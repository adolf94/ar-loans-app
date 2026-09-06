using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class AccountLinkRepo : IAccountLinkRepo
    {
        private readonly AppDbContext _context;

        public AccountLinkRepo(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<AccountLink>> GetAllLinks()
        {
            return await _context.AccountLinks.ToListAsync();
        }

        public async Task<AccountLink?> GetByLoanAccountId(Guid loanAccountId)
        {
            return await _context.AccountLinks.FirstOrDefaultAsync(l => l.LoanAccountId == loanAccountId);
        }

        public async Task<AccountLink> UpsertLink(Guid loanAccountId, string financeAccountId, string financeUserId)
        {
            var existing = await _context.AccountLinks.FirstOrDefaultAsync(l => l.LoanAccountId == loanAccountId);
            if (existing != null)
            {
                existing.FinanceAccountId = financeAccountId;
                if (!string.IsNullOrEmpty(financeUserId)) existing.FinanceUserId = financeUserId;
                _context.AccountLinks.Update(existing);
                await _context.SaveChangesAsync();
                return existing;
            }

            var link = new AccountLink
            {
                Id = Guid.CreateVersion7(),
                LoanAccountId = loanAccountId,
                FinanceAccountId = financeAccountId,
                FinanceUserId = financeUserId,
                CreatedAt = DateTime.UtcNow
            };
            _context.AccountLinks.Add(link);
            await _context.SaveChangesAsync();
            return link;
        }

        public async Task<bool> DeleteLink(Guid id)
        {
            var link = await _context.AccountLinks.FindAsync(id);
            if (link == null) return false;
            _context.AccountLinks.Remove(link);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
