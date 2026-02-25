using Ar.Loans.Api.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
		public class BankAccountRepo : IBankAccountRepo
		{
				private readonly AppDbContext _context;

				public BankAccountRepo(AppDbContext context)
				{
						_context = context;
						
				}

				public async Task<UserBankAccount?> GetByAccountId(string accountId)
				{
						char[] targets = { '*', '.' };
						bool isMasked = accountId.Any(c => targets.Contains(c));
						var match = Regex.Match(accountId, @"[^*.]+$");
						string lastDigits = "";
						if (match.Success)
						{
								lastDigits = match.Value; 
						}

						var items = await _context.BankAccounts.Where(e => e.AccountNumber == accountId || e.AccountNumber.EndsWith(lastDigits))
								.ToArrayAsync();


						var sortedResults = items
								.OrderByDescending(e => e.AccountNumber == accountId)
								.ThenBy(e => e.AccountNumber)
								.ToList();

						var item = sortedResults.FirstOrDefault();

						return item;

				}

				public async Task<UserBankAccount?> GetByExactAccountId(string accountId)
				{

						var item = await _context.BankAccounts.Where(e => e.AccountNumber == accountId)
								.FirstOrDefaultAsync();

						return item;

				}
				public async Task CreateBankAccount(UserBankAccount acct)
				{

						var item = await _context.BankAccounts.AddAsync(acct);

				}
		}
}
