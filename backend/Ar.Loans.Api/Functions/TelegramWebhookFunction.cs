using System;
using System.IO;
using System.Threading.Tasks;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Data;
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
using Telegram.Bot.Types;

namespace Ar.Loans.Api.Functions
{
    public class TelegramWebhookFunction
    {
        private readonly ILogger<TelegramWebhookFunction> _logger;
        private readonly LogService _logService;
        private readonly AppConfig _appConfig;
        private readonly TelegramService _telegramService;
        private readonly ITelegramMessageRepo _telegramRepo;
        private readonly TelegramWorkflowService _workflowService;

        public TelegramWebhookFunction(
            ILogger<TelegramWebhookFunction> logger, 
            LogService logService,
            AppConfig appConfig,
            TelegramService telegramService,
            ITelegramMessageRepo telegramRepo,
            TelegramWorkflowService workflowService)
        {
            _logger = logger;
            _logService = logService;
            _appConfig = appConfig;
            _telegramService = telegramService;
            _telegramRepo = telegramRepo;
            _workflowService = workflowService;
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

            // Parse incoming JSON into Library Model using System.Text.Json (required for Telegram.Bot v22+)
            var update = System.Text.Json.JsonSerializer.Deserialize<Update>(requestBody, new JsonSerializerOptions 
            { 
                PropertyNameCaseInsensitive = true 
            });
            var message = update?.Message;
            if (message == null)
            {
                return new OkResult(); // Webhook might receive other update types (edits, etc.)
            }
        
            var text = message.Text;
            var chatId = message.Chat.Id.ToString();
            var user = message.From?.Username ?? message.From?.FirstName;

            // Log the incoming message to CosmosDB (including ChatId)
            var logId = await _logService.LogInfoAsync(
                "TelegramWebhook", 
                $"Webhook message from {user}", 
                new 
                { 
                    Type = "webhook", 
                    Status = 100,
                    Data = JObject.Parse(requestBody) 
                }, 
                chatId);

            // Record message metadata to dedicated container with conversation grouping
            if (!string.IsNullOrEmpty(chatId) && message != null)
            {
                var convoId = await _telegramRepo.GetOrCreateConvoIdAsync(chatId);
                var telegramMessage = new Models.TelegramMessage
                {
                    LogId = logId,
                    ConvoId = convoId,
                    MessageId = message.Id,
                    ChatId = chatId,
                    Sender = JObject.FromObject(message.From!),
                    UserId = null,
                    ConvoType = message.Chat.Type.ToString(),
                    Text = text,
                    Entities = message.Entities?.Select(e => new Models.TelegramMessageEntity
                    {
                        Offset = e.Offset,
                        Length = e.Length,
                        Type = e.Type.ToString()
                    }).ToList(),
                    Timestamp = DateTime.UtcNow
                };
                await _telegramRepo.RecordMessageAsync(telegramMessage);
            }

            // Respond to "/" command (Internal Logs - keeping for now)
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

            // --- DELEGATE TO WORKFLOW SERVICE ---
            await _workflowService.HandleUpdateAsync(update);
            
            return new OkResult();
        }

    }
}
