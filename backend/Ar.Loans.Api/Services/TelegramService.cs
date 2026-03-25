using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Services
{
    public class TelegramService
    {
        private readonly HttpClient _httpClient;
        private readonly AppConfig _appConfig;
        private readonly ILogger<TelegramService> _logger;

        public TelegramService(HttpClient httpClient, AppConfig appConfig, ILogger<TelegramService> logger)
        {
            _httpClient = httpClient;
            _appConfig = appConfig;
            _logger = logger;
        }

        public async Task<bool> SendMessageAsync(string chatId, string text)
        {
            var botToken = _appConfig.Telegram.ClientSecret;
            if (string.IsNullOrEmpty(botToken))
            {
                _logger.LogError("Telegram Bot Token (ClientSecret) is missing in configuration.");
                return false;
            }

            var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
            var payload = new
            {
                chat_id = chatId,
                text = text,
                parse_mode = "Markdown"
            };

            var response = await _httpClient.PostAsJsonAsync(url, payload);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to send Telegram message: {Error}", error);
                return false;
            }

            return true;
        }
    }
}
