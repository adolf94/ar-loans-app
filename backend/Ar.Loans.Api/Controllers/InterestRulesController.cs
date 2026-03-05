using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Ar.Loans.Api.Controllers
{
    public class InterestRulesController
    {
        private readonly IInterestRuleRepo _repo;

        public InterestRulesController(IInterestRuleRepo repo)
        {
            _repo = repo;
        }

        [Function("GetAllRules")]
        public async Task<IActionResult> GetAllRules([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "InterestRules")] HttpRequest req)
        {
            var rules = await _repo.GetAllRules();
            return new OkObjectResult(rules);
        }

        [Function("GetRuleById")]
        public async Task<IActionResult> GetRuleById([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "InterestRules/{id}")] HttpRequest req, Guid id)
        {
            var rule = await _repo.GetRuleById(id);
            if (rule == null)
                return new NotFoundResult();
            return new OkObjectResult(rule);
        }

        [Function("CreateRule")]
        public async Task<IActionResult> CreateRule([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "InterestRules")] HttpRequest req)
        {
            var rule = await req.ReadFromJsonAsync<InterestRule>();
            if (rule == null) return new BadRequestResult();

            if (rule.Id == Guid.Empty)
                rule.Id = Guid.CreateVersion7();

            var created = await _repo.CreateRule(rule);
            return new OkObjectResult(created);
        }

        [Function("UpdateRule")]
        public async Task<IActionResult> UpdateRule([HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "InterestRules/{id}")] HttpRequest req, Guid id)
        {
            var rule = await req.ReadFromJsonAsync<InterestRule>();
            if (rule == null || id != rule.Id) return new BadRequestResult();

            var updated = await _repo.UpdateRule(rule);
            if (updated == null)
                return new NotFoundResult();

            return new OkObjectResult(updated);
        }

        [Function("DeleteRule")]
        public async Task<IActionResult> DeleteRule([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "InterestRules/{id}")] HttpRequest req, Guid id)
        {
            await _repo.DeleteRule(id);
            return new OkResult();
        }
    }
}
