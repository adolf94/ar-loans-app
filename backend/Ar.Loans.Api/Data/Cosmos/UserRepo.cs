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
    public class UserRepo : IUserRepo
    {
        private readonly AppDbContext _ctx;
        private readonly IQueryable<User> _q;
        private readonly AppConfig _config;

        public UserRepo(AppDbContext ctx, AppConfig config)
        {
            _ctx = ctx;
            _q = ctx.Users.Where(e => e.PartitionKey == "default");
            _config = config;
        }

        public async Task<User?> GetUserById(Guid id)
        {
            return await _q.Where(e => e.Id == id).FirstOrDefaultAsync();
        }

        public async Task<User?> GetUserByOidcUid(string oidcUid)
        {
            return await _q.Where(e => e.OidcUid == oidcUid).FirstOrDefaultAsync();
        }

        public async Task<User[]> GetAllUsers()
        {
            return await _q.ToArrayAsync();
        }


        public async Task<User?> GetUser(Guid id)
        {
            return await _q.FirstOrDefaultAsync(e => e.Id == id);
        }

        public async Task<User> CreateUser(User item)
        {
            User? user = await GetUserByEmailOrMobile(item.EmailAddress, item.MobileNumber);
            
            if (user == null && !string.IsNullOrEmpty(item.OidcUid))
            {
                user = await GetUserByOidcUid(item.OidcUid);
            }

            if (user != null)
            {
                user.Accounts = item.Accounts
                                .UnionBy(user.Accounts, a => a.AccountNumber)
                                .ToList();
                _ctx.Users.Update(user);
                return user;
            }

            await _ctx.Users.AddAsync(item);
            return item;
        }

        public async Task<User?> GetUserByEmailOrMobile(string email, string mobile)
        {
            return await _ctx.Users
                .Where(e => (!string.IsNullOrEmpty(email) && e.EmailAddress == email) || (!string.IsNullOrEmpty(mobile) && e.MobileNumber == mobile))
                .FirstOrDefaultAsync();
        }

        public async Task<User> UpdateUser(User item)
        {
            var existing = await _ctx.Users.FindAsync(item.Id, item.PartitionKey ?? "default");
            if (existing == null) throw new Exception($"User not found with ID: {item.Id} in partition: {item.PartitionKey}");

            existing.Name = item.Name;
            existing.Role = item.Role;
            existing.MobileNumber = item.MobileNumber;
            existing.EmailAddress = item.EmailAddress;
            existing.Accounts = item.Accounts;
            existing.OidcUid = item.OidcUid;
            existing.DefaultInterestRuleId = item.DefaultInterestRuleId;

            _ctx.Users.Update(existing);
            return existing;
        }

        public async Task<User?> TestCreateUser(User item)
        {
            User? user = null;

            if (!string.IsNullOrEmpty(item.MobileNumber) || !string.IsNullOrEmpty(item.EmailAddress))
            {
                user = await _q.Where(e => (!string.IsNullOrEmpty(item.EmailAddress) && e.EmailAddress == item.EmailAddress) || (item.MobileNumber != "" && e.MobileNumber == item.MobileNumber)).FirstOrDefaultAsync();

                if (user != null)
                {
                    user.Accounts = item.Accounts
                                    .UnionBy(user.Accounts, a => a.AccountNumber)
                                    .ToList();
                    //_ctx.Update(user);
                    return user;
                }
            }




            if (user == null)
            {
                var existingUser = await GetUserByEmailOrMobile(item.EmailAddress, item.MobileNumber);

                if (existingUser != null)
                {
                    item.Id = existingUser.Id;
                    item.Name = existingUser.Name ?? item.Name;
                    item.EmailAddress = existingUser.EmailAddress ?? item.EmailAddress;
                    item.MobileNumber = existingUser.MobileNumber ?? item.MobileNumber;
                }
            }


            //await _ctx.Users.AddAsync(item);
            return item;
        }
    }
}
