using Ar.Loans.Api.Models;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface IConversationStateRepo
    {
        Task<ConversationState?> GetStateAsync(string chatId);
        Task UpsertStateAsync(ConversationState state);
        Task DeleteStateAsync(string chatId);
    }
}
