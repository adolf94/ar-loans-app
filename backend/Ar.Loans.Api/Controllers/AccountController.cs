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
    public class AccountController(IAccountRepo accountRepo, CurrentUser user, AppConfig config)
    {
        private readonly IAccountRepo _accountRepo = accountRepo;
        private readonly CurrentUser _user = user;
        private readonly AppConfig _config = config;

        [Function("GetAccounts")]
        public async Task<IActionResult> GetAccounts([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "accounts")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
            var accounts = await _accountRepo.GetAllAccounts();
            return new OkObjectResult(accounts);
        }

        [Function("CreateLedgerAccount")]
        public async Task<IActionResult> CreateLedgerAccount([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "accounts")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_admin")) return new ForbidResult();

            if (!_config.AllowAccountCreation)
            {
                return new BadRequestObjectResult("Account creation is currently disabled in the configuration.");
            }

            var account = await req.ReadFromJsonAsync<Account>();
            if (account == null) return new BadRequestObjectResult("Invalid account data.");

            var createdAccount = await _accountRepo.CreateAccount(account);
            return new OkObjectResult(createdAccount);
        }
    }
}
