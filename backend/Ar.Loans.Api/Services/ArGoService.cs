using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading.Tasks;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Services
{
    public class ArGoService(HttpClient httpClient, AppConfig config, AuthorityService authorityService, ILogger<ArGoService> logger)
    {
        private readonly HttpClient _httpClient = httpClient;
        private readonly AppConfig _config = config;
        private readonly AuthorityService _authorityService = authorityService;
        private readonly ILogger<ArGoService> _logger = logger;

        public async Task<string> ShortenUrlAsync(string longUrl, string? title = null, string? onBehalfOfUserId = null)
        {
            var baseUrl = _config.ArGo.BaseUrl?.TrimEnd('/');
            if (string.IsNullOrEmpty(baseUrl))
            {
                _logger.LogWarning("AR Go BaseUrl is not configured. Returning original URL.");
                return longUrl;
            }

            var token = await _authorityService.GetAccessTokenAsync(_config.ArGo.Scope);
            if (string.IsNullOrEmpty(token))
            {
                _logger.LogError("Failed to get access token for AR Go. Returning original URL.");
                return longUrl;
            }

            var requestBody = new
            {
                longUrl,
                title,
                siteName = "AR Loans",
                onBehalfOfUserId
            };

            try
            {
                var request = new HttpRequestMessage(HttpMethod.Post, $"{baseUrl}/shorten");
                request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                request.Content = JsonContent.Create(requestBody);

                var response = await _httpClient.SendAsync(request);
                if (!response.IsSuccessStatusCode)
                {
                    var error = await response.Content.ReadAsStringAsync();
                    _logger.LogError("AR Go shortening failed: {Error}", error);
                    return longUrl;
                }

                var result = await response.Content.ReadFromJsonAsync<ShortenResponse>();
                if (!string.IsNullOrEmpty(result?.ShortCode))
                {
                    // AR Go RedirectFunction route is api/links/{shortCode} but the user says GET /{shortCode}
                    // Actually, looking at AR Go RedirectFunction: [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "{shortCode?}")]
                    // So it's at the root of the API domain.
                    var arGoDomain = new Uri(baseUrl).GetLeftPart(UriPartial.Authority);
                    return $"{arGoDomain}/{result.ShortCode}";
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception while shortening URL via AR Go.");
            }

            return longUrl;
        }

        private class ShortenResponse
        {
            [System.Text.Json.Serialization.JsonPropertyName("shortCode")]
            public string? ShortCode { get; set; }
        }
    }
}
