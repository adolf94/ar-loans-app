using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using System.Text.Json.Serialization;

namespace Ar.Loans.Api.Services
{
    public class AuthorityService(HttpClient httpClient, AppConfig config, IMemoryCache cache, ILogger<AuthorityService> logger)
    {
        private readonly HttpClient _httpClient = httpClient;
        private readonly AppConfig _config = config;
        private readonly IMemoryCache _cache = cache;
        private readonly ILogger<AuthorityService> _logger = logger;

        public async Task<string?> GetAccessTokenAsync(string? scope = null)
        {
            scope ??= "api://ar-auth-management/users:read:all";
            string cacheKey = $"authority_access_token_{scope.Replace(":", "_").Replace("/", "_")}";
            
            if (_cache.TryGetValue(cacheKey, out string? token)) return token;

            var authority = _config.JwtConfig.Authority?.TrimEnd('/');
            if (string.IsNullOrEmpty(authority)) return null;

            var requestBody = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "grant_type", "client_credentials" },
                { "client_id", _config.JwtConfig.Audience ?? "" },
                { "client_secret", _config.JwtConfig.ClientSecret ?? "" },
                { "scope", scope }
            });

            try 
            {
                var response = await _httpClient.PostAsync($"{authority}/token", requestBody);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("Failed to get access token from authority for scope {Scope}: {Error}", scope, error);
                    return null;
                }

                var result = await response.Content.ReadFromJsonAsync<TokenResponse>();
                if (result?.AccessToken != null)
                {
                    _cache.Set(cacheKey, result.AccessToken, TimeSpan.FromSeconds(result.ExpiresIn - 60));
                    return result.AccessToken;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while getting access token from authority for scope {Scope}.", scope);
            }

            return null;
        }

        public async Task<AuthUser?> GetUserDetailsAsync(string userId)
        {
            var token = await GetAccessTokenAsync();
            if (token == null) return null;

            var authority = _config.JwtConfig.Authority?.TrimEnd('/');
            var request = new HttpRequestMessage(HttpMethod.Get, $"{authority}/user/{userId}");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                
            var response = await _httpClient.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                if(response.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return null;
								}
								_logger.LogWarning("Failed to fetch user {UserId} from authority: {StatusCode}", userId, response.StatusCode);
                throw new Exception($"Failed to fetch user {userId} from authority: {response.StatusCode}");
						}

            return await response.Content.ReadFromJsonAsync<AuthUser>();
        }

        private class TokenResponse
        {
            [JsonPropertyName("access_token")]
            public string AccessToken { get; set; } = string.Empty;
            [JsonPropertyName("expires_in")]
            public int ExpiresIn { get; set; }
        }
    }

    public class AuthUser
    {
        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;
        [JsonPropertyName("mobileNumber")]
        public string? MobileNumber { get; set; }
        [JsonPropertyName("externalIdentities")]
        public List<AuthUserIdentity> ExternalIdentities { get; set; } = new();
        
        public string? GetTelegramId() 
        {
            return ExternalIdentities?.FirstOrDefault(x => x.Provider == "telegram")?.ProviderId;
        }
    }

    public class AuthUserIdentity
    {
        [JsonPropertyName("provider")]
        public string Provider { get; set; } = string.Empty;
        [JsonPropertyName("providerId")]
        public string ProviderId { get; set; } = string.Empty;
    }
}
