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
    public class PaymentController(ILoanRepo loanRepo, IUserRepo userRepo, TelegramService telegramService, AppConfig appConfig, CurrentUser user)
    {
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly IUserRepo _userRepo = userRepo;
        private readonly TelegramService _telegramService = telegramService;
        private readonly AppConfig _appConfig = appConfig;
        private readonly CurrentUser _user = user;

        [Function("RecordPayment")]
        public async Task<IActionResult> RecordPayment([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "payments")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var payment = await req.ReadFromJsonAsync<Payment>();
            if (payment == null)
            {
                return new BadRequestObjectResult("Invalid payment data.");
            }

            try
            {
                var result = await _loanRepo.RecordPayment(payment);

                // Send Telegram Notification
                try
                {
                    var client = await _userRepo.GetUser(result.Loan.ClientId);
                    var runningBalance = result.Loan.Balance - result.NewTransactions.Sum(t => t.Amount);

                    var paymentMsg = $"🏦 *Payment Received*\n" +
                                     $"*ID*: {result.Loan.AlternateId}\n" +
                                     $"*Name*: {result.ClientName ?? "Unknown"}\n" +
                                     $"*Amount*: {payment.Amount:N2}\n" +
                                     $"*Balance*: {runningBalance:N2}";

                    var messageId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, paymentMsg);

                    if (messageId.HasValue)
                    {
                        // Update matching ledger record for the payment
                        var ledgerItem = result.Loan.Transactions.FirstOrDefault(t => t.LedgerId == result.Entries.FirstOrDefault(e => e.CreditId == AccountConstants.LoanReceivables)?.Id);
                        if (ledgerItem != null)
                        {
                            ledgerItem.TelegramMessageId = messageId;
                            await _loanRepo.UpdateLoan(result.Loan);
                        }
                    }

                    // Send notifications for any re-accrued interest
                    if (result.NewTransactions != null && result.NewTransactions.Any())
                    {
                        bool hasNewTelegramIds = false;
                        foreach (var tx in result.NewTransactions)
                        {
                            runningBalance += tx.Amount;
                            var msg = $"📈 *New Interest Accrued*\n" +
                                         $"*ID*: {result.Loan.AlternateId}\n" +
                                         $"*Name*: {result.ClientName ?? "Unknown"}\n" +
                                         $"*Type*: {(tx.Type == "interest" ? "Interest" : "Penalty")}\n" +
                                         $"*Amount*: {tx.Amount:N2}\n" +
                                         $"*Until*: {tx.EndDate:MMM dd}\n" +
                                         $"*Balance*: {runningBalance:N2}";

                            var interestMsgId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, msg);
                            if (interestMsgId.HasValue)
                            {
                                tx.TelegramMessageId = interestMsgId;
                                hasNewTelegramIds = true;
                            }
                        }

                        if (hasNewTelegramIds)
                        {
                            await _loanRepo.UpdateLoan(result.Loan);
                        }
                    }

                    // Strike out deleted messages
                    if (result.DeletedTransactions != null && result.DeletedTransactions.Any())
                    {
                        foreach (var tx in result.DeletedTransactions)
                        {
                            if (tx.TelegramMessageId.HasValue)
                            {
                                // Reconstruct the message to wrap it in a spoiler + strikethrough
                                // Telegram MarkdownV2: || for spoiler, ~ for strike
                                var strikeMsg = "";
                                if (tx.Type == "payment")
                                {
                                    strikeMsg = $"||~🏦 *Payment Received* (Removed)~\n" +
                                                $"~*ID*: {result.Loan.AlternateId}~\n" +
                                                $"~*Name*: {result.ClientName ?? "Unknown"}~\n" +
                                                $"~*Amount*: {tx.Amount:N2}~||\n" +
                                                $"_Payment Record Removed_";
                                }
                                else
                                {
                                    strikeMsg = $"||~📈 *New Interest Accrued* (Deleted)~\n" +
                                                $"~*ID*: {result.Loan.AlternateId}~\n" +
                                                $"~*Name*: {result.ClientName ?? "Unknown"}~\n" +
                                                (tx.Type == "interest" ? "" : $"~*Type*: Penalty~\n") +
                                                $"~*Amount*: {tx.Amount:N2}~\n" +
                                                $"~*Until*: {tx.EndDate:MMM dd}~||\n" +
                                                $"_Deleted/Rebalanced due to backdated payment_";
                                }

                                if (!string.IsNullOrEmpty(strikeMsg))
                                {
                                    await _telegramService.EditMessageAsync(_appConfig.Telegram.GuarantorChannel, tx.TelegramMessageId.Value, strikeMsg);
                                }
                            }
                        }
                    }

                }
                catch (System.Exception ex)
                {
                    System.Console.WriteLine($"Error sending Telegram notification: {ex.Message}");
                }

                return new OkObjectResult(result);
            }
            catch (System.Exception ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
        }

        [Function("DeletePayment")]
        public async Task<IActionResult> DeletePayment([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "payments/{id}")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("admin")) return new ForbidResult();

            var idItem = req.RouteValues["id"]!.ToString();
            if (!Guid.TryParse(idItem, out var paymentId))
            {
                return new BadRequestResult();
            }

            try
            {
                var result = await _loanRepo.DeletePayment(paymentId);

                // Strike out deleted messages
                if (result.DeletedTransactions != null && result.DeletedTransactions.Any())
                {
                    foreach (var tx in result.DeletedTransactions)
                    {
                        if (tx.TelegramMessageId.HasValue)
                        {
                            var strikeMsg = "";
                            if (tx.Type == "payment")
                            {
                                strikeMsg = $"||~🏦 *Payment Received* (Removed)~\n" +
                                            $"~*ID*: {result.Loan.AlternateId}~\n" +
                                            $"~*Name*: {result.ClientName ?? "Unknown"}~\n" +
                                            $"~*Amount*: {tx.Amount:N2}~||\n" +
                                            $"_Payment Record Removed_";
                            }
                            else
                            {
                                strikeMsg = $"||~📈 *New Interest Accrued* (Voided)~\n" +
                                            $"~*ID*: {result.Loan.AlternateId}~\n" +
                                            $"~*Name*: {result.ClientName ?? "Unknown"}~\n" +
                                            (tx.Type == "interest" ? "" : $"~*Type*: Penalty~\n") +
                                            $"~*Amount*: {tx.Amount:N2}~\n" +
                                            $"~*Until*: {tx.EndDate:MMM dd}~||\n" +
                                            $"_Rebalanced due to payment removal_";
                            }

                            if (!string.IsNullOrEmpty(strikeMsg))
                            {
                                await _telegramService.EditMessageAsync(_appConfig.Telegram.GuarantorChannel, tx.TelegramMessageId.Value, strikeMsg);
                            }
                        }
                    }
                }

                // If any NEW interest was re-accrued, notify it
                if (result.NewTransactions != null && result.NewTransactions.Any())
                {
                    decimal currentBal = result.Loan.Balance - result.NewTransactions.Sum(t => t.Amount);
                    bool hasNewTelegramIds = false;
                    foreach (var tx in result.NewTransactions.OrderBy(t => t.EndDate))
                    {
                        currentBal += tx.Amount;
                        var msg = $"📈 *New Interest Accrued*\n" +
                                     $"*ID*: {result.Loan.AlternateId}\n" +
                                     $"*Name*: {result.ClientName ?? "Unknown"}\n" +
                                     (tx.Type == "interest" ? "" : "*Type*: Penalty\n") +
                                     $"*Amount*: {tx.Amount:N2}\n" +
                                     $"*Until*: {tx.EndDate:MMM dd}\n" +
                                     $"*Balance*: {currentBal:N2}";

                        var interestMsgId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, msg);
                        if (interestMsgId.HasValue)
                        {
                            tx.TelegramMessageId = interestMsgId;
                            hasNewTelegramIds = true;
                        }
                    }

                    if (hasNewTelegramIds)
                    {
                        await _loanRepo.UpdateLoan(result.Loan);
                    }
                }
                
                return new OkObjectResult(result);
            }
            catch (Exception ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
        }
    }
}
