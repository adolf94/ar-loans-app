using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
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
        private readonly CurrentUser _user;

        public LoanRepo(AppDbContext context, IEntryRepo entry, CurrentUser user)
        {
            _context = context;
            _entry = entry;
            _user = user;
        }

        public async Task<TransactionResult> CreateLoan(Loan loan)
        {
            var client = await _context.Users.FirstOrDefaultAsync(l => l.Id == loan.ClientId);

            if (string.IsNullOrEmpty(loan.AlternateId))
            {
                string loanAltId = $"{loan.Date:yyMMdd}-{loan.Date:dd}-{loan.Id.ToString()[^4..]}";
                loan.AlternateId = loanAltId;
            }


            // 1. Initial Principal Disbursement
            var principalEntryId = Guid.CreateVersion7();
            var principalEntry = new Entry
            {
                Id = principalEntryId,
                Description = $"Loan Principal Disbursement ({loan.AlternateId}) - {client!.Name}",
                DebitId = AccountConstants.LoanReceivables,
                CreditId = loan.SourceAcct,
                Amount = loan.Principal,
                Date = loan.Date,
                FileId = loan.FileId,
                AddedBy = _user.UserId,
                LoanId = loan.Id,
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
            await AccrueInterestInternal(loan, referenceDateUTC8, true);

            _context.Loans.Add(loan);

            var accounts = _context.ChangeTracker.Entries<Account>()
                .Where(e => e.State == EntityState.Modified || e.State == EntityState.Added)
                .Select(e => e.Entity).ToList();
            var entries = _context.ChangeTracker.Entries<Entry>()
                .Where(e => e.State == EntityState.Modified || e.State == EntityState.Added)
                .Select(e => e.Entity).ToList();

            await _context.SaveChangesAsync();
            return new TransactionResult { Loan = loan, Accounts = accounts, Entries = entries };
        }

        public async Task<List<Loan>> GetLoansPendingInterest(DateTime referenceDateUTC8)
        {
            var refDate = DateOnly.FromDateTime(referenceDateUTC8).AddDays(-1);
            // Checks if the NextInterestDate + 1 day has passed
            return await _context.Loans
                   .Where(l => l.Status == "Active" && l.NextInterestDate <= refDate)
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

        public async Task<TransactionResult> RecordPayment(Payment payment)
        {
            var loan = await _context.Loans.FirstOrDefaultAsync(l => l.Id == payment.LoanId);
            var client = await _context.Users.FirstOrDefaultAsync(l => l.Id == payment.UserId);
            if (loan == null) throw new Exception("Loan not found");

            // 1. Identify entries to remove (those after payment date)
            var futureTransactions = loan.Transactions
                    .Where(t => t.DateStart > payment.Date)
                    .ToList();

            var deletedEntryIds = new List<Guid>();

            if (futureTransactions.Any())
            {
                // Backdated Payment Logic: Rebuild state
                foreach (var tx in futureTransactions)
                {
                    deletedEntryIds.Add(tx.LedgerId);
                    // Remove from Balance if it was an interest accrual or penalty
                    if (tx.Type == "interest" || tx.Type == "penalty")
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

                // Reset NextInterestDate to the end of the last remaining interest transaction (or loan.Date if none)
                var lastInterest = loan.Transactions
                        .Where(t => t.Type == "interest" || t.Type == "penalty")
                        .OrderByDescending(t => t.EndDate)
                        .FirstOrDefault();

                loan.NextInterestDate = lastInterest != null ? lastInterest.EndDate : loan.Date;
            }

            decimal oldBalance = loan.Balance;
            loan.Balance -= payment.Amount;

            // 2. Record the Payment
            var paymentEntryId = Guid.CreateVersion7();
            var paymentEntry = new Entry
            {
                Id = paymentEntryId,
                Description = $"Loan Payment ({loan.AlternateId}) - {client!.Name}",
                DebitId = payment.DestinationAcctId, // The account where money goes
                CreditId = AccountConstants.LoanReceivables,
                Date = payment.Date,
                Amount = payment.Amount,
                LoanId = loan.Id,
                FileId = payment.FileId,
                AddedBy = _user.UserId,
            };

            loan.Transactions.Add(new LoanLedger
            {
                LedgerId = paymentEntryId,
                AltKey = $"payment|{payment.Date:yyyy-MM-dd}|{paymentEntryId.ToString().Substring(0, 4)}",
                Type = "payment",
                Amount = payment.Amount,
                DateStart = payment.Date,
                EndDate = payment.Date
            });

            _context.Entries.Add(paymentEntry);
            _context.Payment.Add(payment);

            // Synchronize Account Balances for Payment
            await _entry.AdjustAccountBalance(paymentEntry.DebitId, paymentEntry.Amount, true, true);
            await _entry.AdjustAccountBalance(paymentEntry.CreditId, paymentEntry.Amount, false, true);



            // 4. Re-accrue interest from the reset point to Today
            DateTime referenceDateUTC8 = DateTime.UtcNow.AddHours(8);
            await AccrueInterestInternal(loan, referenceDateUTC8, true);

            if (loan.Balance <= 0)
            {
                loan.Status = "Paid";
            }

            _context.Loans.Update(loan);

            // 5. DEEP REBALANCE: Recalculate ALL realizations for this loan from scratch AND capture final results
            var rebalanceResult = await RebalanceInterestRealizations(loan);

            // Our final result should merge what rebalance saved with what we tracked here manually if necessary, 
            // but since rebalanceResult already contains the saved entities, we just need to merge additional tracking from earlier if needed.
            // Actually, because rebalanceResult.Accounts/Entries already includes saved changes from THIS tracker, it's fairly complete.
            
            rebalanceResult.Loan = loan;
            rebalanceResult.Payment = payment;
            foreach (var dId in deletedEntryIds)
            {
                if (!rebalanceResult.DeletedEntryIds.Contains(dId)) rebalanceResult.DeletedEntryIds.Add(dId);
            }

            return rebalanceResult;
        }

        public async Task DeleteLoan(Guid id)
        {
            var loan = await _context.Loans.FindAsync(id);
            if (loan == null) return;

            // 1. Find and remove all related entries (including interest realizations)
            var entries = await _context.Entries.Where(e => e.LoanId == id).ToListAsync();
            foreach (var entry in entries)
            {
                // Revert Account Balancesteateab v      await _entry.AdjustAccountBalance(entry.DebitId, entry.Amount, true, false);
                await _entry.AdjustAccountBalance(entry.CreditId, entry.Amount, false, false);
                _context.Entries.Remove(entry);
            }

            // 2. Find and remove associated Payments
            var payments = await _context.Payment.Where(p => p.LoanId == id).ToListAsync();
            foreach (var payment in payments)
            {
                _context.Payment.Remove(payment);
            }

            // 3. Find and remove associated Comments
            var comments = await _context.Comments.Where(c => c.LoanId == id).ToListAsync();
            foreach (var comment in comments)
            {
                _context.Comments.Remove(comment);
            }

            // 4. Remove the Loan itself
            _context.Loans.Remove(loan);

            await _context.SaveChangesAsync();
        }

        private async Task AccrueInterestInternal(Loan loan, DateTime referenceDateUTC8, bool saveEntries)
        {
            // Accrue for every date where NextInterestDate + 1 day buffer has passed


            var client = await _context.Users.FirstOrDefaultAsync(l => l.Id == loan.ClientId);
            while (true)
            {
                if (loan.Balance <= 0)
                {
                    loan.Status = "Paid";
                    break;
                }

                if (loan.Transactions.Count > 120) break; // Increased limit slightly to handle more separate entries

                // We wait until the grace period is over to accrue the full interest
                int graceDays = (loan.RecurringGracePeriod || loan.NextInterestDate == loan.Date) ? loan.GracePeriodDays : 0;
                DateTime accrualThreshold = loan.NextInterestDate.AddDays(graceDays).ToDateTime(new TimeOnly(8, 0));

                if (accrualThreshold > referenceDateUTC8)
                    break;

                var startDate = loan.NextInterestDate;

                // Calculate missed payment (Late Factor)
                int monthsElapsed = ((startDate.Year - loan.Date.Year) * 12) + startDate.Month - loan.Date.Month;
                if (monthsElapsed < 0) monthsElapsed = 0;

                decimal expectedPrincipal = loan.TermMonths > 0 ? (loan.Principal / loan.TermMonths) * monthsElapsed : loan.Principal;
                if (expectedPrincipal > loan.Principal) expectedPrincipal = loan.Principal;

                decimal expectedInterestTotal = loan.Transactions.Where(t => (t.Type == "interest" || t.Type == "penalty") && t.DateStart < startDate).Sum(t => t.Amount);
                decimal expectedTotal = expectedPrincipal + expectedInterestTotal;

                // Include payments made up to the end of the grace period
                DateOnly graceDate = DateOnly.FromDateTime(accrualThreshold);
                decimal totalPaid = loan.Transactions.Where(t => t.Type == "payment" && t.DateStart <= graceDate).Sum(t => t.Amount);

                decimal lateFactor = expectedTotal - totalPaid;
                if (lateFactor < 0) lateFactor = 0;

                decimal currentBalance = Math.Max(loan.Balance, 0);
                decimal originalPrincipal = loan.Principal;
                decimal remainingPrincipal = Math.Min(currentBalance, originalPrincipal);
                decimal totalInterestAccruedSoFar = Math.Max(0, currentBalance - originalPrincipal);

                decimal interestFactor = loan.InterestBase switch
                {
                    "principalBalance" => Math.Max(remainingPrincipal, (remainingPrincipal + totalInterestAccruedSoFar) / 2m),
                    "balance" => Math.Min(originalPrincipal, currentBalance),
                    "principal" => originalPrincipal,
                    _ => originalPrincipal
                };

                decimal rateToUse = (lateFactor <= 0) ? loan.GracePeriodInterest : loan.InterestRate;

                decimal monthlyInterest = interestFactor * (rateToUse / 100M);
                decimal penaltyInterest = lateFactor * (loan.LatePaymentPenalty / 100M);

                decimal totalCharge = monthlyInterest + penaltyInterest;

                if (totalCharge <= 0)
                {
                    // Make sure we advance dates even if 0 charge
                    loan.NextInterestDate = loan.NextInterestDate.AddMonths(1);
                    continue;
                }

                var endDate = startDate.AddMonths(1);

                if (monthlyInterest > 0)
                {
                    var interestEntryId = Guid.CreateVersion7();
                    var interestEntry = new Entry
                    {
                        Id = interestEntryId,
                        Description = $"Interest Accrual ({loan.AlternateId}) - {client!.Name} ",
                        DebitId = AccountConstants.LoanReceivables,
                        CreditId = AccountConstants.AccruedInterest,
                        Amount = monthlyInterest,
                        LoanId = loan.Id,
                        Date = startDate,
                        AddedBy = _user.UserId
                    };

                    loan.Transactions.Add(new LoanLedger
                    {
                        LedgerId = interestEntryId,
                        AltKey = $"interest|{startDate:yyyy-MM-dd}",
                        Type = "interest",
                        Amount = monthlyInterest,
                        DateStart = startDate,
                        EndDate = endDate
                    });

                    loan.Balance += monthlyInterest;

                    if (saveEntries)
                    {
                        _context.Entries.Add(interestEntry);
                        await _entry.AdjustAccountBalance(interestEntry.DebitId, interestEntry.Amount, true, true);
                        await _entry.AdjustAccountBalance(interestEntry.CreditId, interestEntry.Amount, false, true);
                    }
                }

                if (penaltyInterest > 0)
                {
                    var penaltyEntryId = Guid.CreateVersion7();
                    var penaltyEntry = new Entry
                    {
                        Id = penaltyEntryId,
                        Description = $"Late Penalty Accrual ({loan.AlternateId}) - {client!.Name} ",
                        DebitId = AccountConstants.LoanReceivables,
                        CreditId = AccountConstants.AccruedInterest,
                        Amount = penaltyInterest,
                        LoanId = loan.Id,
                        Date = startDate,
                        AddedBy = _user.UserId
                    };

                    loan.Transactions.Add(new LoanLedger
                    {
                        LedgerId = penaltyEntryId,
                        AltKey = $"penalty|{startDate:yyyy-MM-dd}",
                        Type = "penalty",
                        Amount = penaltyInterest,
                        DateStart = startDate,
                        EndDate = endDate
                    });

                    loan.Balance += penaltyInterest;

                    if (saveEntries)
                    {
                        _context.Entries.Add(penaltyEntry);
                        await _entry.AdjustAccountBalance(penaltyEntry.DebitId, penaltyEntry.Amount, true, true);
                        await _entry.AdjustAccountBalance(penaltyEntry.CreditId, penaltyEntry.Amount, false, true);
                    }
                }

                loan.NextInterestDate = endDate;
            }

            await Task.CompletedTask;
        }

        public async Task<TransactionResult> RebalanceInterestRealizations(Loan loan)
        {
            var client = await _context.Users.FirstOrDefaultAsync(l => l.Id == loan.ClientId);
            
            // 1. CLEAR: Remove all existing Interest Income Realization entries for this loan
            var existingRealizations = await _context.Entries
                .Where(e => e.LoanId == loan.Id && e.CreditId == AccountConstants.InterestIncome)
                .ToListAsync();

            foreach (var r in existingRealizations)
            {
                // Revert Account Balances for the old realizations
                await _entry.AdjustAccountBalance(r.DebitId, r.Amount, true, false);
                await _entry.AdjustAccountBalance(r.CreditId, r.Amount, false, false);
                _context.Entries.Remove(r);
            }

            // 2. RE-SIMULATE: Iterate through ALL transactions chronologically to calculate realizations
            decimal runningTotalAccrued = 0;
            decimal runningTotalRealized = 0;
            decimal currentSimBalance = loan.Principal;
            
            // Get all ledger transactions sorted by date
            var allLedger = loan.Transactions.OrderBy(t => t.DateStart).ThenBy(t => t.Type == "payment" ? 1 : 0).ToList();

            foreach (var tx in allLedger)
            {
                if (tx.Type == "interest" || tx.Type == "penalty")
                {
                    runningTotalAccrued += tx.Amount;
                    currentSimBalance += tx.Amount;
                }
                else if (tx.Type == "payment")
                {
                    decimal unrealizedAtPoint = Math.Max(0, runningTotalAccrued - runningTotalRealized);
                    decimal remPrinAtPoint = Math.Max(0, currentSimBalance - unrealizedAtPoint);
                    
                    decimal toRealize = Math.Max(0, Math.Min(unrealizedAtPoint, tx.Amount - remPrinAtPoint));

                    if (toRealize > 0)
                    {
                        var realizationEntryId = Guid.CreateVersion7();
                        var realizationEntry = new Entry
                        {
                            Id = realizationEntryId,
                            Description = $"Interest Income Realization ({loan.AlternateId}) - {client!.Name} ",
                            DebitId = AccountConstants.AccruedInterest,
                            CreditId = AccountConstants.InterestIncome,
                            Amount = toRealize,
                            LoanId = loan.Id,
                            Date = tx.DateStart, // Same date as payment
                            AddedBy = _user.UserId
                        };

                        _context.Entries.Add(realizationEntry);
                        
                        // Update Account Balances
                        await _entry.AdjustAccountBalance(realizationEntry.DebitId, toRealize, true, true);
                        await _entry.AdjustAccountBalance(realizationEntry.CreditId, toRealize, false, true);

                        runningTotalRealized += toRealize;
                    }
                    
                    currentSimBalance -= tx.Amount;
                }
            }

            var result = new TransactionResult
            {
                Accounts = _context.ChangeTracker.Entries<Account>()
                    .Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Modified)
                    .Select(e => e.Entity).ToList(),

                Entries = _context.ChangeTracker.Entries<Entry>()
                    .Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Modified || e.State == Microsoft.EntityFrameworkCore.EntityState.Added)
                    .Select(e => e.Entity).ToList(),

                DeletedEntryIds = _context.ChangeTracker.Entries<Entry>()
                    .Where(e => e.State == Microsoft.EntityFrameworkCore.EntityState.Deleted)
                    .Select(e => e.Entity.Id).ToList()
            };

            await _context.SaveChangesAsync();
            return result;
        }
    }
}
