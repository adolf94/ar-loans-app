using System;
using System.Text.Json;
using System.Threading.Tasks;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Azure.Identity;
using Azure.Storage.Queues;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Data.Azure
{
    /// <summary>
    /// Azure Storage Queue publisher for finance sync items. Event-driven counterpart
    /// of the durable Cosmos FinanceSyncItem (queue trigger processes each message).
    /// </summary>
    public class FinanceSyncQueue : IFinanceSyncQueue
    {
        private readonly AppConfig _config;
        private readonly ILogger<FinanceSyncQueue> _logger;
        private readonly Lazy<QueueClient> _queueClient;

        public FinanceSyncQueue(AppConfig config, ILogger<FinanceSyncQueue> logger)
        {
            _config = config;
            _logger = logger;
            _queueClient = new Lazy<QueueClient>(CreateClient);
        }

        public bool IsConfigured =>
            _config.Finance.Enabled
            && !string.IsNullOrWhiteSpace(ResolveConnection())
            && !string.IsNullOrWhiteSpace(_config.Finance.SyncQueueName);

        // Prefer the app-specific storage connection; fall back to the Functions
        // host connection so the publisher and the [QueueTrigger] always target
        // the same storage account.
        private string ResolveConnection()
        {
            if (!string.IsNullOrWhiteSpace(_config.AzureStorage))
                return _config.AzureStorage;
            return Environment.GetEnvironmentVariable("AzureWebJobsStorage") ?? string.Empty;
        }

        private QueueClient CreateClient()
        {
            var connection = ResolveConnection();
            if (Uri.TryCreate(connection, UriKind.Absolute, out var uri))
            {
                // Account URL form -> RBAC via DefaultAzureCredential
                var service = new QueueServiceClient(uri, new DefaultAzureCredential());
                return service.GetQueueClient(_config.Finance.SyncQueueName);
            }

            var client = new QueueServiceClient(connection).GetQueueClient(_config.Finance.SyncQueueName);
            return client;
        }

        public async Task PublishAsync(Guid syncItemId)
        {
            if (!IsConfigured)
            {
                _logger.LogWarning("Finance sync queue not configured; item {ItemId} will be picked up opportunistically.", syncItemId);
                return;
            }

            try
            {
                var client = _queueClient.Value;
                await client.CreateIfNotExistsAsync();
                var message = JsonSerializer.Serialize(new { itemId = syncItemId });
                await client.SendMessageAsync(message);
            }
            catch (Exception ex)
            {
                // Durable item stays Pending in Cosmos; drains will retry.
                _logger.LogError(ex, "Failed to push finance sync message for item {ItemId}", syncItemId);
            }
        }
    }
}
