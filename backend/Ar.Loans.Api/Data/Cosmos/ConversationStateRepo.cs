using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class ConversationStateRepo : IConversationStateRepo
    {
        private readonly AppDbContext _context;

        public ConversationStateRepo(AppDbContext context)
        {
            _context = context;
        }

        public async Task<ConversationState?> GetStateAsync(string chatId)
        {
            return await _context.ConversationStates.FindAsync(chatId);
        }

        public async Task UpsertStateAsync(ConversationState state)
        {
            var existing = await _context.ConversationStates.FindAsync(state.Id);
            if (existing == null)
            {
                await _context.ConversationStates.AddAsync(state);
            }
            else
            {
                _context.Entry(existing).CurrentValues.SetValues(state);
                _context.ConversationStates.Update(existing);
            }
            await _context.SaveChangesAsync();
        }

        public async Task DeleteStateAsync(string chatId)
        {
            var state = await _context.ConversationStates.FindAsync(chatId);
            if (state != null)
            {
                _context.ConversationStates.Remove(state);
                await _context.SaveChangesAsync();
            }
        }
    }
}
