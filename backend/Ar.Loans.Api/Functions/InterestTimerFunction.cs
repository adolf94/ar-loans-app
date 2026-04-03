using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Functions
{
    public class InterestTimerFunction
    {
        private readonly ILoanRepo _loanRepo;
        private readonly IUserRepo _userRepo;
        private readonly TelegramService _telegramService;
        private readonly AppConfig _appConfig;
        private readonly ILogger _logger;

        public InterestTimerFunction(
            ILoanRepo loanRepo, 
            IUserRepo userRepo,
            TelegramService telegramService,
            AppConfig appConfig,
            ILoggerFactory loggerFactory)
        {
            _loanRepo = loanRepo;
            _userRepo = userRepo;
            _telegramService = telegramService;
            _appConfig = appConfig;
            _logger = loggerFactory.CreateLogger<InterestTimerFunction>();
        }

        [Function("InterestTimerFunction")]
        public async Task Run([TimerTrigger("0 0 16 * * *", RunOnStartup = true)] TimerInfo myTimer)
        {
            _logger.LogInformation($"InterestTimerFunction executed at: {DateTime.Now}");

            // UTC+8 Reference Date
            DateTime referenceDateUTC8 = DateTime.UtcNow.AddHours(8);

            var loans = await _loanRepo.GetLoansPendingInterest(referenceDateUTC8);
            _logger.LogInformation($"Found {loans.Count} loans pending interest accrual.");

            foreach (var loan in loans)
            {
                try
                {
                    var client = await _userRepo.GetUserById(loan.ClientId);
                    var newTransactions = await _loanRepo.AccrueInterest(loan, referenceDateUTC8);
                    
                    if (newTransactions != null && newTransactions.Any())
                    {
                        bool hasNewTelegramIds = false;
                        var runningBalance = loan.Balance - newTransactions.Sum(t => t.Amount);
                        foreach (var tx in newTransactions)
                        {
                            runningBalance += tx.Amount;
                            var message = new StringBuilder();
                            message.AppendLine("📈 *New Interest Accrued*");
                            message.AppendLine($"*ID*: {loan.AlternateId}");
                            message.AppendLine($"*Name*: {client?.Name ?? "Unknown"}");
                            message.AppendLine($"*Type*: {(tx.Type == "interest" ? "Interest" : "Penalty")}");
                            message.AppendLine($"*Amount*: {tx.Amount:N2}");
                            message.AppendLine($"*Until*: {tx.EndDate:MMM dd}");
                            message.AppendLine($"*Balance*: {runningBalance:N2}");

                            var msgId = await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, message.ToString());
                            if (msgId.HasValue)
                            {
                                tx.TelegramMessageId = msgId;
                                hasNewTelegramIds = true;
                            }
                        }

                        if (hasNewTelegramIds)
                        {
                            await _loanRepo.UpdateLoan(loan);
                        }
                    }

                    _logger.LogInformation($"Accrued interest for loan {loan.Id}");
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Error accruing interest for loan {loan.Id}: {ex.Message}");
                }
            }

            // Summary of Upcoming Accruals
            try
            {
                var activeLoans = await _loanRepo.GetActiveLoans();
                var refDateOnly = DateOnly.FromDateTime(referenceDateUTC8);
                var targetDays = new[] { 0, 1, 3, 7 };
                var summaryList = new List<string>();

                foreach (var loan in activeLoans.OrderBy(l => l.NextInterestDate))
                {
                    var daysRemaining = loan.NextInterestDate.DayNumber - refDateOnly.DayNumber;
                    if (targetDays.Contains(daysRemaining))
                    {
                        var client = await _userRepo.GetUserById(loan.ClientId);
                        // Determine if Grace Period (🛡️) or Regular (⚡)
                        // Simple check: Days from start loan date to next interest date
                        var totalDaysFromStart = loan.NextInterestDate.DayNumber - loan.Date.DayNumber;
                        bool isGrace = totalDaysFromStart <= loan.GracePeriodDays;
                        
                        var typeEmoji = isGrace ? "🛡️" : "⚡";

                        summaryList.Add($"`{daysRemaining,-2}` | {loan.NextInterestDate:MMM dd} | {typeEmoji} | {client?.Name ?? "Unknown"}");
                    }
                }

                if (summaryList.Any())
                {
                    var summaryMsg = new StringBuilder();
                    summaryMsg.AppendLine($"⏳ *Upcoming Interest Accruals Summary* - {referenceDateUTC8:MMM dd, yyyy}");
                    summaryMsg.AppendLine("`Days` | `Day   ` | ` ` | `Client` ");
                    summaryMsg.AppendLine("-----------------------------");
                    foreach (var line in summaryList)
                    {
                        summaryMsg.AppendLine(line);
                    }
                    
                    await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, summaryMsg.ToString());
                }
            }
            catch (Exception ex)
            {
                await _telegramService.SendMessageAsync(_appConfig.Telegram.GuarantorChannel, $"Error generating interest summary");
                _logger.LogError($"Error generating interest summary: {ex.Message}");
            }
        }
    }
}
