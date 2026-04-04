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

                            // Direct Notification to Client
                            if (client != null && !string.IsNullOrWhiteSpace(client.TelegramId))
                            {
                                bool isGrace = (tx.DateStart == loan.Date) || loan.RecurringGracePeriod;
                                var emoji = isGrace ? "🛡️" : "📈";
                                var title = isGrace ? (tx.Type == "interest" ? "Grace Interest Accrued" : "Grace Penalty Applied") 
                                                    : (tx.Type == "interest" ? "Interest Accrued" : "Penalty Applied");

                                var userMsg = new StringBuilder();
                                userMsg.AppendLine($"{emoji} *{title}*");
                                userMsg.AppendLine($"Loan ID: {loan.AlternateId}");
                                userMsg.AppendLine($"Amount: {tx.Amount:N2}");
                                userMsg.AppendLine($"Balance: {runningBalance:N2}");
                                userMsg.AppendLine();
                                userMsg.AppendLine($"_This amount covers the period from {tx.DateStart:MMM dd} until {tx.EndDate:MMM dd, yyyy}._");

                                if (isGrace && !loan.RecurringGracePeriod)
                                {
                                    userMsg.AppendLine();
                                    userMsg.AppendLine($"🔔 *Grace Period Ended*: Your one-time grace period has concluded with this accrual. Starting next month, the regular interest rate of *{loan.InterestRate:N2}%* will apply.");
                                }
                                
                                var userMsgId = await _telegramService.SendMessageAsync(client.TelegramId, userMsg.ToString());
                                if (userMsgId.HasValue)
                                {
                                    tx.UserMessageId = $"{client.TelegramId}|{userMsgId.Value}";
                                    hasNewTelegramIds = true;
                                }
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
        }
    }
}
