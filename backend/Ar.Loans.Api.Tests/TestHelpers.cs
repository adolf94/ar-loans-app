using System.Net;
using System.Text;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;

namespace Ar.Loans.Api.Tests;

/// <summary>
/// AppDbContext variant for the InMemory provider. The Cosmos provider stores JObject
/// properties natively; InMemory needs explicit string conversions for them.
/// </summary>
public class TestAppDbContext : AppDbContext
{
    public TestAppDbContext(DbContextOptions<AppDbContext> options, IConfiguration config, IFinanceSyncQueue? syncQueue)
        : base(options, config, syncQueue) { }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        var converter = new NewtonsoftJsonConverter();
        builder.Entity<Ar.Loans.Api.Models.LogEntry>().Property(e => e.Payload).HasConversion(converter);
        builder.Entity<Ar.Loans.Api.Models.LogEntry>().Property(e => e.Data).HasConversion(converter);
        builder.Entity<Ar.Loans.Api.Models.BlobFile>().OwnsOne(e => e.Data);
        builder.Entity<Ar.Loans.Api.Models.Loan>().OwnsMany(e => e.Transactions);
    }

    private class NewtonsoftJsonConverter : Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter<JObject?, string?>
    {
        public NewtonsoftJsonConverter() : base(
            j => j == null ? null : j.ToString(),
            s => string.IsNullOrEmpty(s) ? null : JObject.Parse(s)) { }
    }
}

public class FakeFinanceSyncQueue : IFinanceSyncQueue
{
    public List<Guid> Published { get; } = new();
    public bool IsConfigured => true;

    public Task PublishAsync(Guid syncItemId)
    {
        Published.Add(syncItemId);
        return Task.CompletedTask;
    }
}

public class ScriptedHandler : HttpMessageHandler
{
    public record CannedResponse(HttpStatusCode StatusCode, string Body, string? ContainsPath = null, HttpMethod? Method = null);

    public class CapturedRequest
    {
        public HttpMethod Method { get; init; } = HttpMethod.Get;
        public Uri? Uri { get; init; }
        public string? Authorization { get; init; }
        public string Body { get; init; } = "";
    }

    private readonly List<CannedResponse> _responses = new();
    public List<CapturedRequest> Requests { get; } = new();

    public ScriptedHandler Respond(HttpStatusCode status, string body = "", string? containsPath = null, HttpMethod? method = null)
    {
        _responses.Add(new CannedResponse(status, body, containsPath, method));
        return this;
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content != null ? await request.Content.ReadAsStringAsync(cancellationToken) : "";
        Requests.Add(new CapturedRequest
        {
            Method = request.Method,
            Uri = request.RequestUri,
            Authorization = request.Headers.Authorization?.ToString(),
            Body = body
        });

        var match = _responses.FirstOrDefault(r =>
            (r.ContainsPath == null || (request.RequestUri?.AbsolutePath.Contains(r.ContainsPath) ?? false))
            && (r.Method == null || r.Method == request.Method))
            ?? _responses.FirstOrDefault();

        if (match == null)
            return new HttpResponseMessage(HttpStatusCode.ServiceUnavailable) { Content = new StringContent("{}") };

        _responses.Remove(match);
        return new HttpResponseMessage(match.StatusCode)
        {
            Content = new StringContent(match.Body, Encoding.UTF8, "application/json")
        };
    }
}

public static class TestHelpers
{
    public const string DefaultAuthorityJson = """{"access_token":"test-token","expires_in":3600}""";

    public static IConfiguration BuildConfig(bool financeEnabled = true, bool useDeleteForReversal = true)
    {
        return new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["AppConfig:Finance:Enabled"] = financeEnabled ? "true" : "false",
            ["AppConfig:Finance:BaseUrl"] = "http://finance.test/api",
            ["AppConfig:Finance:IngesterBaseUrl"] = "http://ingester.test",
            ["AppConfig:Finance:UseDeleteForReversal"] = useDeleteForReversal ? "true" : "false",
            ["AppConfig:Finance:SyncQueueName"] = "finance-sync",
            ["AppConfig:JwtConfig:Authority"] = "http://authority.test/api",
            ["AppConfig:JwtConfig:Audience"] = "ar-loans-api",
            ["AppConfig:JwtConfig:ClientSecret"] = "test-secret"
        }).Build();
    }

    public static AppDbContext CreateContext(FakeFinanceSyncQueue? queue = null, bool financeEnabled = true)
    {
        var dbName = "testdb-" + Guid.NewGuid();
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var config = BuildConfig(financeEnabled);
        return new TestAppDbContext(options, config, queue ?? new FakeFinanceSyncQueue());
    }

    public static AppDbContext CreateContextWithSharedDb(string dbName, FakeFinanceSyncQueue? queue = null, bool financeEnabled = true)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(dbName)
            .ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        var config = BuildConfig(financeEnabled);
        return new TestAppDbContext(options, config, queue ?? new FakeFinanceSyncQueue());
    }

    public static AppConfig BuildAppConfig(bool financeEnabled = true, bool useDeleteForReversal = true)
    {
        return BuildConfig(financeEnabled, useDeleteForReversal).GetRequiredSection("AppConfig").Get<Ar.Loans.Api.Utilities.AppConfig>()!;
    }

    public static Microsoft.Extensions.Logging.ILogger<T> NullLogger<T>() =>
        Microsoft.Extensions.Logging.Abstractions.NullLogger<T>.Instance;

    public static (Ar.Loans.Api.Services.FinanceService finance, ScriptedHandler financeHandler, ScriptedHandler authorityHandler)
        CreateFinanceService(Ar.Loans.Api.Utilities.AppConfig config)
    {
        var cache = new Microsoft.Extensions.Caching.Memory.MemoryCache(new Microsoft.Extensions.Caching.Memory.MemoryCacheOptions());
        var authorityHandler = new ScriptedHandler().Respond(HttpStatusCode.OK, DefaultAuthorityJson);
        var authorityClient = new HttpClient(authorityHandler) { BaseAddress = new Uri("http://authority.test") };
        var authority = new AuthorityService(authorityClient, config, cache, NullLogger<AuthorityService>());

        var financeHandler = new ScriptedHandler();
        var financeClient = new HttpClient(financeHandler);
        var finance = new Ar.Loans.Api.Services.FinanceService(financeClient, config, authority, cache, NullLogger<Ar.Loans.Api.Services.FinanceService>());
        return (finance, financeHandler, authorityHandler);
    }
}
