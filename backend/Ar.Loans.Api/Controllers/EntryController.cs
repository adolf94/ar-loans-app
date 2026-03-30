using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class EntryController(IEntryRepo entryRepo, ILoanRepo loanRepo, IDbHelper db, CurrentUser user)
    {
        private readonly IEntryRepo _entryRepo = entryRepo;
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly IDbHelper _db = db;
        private readonly CurrentUser _user = user;

        [Function("GetAllEntries")]
        public async Task<IActionResult> GetAllEntries([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "entries")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var entries = await _entryRepo.GetAllEntries();
            return new OkObjectResult(entries);
        }

        [Function("CreateEntry")]
        public async Task<IActionResult> CreateEntry([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "entries")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();

            var dto = await req.ReadFromJsonAsync<Entry>();
            if (dto == null) return new BadRequestResult();

            var result = await _entryRepo.ExecuteCreateEntryAndSave(dto);
            return new OkObjectResult(result);
        }

        [Function("DeleteEntry")]
        public async Task<IActionResult> DeleteEntry([HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "entries/{id}")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("admin")) return new ForbidResult();

            var idItem = req.RouteValues["id"]!.ToString();
            if (!Guid.TryParse(idItem, out var entryId))
            {
                return new BadRequestResult();
            }

            var result = await _entryRepo.DeleteEntry(entryId);
            
            // Orchestrate: If a loan's payments were affected, rebalance realizations
            if (result != null && result.Loan != null)
            {
                await _loanRepo.RebalanceInterestRealizations(result.Loan);
            }

            return new OkObjectResult(result);
        }

    }
}
