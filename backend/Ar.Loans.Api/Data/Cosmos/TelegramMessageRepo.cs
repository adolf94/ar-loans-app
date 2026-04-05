using System;
using System.Threading.Tasks;
using Ar.Loans.Api.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class TelegramMessageRepo : ITelegramMessageRepo
    {
        private readonly AppDbContext _context;
        private readonly IMemoryCache _cache;
        private readonly ILogger<TelegramMessageRepo> _logger;
        private const string CacheKeyPrefix = "TelegramConvo_";

        public TelegramMessageRepo(AppDbContext context, IMemoryCache cache, ILogger<TelegramMessageRepo> logger)
        {
            _context = context;
            _cache = cache;
            _logger = logger;
        }

        public async Task<string> GetOrCreateConvoIdAsync(string chatId)
        {
            string cacheKey = $"{CacheKeyPrefix}{chatId}";
            
            if (_cache.TryGetValue(cacheKey, out string? convoId) && !string.IsNullOrEmpty(convoId))
            {
                // Refresh sliding expiration by re-setting the same value
                _cache.Set(cacheKey, convoId, new MemoryCacheEntryOptions
                {
                    SlidingExpiration = TimeSpan.FromMinutes(10)
                });
                return convoId;
            }

            // Create new convoId
            string newConvoId = Guid.NewGuid().ToString();
            _cache.Set(cacheKey, newConvoId, new MemoryCacheEntryOptions
            {
                SlidingExpiration = TimeSpan.FromMinutes(10)
            });
            
            return newConvoId;
        }

        public async Task RecordMessageAsync(TelegramMessage message)
        {
            try
            {
                _context.TelegramMessages.Add(message);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to record Telegram message for ChatId {ChatId}", message.ChatId);
            }
        }
    }
}
