using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
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

        public AccountController(IAccountRepo accountRepo)
        {
            _accountRepo = accountRepo;
        }

        [Function("GetAccounts")]
        public async Task<IActionResult> GetAccounts([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "accounts")] HttpRequest req)
        {
            var accounts = await _accountRepo.GetAllAccounts();
            return new OkObjectResult(accounts);
        }
    }
}
