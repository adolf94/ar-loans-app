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
        private readonly TelegramService _telegramService;

        public TelegramWebhookFunction(
            ILogger<TelegramWebhookFunction> logger, 
            LogService logService,
            AppConfig appConfig,
            TelegramService telegramService)
        {
            _logger = logger;
            _logService = logService;
            _appConfig = appConfig;
            _telegramService = telegramService;
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
            await _logService.LogInfoAsync(
                "TelegramWebhook", 
                $"Webhook message from {user}", 
                new 
                { 
                    Type = "webhook", 
                    Status = 100,
                    Data = json 
                }, 
                chatId);

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

                await _telegramService.SendMessageAsync(chatId, sb.ToString());
            }
            
            return new OkResult();
        }

    }
}
