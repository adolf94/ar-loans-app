using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Services
{
    public enum FinanceDeleteResult
    {
        Success,
        NotFound,
        NotAllowed,
        Error
    }

    public class FinanceService(HttpClient httpClient, AppConfig config, AuthorityService authorityService, IMemoryCache cache, ILogger<FinanceService> logger)
    {
        private readonly HttpClient _httpClient = httpClient;
        private readonly AppConfig _config = config;
        private readonly AuthorityService _authorityService = authorityService;
        private readonly IMemoryCache _cache = cache;
        private readonly ILogger<FinanceService> _logger = logger;

        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        private bool IsConfigured =>
            _config.Finance.Enabled && !string.IsNullOrWhiteSpace(_config.Finance.BaseUrl);

        private async Task<string?> GetTokenAsync()
        {
            return await _authorityService.GetAccessTokenAsync(_config.Finance.Scope);
        }

        /// <summary>GET /api/owners/{userId}/accounts (accounts:read). Cached briefly per owner.</summary>
        public async Task<List<FinanceAccount>> GetAccountsAsync(string userId)
        {
            if (!IsConfigured || string.IsNullOrWhiteSpace(userId)) return new List<FinanceAccount>();

            var cacheKey = $"finance_accounts:{userId}";
            if (_cache.TryGetValue(cacheKey, out List<FinanceAccount>? cached) && cached != null)
                return cached;

            var token = await GetTokenAsync();
            if (token == null) return new List<FinanceAccount>();

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"{_config.Finance.BaseUrl.TrimEnd('/')}/owners/{Uri.EscapeDataString(userId)}/accounts");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Finance accounts fetch failed: {Status}", response.StatusCode);
                    return new List<FinanceAccount>();
                }

                var accounts = await response.Content.ReadFromJsonAsync<List<FinanceAccount>>(JsonOptions)
                               ?? new List<FinanceAccount>();
                _cache.Set(cacheKey, accounts, TimeSpan.FromMinutes(5));
                return accounts;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while fetching finance accounts.");
                return new List<FinanceAccount>();
            }
        }

        /// <summary>GET /api/owners/{userId}/account-group (accounts:read). Cached briefly per owner.</summary>
        public async Task<List<FinanceAccountGroup>> GetAccountGroupsAsync(string userId)
        {
            if (!IsConfigured || string.IsNullOrWhiteSpace(userId)) return new List<FinanceAccountGroup>();

            var cacheKey = $"finance_account_groups:{userId}";
            if (_cache.TryGetValue(cacheKey, out List<FinanceAccountGroup>? cached) && cached != null)
                return cached;

            var token = await GetTokenAsync();
            if (token == null) return new List<FinanceAccountGroup>();

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"{_config.Finance.BaseUrl.TrimEnd('/')}/owners/{Uri.EscapeDataString(userId)}/account-group");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Finance account groups fetch failed: {Status}", response.StatusCode);
                    return new List<FinanceAccountGroup>();
                }

                var groups = await response.Content.ReadFromJsonAsync<List<FinanceAccountGroup>>(JsonOptions)
                             ?? new List<FinanceAccountGroup>();
                _cache.Set(cacheKey, groups, TimeSpan.FromMinutes(5));
                return groups;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while fetching finance account groups.");
                return new List<FinanceAccountGroup>();
            }
        }

        /// <summary>POST /api/transactions (transactions:create). Returns the created transaction id, or null.</summary>
        public async Task<FinanceTransaction?> CreateTransactionAsync(
            string userId,
            string dateIso,
            string type,
            string? note,
            List<FinanceLedgerEntry> entries,
            string? ingestionId = null)
        {
            if (!IsConfigured)
            {
                _logger.LogWarning("Finance integration is not configured/enabled; skipping transaction create.");
                return null;
            }

            var token = await GetTokenAsync();
            if (token == null) return null;

            var body = new FinanceTransactionCreateRequest
            {
                UserId = userId,
                Date = dateIso,
                Type = type,
                Note = note,
                IngestionId = ingestionId,
                Entries = entries
            };

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, $"{_config.Finance.BaseUrl.TrimEnd('/')}/transactions");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                request.Content = JsonContent.Create(body, options: JsonOptions);

                var response = await _httpClient.SendAsync(request);
                var text = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Finance transaction create failed ({Status}): {Body}", (int)response.StatusCode, text);
                    throw new HttpRequestException($"Finance transaction create failed with status {(int)response.StatusCode}: {Truncate(text)}");
                }

                return JsonSerializer.Deserialize<FinanceTransaction>(text, JsonOptions);
            }
            catch (HttpRequestException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while creating finance transaction.");
                throw new HttpRequestException("Finance transaction create error", ex);
            }
        }

        /// <summary>DELETE /api/transactions/{id} (transactions:delete:self).</summary>
        public async Task<FinanceDeleteResult> DeleteTransactionAsync(string transactionId)
        {
            if (!IsConfigured) return FinanceDeleteResult.Error;

            var token = await GetTokenAsync();
            if (token == null) return FinanceDeleteResult.Error;

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Delete, $"{_config.Finance.BaseUrl.TrimEnd('/')}/transactions/{transactionId}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                var response = await _httpClient.SendAsync(request);

                return response.StatusCode switch
                {
                    HttpStatusCode.OK or HttpStatusCode.NoContent => FinanceDeleteResult.Success,
                    HttpStatusCode.NotFound => FinanceDeleteResult.NotFound,
                    HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized => FinanceDeleteResult.NotAllowed,
                    _ => FinanceDeleteResult.Error
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while deleting finance transaction {TxId}", transactionId);
                return FinanceDeleteResult.Error;
            }
        }

        /// <summary>
        /// GET {INGESTER_BASE_URL}/ingestions using the SERVICE's client_credentials
        /// token (ingestions:read is supported on the client_credentials flow).
        /// Returns the raw JSON body.
        /// </summary>
        public async Task<IngestionProxyResult> GetIngestionsAsync(string status, int top)
        {
            return await ProxyIngesterGetAsync(
                $"/ingestions?status={Uri.EscapeDataString(status)}&%24top={top}");
        }

        public async Task<IngestionProxyResult> GetIngestionAsync(string ingestionId)
        {
            return await ProxyIngesterGetAsync($"/ingestions/{Uri.EscapeDataString(ingestionId)}");
        }

        private async Task<IngestionProxyResult> ProxyIngesterGetAsync(string pathAndQuery)
        {
            var ingester = _config.Finance.IngesterBaseUrl?.TrimEnd('/');
            if (_config.Finance.Enabled == false || string.IsNullOrWhiteSpace(ingester))
                return new IngestionProxyResult(503, "{\"error\":\"Ingester not configured\"}");

            var token = await GetTokenAsync();
            if (token == null)
                return new IngestionProxyResult(502, "{\"error\":\"Finance service token unavailable\"}");

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Get, $"{ingester}{pathAndQuery}");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

                var response = await _httpClient.SendAsync(request);
                var body = await response.Content.ReadAsStringAsync();
                return new IngestionProxyResult((int)response.StatusCode, body);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while proxying ingester request {Path}", pathAndQuery);
                return new IngestionProxyResult(502, "{\"error\":\"Ingester request failed\"}");
            }
        }

        /// <summary>
        /// POST {INGESTER_BASE_URL}/ingestions/{id}/confirm-status (transactions:create, acts on behalf of user).
        /// Marks the ingestion Pending -> Confirmed.
        /// </summary>
        public async Task<bool> ConfirmIngestionAsync(string ingestionId, string userId, string transactionId)
        {
            var ingester = _config.Finance.IngesterBaseUrl?.TrimEnd('/');
            if (_config.Finance.Enabled == false || string.IsNullOrWhiteSpace(ingester)) return false;

            var token = await GetTokenAsync();
            if (token == null) return false;

            try
            {
                var body = new ConfirmIngestionRequest
                {
                    UserId = userId,
                    TransactionId = transactionId
                };

                var request = new HttpRequestMessage(HttpMethod.Post, $"{ingester}/ingestions/{Uri.EscapeDataString(ingestionId)}/confirm-status");
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                request.Content = JsonContent.Create(body, options: JsonOptions);

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Ingestion confirm failed ({Status}) for {IngestionId}: {Error}", (int)response.StatusCode, ingestionId, error);
                    return false;
                }
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while confirming ingestion {IngestionId}", ingestionId);
                return false;
            }
        }

        private static string Truncate(string s) => s.Length > 500 ? s[..500] : s;
    }

    public record IngestionProxyResult(int StatusCode, string Body);

    public class FinanceAccount
    {
        [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
        [JsonPropertyName("userId")] public string UserId { get; set; } = string.Empty;
        [JsonPropertyName("accountGroupId")] public string? AccountGroupId { get; set; }
        [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("tags")] public List<string> Tags { get; set; } = new();
        [JsonPropertyName("startingBalance")] public decimal StartingBalance { get; set; }
        [JsonPropertyName("currentBalance")] public decimal CurrentBalance { get; set; }
        [JsonPropertyName("accountType")] public string AccountType { get; set; } = string.Empty;
    }

    public class FinanceAccountGroup
    {
        [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
        [JsonPropertyName("userId")] public string UserId { get; set; } = string.Empty;
        [JsonPropertyName("name")] public string Name { get; set; } = string.Empty;
        [JsonPropertyName("accountType")] public string AccountType { get; set; } = string.Empty;
    }

    public class FinanceLedgerEntry
    {
        [JsonPropertyName("accountId")] public string AccountId { get; set; } = string.Empty;
        [JsonPropertyName("amount")] public decimal Amount { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
    }

    public class FinanceTransactionCreateRequest
    {
        [JsonPropertyName("userId")] public string UserId { get; set; } = string.Empty;
        [JsonPropertyName("date")] public string Date { get; set; } = string.Empty;
        [JsonPropertyName("type")] public string Type { get; set; } = "Journal";
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("ingestionId")] public string? IngestionId { get; set; }
        [JsonPropertyName("entries")] public List<FinanceLedgerEntry> Entries { get; set; } = new();
    }

    public class FinanceTransaction
    {
        [JsonPropertyName("id")] public string Id { get; set; } = string.Empty;
        [JsonPropertyName("userId")] public string UserId { get; set; } = string.Empty;
        [JsonPropertyName("createdBy")] public string? CreatedBy { get; set; }
        [JsonPropertyName("date")] public DateTime Date { get; set; }
        [JsonPropertyName("type")] public string Type { get; set; } = string.Empty;
        [JsonPropertyName("note")] public string? Note { get; set; }
        [JsonPropertyName("ingestionId")] public string? IngestionId { get; set; }
        [JsonPropertyName("entries")] public List<FinanceLedgerEntry> Entries { get; set; } = new();
    }

    internal class ConfirmIngestionRequest
    {
        [JsonPropertyName("user_id")] public string UserId { get; set; } = string.Empty;
        [JsonPropertyName("transaction_id")] public string TransactionId { get; set; } = string.Empty;
    }
}
