using Ar.Loans.Api.Models;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface ITelegramMessageRepo
    {
        Task RecordMessageAsync(TelegramMessage message);
        Task<string> GetOrCreateConvoIdAsync(string chatId);
    }
}
