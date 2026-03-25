using Ar.Loans.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface IUserRepo
    {
        public Task<User?> GetUserById(Guid id);
        public Task<User?> GetUserByOidcUid(string oidcUid);
        public Task<User[]> GetAllUsers();
        public Task<User> CreateUser(User item);
        public Task<User?> GetUser(Guid id);
        public Task<User> UpdateUser(User item);
        public Task<User?> GetUserByEmailOrMobile(string email, string mobile);
        public Task<User?> TestCreateUser(User item);

    }
}
