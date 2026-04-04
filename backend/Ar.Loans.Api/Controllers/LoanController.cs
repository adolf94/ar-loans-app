using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Ar.Loans.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;
using System.Linq;
using System;

namespace Ar.Loans.Api.Controllers
{
    public class LoanController(ILoanRepo loanRepo, IUserRepo userRepo, TelegramService telegramService, AppConfig appConfig, CurrentUser user)
    {
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly IUserRepo _userRepo = userRepo;
        private readonly TelegramService _telegramService = telegramService;
        private readonly AppConfig _appConfig = appConfig;
        private readonly CurrentUser _user = user;

        [Function("CreateLoan")]
        public async Task<IActionResult> CreateLoan([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "loans")] HttpRequest req)
        {
            var loan = await req.ReadFromJsonAsync<Loan>();
            if (loan == null)
            {
                return new BadRequestObjectResult("Invalid loan data.");
            }

            var result = await _loanRepo.CreateLoan(loan);

            // Send Telegram Notification
            try
            {
                var client = await _userRepo.GetUser(result.Loan!.ClientId);
                var ratePart = result.Loan.GracePeriodInterest > 0 ? $"(P{result.Loan.GracePeriodDays} - {result.Loan.GracePeriodInterest}%)" : "";
                var rateMsg = $"{result.Loan.InterestRate}% {ratePart}";

                var message = $"🏦 *New Loan Created*\n" +
                              $"*ID*: {result.Loan.AlternateId}\n" +
                              $"*Name*: {client?.Name ?? "Unknown"}\n" +
							  $"*Date*: {result.Loan.Date}\n" +
                              $"*Amount*: {result.Loan.Principal:N2}\n" +
                              $"*Rate*: {rateMsg}";

                var messageId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, message);

                if (messageId.HasValue)
                {
                    // Update the matching ledger record in the loan transactions
                    var ledgerItem = result.Loan.Transactions.FirstOrDefault(t => t.Type == "principal");
                    if (ledgerItem != null)
                    {
                        ledgerItem.TelegramMessageId = messageId;
                        await _loanRepo.UpdateLoan(result.Loan);
                    }
                }

                // Notify User Directly
                if (client != null && !string.IsNullOrWhiteSpace(client.TelegramId))
                {
                    var userMessage = $"🏦 *New Loan Created*\n" +
                                      $"Hello {client.Name},\n\n" +
                                      $"A new loan has been registered under your account:\n" +
                                      $"*ID*: {result.Loan.AlternateId}\n" +
                                      $"*Date*: {result.Loan.Date}\n" +
                                      $"*Principal*: {result.Loan.Principal:N2}\n" +
                                      $"*Interest Rate*: {rateMsg}\n\n" +
                                      $"_Thank you for your business!_";
                    var userMsgId = await _telegramService.SendMessageAsync(client.TelegramId, userMessage);
                    if (userMsgId.HasValue)
                    {
                        var ledgerItem = result.Loan.Transactions.FirstOrDefault(t => t.Type == "principal");
                        if (ledgerItem != null)
                        {
                            ledgerItem.UserMessageId = $"{client.TelegramId}|{userMsgId.Value}";
                            await _loanRepo.UpdateLoan(result.Loan);
                        }
                    }
                }

                // Send notifications for any newly accrued interest/penalties during creation
                if (result.NewTransactions != null && result.NewTransactions.Any())
                {
                    bool hasNewTelegramIds = false;
                    var runningBalance = result.Loan.Balance - result.NewTransactions.Sum(t => t.Amount);
                    foreach (var tx in result.NewTransactions)
                    {
                        runningBalance += tx.Amount;
                        var msg = $"📈 *New Interest Accrued*\n" +
                                     $"*ID*: {result.Loan.AlternateId}\n" +
                                     $"*Name*: {client?.Name ?? "Unknown"}\n" +
                                     ( tx.Type == "interest" ? "": "*Type*: Penalty\n") +
                                     $"*Amount*: {tx.Amount:N2}\n" +
                                     $"*Until*: {tx.EndDate:MMM dd}\n" +
                                     $"*Balance*: {runningBalance:N2}\n";

                        var interestMsgId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, msg);
                        if (interestMsgId.HasValue)
                        {
                            tx.TelegramMessageId = interestMsgId;
                            hasNewTelegramIds = true;
                        }

                        // Notify User Directly
                        if (client != null && !string.IsNullOrWhiteSpace(client.TelegramId))
                        {
                            var userIntTitle = tx.Type == "interest" ? "Interest Accrued" : "Penalty Applied";
                            var userIntMsg = $"📈 *{userIntTitle}*\n" +
                                             $"Loan ID: {result.Loan.AlternateId}\n" +
                                             $"Amount: {tx.Amount:N2}\n" +
                                             $"Balance: {runningBalance:N2}\n" +
                                             $"_For period until {tx.EndDate:MMM dd}_";
                            var userIntMsgId = await _telegramService.SendMessageAsync(client.TelegramId, userIntMsg);
                            if (userIntMsgId.HasValue)
                            {
                                tx.UserMessageId = $"{client.TelegramId}|{userIntMsgId.Value}";
                                hasNewTelegramIds = true;
                            }
                        }
                    }

                    if (hasNewTelegramIds)
                    {
                        await _loanRepo.UpdateLoan(result.Loan);
                    }
                }
            }
            catch (Exception ex)
            {
                // We don't want to fail the whole request if notification fails
                // but we should log it
                Console.WriteLine($"Error sending Telegram notification: {ex.Message}");
            }

            return new OkObjectResult(result);
        }

        [Function("GetAllLoans")]
        public async Task<IActionResult> GetAllLoans([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "loans")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var loans = await _loanRepo.GetAllLoans();
            return new OkObjectResult(loans);
        }

        [Function("GetLoansAsGuarantor")]
        public async Task<IActionResult> GetLoansAsGuarantor([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "guarantor/{userId}/loans")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor")) return new ForbidResult();
            var userIdItem = req.RouteValues["userId"]!.ToString();
            Guid userId;
            if (!Guid.TryParse(userIdItem, out userId))
            {
                return new BadRequestResult();
            }

            var loans = await _loanRepo.GetGuaranteedLoans(userId);
            return new OkObjectResult(loans);
        }

        [Function("GetLoansAsClient")]
        public async Task<IActionResult> GetLoansAsClient([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/{userId}/loans")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            var userIdItem = req.RouteValues["userId"]!.ToString();
            Guid userId;
            if (!Guid.TryParse(userIdItem, out userId))
            {
                return new BadRequestResult();
            }

            var loans = await _loanRepo.GetUserLoans(userId);
            return new OkObjectResult(loans);
        }

        [Function("DeleteLoan")]
        public async Task<IActionResult> DeleteLoan([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "loans/{id}")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("admin")) return new ForbidResult();

            var idItem = req.RouteValues["id"]!.ToString();
            if (!Guid.TryParse(idItem, out var loanId))
            {
                return new BadRequestResult();
            }

            var loan = await _loanRepo.DeleteLoan(loanId);

            if (loan != null)
            {
                var client = await _userRepo.GetUser(loan.ClientId);
                // Send strikethrough for all Telegram messages in the ledger
                foreach (var tx in loan.Transactions)
                {
                    if (tx.TelegramMessageId.HasValue)
                    {
                        var strikeMsg = "";
                        var userStrikeMsg = "";
                        if (tx.Type == "principal")
                        {
                            strikeMsg = $"||~🏦 *New Loan Created* (Deleted)~\n" +
                                        $"~*ID*: {loan.AlternateId}~\n" +
                                        $"~*Name*: {client?.Name ?? "Unknown"}~\n" +
                                        $"~*Amount*: {loan.Principal:N2}~||\n" +
                                        $"_Loan Record Deleted_";

                            userStrikeMsg = $"||~Loan Deleted~\n" +
                                            $"~ID: {loan.AlternateId}~\n" +
                                            $"~amount:{loan.Principal:N2}~||";
                        }
                        else if (tx.Type == "payment")
                        {
                            strikeMsg = $"||~🏦 *Payment Received* (Removed)~\n" +
                                        $"~*ID*: {loan.AlternateId}~\n" +
                                        $"~*Name*: {client?.Name ?? "Unknown"}~\n" +
                                        $"~*Amount*: {tx.Amount:N2}~||\n" +
                                        $"_Payment Record Removed_";

                            userStrikeMsg = $"||~Payment~\n" +
                                            $"~ID: {loan.AlternateId}~\n" +
                                            $"~amount:{tx.Amount:N2}~||";
                        }
                        else
                        {
                            strikeMsg = $"||~📈 *New Interest Accrued* (Voided)~\n" +
                                        $"~*ID*: {loan.AlternateId}~\n" +
                                        $"~*Name*: {client?.Name ?? "Unknown"}~\n" +
                                        (tx.Type == "interest" ? "" : $"~*Type*: Penalty~\n") +
                                        $"~*Amount*: {tx.Amount:N2}~\n" +
                                        $"~*Until*: {tx.EndDate:MMM dd}~||\n" +
                                        $"_Interest Voided_";

                            userStrikeMsg = $"||~Interest~\n" +
                                            $"~ID: {loan.AlternateId}~\n" +
                                            $"~amount:{tx.Amount:N2}~||";
                        }

                        if (!string.IsNullOrEmpty(strikeMsg))
                        {
                            await _telegramService.EditMessageAsync(_appConfig.Telegram.GuarantorChannel, tx.TelegramMessageId.Value, strikeMsg);

                            // Also update User Direct Message
                            if (!string.IsNullOrEmpty(tx.UserMessageId))
                            {
                                var parts = tx.UserMessageId.Split('|');
                                if (parts.Length == 2 && long.TryParse(parts[1], out var uMsgId))
                                {
                                    await _telegramService.EditMessageAsync(parts[0], uMsgId, userStrikeMsg);
                                }
                            }
                        }
                    }
                }
            }

            return new OkResult();
        }


    }
}
