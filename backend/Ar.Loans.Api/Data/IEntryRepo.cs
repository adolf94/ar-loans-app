using Ar.Loans.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
    public interface IEntryRepo
    {
        Task<List<Entry>> GetAllEntries();
				Task AdjustAccountBalance(Guid accountId, decimal amount, bool isDebit, bool isAdding);
				Task<TransactionResult> ExecuteCreateEntryAndSave(Entry entry);
				Task CreateEntry(Entry entry);
				Task<TransactionResult> DeleteEntry(Guid id);


		}
}
