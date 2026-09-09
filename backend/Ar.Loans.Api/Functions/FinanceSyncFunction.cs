using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Functions
{
    /// <summary>
    /// Event-driven finance sync. Two dispatch paths behind Finance.SyncMode:
    /// - "queue": storage-queue doorbell pushed by AppDbContext (FinanceSyncFunction).
    /// - "changefeed": the FinanceSyncItem Cosmos insert itself triggers
    ///   FinanceSyncChangeFeed on the FinanceSyncQueue container; publishing is a
    ///   no-op (ChangeFeedSyncPublisher).
    /// In change-feed mode a timer-driven drain (FinanceSyncDrain) is the error
    /// path for Failed/stale items - the trigger itself only processes Pending.
    /// </summary>
    public class FinanceSyncFunction(FinanceSyncProcessor processor, AppConfig config, ILogger<FinanceSyncFunction> logger)
    {
        private readonly FinanceSyncProcessor _processor = processor;
        private readonly AppConfig _config = config;
        private readonly ILogger<FinanceSyncFunction> _logger = logger;

        [Function("FinanceSyncFunction")]
        public async Task Run([QueueTrigger("finance-sync", Connection = "AzureWebJobsStorage")] string message)
        {
            if (!string.Equals(_config.Finance.SyncMode, "queue", StringComparison.OrdinalIgnoreCase))
                return;

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

        /// <summary>
        /// Happy path only: processes what the feed recently delivered with
        /// Status == Pending. The trigger's own status writes re-fire the feed
        /// (Pending -> Processing -> Completed); the status filter makes those
        /// cheap no-ops. Failed items are NEVER retried here - the drain timer
        /// and the admin retry endpoint handle errors separately.
        /// </summary>
        [Function("FinanceSyncChangeFeed")]
        public async Task RunChangeFeed(
            // Names must stay in sync with AppDbContext.cs (FinanceSyncQueue
            // container) and AppConfig.DatabaseName (LoansDb).
            // Bound as raw documents because the EF-written key is "id" (lowercase).
            [CosmosDBTrigger("LoansDb", "FinanceSyncQueue",
                Connection = "CosmosDBConnection",
                LeaseContainerName = "FinanceSyncLeases",
                CreateLeaseContainerIfNotExists = true)]
            IReadOnlyList<JsonElement> changes,
            CancellationToken cancellationToken)
        {
            foreach (var doc in changes)
            {
                var status = doc.TryGetProperty("Status", out var statusProp) ? statusProp.GetString() : null;
                if (!string.Equals(status, FinanceSyncStatuses.Pending, StringComparison.Ordinal))
                    continue;

                var id = doc.TryGetProperty("id", out var idProp)
                         && idProp.ValueKind == JsonValueKind.String
                         && Guid.TryParse(idProp.GetString(), out var parsed)
                    ? parsed
                    : Guid.Empty;
                if (id == Guid.Empty)
                {
                    _logger.LogWarning("Change feed document without a parsable id; skipping");
                    continue;
                }

                try
                {
                    await _processor.ProcessItemAsync(id);
                }
                catch (Exception ex)
                {
                    // Item already marked Failed + LastError in Cosmos. Never rethrow:
                    // an escaping exception stalls the checkpoint and blocks the feed.
                    _logger.LogError(ex, "Finance sync item {ItemId} failed via change feed; leaving to drain", id);
                }
            }
        }

        /// <summary>
        /// Error path for change-feed mode: sweeps stranded Pending/Failed and
        /// stale Processing items. Gated so it doesn't double-run with the
        /// opportunistic drain in the queue trigger.
        /// </summary>
        [Function("FinanceSyncDrain")]
        public async Task Drain([TimerTrigger("0 */5 * * * *")] TimerInfo timer)
        {
            if (!string.Equals(_config.Finance.SyncMode, "changefeed", StringComparison.OrdinalIgnoreCase)
                || !_config.Finance.Enabled)
                return;

            try
            {
                var processed = await _processor.DrainStaleAsync();
                if (processed > 0)
                    _logger.LogInformation("Finance sync drain processed {Count} item(s)", processed);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Finance sync drain failed");
            }
        }
    }
}
