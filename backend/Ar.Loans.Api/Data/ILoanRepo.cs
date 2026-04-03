using Ar.Loans.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
		public interface ILoanRepo
		{
				Task<TransactionResult> CreateLoan(Loan loan);
        Task<List<Loan>> GetLoansPendingInterest(DateTime referenceDateUTC8);
        Task<List<LoanLedger>> AccrueInterest(Loan loan, DateTime referenceDateUTC8);
        Task<TransactionResult> RecordPayment(Payment payment);
        Task<TransactionResult> DeletePayment(Guid paymentId);
        Task<Payment?> GetPaymentByLedgerId(Guid ledgerId);
				public Task<List<Loan>> GetActiveLoans();
				public Task<List<Loan>> GetAllLoans();
				public Task<List<Loan>> GetGuaranteedLoans(Guid id);
				public Task<List<Loan>> GetUserLoans(Guid id);
				Task<Loan?> DeleteLoan(Guid id);
				Task<TransactionResult> RebalanceInterestRealizations(Loan loan);
				Task UpdateLoan(Loan loan);


		}
}
