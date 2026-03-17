using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class CommentRepo : ICommentRepo
    {
        private readonly AppDbContext _context;

        public CommentRepo(AppDbContext context)
        {
            _context = context;
        }

        public async Task<Comment> CreateComment(Comment comment)
        {
            _context.Set<Comment>().Add(comment);
            await _context.SaveChangesAsync();
            return comment;
        }

        public async Task<List<Comment>> GetCommentsByLoanId(Guid loanId)
        {
            return await _context.Set<Comment>()
                .Where(c => c.LoanId == loanId)
                .OrderByDescending(c => c.CreatedAt)
                .ToListAsync();
        }
    }
}
