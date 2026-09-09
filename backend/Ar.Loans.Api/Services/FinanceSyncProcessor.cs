using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Services
{
    /// <summary>
    /// Processes FinanceSyncItems (durable queue in Cosmos): mirrors local journal
    /// entries to the finance app (create) and reverses them (delete-first via
    /// transactions:delete:self, with reversal-transaction fallback).
    /// </summary>
    public class FinanceSyncProcessor(AppDbContext db, FinanceService finance, AppConfig config, ILogger<FinanceSyncProcessor> logger)
    {
        private readonly AppDbContext _db = db;
        private readonly FinanceService _finance = finance;
        private readonly AppConfig _config = config;
        private readonly ILogger<FinanceSyncProcessor> _logger = logger;

        private static readonly JsonSerializerOptions PayloadJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        private static readonly string[] TransferableTypes = { "Cash", "Bank", "CreditCard", "Investment", "Asset", "Liability" };

        public async Task ProcessItemAsync(Guid itemId)
        {
            // Kill-switch: when the integration is off, leave items untouched (Pending)
            // so they are picked up once it is re-enabled instead of failing to the poison queue.
            if (!_config.Finance.Enabled)
            {
                _logger.LogInformation("Finance integration disabled; skipping sync item {ItemId}", itemId);
                return;
            }

            var item = await _db.FinanceSyncItems.FirstOrDefaultAsync(x => x.Id == itemId);
            if (item == null) return;
            if (item.Status == FinanceSyncStatuses.Completed || item.Status == FinanceSyncStatuses.Cancelled) return;

            var payload = DeserializePayload(item);
            if (payload == null)
            {
                item.Status = FinanceSyncStatuses.Cancelled;
                item.LastError = "Missing or invalid payload";
                item.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                return;
            }

            item.Status = FinanceSyncStatuses.Processing;
            item.Attempts += 1;
            item.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            try
            {
                if (item.Kind == FinanceSyncKinds.Create)
                    await ProcessCreateAsync(item, payload);
                else
                    await ProcessDeleteAsync(item, payload);
            }
            catch (Exception ex)
            {
                item.Status = FinanceSyncStatuses.Failed;
                item.LastError = Truncate(ex.Message);
                item.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();
                _logger.LogError(ex, "Finance sync item {ItemId} ({Kind}) failed", item.Id, item.Kind);
                throw; // Let the queue trigger retry with platform backoff
            }
        }

        private async Task ProcessCreateAsync(FinanceSyncItem item, FinanceSyncPayload payload)
        {
            // If the local entry vanished before sync, nothing to mirror.
            var preEntry = await _db.Entries.AsNoTracking().FirstOrDefaultAsync(e => e.Id == item.EntryId);
            if (preEntry == null)
            {
                await FinishItem(item, FinanceSyncStatuses.Cancelled, "Entry no longer exists");
                return;
            }
            if (!string.IsNullOrEmpty(preEntry.FinanceTransactionId))
            {
                // Already synced (duplicate delivery) - idempotent success.
                item.FinanceTransactionId = preEntry.FinanceTransactionId;
                await FinishItem(item, FinanceSyncStatuses.Completed);
                return;
            }

            var type = await DetermineTransactionTypeAsync(payload);
            var tx = await _finance.CreateTransactionAsync(
                payload.FinanceUserId,
                payload.Date,
                type,
                payload.Note,
                new List<FinanceLedgerEntry>
                {
                    new() { AccountId = payload.CreditFinanceAccountId, Amount = -payload.Amount },
                    new() { AccountId = payload.DebitFinanceAccountId, Amount = payload.Amount }
                },
                payload.IngestionId);

            if (tx == null || string.IsNullOrEmpty(tx.Id))
                throw new HttpRequestException("Finance API did not return a transaction id.");

            // Race guard: the entry may have been deleted while we created the finance tx.
            var entry = await _db.Entries.FirstOrDefaultAsync(e => e.Id == item.EntryId);
            if (entry == null)
            {
                _logger.LogWarning("Entry {EntryId} deleted during finance sync; reversing tx {TxId}", item.EntryId, tx.Id);
                await _finance.DeleteTransactionAsync(tx.Id);
                await FinishItem(item, FinanceSyncStatuses.Cancelled, "Entry deleted during sync; finance tx reversed");
                return;
            }

            entry.FinanceTransactionId = tx.Id;
            item.FinanceTransactionId = tx.Id;
            await FinishItem(item, FinanceSyncStatuses.Completed);

            if (!string.IsNullOrEmpty(payload.IngestionId))
            {
                var confirmed = await _finance.ConfirmIngestionAsync(payload.IngestionId, payload.FinanceUserId, tx.Id);
                if (!confirmed)
                    _logger.LogWarning("Finance tx {TxId} created for ingestion {IngestionId} but confirm-status failed",
                        tx.Id, payload.IngestionId);
            }
        }

        private async Task ProcessDeleteAsync(FinanceSyncItem item, FinanceSyncPayload payload)
        {
            if (!string.IsNullOrEmpty(item.FinanceTransactionId) && _config.Finance.UseDeleteForReversal)
            {
                var result = await _finance.DeleteTransactionAsync(item.FinanceTransactionId);
                if (result is FinanceDeleteResult.Success or FinanceDeleteResult.NotFound)
                {
                    await FinishItem(item, FinanceSyncStatuses.Completed);
                    return;
                }
                _logger.LogWarning("Finance delete of tx {TxId} returned {Result}; falling back to reversal transaction",
                    item.FinanceTransactionId, result);
            }

            // Fallback: create a reversal transaction (flipped signs).
            var type = await DetermineTransactionTypeAsync(payload);
            var tx = await _finance.CreateTransactionAsync(
                payload.FinanceUserId,
                payload.Date,
                type,
                payload.Note ?? "Reversal",
                new List<FinanceLedgerEntry>
                {
                    new() { AccountId = payload.DebitFinanceAccountId, Amount = -payload.Amount },
                    new() { AccountId = payload.CreditFinanceAccountId, Amount = payload.Amount }
                });

            if (tx == null || string.IsNullOrEmpty(tx.Id))
                throw new HttpRequestException("Finance reversal transaction was not created.");

            await FinishItem(item, FinanceSyncStatuses.Completed);
        }

        /// <summary>
        /// Sweep of stranded items not touched recently: Pending/Failed (dispatch
        /// lost or last attempt failed) and stale Processing (host died
        /// mid-process; the redelivered change-feed batch is filtered out by its
        /// Pending-only check). In change-feed mode this is the retry engine.
        /// </summary>
        public async Task<int> DrainStaleAsync(int take = 20)
        {
            if (!_config.Finance.Enabled) return 0;

            var cutoff = DateTime.UtcNow.AddMinutes(-5);
            var staleIds = await _db.FinanceSyncItems
                .Where(s => s.UpdatedAt < cutoff
                            && (s.Status == FinanceSyncStatuses.Pending
                                || s.Status == FinanceSyncStatuses.Failed
                                || s.Status == FinanceSyncStatuses.Processing))
                .OrderBy(s => s.CreatedAt)
                .Select(s => s.Id)
                .Take(take)
                .ToListAsync();

            var processed = 0;
            foreach (var id in staleIds)
            {
                try
                {
                    await ProcessItemAsync(id);
                    processed++;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Drain of stale finance sync item {ItemId} failed", id);
                }
            }
            return processed;
        }

        /// <summary>
        /// Manual/admin reprocessing of Pending/Failed items (used when queue delivery is
        /// lost - e.g. messages poisoned by a host-side dispatch issue). Unlike the
        /// opportunistic drain, this ignores the staleness cutoff and reports per-item
        /// outcomes so the caller can see why an item fails.
        /// </summary>
        public async Task<List<object>> RetryPendingAsync(int take = 50)
        {
            var results = new List<object>();
            if (!_config.Finance.Enabled) return results;

            var items = await _db.FinanceSyncItems
                .Where(s => s.Status == FinanceSyncStatuses.Pending || s.Status == FinanceSyncStatuses.Failed)
                .OrderBy(s => s.CreatedAt)
                .Take(take)
                .ToListAsync();

            foreach (var item in items)
            {
                try
                {
                    await ProcessItemAsync(item.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Manual retry of finance sync item {ItemId} failed", item.Id);
                }
                results.Add(new
                {
                    id = item.Id,
                    kind = item.Kind,
                    status = item.Status,
                    attempts = item.Attempts,
                    financeTransactionId = item.FinanceTransactionId,
                    lastError = item.LastError
                });
            }
            return results;
        }

        private async Task<string> DetermineTransactionTypeAsync(FinanceSyncPayload payload)
        {
            var accounts = await _finance.GetAccountsAsync(payload.FinanceUserId);
            var debitType = accounts.FirstOrDefault(a => a.Id == payload.DebitFinanceAccountId)?.AccountType;
            var creditType = accounts.FirstOrDefault(a => a.Id == payload.CreditFinanceAccountId)?.AccountType;

            if (debitType != null && creditType != null
                && TransferableTypes.Contains(debitType) && TransferableTypes.Contains(creditType))
                return "Transfer";

            return "Journal";
        }

        private async Task FinishItem(FinanceSyncItem item, string status, string? note = null)
        {
            item.Status = status;
            item.UpdatedAt = DateTime.UtcNow;
            item.LastError = note;
            await _db.SaveChangesAsync();
        }

        private static FinanceSyncPayload? DeserializePayload(FinanceSyncItem item)
        {
            if (string.IsNullOrEmpty(item.PayloadJson)) return null;
            try
            {
                return JsonSerializer.Deserialize<FinanceSyncPayload>(item.PayloadJson, PayloadJsonOptions);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string Truncate(string s) => s.Length > 1000 ? s[..1000] : s;
    }
}
