using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using System;
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

				public async Task<TransactionResult> ExecuteCreateEntryAndSave(Entry dto)
				{
						await CreateEntry(dto);
						await AdjustAccountBalance(dto.CreditId, dto.Amount, false, true);
						await AdjustAccountBalance(dto.DebitId, dto.Amount, true, true);

						var accounts = _context.ChangeTracker.Entries<Account>()
							.Where(e => e.State == EntityState.Modified || e.State == EntityState.Added)
							.Select(e => e.Entity).ToList();

						await _context.SaveChangesAsync();
						return new TransactionResult { Entry = dto, Accounts = accounts };
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

				public async Task<TransactionResult?> DeleteEntry(Guid id)
				{
						var entry = await _context.Entries.FindAsync(id);
						if (entry == null) return null;

						// 1. Revert Account Balances
						await AdjustAccountBalance(entry.DebitId, entry.Amount, true, false);
						await AdjustAccountBalance(entry.CreditId, entry.Amount, false, false);

						Loan? updatedLoan = null;

						// 2. If it's a loan entry, update the loan balance and remove from transactions list
						if (entry.LoanId.HasValue)
						{
								var loan = await _context.Loans.FindAsync(entry.LoanId.Value);
								if (loan != null)
								{
										var tx = loan.Transactions.FirstOrDefault(t => t.LedgerId == id);
										if (tx != null)
										{
												if (tx.Type == "interest" || tx.Type == "penalty")
												{
														loan.Balance -= tx.Amount;
												}
												else if (tx.Type == "payment")
												{
														loan.Balance += tx.Amount;
												}
												loan.Transactions.Remove(tx);

												// Recalculate NextInterestDate based on remaining transactions
												var lastInterest = loan.Transactions
														.Where(t => t.Type == "interest" || t.Type == "penalty")
														.OrderByDescending(t => t.EndDate)
														.FirstOrDefault();

												loan.NextInterestDate = lastInterest != null ? lastInterest.EndDate : loan.Date;
										}
										if(loan.Balance > 0)
										{
												loan.Status = "Active";
										}
										_context.Loans.Update(loan);
										updatedLoan = loan;
								}
						}

						_context.Entries.Remove(entry);

						var accounts = _context.ChangeTracker.Entries<Account>()
							.Where(e => e.State == EntityState.Modified)
							.Select(e => e.Entity).ToList();

						await _context.SaveChangesAsync();

						return new TransactionResult 
						{ 
							DeletedEntryIds = new List<Guid> { id },
							Loan = updatedLoan!,
							Accounts = accounts
						};
				}
		}
}
