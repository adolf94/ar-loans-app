using Ar.Loans.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
		public interface IBankAccountRepo
		{
				public Task<UserBankAccount?> GetByAccountId(string accountId);
				public Task<UserBankAccount?> GetByExactAccountId(string accountId);

				public Task CreateBankAccount(UserBankAccount acct);

		}
}
