using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Ar.Loans.Api.Services;
using System.Threading.Tasks;
using System.IO;
using Newtonsoft.Json;

namespace Ar.Loans.Api.Controllers
{
    public class TelegramController
    {
        private readonly TelegramService _telegramService;
        private readonly LogService _logService;

        public TelegramController(TelegramService telegramService, LogService logService)
        {
            _telegramService = telegramService;
            _logService = logService;
        }

        [Function("SendTelegramMessage")]
        public async Task<IActionResult> SendMessage(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "Telegram/send")] HttpRequest req)
        {
            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var request = JsonConvert.DeserializeObject<SendMessageRequest>(requestBody);

            if (request == null || string.IsNullOrEmpty(request.ChatId) || string.IsNullOrEmpty(request.Text))
            {
                return new BadRequestObjectResult("ChatId and Text are required.");
            }

            var success = await _telegramService.SendMessageAsync(request.ChatId, request.Text);

                if (success != null)
            {
                //await _logService.LogInfoAsync("AdminDashboard", $"Outbound message to {request.ChatId}", new { request.ChatId, request.Text }, request.ChatId);
                return new OkObjectResult(new { success = true });
            }

            return new StatusCodeResult(500);
        }
    }

    public class SendMessageRequest
    {
        public string ChatId { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
    }
}
