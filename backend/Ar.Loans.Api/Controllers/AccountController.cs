using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class AccountController
    {
        private readonly IAccountRepo _accountRepo;
        private readonly CurrentUser _user;

        public AccountController(IAccountRepo accountRepo, CurrentUser user)
        {
            _accountRepo = accountRepo;
            _user = user;
        }

        [Function("GetAccounts")]
        public async Task<IActionResult> GetAccounts([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "accounts")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
            var accounts = await _accountRepo.GetAllAccounts();
            return new OkObjectResult(accounts);
        }
    }
}
