using System.Net;
using System.Text.Json;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Ar.Loans.Api.Tests;

public class FinanceSyncProcessorTests
{
    private static readonly JsonSerializerOptions Camel = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private const string AccountsBankBank = """[{"id":"fin-debit","userId":"user-123","name":"GoTyme","currentBalance":1000,"accountType":"Bank","tags":[]},{"id":"fin-credit","userId":"user-123","name":"Receivables","currentBalance":0,"accountType":"Asset","tags":[]}]""";

    private const string AccountsBankIncome = """[{"id":"fin-debit","userId":"user-123","name":"Accrued","currentBalance":0,"accountType":"Asset","tags":[]},{"id":"fin-credit","userId":"user-123","name":"Interest Income","currentBalance":0,"accountType":"Income","tags":[]}]""";

    private static string PayloadJson(decimal amount = 250m, string? ingestionId = null, string? note = "Test entry") =>
        JsonSerializer.Serialize(new FinanceSyncPayload
        {
            DebitFinanceAccountId = "fin-debit",
            CreditFinanceAccountId = "fin-credit",
            FinanceUserId = "user-123",
            Amount = amount,
            Date = "2026-09-05T00:00:00Z",
            Note = note,
            IngestionId = ingestionId
        }, Camel);

    private static (FinanceSyncProcessor processor, AppDbContext db, ScriptedHandler financeHandler) CreateProcessor(
        bool useDeleteForReversal = true, bool financeEnabledContext = false)
    {
        var config = TestHelpers.BuildAppConfig(financeEnabled: true, useDeleteForReversal: useDeleteForReversal);
        var db = TestHelpers.CreateContext(financeEnabled: financeEnabledContext);
        var (finance, handler, _) = TestHelpers.CreateFinanceService(config);
        var processor = new FinanceSyncProcessor(db, finance, config, NullLogger<FinanceSyncProcessor>.Instance);
        return (processor, db, handler);
    }

