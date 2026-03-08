using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class AccountRepo : IAccountRepo
    {
        private readonly AppDbContext _context;

        public AccountRepo(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<Account>> GetAllAccounts()
        {
            return await _context.Accounts.ToListAsync();
        }
        public async Task<Account> CreateAccount(Account account)
        {
            if (account.Id == Guid.Empty) account.Id = Guid.CreateVersion7();
            _context.Accounts.Add(account);
            await _context.SaveChangesAsync();
            return account;
        }
    }
}
