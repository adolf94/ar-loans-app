using System;
using System.Text.Json;
using System.Threading.Tasks;
using Ar.Loans.Api.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Functions
{
    /// <summary>
    /// Event-driven finance sync: fires per message pushed by AppDbContext after each
    /// local journal write. No polling - the Functions platform wakes the app from
    /// scale-to-zero when a queue message arrives.
    /// </summary>
    public class FinanceSyncFunction(FinanceSyncProcessor processor, ILogger<FinanceSyncFunction> logger)
    {
        private readonly FinanceSyncProcessor _processor = processor;
        private readonly ILogger<FinanceSyncFunction> _logger = logger;

        [Function("FinanceSyncFunction")]
        public async Task Run([QueueTrigger("finance-sync", Connection = "AzureWebJobsStorage")] string message)
        {
            Guid itemId = Guid.Empty;
            try
            {
                using var doc = JsonDocument.Parse(message);
                if (doc.RootElement.TryGetProperty("itemId", out var idProp))
                {
                    Guid.TryParse(idProp.GetString(), out itemId);
                }
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Unparseable finance-sync message: {Message}", message);
            }

            if (itemId != Guid.Empty)
            {
                // Throws on failure -> queue visibility retry (max dequeue count) -> poison queue.
                await _processor.ProcessItemAsync(itemId);
            }

            try
            {
                await _processor.DrainStaleAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Opportunistic finance sync drain failed");
            }
        }
    }
}
