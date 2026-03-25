using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Controllers
{
    public class CommentController(ICommentRepo commentRepo, CurrentUser user)
    {
        private readonly ICommentRepo _commentRepo = commentRepo;
        private readonly CurrentUser _user = user;

        [Function("CreateComment")]
        public async Task<IActionResult> CreateComment([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "comments")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();

            
            var comment = await req.ReadFromJsonAsync<Comment>();
            if (comment == null)
            {
                return new BadRequestObjectResult("Invalid comment data.");
            }

            comment.UserId = _user.UserId;
            comment.UserName = _user.Name;
            comment.CreatedAt = DateTime.UtcNow; 

            var createdComment = await _commentRepo.CreateComment(comment);
            return new OkObjectResult(createdComment);
        }

        [Function("GetCommentsByLoanId")]
        public async Task<IActionResult> GetCommentsByLoanId([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "loans/{loanId}/comments")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();

            
            var loanIdItem = req.RouteValues["loanId"]!.ToString();
            if (!Guid.TryParse(loanIdItem, out var loanId))
            {
                return new BadRequestResult();
            }

            var comments = await _commentRepo.GetCommentsByLoanId(loanId);
            return new OkObjectResult(comments);
        }
    }
}
