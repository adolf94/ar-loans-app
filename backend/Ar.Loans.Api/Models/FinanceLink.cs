using System;
using System.Collections.Generic;

namespace Ar.Loans.Api.Models
{
    public class AccountLink
    {
        public Guid Id { get; set; }
        public Guid LoanAccountId { get; set; }
        public string FinanceAccountId { get; set; } = string.Empty;
        public string FinanceUserId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public string PartitionKey { get; set; } = "default";
    }

    public class FinanceSyncItem
    {
        public Guid Id { get; set; }
        // Create | Delete
        public string Kind { get; set; } = FinanceSyncKinds.Create;
        // Pending | Processing | Completed | Failed | Cancelled
        public string Status { get; set; } = FinanceSyncStatuses.Pending;
        public Guid EntryId { get; set; }
        public string? FinanceTransactionId { get; set; }
        public string? PayloadJson { get; set; }
        public int Attempts { get; set; }
        public string? LastError { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        public string PartitionKey { get; set; } = "default";
    }

    public static class FinanceSyncKinds
    {
        public const string Create = "Create";
        public const string Delete = "Delete";
    }

    public static class FinanceSyncStatuses
    {
        public const string Pending = "Pending";
        public const string Processing = "Processing";
        public const string Completed = "Completed";
        public const string Failed = "Failed";
        public const string Cancelled = "Cancelled";
    }

    public class FinanceSyncPayload
    {
        public string DebitFinanceAccountId { get; set; } = string.Empty;
        public string CreditFinanceAccountId { get; set; } = string.Empty;
        public string FinanceUserId { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        // ISO 8601 UTC, e.g. 2026-09-05T00:00:00Z
        public string Date { get; set; } = string.Empty;
        public string? Note { get; set; }
        public string? IngestionId { get; set; }
    }
}
