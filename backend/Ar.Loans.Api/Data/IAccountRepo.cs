using Ar.Loans.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface IAccountRepo
    {
        Task<List<Account>> GetAllAccounts();
    }
}
