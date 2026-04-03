using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;

namespace Ar.Loans.Api.Services
{
    public class TelegramService
    {
        private readonly HttpClient _httpClient;
        private readonly AppConfig _appConfig;
        private readonly ILogger<TelegramService> _logger;
        private readonly LogService _logService;

        public TelegramService(HttpClient httpClient, AppConfig appConfig, ILogger<TelegramService> logger, LogService logService)
        {
            _httpClient = httpClient;
            _appConfig = appConfig;
            _logger = logger;
            _logService = logService;
        }

        private string EscapeMarkdownV2(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            // Characters to escape: [ ] ( ) # + - = { } . !
            char[] specialChars = { '[', ']', '(', ')', '#', '+', '-', '=', '{', '}', '.', '!', '|'};
            var sb = new StringBuilder();
            foreach (var c in text)
            {
                if (specialChars.Contains(c)) sb.Append("\\");
                sb.Append(c);
            }
            return sb.ToString();
        }

        public async Task<bool> EditMessageAsync(string chatId, long messageId, string text)
        {
            var botToken = _appConfig.Telegram.ClientSecret;
            if (string.IsNullOrEmpty(botToken))
            {
                _logger.LogError("Telegram Bot Token (ClientSecret) is missing in configuration.");
                return false;
            }

            var escapedText = EscapeMarkdownV2(text);
            var url = $"https://api.telegram.org/bot{botToken}/editMessageText";
            var payload = new
            {
                chat_id = chatId,
                message_id = messageId,
                text = escapedText,
                parse_mode = "MarkdownV2"
            };

            var response = await _httpClient.PostAsJsonAsync(url, payload);
            var responseContent = await response.Content.ReadAsStringAsync();

            await _logService.LogInfoAsync(
                "TelegramService.EditAsync",
                $"Editing Telegram message {messageId} in {chatId}",
                new
                {
                    Type = "editMessage",
                    Status = (int)response.StatusCode,
                    Payload = JObject.FromObject(payload),
                    Data = responseContent
                },
                chatId);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to edit Telegram message: {Error}", responseContent);
                return false;
            }

            return true;
        }

        public async Task<long?> SendMessageAsync(string chatId, string text)
        {
            var botToken = _appConfig.Telegram.ClientSecret;
            if (string.IsNullOrEmpty(botToken))
            {
                _logger.LogError("Telegram Bot Token (ClientSecret) is missing in configuration.");
                return null;
            }

            var escapedText = EscapeMarkdownV2(text);
            var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
            var payload = new
            {
                chat_id = chatId,
                text = escapedText,
                parse_mode = "MarkdownV2"
            };

            var response = await _httpClient.PostAsJsonAsync(url, payload);
            var responseContent = await response.Content.ReadAsStringAsync();
            
            JObject? parsedResponse = null;
            try { parsedResponse = JObject.Parse(responseContent); } catch { }

            // Log the outbound message (Success or Failure)
            await _logService.LogInfoAsync(
                "TelegramService.LogAsync", 
                $"Outbound Telegram message to {chatId}", 
                new 
                { 
                    Type = "sendMessage", 
                    Status = (int)response.StatusCode,
                    Payload = JObject.FromObject(payload), 
                    Data = parsedResponse ?? (object)responseContent 
                }, 
                chatId);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Failed to send Telegram message: {Error}", responseContent);
                return null;
            }

            try
            {
                if (parsedResponse != null && 
                    parsedResponse["result"]?["message_id"] != null)
                {
                    return parsedResponse["result"]!["message_id"]!.Value<long>();
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse Telegram message_id from: {Response}", responseContent);
            }

            return null;
        }
    }
}
