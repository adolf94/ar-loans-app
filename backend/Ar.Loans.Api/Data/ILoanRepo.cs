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
				Task<Loan> CreateLoan(Loan loan);
        Task<List<Loan>> GetLoansPendingInterest(DateTime referenceDateUTC8);
        Task AccrueInterest(Loan loan, DateTime referenceDateUTC8);
        Task RecordPayment(Payment payment);
				public Task<List<Loan>> GetAllLoans();
				public Task<List<Loan>> GetGuaranteedLoans(Guid id);
				public Task<List<Loan>> GetUserLoans(Guid id);


		}
}
