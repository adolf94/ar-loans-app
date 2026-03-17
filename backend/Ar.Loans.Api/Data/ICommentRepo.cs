using Ar.Loans.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface ICommentRepo
    {
        Task<Comment> CreateComment(Comment comment);
        Task<List<Comment>> GetCommentsByLoanId(Guid loanId);
    }
}
