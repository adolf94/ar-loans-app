using System;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Threading.Tasks;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json.Linq;
using Telegram.Bot;
using Telegram.Bot.Types;
using Telegram.Bot.Types.Enums;

namespace Ar.Loans.Api.Services
{
    public class TelegramService
    {
        public ITelegramBotClient BotClient { get; }
        private readonly AppConfig _appConfig;
        private readonly ILogger<TelegramService> _logger;
        private readonly LogService _logService;

        public TelegramService(HttpClient httpClient, AppConfig appConfig, ILogger<TelegramService> logger, LogService logService)
        {
            _appConfig = appConfig;
            _logger = logger;
            _logService = logService;

            var botToken = _appConfig.Telegram.ClientSecret;
            if (string.IsNullOrEmpty(botToken))
            {
                _logger.LogError("Telegram Token is missing.");
                // We initialize with a dummy if missing to avoid NullRef, but log big error
                BotClient = new TelegramBotClient("MISSING_TOKEN");
            }
            else
            {
                BotClient = new TelegramBotClient(botToken, httpClient);
            }
        }

        private string EscapeMarkdownV2(string text)
        {
            if (string.IsNullOrEmpty(text)) return text;
            // Characters to escape: [ ] ( ) # + - = { } . !
            char[] specialChars = { '[', ']', '(', ')', '#', '+', '-', '=', '{', '}', '.', '!'};
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
            try
            {
                var escapedText = EscapeMarkdownV2(text);
                await BotClient.EditMessageText(
                    chatId: chatId,
                    messageId: (int)messageId,
                    text: escapedText,
                    parseMode: ParseMode.MarkdownV2
                );

                await _logService.LogInfoAsync(
                    "TelegramService.EditAsync",
                    $"Edited Telegram message {messageId} in {chatId}",
                    new { Text = text },
                    chatId);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to edit Telegram message: {MessageId}", messageId);
                return false;
            }
        }

        public async Task<long?> SendPhotoAsync(string chatId, byte[] photoData, string fileName, string? caption = null)
        {
            try
            {
                using var ms = new System.IO.MemoryStream(photoData);
                var photoFile = InputFile.FromStream(ms, fileName);
                
                var message = await BotClient.SendPhoto(
                    chatId: chatId,
                    photo: photoFile,
                    caption: string.IsNullOrEmpty(caption) ? null : EscapeMarkdownV2(caption),
                    parseMode: ParseMode.MarkdownV2
                );

                return message.Id;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to upload Photo to {ChatId}", chatId);
                return null;
            }
        }

        public async Task<long?> SendPhotoAsync(string chatId, string photoUrl, string? caption = null)
        {
            try
            {
                var message = await BotClient.SendPhoto(
                    chatId: chatId,
                    photo: InputFile.FromUri(photoUrl),
                    caption: string.IsNullOrEmpty(caption) ? null : EscapeMarkdownV2(caption),
                    parseMode: ParseMode.MarkdownV2
                );

                return message.Id;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse message_id from photo response.");
                return null;
            }
        }

        public async Task<long?> SendMessageAsync(string chatId, string text)
        {
            try
            {
                var escapedText = EscapeMarkdownV2(text);
                Message message = await BotClient.SendMessage(
                    chatId: chatId,
                    text: escapedText,
                    parseMode: ParseMode.MarkdownV2
                );

            // Log the outbound message (Success or Failure)
                await _logService.LogInfoAsync(
                    "TelegramService.SendMessageAsync", 
                    $"Outbound Telegram message to {chatId}", 
                    new 
                    { 
                        Type = "sendMessage", 
                        Text = text,
                        Data = message
                    }, 
                    chatId);

                return message.Id;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send Telegram message to {ChatId}", chatId);
                return null;
            }
        }
    }
}
