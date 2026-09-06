using System.Text.Json;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Ar.Loans.Api.Tests;

public class FinanceEnqueueHookTests
{
    private static readonly Guid DebitLoanAccount = Guid.NewGuid();
    private static readonly Guid CreditLoanAccount = Guid.NewGuid();
    private const string DebitFinanceAccount = "019a-debit";
    private const string CreditFinanceAccount = "019a-credit";
    private const string FinanceUser = "user-123";

    private static AccountLink Link(Guid loanAccountId, string financeAccountId) => new()
    {
        Id = Guid.CreateVersion7(),
        LoanAccountId = loanAccountId,
        FinanceAccountId = financeAccountId,
        FinanceUserId = FinanceUser
    };

    private static Entry MakeEntry(decimal amount = 250m) => new()
    {
        Id = Guid.CreateVersion7(),
        Description = "Test entry",
        Date = new DateOnly(2026, 9, 5),
        DebitId = DebitLoanAccount,
        CreditId = CreditLoanAccount,
        Amount = amount,
        AddedBy = Guid.NewGuid()
    };

    private static FinanceSyncPayload? Payload(FinanceSyncItem item) =>
        item.PayloadJson == null ? null : JsonSerializer.Deserialize<FinanceSyncPayload>(item.PayloadJson,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

    [Fact]
    public async Task AddedEntry_WithBothAccountsLinked_EnqueuesCreateItem()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue);
        db.AccountLinks.AddRange(Link(DebitLoanAccount, DebitFinanceAccount), Link(CreditLoanAccount, CreditFinanceAccount));
        await db.SaveChangesAsync();

        var entry = MakeEntry();
        db.Entries.Add(entry);
        await db.SaveChangesAsync();

        var item = Assert.Single(await db.FinanceSyncItems.ToListAsync());
        Assert.Equal(FinanceSyncKinds.Create, item.Kind);
        Assert.Equal(FinanceSyncStatuses.Pending, item.Status);
        Assert.Equal(entry.Id, item.EntryId);
        Assert.Contains(queue.Published, id => id == item.Id);

