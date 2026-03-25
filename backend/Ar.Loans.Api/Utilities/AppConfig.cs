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
        public string GeminiKey { get; set; }
        public string UsersDb { get; set; }
        public string CosmosEndpoint { get; set; }
        public string CosmosKey { get; set; } = "";
        public string AuthUrl { get; set; }
        public string AzureStorage { get; set; }
        public string StorageContainer { get; set; }
        public bool AllowAccountCreation { get; set; } = false;

        public JwtConfiguration JwtConfig { get; set; } = new();
        public TelegramConfiguration Telegram { get; set; } = new();
    }
    public class TelegramConfiguration
    {
        public string ClientSecret { get; set; } = string.Empty;
    }
    public class JwtConfiguration
    {
        public string? Issuer { get; set; }
        public string? Audience { get; set; }
        public string? SecretKey { get; set; }
        public string? Authority { get; set; }
        public string? ClientId { get; set; }
        public string? RedirectUri { get; set; }
        public string? Scope { get; set; }
    }
}
