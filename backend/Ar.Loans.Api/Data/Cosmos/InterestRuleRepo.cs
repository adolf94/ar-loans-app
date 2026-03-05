using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class InterestRuleRepo : IInterestRuleRepo
    {
        private readonly AppDbContext _ctx;
        private readonly IQueryable<InterestRule> _query;

        public InterestRuleRepo(AppDbContext ctx)
        {
            _ctx = ctx;
            _query = _ctx.InterestRules.Where(r => r.PartitionKey == "default");
        }

        public async Task<InterestRule?> GetRuleById(Guid id)
        {
            return await _query.FirstOrDefaultAsync(r => r.Id == id);
        }

        public async Task<IEnumerable<InterestRule>> GetAllRules()
        {
            return await _query.ToArrayAsync();
        }

        public async Task<InterestRule> CreateRule(InterestRule rule)
        {
            await _ctx.InterestRules.AddAsync(rule);
            await _ctx.SaveChangesAsync();
            return rule;
        }

        public async Task<InterestRule?> UpdateRule(InterestRule rule)
        {
            var existing = await GetRuleById(rule.Id);
            if (existing != null)
            {
                _ctx.Entry(existing).CurrentValues.SetValues(rule);
                await _ctx.SaveChangesAsync();
                return existing;
            }
            return null;
        }

        public async Task DeleteRule(Guid id)
        {
            var existing = await GetRuleById(id);
            if (existing != null)
            {
                _ctx.InterestRules.Remove(existing);
                await _ctx.SaveChangesAsync();
            }
        }
    }
}
