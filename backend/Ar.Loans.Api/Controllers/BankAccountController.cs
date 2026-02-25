using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
		public class BankAccountController
		{
				private readonly IBankAccountRepo _repo;
				private readonly IDbHelper _db;
        private readonly CurrentUser _user;

        public BankAccountController(IBankAccountRepo repo, IDbHelper db, CurrentUser user)
				{
						_repo = repo;
						_db = db;
						_user = user;
				}



				[Function("GetByBankAccountId")]
				public async Task<IActionResult> GetByBankAccountId([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "bankaccounts")] HttpRequest req)
				{
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
						string? accountId = req.Query["accountId"];
						if (string.IsNullOrEmpty(accountId))
						{
								return new BadRequestObjectResult("Account ID is required.");
						}

						var account = await _repo.GetByAccountId(accountId);
						if (account == null)
						{
								return new NotFoundResult();
						}

						return new OkObjectResult(account);
				}

				[Function("PutBankAccount")]
				public async Task<IActionResult> PutBankAccount([HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "bankaccounts")] HttpRequest req)
				{
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();

						var dto = await req.ReadFromJsonAsync<UserBankAccount>();

						var item =await _repo.GetByExactAccountId(dto!.AccountNumber);

						if(item == null)
						{
							 await	_repo.CreateBankAccount(dto);
						}
						else
						{
								item.UserId = dto.UserId;
						}

						await _db.SaveChangesAsync();


						return new OkObjectResult(dto);
				}
		}
}
