using System.Net;
using System.Text.Json;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Xunit;

namespace Ar.Loans.Api.Tests;

public class FinanceServiceTests
{
    private static AppConfig Config(bool enabled = true) => TestHelpers.BuildAppConfig(enabled);

    private static List<FinanceLedgerEntry> BalancedEntries() => new()
    {
        new() { AccountId = "acc-credit", Amount = -250m },
        new() { AccountId = "acc-debit", Amount = 250m }
    };

    [Fact]
    public async Task CreateTransaction_PostsBalancedPayload_WithBearerToken()
    {
        var config = Config();
        var (finance, handler, authority) = TestHelpers.CreateFinanceService(config);

        handler.Respond(HttpStatusCode.Created,
            """{"id":"tx-1","userId":"user-123","date":"2026-09-05T00:00:00Z","type":"Transfer","entries":[]}""",
            containsPath: "/transactions", method: HttpMethod.Post);

        var tx = await finance.CreateTransactionAsync(
            "user-123", "2026-09-05T00:00:00Z", "Transfer", "Payment via partner app",
            BalancedEntries(), ingestionId: "ing-1");

        Assert.Equal("tx-1", tx?.Id);

        // Client credentials token acquired once
        Assert.Contains(authority.Requests, r => r.Uri!.AbsolutePath.Contains("/token"));

        var post = handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.Equal("Bearer test-token", post.Authorization);
        Assert.Contains("/api/transactions", post.Uri!.AbsolutePath);

        using var doc = JsonDocument.Parse(post.Body!);
        var root = doc.RootElement;
        Assert.Equal("user-123", root.GetProperty("userId").GetString());
        Assert.Equal("Transfer", root.GetProperty("type").GetString());
        Assert.Equal("ing-1", root.GetProperty("ingestionId").GetString());
        var entries = root.GetProperty("entries").EnumerateArray().ToList();
        Assert.Equal(2, entries.Count);
        Assert.Equal(0m, entries.Sum(e => e.GetProperty("amount").GetDecimal()));
    }

    [Fact]
    public async Task CreateTransaction_NonSuccess_ThrowsHttpRequestException()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config());
        handler.Respond(HttpStatusCode.BadRequest, """{"message":"Unbalanced entries"}""");

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            finance.CreateTransactionAsync("u", "2026-09-05T00:00:00Z", "Journal", null, BalancedEntries()));
    }

    [Fact]
    public async Task CreateTransaction_WhenDisabled_DoesNotCallApi()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config(enabled: false));

        var tx = await finance.CreateTransactionAsync("u", "2026-09-05T00:00:00Z", "Journal", null, BalancedEntries());

        Assert.Null(tx);
        Assert.Empty(handler.Requests);
    }

    [Theory]
    [InlineData(HttpStatusCode.OK, FinanceDeleteResult.Success)]
    [InlineData(HttpStatusCode.NoContent, FinanceDeleteResult.Success)]
    [InlineData(HttpStatusCode.NotFound, FinanceDeleteResult.NotFound)]
    [InlineData(HttpStatusCode.Forbidden, FinanceDeleteResult.NotAllowed)]
    [InlineData(HttpStatusCode.Unauthorized, FinanceDeleteResult.NotAllowed)]
    [InlineData(HttpStatusCode.InternalServerError, FinanceDeleteResult.Error)]
    public async Task DeleteTransaction_MapsStatusCodes(HttpStatusCode status, FinanceDeleteResult expected)
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config());
        handler.Respond(status, "{}");

        var result = await finance.DeleteTransactionAsync("tx-42");

        Assert.Equal(expected, result);
        var req = Assert.Single(handler.Requests);
        Assert.Equal(HttpMethod.Delete, req.Method);
        Assert.Contains("/api/transactions/tx-42", req.Uri!.AbsolutePath);
    }

    [Fact]
    public async Task ConfirmIngestion_PostsSnakeCaseBody_WithServiceToken()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config());
        handler.Respond(HttpStatusCode.OK, """{"id":"ing-1","status":"Confirmed"}""",
            containsPath: "/confirm-status", method: HttpMethod.Post);

        var ok = await finance.ConfirmIngestionAsync("ing-1", "user-123", "tx-5");

        Assert.True(ok);
        var req = handler.Requests.Single(r => r.Method == HttpMethod.Post);
        Assert.Contains("/ingestions/ing-1/confirm-status", req.Uri!.AbsolutePath);
        Assert.Equal("http://ingester.test", req.Uri!.GetLeftPart(UriPartial.Authority));

        using var doc = JsonDocument.Parse(req.Body!);
        Assert.Equal("user-123", doc.RootElement.GetProperty("user_id").GetString());
        Assert.Equal("tx-5", doc.RootElement.GetProperty("transaction_id").GetString());
    }

    [Fact]
    public async Task GetIngestions_ForwardsUserToken_NotServiceToken()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config());
        handler.Respond(HttpStatusCode.OK, """[{"id":"ing-1","status":"Pending"}]""", containsPath: "/ingestions");

        var result = await finance.GetIngestionsAsync("Bearer user-token-abc", "Pending", 10);

        Assert.Equal(200, result.StatusCode);
        Assert.Contains("ing-1", result.Body);
        var req = Assert.Single(handler.Requests);
        Assert.Equal("Bearer user-token-abc", req.Authorization);
        Assert.Contains("status=Pending", req.Uri!.Query);
    }

    [Fact]
    public async Task GetAccounts_CachesResult_PerOwner()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config());
        handler.Respond(HttpStatusCode.OK,
            """[{"id":"acc-1","userId":"user-123","name":"BDO Checking","currentBalance":1250.5,"accountType":"Bank","tags":[]}]""",
            containsPath: "/accounts", method: HttpMethod.Get);

        var first = await finance.GetAccountsAsync("user-123");
        var second = await finance.GetAccountsAsync("user-123");

        Assert.Single(first);
        Assert.Equal(1250.5m, first[0].CurrentBalance);
        Assert.Equal("Bank", first[0].AccountType);
        Assert.Equal("acc-1", second[0].Id);
        Assert.Single(handler.Requests); // only one HTTP call, second from cache

        var req = Assert.Single(handler.Requests);
        Assert.Contains("/api/owners/user-123/accounts", req.Uri!.AbsolutePath);
    }

    [Fact]
    public async Task GetAccountGroups_ReturnsOwnerScopedGroups()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config());
        handler.Respond(HttpStatusCode.OK,
            """[{"id":"grp-1","userId":"user-123","name":"Cash & Banks","accountType":"Cash"}]""",
            containsPath: "/account-group", method: HttpMethod.Get);

        var groups = await finance.GetAccountGroupsAsync("user-123");

        Assert.Single(groups);
        Assert.Equal("grp-1", groups[0].Id);
        Assert.Equal("Cash", groups[0].AccountType);
        var req = Assert.Single(handler.Requests);
        Assert.Contains("/api/owners/user-123/account-group", req.Uri!.AbsolutePath);
    }

    [Fact]
    public async Task GetAccountGroups_WhenDisabled_DoesNotCallApi()
    {
        var (finance, handler, _) = TestHelpers.CreateFinanceService(Config(enabled: false));

        var groups = await finance.GetAccountGroupsAsync("user-123");

        Assert.Empty(groups);
        Assert.Empty(handler.Requests);
    }
}
