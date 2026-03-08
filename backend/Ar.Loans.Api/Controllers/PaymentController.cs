using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class PaymentController(ILoanRepo loanRepo, CurrentUser user)
    {
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly CurrentUser _user = user;

        [Function("RecordPayment")]
        public async Task<IActionResult> RecordPayment([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "payments")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
            var payment = await req.ReadFromJsonAsync<Payment>();
            if (payment == null)
            {
                return new BadRequestObjectResult("Invalid payment data.");
            }

            try
            {
                var result = await _loanRepo.RecordPayment(payment);
                return new OkObjectResult(result);
            }
            catch (System.Exception ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
        }
    }
}
