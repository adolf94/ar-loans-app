using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class EntryController
    {
        private readonly IEntryRepo _entryRepo;
				private readonly IDbHelper _db;
        private readonly CurrentUser _user;

        public EntryController(IEntryRepo entryRepo, IDbHelper db, CurrentUser user)
        {
            _entryRepo = entryRepo;
            _db = db;
            _user = user;
        }

        [Function("GetAllEntries")]
        public async Task<IActionResult> GetAllEntries([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "entries")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
            var entries = await _entryRepo.GetAllEntries();
            return new OkObjectResult(entries);
        }

        [Function("CreateEntry")]
				public async Task<IActionResult> CreateEntry([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "entries")] HttpRequest req)
				{
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();

            var dto = await req.ReadFromJsonAsync<Entry>();
            if (dto == null) return new BadRequestResult();

						await _entryRepo.CreateEntry(dto);
						await _entryRepo.AdjustAccountBalance(dto.CreditId, dto.Amount, false, true);
						await _entryRepo.AdjustAccountBalance(dto.DebitId, dto.Amount, true, true);
            await _db.SaveChangesAsync();
						return new OkObjectResult(dto);
				}

		}
}
