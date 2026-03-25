using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Ar.Loans.Api.Models;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Ar.Loans.Api.Data.Cosmos;
using System.Linq;

namespace Ar.Loans.Api.Controllers
{
    public class LogController
    {
        private readonly AppDbContext _context;

        public LogController(AppDbContext context)
        {
            _context = context;
        }

        [Function("GetLogs")]
        public async Task<IActionResult> GetLogs(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "Log")] HttpRequest req)
        {
            int count = 50;
            if (req.Query.ContainsKey("count"))
            {
                int.TryParse(req.Query["count"], out count);
            }

            var logs = await _context.Logs
                .OrderByDescending(l => l.Timestamp)
                .Take(count)
                .ToListAsync();

            return new OkObjectResult(logs);
        }

        [Function("GetLogsByChatId")]
        public async Task<IActionResult> GetLogsByChatId(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "Log/chat/{chatId}")] HttpRequest req,
            string chatId)
        {
            int count = 50;
            if (req.Query.ContainsKey("count"))
            {
                int.TryParse(req.Query["count"], out count);
            }

            var logs = await _context.Logs
                .Where(l => l.ChatId == chatId)
                .OrderByDescending(l => l.Timestamp)
                .Take(count)
                .ToListAsync();

            return new OkObjectResult(logs);
        }
    }
}