        var payload = Payload(item);
        Assert.NotNull(payload);
        Assert.Equal(DebitFinanceAccount, payload!.DebitFinanceAccountId);
        Assert.Equal(CreditFinanceAccount, payload.CreditFinanceAccountId);
        Assert.Equal(FinanceUser, payload.FinanceUserId);
        Assert.Equal(250m, payload.Amount);
        Assert.Equal("2026-09-05T00:00:00Z", payload.Date);
        Assert.Null(payload.IngestionId);
    }

    [Fact]
    public async Task AddedEntry_WithoutLinks_EnqueuesNothing()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue);

        db.Entries.Add(MakeEntry());
        await db.SaveChangesAsync();

        Assert.Empty(await db.FinanceSyncItems.ToListAsync());
        Assert.Empty(queue.Published);
    }

    [Fact]
    public async Task AddedEntry_PartiallyLinked_EnqueuesNothing()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue);
        db.AccountLinks.Add(Link(DebitLoanAccount, DebitFinanceAccount));
        await db.SaveChangesAsync();

        db.Entries.Add(MakeEntry());
        await db.SaveChangesAsync();

        Assert.Empty(await db.FinanceSyncItems.ToListAsync());
    }

    [Fact]
    public async Task AddedEntry_SkipFinanceSync_EnqueuesNothing()
    {
        await using var db = TestHelpers.CreateContext();
        db.AccountLinks.AddRange(Link(DebitLoanAccount, DebitFinanceAccount), Link(CreditLoanAccount, CreditFinanceAccount));
        await db.SaveChangesAsync();

        var entry = MakeEntry();
        entry.SkipFinanceSync = true;
        db.Entries.Add(entry);
        await db.SaveChangesAsync();

        Assert.Empty(await db.FinanceSyncItems.ToListAsync());
    }

    [Fact]
    public async Task AddedPaymentEntry_FromIngestion_TagsCreateItemWithIngestionId()
    {
        await using var db = TestHelpers.CreateContext();
        db.AccountLinks.AddRange(Link(DebitLoanAccount, DebitFinanceAccount), Link(CreditLoanAccount, CreditFinanceAccount));
        await db.SaveChangesAsync();

        var entry = MakeEntry();
        var payment = new Payment
        {
            Id = Guid.CreateVersion7(),
            LoanId = Guid.NewGuid(),
            UserId = Guid.NewGuid(),
            LedgerId = entry.Id,
            Amount = entry.Amount,
            Date = entry.Date,
            DestinationAcctId = DebitLoanAccount,
            FinanceIngestionId = "ing-777"
        };
        db.Entries.Add(entry);
        db.Payment.Add(payment);
        await db.SaveChangesAsync();

        var item = Assert.Single(await db.FinanceSyncItems.ToListAsync());
        Assert.Equal("ing-777", Payload(item)?.IngestionId);
    }

    [Fact]
    public async Task DeletedSyncedEntry_EnqueuesDeleteItem()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue);
        db.AccountLinks.AddRange(Link(DebitLoanAccount, DebitFinanceAccount), Link(CreditLoanAccount, CreditFinanceAccount));
        await db.SaveChangesAsync();

        var entry = MakeEntry();
        db.Entries.Add(entry);
        await db.SaveChangesAsync();

        // Mark as already synced on the finance side
        entry.FinanceTransactionId = "tx-999";
        await db.SaveChangesAsync();

        queue.Published.Clear();
        db.Entries.Remove(entry);
        await db.SaveChangesAsync();

        var items = await db.FinanceSyncItems.ToListAsync();
        var deleteItem = items.Single(i => i.Kind == FinanceSyncKinds.Delete);
        Assert.Equal("tx-999", deleteItem.FinanceTransactionId);
        Assert.Equal(FinanceSyncStatuses.Pending, deleteItem.Status);
        Assert.Contains(queue.Published, id => id == deleteItem.Id);

        // The original Create item was Completed-state? It stayed Pending here (never processed),
        // and the entry WAS synced, so the pending create must be cancelled.
        var createItem = items.Single(i => i.Kind == FinanceSyncKinds.Create);
        Assert.Equal(FinanceSyncStatuses.Cancelled, createItem.Status);
    }

    [Fact]
    public async Task DeletedUnsyncedEntry_CancelsPendingCreate_WithoutDeleteItem()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue);
        db.AccountLinks.AddRange(Link(DebitLoanAccount, DebitFinanceAccount), Link(CreditLoanAccount, CreditFinanceAccount));
        await db.SaveChangesAsync();

        var entry = MakeEntry();
        db.Entries.Add(entry);
        await db.SaveChangesAsync();

        Assert.Single(await db.FinanceSyncItems.ToListAsync()); // Pending create

        queue.Published.Clear();
        db.Entries.Remove(entry);
        await db.SaveChangesAsync();

        var item = Assert.Single(await db.FinanceSyncItems.ToListAsync());
        Assert.Equal(FinanceSyncKinds.Create, item.Kind);
        Assert.Equal(FinanceSyncStatuses.Cancelled, item.Status);
        Assert.Empty(queue.Published);
    }

    [Fact]
    public async Task FinanceDisabled_EnqueuesNothing()
    {
        var queue = new FakeFinanceSyncQueue();
        await using var db = TestHelpers.CreateContext(queue, financeEnabled: false);
        db.AccountLinks.AddRange(Link(DebitLoanAccount, DebitFinanceAccount), Link(CreditLoanAccount, CreditFinanceAccount));
        await db.SaveChangesAsync();

        db.Entries.Add(MakeEntry());
        await db.SaveChangesAsync();

        Assert.Empty(await db.FinanceSyncItems.ToListAsync());
        Assert.Empty(queue.Published);
    }
}
