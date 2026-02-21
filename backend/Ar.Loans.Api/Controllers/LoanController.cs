using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class LoanController
    {
        private readonly ILoanRepo _loanRepo;

        public LoanController(ILoanRepo loanRepo)
        {
            _loanRepo = loanRepo;
        }

        [Function("CreateLoan")]
        public async Task<IActionResult> CreateLoan([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "loans")] HttpRequest req)
        {
            var loan = await req.ReadFromJsonAsync<Loan>();
            if (loan == null)
            {
                return new BadRequestObjectResult("Invalid loan data.");
            }

            var createdLoan = await _loanRepo.CreateLoan(loan);
            return new OkObjectResult(createdLoan);
        }

        [Function("GetAllLoans")]
        public async Task<IActionResult> GetAllLoans([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "loans")] HttpRequest req)
        {
            var loans = await _loanRepo.GetAllLoans();
            return new OkObjectResult(loans);
        }

        [Function("GetLoansAsGuarantor")]
				public async Task<IActionResult> GetLoansAsGuarantor([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "guarantor/{userId}/loans")] HttpRequest req)
        {
            var userIdItem = req.RouteValues["userId"]!.ToString();
            Guid userId;
            if (!Guid.TryParse(userIdItem,out userId))
            {
                return new BadRequestResult();
            }

            var loans = await _loanRepo.GetGuaranteedLoans(userId);
            return new OkObjectResult(loans);   
        }

        [Function("GetLoansAsClient")]
				public async Task<IActionResult> GetLoansAsClient([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/{userId}/loans")] HttpRequest req)
				{
						var userIdItem = req.RouteValues["userId"]!.ToString();
						Guid userId;
						if (!Guid.TryParse(userIdItem, out userId))
						{
								return new BadRequestResult();
						}

						var loans = await _loanRepo.GetUserLoans(userId);
						return new OkObjectResult(loans);
				}


		}
}
