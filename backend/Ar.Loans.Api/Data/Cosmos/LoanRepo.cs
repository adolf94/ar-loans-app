using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
		public class LoanRepo : ILoanRepo
		{
				private readonly AppDbContext _context;
				private readonly IEntryRepo _entry;

				public LoanRepo(AppDbContext context, IEntryRepo entry)
				{
						_context = context;
						_entry = entry;
				}

				public async Task<Loan> CreateLoan(Loan loan)
				{


						if (string.IsNullOrEmpty(loan.AlternateId))
						{
								string loanAltId = $"{loan.Date:yyMMdd}-{loan.Date:dd}-{loan.Id.ToString()[^4..]}";
								loan.AlternateId = loanAltId;
						}


						// 1. Initial Principal Disbursement
						var principalEntryId =  Guid.CreateVersion7();
						var principalEntry = new Entry
						{
								Id = principalEntryId,
								Description = $"Loan Principal Disbursement ({loan.AlternateId})",
								DebitId = AccountConstants.LoanReceivables,
								CreditId = loan.SourceAcct,
								Amount = loan.Principal,
								Date = loan.Date,
								FileId = loan.FileId,
								AddedBy = Guid.Empty
						};

						loan.Transactions.Add(new LoanLedger
						{
								LedgerId = principalEntryId,
								AltKey = $"principal|{loan.Date:yyyy-MM-dd}",
								Type = "principal",
								Amount = loan.Principal,
								DateStart = loan.Date,
								EndDate = loan.Date
						});

						_context.Entries.Add(principalEntry);

						// Synchronize Account Balances
						await _entry.AdjustAccountBalance(principalEntry.DebitId, principalEntry.Amount, true, true);
						await _entry.AdjustAccountBalance(principalEntry.CreditId, principalEntry.Amount, false, true);

						// Initialize Balance and Dates for interest loop
						loan.Balance = loan.Principal;
						loan.NextInterestDate = loan.Date; 
						loan.Status = "Active";

						// 2. Accrue initial and catch-up interest
						// We pass Today (UTC+8) to catch up all periods including the current one
						DateTime referenceDateUTC8 = DateTime.UtcNow.AddHours(8);
						await AccrueInterestInternal(loan, referenceDateUTC8, true	);

						_context.Loans.Add(loan);
						await _context.SaveChangesAsync();
						return loan;
				}

				public async Task<List<Loan>> GetLoansPendingInterest(DateTime referenceDateUTC8)
				{
						var refDate = DateOnly.FromDateTime(referenceDateUTC8);
						// Checks if the NextInterestDate + 1 day has passed
						return await _context.Loans
								.Where(l => l.Status == "Active" && l.NextInterestDate.AddDays(1) <= refDate)
								.ToListAsync();
				}

				public async Task<List<Loan>> GetAllLoans()
				{
						return await _context.Loans.ToListAsync();
				}


				public async Task<List<Loan>> GetGuaranteedLoans(Guid id)
				{
						var q = await _context.Loans.Where(e => e.GuarantorId == id).ToListAsync();
						return q;
				}


				public async Task<List<Loan>> GetUserLoans(Guid id)
				{
						var q = await _context.Loans.Where(e => e.ClientId == id).ToListAsync();
						return q;
				}


				public async Task AccrueInterest(Loan loan, DateTime referenceDateUTC8)
				{
						await AccrueInterestInternal(loan, referenceDateUTC8, true);
						_context.Loans.Update(loan);
						await _context.SaveChangesAsync();
				}

				public async Task RecordPayment(Payment payment)
				{
						var loan = await _context.Loans.FirstOrDefaultAsync(l => l.Id == payment.LoanId);
						var client = await _context.Users.FirstOrDefaultAsync(l => l.Id == payment.UserId);
						if (loan == null) throw new Exception("Loan not found");

						// 1. Identify entries to remove (those after payment date)
						var futureTransactions = loan.Transactions
								.Where(t => t.DateStart > payment.Date)
								.ToList();

						if (futureTransactions.Any())
						{
								// Backdated Payment Logic: Rebuild state
								foreach (var tx in futureTransactions)
								{
										// Remove from Balance if it was an interest accrual
										if (tx.Type == "interest")
										{
												loan.Balance -= tx.Amount;
										}
										
										// Remove the Entry and the Ledger record
										var entry = await _context.Entries.FindAsync(tx.LedgerId);
										if (entry != null)
										{
												// Synchronize Account Balances (Remove)
												await _entry.AdjustAccountBalance(entry.DebitId, entry.Amount, true, false);
												await _entry.AdjustAccountBalance(entry.CreditId, entry.Amount, false, false);
												
												_context.Entries.Remove(entry);
										}
										loan.Transactions.Remove(tx);
								}

								// Reset NextInterestDate to the earliest removed date start or keep current if none removed
								loan.NextInterestDate = futureTransactions.Min(t => t.DateStart);
						}

						// 2. Record the Payment
						var paymentEntryId = Guid.CreateVersion7();
						var paymentEntry = new Entry
						{
								Id = paymentEntryId,
								Description = $"Loan Payment ({loan.AlternateId}) - {client.Name}",
								DebitId = payment.DestinationAcctId, // The account where money goes
								CreditId = AccountConstants.LoanReceivables,
								Date = payment.Date,
								Amount = payment.Amount,
								FileId = payment.FileId,
								AddedBy = Guid.Empty
						};

						loan.Transactions.Add(new LoanLedger
						{
								LedgerId = paymentEntryId,
								AltKey = $"payment|{payment.Date:yyyy-MM-dd}|{paymentEntryId.ToString().Substring(0,4)}",
								Type = "payment",
								Amount = payment.Amount,
								DateStart = payment.Date,
								EndDate = payment.Date
						});

						loan.Balance -= payment.Amount;
						_context.Entries.Add(paymentEntry);
						_context.Payment.Add(payment);

						// Synchronize Account Balances for Payment
						await _entry.AdjustAccountBalance(paymentEntry.DebitId, paymentEntry.Amount, true, true);
						await _entry.AdjustAccountBalance(paymentEntry.CreditId, paymentEntry.Amount, false, true);

						// 3. Re-accrue interest from the reset point to Today
						DateTime referenceDateUTC8 = DateTime.UtcNow.AddHours(8);
						await AccrueInterestInternal(loan, referenceDateUTC8, true);

						if (loan.Balance <= 0)
						{
								loan.Status = "Paid";
						}

						_context.Loans.Update(loan);
						await _context.SaveChangesAsync();
				}

				private async Task AccrueInterestInternal(Loan loan, DateTime referenceDateUTC8, bool saveEntries)
				{
						// Accrue for every date where NextInterestDate + 1 day buffer has passed
						while (loan.NextInterestDate.AddDays(1).ToDateTime(new TimeOnly(8,0)) <= referenceDateUTC8)
								
						{
								if (loan.Balance <= 0)
								{
										loan.Status = "Paid";
										break;
								}
								
								if (loan.Transactions.Count > 100) break;

								// Interest Factor: Principal or Remaining Balance, whichever is lower
								decimal factor = loan.Principal; //Math.Min(loan.Balance, loan.Principal);
								decimal monthlyInterest = factor * (loan.InterestRate / 100);

								if (monthlyInterest <= 0) break;

								var entryId = Guid.CreateVersion7(); 
								var startDate = loan.NextInterestDate;
								var endDate = startDate.AddMonths(1);

								var entry = new Entry
								{
										Id = entryId,
										Description = $"Interest Accrual ({loan.AlternateId}) - {startDate:yyyy-MM-dd}",
										DebitId = AccountConstants.LoanReceivables,
										CreditId = AccountConstants.InterestIncome,
										Amount = monthlyInterest,
										Date =startDate,
										AddedBy = Guid.Empty
								};

								loan.Transactions.Add(new LoanLedger
								{
										LedgerId = entryId,
										AltKey = $"interest|{startDate:yyyy-MM-dd}",
										Type = "interest",
										Amount = monthlyInterest,
										DateStart = startDate,
										EndDate = endDate
								});

								loan.Balance += monthlyInterest;
								loan.NextInterestDate = endDate;

								if (saveEntries)
								{
										_context.Entries.Add(entry);
										// Synchronize Account Balances
										await _entry.AdjustAccountBalance(entry.DebitId, entry.Amount, true, true);
										await _entry.AdjustAccountBalance(entry.CreditId, entry.Amount, false, true);
								}
						}
						
						await Task.CompletedTask;
				}

		}
}
