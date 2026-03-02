using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class EntryRepo : IEntryRepo
    {
        private readonly AppDbContext _context;

        public EntryRepo(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Entry>> GetAllEntries()
        {
            return await _context.Entries
                .OrderByDescending(e => e.Id)
                .ToListAsync();
        }

				public async Task CreateEntry(Entry entry)
				{
						await _context.Entries.AddAsync(entry);
				}

				public async Task AdjustAccountBalance(Guid accountId, decimal amount, bool isDebit, bool isAdding)
				{
						var account = await _context.Accounts.FindAsync(accountId);
						if (account == null) return;

						// Simplified Rule: Debit is positive (+), Credit is negative (-)
						// Regardless of the account section (Assets, Income, etc.)
						decimal delta = isDebit ? amount : -amount;

						// If we are removing an entry, flip the sign
						if (!isAdding)
						{
								delta = -delta;
						}

						account.Balance += delta;
						_context.Accounts.Update(account);
				}

				public async Task DeleteEntry(Guid id)
				{
						var entry = await _context.Entries.FindAsync(id);
						if (entry == null) return;

						// 1. Revert Account Balances
						await AdjustAccountBalance(entry.DebitId, entry.Amount, true, false);
						await AdjustAccountBalance(entry.CreditId, entry.Amount, false, false);

						// 2. If it's a loan entry, update the loan balance and remove from transactions list
						if (entry.LoanId.HasValue)
						{
								var loan = await _context.Loans.FindAsync(entry.LoanId.Value);
								if (loan != null)
								{
										var tx = loan.Transactions.FirstOrDefault(t => t.LedgerId == id);
										if (tx != null)
										{
												if (tx.Type == "interest")
												{
														loan.Balance -= tx.Amount;
												}
												else if (tx.Type == "payment")
												{
														loan.Balance += tx.Amount;
												}
												loan.Transactions.Remove(tx);
										}
										_context.Loans.Update(loan);
								}
						}

						_context.Entries.Remove(entry);
				}
		}
}
