using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Utilities
{
    public class AppConfig
    {
        public string DatabaseName { get; set; }
        public string OpenRouterKey { get; set; } = string.Empty;
        public string OpenRouterModel { get; set; } = string.Empty;
        public string OpenRouterReasoningEffort { get; set; } = "medium";
        public string UsersDb { get; set; }
        public string CosmosEndpoint { get; set; }
        public string CosmosKey { get; set; } = "";
        public string AuthUrl { get; set; }
        public string BaseUrl { get; set; } = string.Empty;
        public string AzureStorage { get; set; }
        public string StorageContainer { get; set; }
        public bool AllowAccountCreation { get; set; } = false;

        public JwtConfiguration JwtConfig { get; set; } = new();
        public TelegramConfiguration Telegram { get; set; } = new();
        public ArGoConfiguration ArGo { get; set; } = new();
        public FinanceConfiguration Finance { get; set; } = new();
    }
    public class ArGoConfiguration
    {
        public string BaseUrl { get; set; } = string.Empty;
        public string Scope { get; set; } = "api://ar-go/links:create api://ar-go/links:on_behalf";
    }
    public class FinanceConfiguration
    {
        public bool Enabled { get; set; } = false;
        // Full API base including the /api suffix, e.g. https://finance.adolfrey.com/api
        public string BaseUrl { get; set; } = string.Empty;
        // Notification Ingester base, e.g. http://localhost:7072
        public string IngesterBaseUrl { get; set; } = string.Empty;
        public string Scope { get; set; } = "api://finance-app-api/transactions:create api://finance-app-api/transactions:read:self api://finance-app-api/accounts:read api://finance-app-api/ingestions:read api://finance-app-api/transactions:delete:self";
        public string SyncQueueName { get; set; } = "finance-sync";
        // Sync dispatch mode: "queue" (storage-queue doorbell) or "changefeed"
        // (Cosmos change feed trigger on the FinanceSyncQueue container).
        public string SyncMode { get; set; } = "queue";
        // Use DELETE /transactions/{id} (transactions:delete:self) for reversals;
        // falls back to reversal transactions when the scope is unavailable.
        public bool UseDeleteForReversal { get; set; } = true;
        // Static user ID for fetching finance accounts/groups and linking
        public string UserId { get; set; } = "3575cfa0-ec94-40d2-8b25-ee9f0f135027";
    }
    public class TelegramConfiguration
    {
        public string ClientSecret { get; set; } = string.Empty;
        public string WebhookUrl { get; set; } = string.Empty;
        public string GuarantorGroupChat { get; set; } = string.Empty;
        public string GuarantorChannel { get; set; } = string.Empty;
		}
    public class JwtConfiguration
    {
        public string? Issuer { get; set; }
        public string? Audience { get; set; }
        public string? SecretKey { get; set; }
        public string? Authority { get; set; }
        public string? ClientId { get; set; }
        public string? ClientSecret { get; set; }
        public string? RedirectUri { get; set; }
        public string? Scope { get; set; }
    }
}
