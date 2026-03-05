using Ar.Loans.Api.Models;

namespace Ar.Loans.Api.Data.Cosmos
{
    public interface IInterestRuleRepo
    {
        Task<InterestRule?> GetRuleById(Guid id);
        Task<IEnumerable<InterestRule>> GetAllRules();
        Task<InterestRule> CreateRule(InterestRule rule);
        Task<InterestRule?> UpdateRule(InterestRule rule);
        Task DeleteRule(Guid id);
    }
}
