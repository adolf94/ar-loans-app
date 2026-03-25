using System;
using System.Threading.Tasks;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Newtonsoft.Json.Linq;

namespace Ar.Loans.Api.Services
{
    public class LogService
    {
        private readonly AppDbContext _context;
        private readonly ILogger<LogService> _logger;

        public LogService(AppDbContext context, ILogger<LogService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task LogAsync(string level, string source, string message, object? data = null, string? chatId = null)
        {
            try
            {
                JObject? finalData = null;
                if (data != null)
                {
                    if (data is JObject jo)
                    {
                        finalData = jo;
                    }
                    else if (data is JToken token)
                    {
                        finalData = token is JObject obj ? obj : new JObject { ["Values"] = token };
                    }
                    else if (data is string strData && !string.IsNullOrWhiteSpace(strData))
                    {
                        string trimmed = strData.Trim();
                        if ((trimmed.StartsWith("{") && trimmed.EndsWith("}")) || 
                            (trimmed.StartsWith("[") && trimmed.EndsWith("]")))
                        {
                            try 
                            { 
                                var t = JToken.Parse(trimmed);
                                finalData = t is JObject obj ? obj : new JObject { ["Values"] = t };
                            }
                            catch { finalData = new JObject { ["Raw"] = strData }; }
                        }
                        else { finalData = new JObject { ["Raw"] = strData }; }
                    }
                    else if (data is JsonNode node)
                    {
                        var t = JToken.Parse(node.ToJsonString());
                        finalData = t is JObject obj ? obj : new JObject { ["Values"] = t };
                    }
                    else
                    {
                        finalData = JObject.FromObject(data);
                    }
                }

                var logEntry = new LogEntry
                {
                    Level = level,
                    Source = source,
                    Message = message,
                    ChatId = chatId,
                    Data = finalData,
                    PartitionKey = "default"
                };

                _context.Logs.Add(logEntry);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to write log entry to CosmosDB: {Source} - {Message}", source, message);
            }
        }

        public async Task LogInfoAsync(string source, string message, object? data = null, string? chatId = null)
            => await LogAsync("Information", source, message, data, chatId);

        public async Task LogErrorAsync(string source, string message, object? data = null, string? chatId = null)
            => await LogAsync("Error", source, message, data, chatId);

        public async Task<List<LogEntry>> GetRecentLogsByChatIdAsync(string chatId, int count = 10)
        {
            return await _context.Logs
                .Where(l => l.ChatId == chatId)
                .OrderByDescending(l => l.Timestamp)
                .Take(count)
                .ToListAsync();
        }
    }
}
