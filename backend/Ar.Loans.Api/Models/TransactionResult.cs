using System.Collections.Generic;

namespace Ar.Loans.Api.Models
{
    public class TransactionResult
    {
        public Loan Loan { get; set; }
        public Entry Entry { get; set; }
        public Payment Payment { get; set; }
        public List<Entry> Entries { get; set; } = new List<Entry>();
        public List<Account> Accounts { get; set; } = new List<Account>();
        public List<Guid> DeletedEntryIds { get; set; } = new List<Guid>();
        public List<LoanLedger> NewTransactions { get; set; } = new List<LoanLedger>();
        public List<LoanLedger> DeletedTransactions { get; set; } = new List<LoanLedger>();
        public string? ClientName { get; set; }
    }
}
