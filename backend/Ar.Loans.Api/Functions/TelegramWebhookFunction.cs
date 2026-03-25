using System;
using System.IO;
using System.Threading.Tasks;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Nodes;
using Newtonsoft.Json.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Linq;

namespace Ar.Loans.Api.Functions
{
    public class TelegramWebhookFunction
    {
        private readonly ILogger<TelegramWebhookFunction> _logger;
        private readonly LogService _logService;
        private readonly AppConfig _appConfig;
        private readonly IHttpClientFactory _httpClientFactory;

        public TelegramWebhookFunction(
            ILogger<TelegramWebhookFunction> logger, 
            LogService logService,
            AppConfig appConfig,
            IHttpClientFactory httpClientFactory)
        {
            _logger = logger;
            _logService = logService;
            _appConfig = appConfig;
            _httpClientFactory = httpClientFactory;
        }

        [Function("TelegramWebhook")]
        public async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "telegram/webhook")] HttpRequest req)
        {
            _logger.LogInformation("Telegram webhook triggered.");

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            
            if (string.IsNullOrEmpty(requestBody))
            {
                return new BadRequestResult();
            }

            // Parse incoming JSON
            var json = JObject.Parse(requestBody);
            var message = json?["message"];
            var text = message?["text"]?.ToString();
            var chatId = message?["chat"]?["id"]?.ToString();
            var user = message?["from"]?["username"]?.ToString() ?? message?["from"]?["first_name"]?.ToString();

            // Log the incoming message to CosmosDB (including ChatId)
            await _logService.LogInfoAsync("TelegramWebhook", $"Message from {user}", json, chatId);

            // Respond to "/" command
            if (text != null && text.Trim() == "/")
            {
                if (string.IsNullOrEmpty(chatId)) return new OkResult();

                var recentLogs = await _logService.GetRecentLogsByChatIdAsync(chatId, 5);
                var sb = new StringBuilder();
                sb.AppendLine("📋 *Recent Messages in this Chat:*");
                
                if (recentLogs.Count == 0)
                {
                    sb.AppendLine("_No recent logs found._");
                }
                else
                {
                    foreach (var log in recentLogs)
                    {
                        sb.AppendLine($"• {log.Timestamp:HH:mm:ss}: {log.Message}");
                    }
                }

                await SendTelegramMessage(chatId, sb.ToString());
            }
            
            return new OkResult();
        }

        private async Task SendTelegramMessage(string chatId, string text)
        {
            var botToken = _appConfig.Telegram.ClientSecret;
            if (string.IsNullOrEmpty(botToken))
            {
                _logger.LogError("Telegram Bot Token (ClientSecret) is missing in configuration.");
                return;
            }

            var url = $"https://api.telegram.org/bot{botToken}/sendMessage";
            var payload = new
            {
                chat_id = chatId,
                text = text,
                parse_mode = "Markdown"
            };

            var httpClient = _httpClientFactory.CreateClient();
            var response = await httpClient.PostAsJsonAsync(url, payload);

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to send Telegram message: {Error}", error);
            }
        }
    }
}
