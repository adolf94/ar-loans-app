using System;
using System.Threading.Tasks;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Functions
{
    public class InterestTimerFunction
    {
        private readonly ILoanRepo _loanRepo;
        private readonly ILogger _logger;

        public InterestTimerFunction(ILoanRepo loanRepo, ILoggerFactory loggerFactory)
        {
            _loanRepo = loanRepo;
            _logger = loggerFactory.CreateLogger<InterestTimerFunction>();
        }

        [Function("InterestTimerFunction")]
        public async Task Run([TimerTrigger("0 0 16 * * *")] TimerInfo myTimer)
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
                    await _loanRepo.AccrueInterest(loan, referenceDateUTC8);
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
