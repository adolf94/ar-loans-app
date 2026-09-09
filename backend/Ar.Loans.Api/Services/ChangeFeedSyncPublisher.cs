using System;
using System.Threading.Tasks;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Services
{
    /// <summary>
    /// Change-feed sync mode: the FinanceSyncItem Cosmos insert in SaveChangesAsync
    /// is itself the doorbell (CosmosDBTrigger on the FinanceSyncQueue container),
    /// so publishing is a no-op. Interface stays identical so the AppDbContext hook
    /// and tests are unaffected.
    /// </summary>
    public class ChangeFeedSyncPublisher(AppConfig config, ILogger<ChangeFeedSyncPublisher> logger) : IFinanceSyncQueue
    {
        private readonly AppConfig _config = config;
        private readonly ILogger<ChangeFeedSyncPublisher> _logger = logger;

        public bool IsConfigured => _config.Finance.Enabled;

        public Task PublishAsync(Guid syncItemId)
        {
            _logger.LogDebug("Change-feed sync mode; item {ItemId} dispatched by its Cosmos insert", syncItemId);
            return Task.CompletedTask;
        }
    }
}
