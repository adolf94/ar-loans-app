using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class PaymentController
    {
        private readonly ILoanRepo _loanRepo;

        public PaymentController(ILoanRepo loanRepo)
        {
            _loanRepo = loanRepo;
        }

        [Function("RecordPayment")]
        public async Task<IActionResult> RecordPayment([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "payments")] HttpRequest req)
        {
            var payment = await req.ReadFromJsonAsync<Payment>();
            if (payment == null)
            {
                return new BadRequestObjectResult("Invalid payment data.");
            }

            try
            {
                await _loanRepo.RecordPayment(payment);
                return new OkObjectResult(payment);
            }
            catch (System.Exception ex)
            {
                return new BadRequestObjectResult(ex.Message);
            }
        }
    }
}
