using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Services
{
    public class LoanService
    {
        private readonly ILoanRepo _loanRepo;
        private readonly IUserRepo _userRepo;
        private readonly TelegramService _telegramService;
        private readonly AppConfig _appConfig;
        private readonly ILogger<LoanService> _logger;

        public LoanService(
            ILoanRepo loanRepo,
            IUserRepo userRepo,
            TelegramService telegramService,
            AppConfig appConfig,
            ILogger<LoanService> logger)
        {
            _loanRepo = loanRepo;
            _userRepo = userRepo;
            _telegramService = telegramService;
            _appConfig = appConfig;
            _logger = logger;
        }

        public async Task<TransactionResult> CreateLoanWithNotificationsAsync(Loan loan)
        {
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
                                     (tx.Type == "interest" ? "" : "*Type*: Penalty\n") +
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
                _logger.LogError(ex, "Error sending Telegram notification for loan {LoanId}", result.Loan?.Id);
            }

            return result;
        }
    }
}
