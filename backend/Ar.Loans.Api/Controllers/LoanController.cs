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
    public class LoanController(ILoanRepo loanRepo, IUserRepo userRepo, TelegramService telegramService, AppConfig appConfig, CurrentUser user, LoanService loanService)
    {
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly IUserRepo _userRepo = userRepo;
        private readonly TelegramService _telegramService = telegramService;
        private readonly AppConfig _appConfig = appConfig;
        private readonly CurrentUser _user = user;
        private readonly LoanService _loanService = loanService;

        [Function("CreateLoan")]
        public async Task<IActionResult> CreateLoan([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "loans")] HttpRequest req)
        {
            var loan = await req.ReadFromJsonAsync<Loan>();
            if (loan == null)
            {
                return new BadRequestObjectResult("Invalid loan data.");
            }

            var result = await _loanService.CreateLoanWithNotificationsAsync(loan);
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
