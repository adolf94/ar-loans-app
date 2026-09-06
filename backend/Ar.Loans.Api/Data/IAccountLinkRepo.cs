using Ar.Loans.Api.Models;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface IAccountLinkRepo
    {
        Task<List<AccountLink>> GetAllLinks();
        Task<AccountLink?> GetByLoanAccountId(Guid loanAccountId);
        Task<AccountLink> UpsertLink(Guid loanAccountId, string financeAccountId, string financeUserId);
        Task<bool> DeleteLink(Guid id);
    }
}
