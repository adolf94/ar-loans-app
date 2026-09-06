using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Ar.Loans.Api.Tests;

public class AccountLinkRepoTests
{
    [Fact]
    public async Task Upsert_CreatesLink()
    {
        await using var db = TestHelpers.CreateContext();
        var repo = new AccountLinkRepo(db);

        var link = await repo.UpsertLink(Guid.NewGuid(), "fin-1", "user-123");

        Assert.Equal("fin-1", link.FinanceAccountId);
        Assert.Single(await repo.GetAllLinks());
    }

    [Fact]
    public async Task Upsert_ReplacesExistingLink_ForSameLoanAccount()
    {
        await using var db = TestHelpers.CreateContext();
        var repo = new AccountLinkRepo(db);
        var loanAccountId = Guid.NewGuid();

        await repo.UpsertLink(loanAccountId, "fin-1", "user-123");
        var updated = await repo.UpsertLink(loanAccountId, "fin-2", "user-123");

        Assert.Equal("fin-2", updated.FinanceAccountId);
        var all = await repo.GetAllLinks();
        Assert.Single(all);
        Assert.Equal("fin-2", all[0].FinanceAccountId);
    }

    [Fact]
    public async Task GetByLoanAccountId_ReturnsLink()
    {
        await using var db = TestHelpers.CreateContext();
        var repo = new AccountLinkRepo(db);
        var loanAccountId = Guid.NewGuid();
        await repo.UpsertLink(loanAccountId, "fin-x", "user-123");

        Assert.NotNull(await repo.GetByLoanAccountId(loanAccountId));
        Assert.Null(await repo.GetByLoanAccountId(Guid.NewGuid()));
    }

    [Fact]
    public async Task Delete_RemovesLink()
    {
        await using var db = TestHelpers.CreateContext();
        var repo = new AccountLinkRepo(db);
        var link = await repo.UpsertLink(Guid.NewGuid(), "fin-1", "user-123");

        Assert.True(await repo.DeleteLink(link.Id));
        Assert.False(await repo.DeleteLink(link.Id));
        Assert.Empty(await repo.GetAllLinks());
    }
}

public class IngestionPaymentFlowTests
{
    /// <summary>
    /// End-to-end (repo level): recording a payment with a FinanceIngestionId, on linked
    /// accounts, must enqueue exactly one Create sync item carrying the ingestion id -
    /// which the worker later uses to create the finance tx and confirm the ingestion.
    /// </summary>
    [Fact]
    public async Task RecordPayment_FromIngestion_EnqueuesCreateItemWithIngestionId()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue);

        var clientId = Guid.NewGuid();
        var destinationAccount = Guid.NewGuid();
        var loanId = Guid.NewGuid();

        db.Users.Add(new User { Id = clientId, Name = "Juan Dela Cruz", Role = "user", MobileNumber = "", EmailAddress = "" });
        db.AccountLinks.Add(new AccountLink { Id = Guid.NewGuid(), LoanAccountId = destinationAccount, FinanceAccountId = "fin-dest", FinanceUserId = "user-123" });
        db.AccountLinks.Add(new AccountLink { Id = Guid.NewGuid(), LoanAccountId = AccountConstants.LoanReceivables, FinanceAccountId = "fin-receivables", FinanceUserId = "user-123" });
        db.Accounts.Add(new Account { Id = destinationAccount, Name = "Wallet", Section = "Assets", Balance = 0 });
        db.Accounts.Add(new Account { Id = AccountConstants.LoanReceivables, Name = "Loan Receivables", Section = "Assets", Balance = 10000 });

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8));
        db.Loans.Add(new Loan
        {
            Id = loanId,
            AlternateId = "TEST-LOAN",
            ClientId = clientId,
            Principal = 10000m,
            Balance = 10000m,
            InterestRate = 0,
            GracePeriodDays = 0,
            LatePaymentPenalty = 0,
            TermMonths = 0,
            Date = today.AddDays(-3),
            NextInterestDate = today.AddDays(-3),
            Status = "Active",
            SourceAcct = destinationAccount
        });
        await db.SaveChangesAsync();

        var appConfig = TestHelpers.BuildAppConfig();
        var currentUser = new CurrentUser(appConfig);
        IEntryRepo entryRepo = new EntryRepo(db);
        ILoanRepo loanRepo = new LoanRepo(db, entryRepo, currentUser);

        var payment = new Payment
        {
            LoanId = loanId,
            UserId = clientId,
            Amount = 500m,
            Date = today,
            Description = "GCash payment",
            DestinationAcctId = destinationAccount,
            FinanceIngestionId = "ing-42"
        };

        var result = await loanRepo.RecordPayment(payment);

        Assert.Equal(9500m, result.Loan.Balance);

        var items = await db.FinanceSyncItems.Where(s => s.Kind == FinanceSyncKinds.Create).ToListAsync();
        var paymentItem = Assert.Single(items,
            i => i.PayloadJson != null && i.PayloadJson.Contains("ing-42"));

        var payload = System.Text.Json.JsonSerializer.Deserialize<FinanceSyncPayload>(
            paymentItem.PayloadJson!, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.Equal("fin-dest", payload!.DebitFinanceAccountId);
        Assert.Equal("fin-receivables", payload.CreditFinanceAccountId);
        Assert.Equal(500m, payload.Amount);
        Assert.Equal("ing-42", payload.IngestionId);
        Assert.Contains(queue.Published, id => id == paymentItem.Id);
    }

    [Fact]
    public async Task DeletePayment_CancelsUnsyncedAndEnqueuesDeleteForSynced()
    {
        await using var db = TestHelpers.CreateContext();
        var entry = new Entry
        {
            Id = Guid.CreateVersion7(), Description = "x", Date = new DateOnly(2026, 9, 1),
            DebitId = Guid.NewGuid(), CreditId = AccountConstants.LoanReceivables,
            Amount = 100m, AddedBy = Guid.NewGuid(), FinanceTransactionId = "tx-keep"
        };
        var pendingCreate = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(), Kind = FinanceSyncKinds.Create, EntryId = entry.Id,
            Status = FinanceSyncStatuses.Pending, PayloadJson = "{}"
        };
        db.Entries.Add(entry);
        db.FinanceSyncItems.Add(pendingCreate);
        // Seed links so the delete enqueue can build its payload
        db.AccountLinks.Add(new AccountLink { Id = Guid.NewGuid(), LoanAccountId = entry.DebitId, FinanceAccountId = "fin-d", FinanceUserId = "u" });
        db.AccountLinks.Add(new AccountLink { Id = Guid.NewGuid(), LoanAccountId = entry.CreditId, FinanceAccountId = "fin-c", FinanceUserId = "u" });
        await db.SaveChangesAsync();

        db.Entries.Remove(entry);
        await db.SaveChangesAsync();

        var items = await db.FinanceSyncItems.ToListAsync();
        Assert.Equal(FinanceSyncStatuses.Cancelled, items.Single(i => i.Id == pendingCreate.Id).Status);
        Assert.Contains(items, i => i.Kind == FinanceSyncKinds.Delete && i.FinanceTransactionId == "tx-keep");
    }
}