    private static async Task<(Entry entry, FinanceSyncItem item)> SeedCreateAsync(AppDbContext db, string? ingestionId = null)
    {
        var entry = new Entry
        {
            Id = Guid.CreateVersion7(),
            Description = "Test entry",
            Date = new DateOnly(2026, 9, 5),
            DebitId = Guid.NewGuid(),
            CreditId = Guid.NewGuid(),
            Amount = 250m,
            AddedBy = Guid.NewGuid()
        };
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(),
            Kind = FinanceSyncKinds.Create,
            EntryId = entry.Id,
            Status = FinanceSyncStatuses.Pending,
            PayloadJson = PayloadJson(ingestionId: ingestionId)
        };
        db.Entries.Add(entry);
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();
        return (entry, item);
    }

    [Fact]
    public async Task Create_SyncsBankToAssetAsTransfer_AndStoresFinanceId()
    {
        var (processor, db, handler) = CreateProcessor();
        var (entry, item) = await SeedCreateAsync(db);

        handler.Respond(HttpStatusCode.OK, AccountsBankBank, containsPath: "/accounts", method: HttpMethod.Get);
        handler.Respond(HttpStatusCode.Created, """{"id":"tx-1","userId":"user-123","type":"Transfer","entries":[]}""",
            containsPath: "/transactions", method: HttpMethod.Post);

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        Assert.Equal("tx-1", item.FinanceTransactionId);
        Assert.Equal("tx-1", entry.FinanceTransactionId);

        var post = handler.Requests.Single(r => r.Method == HttpMethod.Post && r.Uri!.AbsolutePath.Contains("/transactions"));
        using var doc = JsonDocument.Parse(post.Body);
        Assert.Equal("Transfer", doc.RootElement.GetProperty("type").GetString());
        var entries = doc.RootElement.GetProperty("entries").EnumerateArray()
            .ToDictionary(e => e.GetProperty("accountId").GetString()!, e => e.GetProperty("amount").GetDecimal());
        Assert.Equal(250m, entries["fin-debit"]);
        Assert.Equal(-250m, entries["fin-credit"]);
    }

    [Fact]
    public async Task Create_InvolvingIncomeAccount_IsJournalType()
    {
        var (processor, db, handler) = CreateProcessor();
        var (_, item) = await SeedCreateAsync(db);

        handler.Respond(HttpStatusCode.OK, AccountsBankIncome, containsPath: "/accounts", method: HttpMethod.Get);
        handler.Respond(HttpStatusCode.Created, """{"id":"tx-2","userId":"user-123","type":"Journal","entries":[]}""",
            containsPath: "/transactions", method: HttpMethod.Post);

        await processor.ProcessItemAsync(item.Id);

        var post = handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.Equal("Journal", JsonDocument.Parse(post.Body).RootElement.GetProperty("type").GetString());
        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
    }

    [Fact]
    public async Task Create_WithIngestionId_ConfirmsIngestionAfterCreation()
    {
        var (processor, db, handler) = CreateProcessor();
        var (_, item) = await SeedCreateAsync(db, ingestionId: "ing-9");

        handler.Respond(HttpStatusCode.OK, AccountsBankBank, containsPath: "/accounts", method: HttpMethod.Get);
        handler.Respond(HttpStatusCode.Created, """{"id":"tx-3","userId":"user-123","type":"Transfer","entries":[]}""",
            containsPath: "/transactions", method: HttpMethod.Post);
        handler.Respond(HttpStatusCode.OK, """{"id":"ing-9","status":"Confirmed"}""",
            containsPath: "/confirm-status", method: HttpMethod.Post);

        await processor.ProcessItemAsync(item.Id);

        var confirm = handler.Requests.Single(r => r.Uri!.AbsolutePath.Contains("/ingestions/ing-9/confirm-status"));
        using var doc = JsonDocument.Parse(confirm.Body);
        Assert.Equal("user-123", doc.RootElement.GetProperty("user_id").GetString());
        Assert.Equal("tx-3", doc.RootElement.GetProperty("transaction_id").GetString());
        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
    }

    [Fact]
    public async Task Create_EntryMissing_CancelsWithoutApiCall()
    {
        var (processor, db, handler) = CreateProcessor();
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(),
            Kind = FinanceSyncKinds.Create,
            EntryId = Guid.NewGuid(), // never saved
            Status = FinanceSyncStatuses.Pending,
            PayloadJson = PayloadJson()
        };
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Cancelled, item.Status);
        Assert.DoesNotContain(handler.Requests, r => r.Method == HttpMethod.Post && r.Uri!.AbsolutePath.Contains("/transactions"));
    }

    [Fact]
    public async Task Create_EntryAlreadySynced_IsIdempotent()
    {
        var (processor, db, handler) = CreateProcessor();
        var (entry, item) = await SeedCreateAsync(db);
        entry.FinanceTransactionId = "tx-existing";
        await db.SaveChangesAsync();

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        Assert.Equal("tx-existing", item.FinanceTransactionId);
        Assert.DoesNotContain(handler.Requests, r => r.Uri!.AbsolutePath.Contains("/transactions"));
    }

    [Fact]
    public async Task Delete_UsesDeleteEndpointAndCompletes()
    {
        var (processor, db, handler) = CreateProcessor();
        var entry = new Entry
        {
            Id = Guid.CreateVersion7(), Date = new DateOnly(2026, 9, 5),
            DebitId = Guid.NewGuid(), CreditId = Guid.NewGuid(), Amount = 250m,
            Description = "d", FinanceTransactionId = "tx-9", PartitionKey = "default"
        };
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(), Kind = FinanceSyncKinds.Delete, EntryId = entry.Id,
            FinanceTransactionId = "tx-9", Status = FinanceSyncStatuses.Pending, PayloadJson = PayloadJson()
        };
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();

        handler.Respond(HttpStatusCode.NoContent, "", containsPath: "/transactions/tx-9", method: HttpMethod.Delete);

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        Assert.DoesNotContain(handler.Requests, r => r.Method == HttpMethod.Post);
    }

    [Fact]
    public async Task Delete_NotFound_CompletesIdempotently_WithoutReversal()
    {
        // Per the finalized finance contract, DELETE returns 404 both when the tx is
        // already gone and when it was never created by us - either way there is nothing
        // to reverse, so the item must complete WITHOUT creating a reversal transaction.
        var (processor, db, handler) = CreateProcessor();
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(), Kind = FinanceSyncKinds.Delete, EntryId = Guid.NewGuid(),
            FinanceTransactionId = "tx-gone", Status = FinanceSyncStatuses.Pending, PayloadJson = PayloadJson()
        };
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();

        handler.Respond(HttpStatusCode.NotFound, "", containsPath: "/transactions/tx-gone", method: HttpMethod.Delete);

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        Assert.DoesNotContain(handler.Requests, r => r.Method == HttpMethod.Post);
    }

    [Fact]
    public async Task Delete_NotAllowed_FallsBackToReversalTransaction()
    {
        var (processor, db, handler) = CreateProcessor();
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(), Kind = FinanceSyncKinds.Delete, EntryId = Guid.NewGuid(),
            FinanceTransactionId = "tx-9", Status = FinanceSyncStatuses.Pending, PayloadJson = PayloadJson()
        };
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();

        handler.Respond(HttpStatusCode.Forbidden, "", containsPath: "/transactions/tx-9", method: HttpMethod.Delete);
        handler.Respond(HttpStatusCode.OK, AccountsBankBank, containsPath: "/accounts", method: HttpMethod.Get);
        handler.Respond(HttpStatusCode.Created, """{"id":"tx-rev","userId":"user-123","type":"Transfer","entries":[]}""",
            containsPath: "/transactions", method: HttpMethod.Post);

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        var post = handler.Requests.Single(r => r.Method == HttpMethod.Post);
        using var doc = JsonDocument.Parse(post.Body);
        var entries = doc.RootElement.GetProperty("entries").EnumerateArray()
            .ToDictionary(e => e.GetProperty("accountId").GetString()!, e => e.GetProperty("amount").GetDecimal());
        // Reversal: flipped signs
        Assert.Equal(-250m, entries["fin-debit"]);
        Assert.Equal(250m, entries["fin-credit"]);
    }

    [Fact]
    public async Task Delete_UseDeleteForReversalDisabled_GoesStraightToReversal()
    {
        var (processor, db, handler) = CreateProcessor(useDeleteForReversal: false);
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(), Kind = FinanceSyncKinds.Delete, EntryId = Guid.NewGuid(),
            FinanceTransactionId = "tx-9", Status = FinanceSyncStatuses.Pending, PayloadJson = PayloadJson()
        };
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();

        handler.Respond(HttpStatusCode.OK, AccountsBankBank, containsPath: "/accounts", method: HttpMethod.Get);
        handler.Respond(HttpStatusCode.Created, """{"id":"tx-rev","userId":"user-123","type":"Transfer","entries":[]}""",
            containsPath: "/transactions", method: HttpMethod.Post);

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        Assert.DoesNotContain(handler.Requests, r => r.Method == HttpMethod.Delete);
    }

    [Fact]
    public async Task Create_ApiFailure_MarksFailedAndThrowsForRetry()
    {
        var (processor, db, handler) = CreateProcessor();
        var (_, item) = await SeedCreateAsync(db);

        handler.Respond(HttpStatusCode.OK, AccountsBankBank, containsPath: "/accounts", method: HttpMethod.Get);
        handler.Respond(HttpStatusCode.BadRequest, """{"message":"Unknown account"}""",
            containsPath: "/transactions", method: HttpMethod.Post);

        await Assert.ThrowsAsync<HttpRequestException>(() => processor.ProcessItemAsync(item.Id));

        Assert.Equal(FinanceSyncStatuses.Failed, item.Status);
        Assert.Equal(1, item.Attempts);
        Assert.NotNull(item.LastError);
    }

    [Fact]
    public async Task Process_AlreadyCompleted_IsNoOp()
    {
        var (processor, db, handler) = CreateProcessor();
        var item = new FinanceSyncItem
        {
            Id = Guid.CreateVersion7(), Kind = FinanceSyncKinds.Create, EntryId = Guid.NewGuid(),
            Status = FinanceSyncStatuses.Completed, PayloadJson = PayloadJson()
        };
        db.FinanceSyncItems.Add(item);
        await db.SaveChangesAsync();

        await processor.ProcessItemAsync(item.Id);

        Assert.Equal(FinanceSyncStatuses.Completed, item.Status);
        Assert.Empty(handler.Requests);
    }
}
