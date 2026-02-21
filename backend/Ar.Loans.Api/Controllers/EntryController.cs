using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
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

				public EntryController(IEntryRepo entryRepo, IDbHelper db)
        {
            _entryRepo = entryRepo;
            _db = db;
        }

        [Function("GetAllEntries")]
        public async Task<IActionResult> GetAllEntries([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "entries")] HttpRequest req)
        {
            var entries = await _entryRepo.GetAllEntries();
            return new OkObjectResult(entries);
        }

        [Function("CreateEntry")]
				public async Task<IActionResult> CreateEntry([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "entries")] HttpRequest req)
				{

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
