using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class EntryController(IEntryRepo entryRepo, ILoanRepo loanRepo, IDbHelper db, CurrentUser user, Ar.Loans.Api.Services.TelegramService telegramService, AppConfig appConfig)
    {
        private readonly IEntryRepo _entryRepo = entryRepo;
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly IDbHelper _db = db;
        private readonly CurrentUser _user = user;
        private readonly Ar.Loans.Api.Services.TelegramService _telegramService = telegramService;
        private readonly AppConfig _appConfig = appConfig;

        [Function("GetAllEntries")]
        public async Task<IActionResult> GetAllEntries([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "entries")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var entries = await _entryRepo.GetAllEntries();
            return new OkObjectResult(entries);
        }

        [Function("CreateEntry")]
        public async Task<IActionResult> CreateEntry([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "entries")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();

            var dto = await req.ReadFromJsonAsync<Entry>();
            if (dto == null) return new BadRequestResult();

            var result = await _entryRepo.ExecuteCreateEntryAndSave(dto);
            return new OkObjectResult(result);
        }

        [Function("DeleteEntry")]
        public async Task<IActionResult> DeleteEntry([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "entries/{id}")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("admin")) return new ForbidResult();

            var idItem = req.RouteValues["id"]!.ToString();
            if (!Guid.TryParse(idItem, out var entryId))
            {
                return new BadRequestResult();
            }

            // Check if this entry is a loan payment
            var payment = await _loanRepo.GetPaymentByLedgerId(entryId);
            TransactionResult? result = null;

            if (payment != null)
            {
                // Reroute to specialized payment deletion logic
                result = await _loanRepo.DeletePayment(payment.Id);

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
            }
            else
            {
                // Standard entry deletion
                result = await _entryRepo.DeleteEntry(entryId);
                
                // Orchestrate: If a loan's payments were affected, rebalance realizations
                if (result != null && result.Loan != null)
                {
                    var additionalResult = await _loanRepo.RebalanceInterestRealizations(result.Loan);

                    // Merge into result
                    if (additionalResult != null)
                    {
                        foreach (var acc in additionalResult.Accounts)
                        {
                            if (!result.Accounts.Any(a => a.Id == acc.Id)) result.Accounts.Add(acc);
                        }
                        foreach (var dId in additionalResult.DeletedEntryIds)
                        {
                            if (!result.DeletedEntryIds.Contains(dId)) result.DeletedEntryIds.Add(dId);
                        }
                    }
                }
            }

            return new OkObjectResult(result);
        }

    }
}
