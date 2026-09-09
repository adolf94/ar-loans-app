# Plan: Finance Sync via Cosmos DB Change Feed Trigger

Replace the storage-queue doorbell for finance sync with a **Cosmos DB change
feed trigger** on the existing `FinanceSyncQueue` container. No new Azure
resource: the Cosmos item insert *is* the dispatch event.

## Why

- The local/Azure Functions host (4.1052) leases `finance-sync` queue messages
  and abandons them (~5x in <1s) **without ever dispatching to the worker** —
  all messages end up in `finance-sync-poison` with `Attempts:0`,
  `LastError:null` (azure-functions-host#11849). HTTP/timer dispatch works fine.
- The Cosmos DB trigger is a different extension/dispatch path; the queue bug
  does not apply.
- Versus the DTS alternative (previous plan): **zero new infrastructure** — no
  DTS resource, no DTS emulator container, no new client packages, no
  managed-identity data-plane role. Reuses the Cosmos account and the vNext
  emulator already in docker-compose.
- `AppDbContext.SaveChangesAsync` already commits `FinanceSyncItem` to Cosmos
  *before* publishing (AppDbContext.cs:160-168) — the durable write and the
  dispatch event become the same operation, eliminating the "saved but not
  published" gap entirely.

## Key Design Decisions (settled)

- **Cosmos remains the source of truth**: statuses, attempts, `LastError`,
  idempotency guards all live in `FinanceSyncItem`. The change feed is pure
  dispatch; lease container holds only checkpoints.
- **Publisher becomes a no-op behind `IFinanceSyncQueue`**: new
  `ChangeFeedSyncPublisher` with `PublishAsync` = no-op (log at debug),
  `IsConfigured => _config.Finance.Enabled`. Interface unchanged, so
  `AppDbContext`, DI shape, and `FakeFinanceSyncQueue`-based tests stay as-is.
- **Config-gated rollout**: `Finance.SyncMode = "queue" | "changefeed"` so
  rollback is a flag flip. Queue trigger + `FinanceSyncQueue.cs` are deleted
  only after change feed is proven (Phase 3).
- **Self-triggering is expected and harmless**: the trigger's own status writes
  (`Pending -> Processing -> Completed`) re-fire the feed. The function filters
  on `Status == Pending` and `ProcessItemAsync` already short-circuits on
  `Completed`/`Cancelled` and guards via `Entry.FinanceTransactionId` — no
  double-mirror path. Extra invocations are cheap no-ops.
- **Trigger = happy path only**: the function processes just what the feed
  recently added — items with `Status == Pending`. Errors are handled
  separately: `Failed` items are never retried inside the trigger; the drain
  timer + admin retry endpoint are the only error paths.
- **Never block the feed**: an escaping exception stops the checkpoint and
  retries the same batch forever, blocking all later items. The trigger must
  catch per-item: on failure the item is already `Failed` + `LastError` in
  Cosmos (processor does this), and the drain picks it up later.
- **Keep the drain, extend it**: `DrainStaleAsync` stays as the retry engine
  (backoff = 5-min staleness window). **Extend it to also sweep stale
  `Processing` items** — if the host dies mid-process, the redelivered batch is
  filtered out (status != Pending) and only the drain recovers it. Plus the
  admin retry endpoint for immediate sweeps.

---

## Phase 0 — Local infra

Nothing new to run: change feed works against the existing vNext emulator
(`mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:vnext-latest`,
`cosmos:8081`). No docker-compose changes.

`local.settings.json` — the trigger extension needs its own named connection
(cannot reuse `AppConfig__CosmosEndpoint` directly):

```json
"CosmosDBConnection": "AccountEndpoint=http://cosmos:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw=="
```

`host.json` — no changes required; optionally tune later:

```json
"extensions": { "cosmosDB": { "feedPollDelay": "00:00:02" } }
```

## Phase 1 — Packages (`backend/Ar.Loans.Api`)

- `Microsoft.Azure.Functions.Worker.Extensions.CosmosDB` **4.16.1** — change
  feed trigger for the isolated worker (pulls the WebJobs Cosmos extension into
  the host automatically).
- Verify compatibility with Worker 2.51.0 / Worker.Sdk 2.0.7 (both current —
  4.16.1 shipped alongside Worker 2.51 in the same dotnet-worker release).

## Phase 2 — Code

### 1. `Services/ChangeFeedSyncPublisher.cs` (new)

```csharp
public class ChangeFeedSyncPublisher : IFinanceSyncQueue
{
    // ctor: AppConfig, ILogger
    public bool IsConfigured => _config.Finance.Enabled;
    public Task PublishAsync(Guid syncItemId)
    {
        // no-op: the Cosmos insert in SaveChangesAsync already fired the feed
        _logger.LogDebug("Change-feed mode; item {ItemId} dispatched by insert", syncItemId);
        return Task.CompletedTask;
    }
}
```

### 2. DI + config

- `Program.cs:62`: pick implementation by `config.Finance.SyncMode`
  (`"changefeed"` -> `ChangeFeedSyncPublisher`, default `"queue"` -> existing
  `FinanceSyncQueue`).
- `Utilities/AppConfig.cs` `FinanceConfiguration`: add
  `public string SyncMode { get; set; } = "queue";`.
- `local.settings.json`: `AppConfig__Finance__SyncMode = "changefeed"` for dev.

### 3. `Functions/FinanceSyncFunction.cs`

- Add the change feed trigger next to the queue trigger (queue trigger kept
  until Phase 3); gate each on `SyncMode` via `Disabled`/early-return so only
  one path runs:

```csharp
[Function("FinanceSyncChangeFeed")]
public async Task RunChangeFeed(
    [CosmosDBTrigger(
        databaseName: "LoansDb",                 // resolve from AppConfig at runtime if needed
        containerName: "FinanceSyncQueue",
        Connection = "CosmosDBConnection",
        LeaseContainerName = "FinanceSyncLeases",
        CreateLeaseContainerIfNotExists = true)]
    IReadOnlyList<FinanceSyncItem> changes,
    CancellationToken ct)
{
    foreach (var item in changes.Where(i => i.Status == FinanceSyncStatuses.Pending))
    {
        try
        {
            await _processor.ProcessItemAsync(item.Id);
        }
        catch (Exception ex)
        {
            // item already Failed + LastError in Cosmos; drain timer retries.
            // NEVER rethrow: would stall the checkpoint and block the feed.
            _logger.LogError(ex, "Finance sync item {ItemId} failed; leaving to drain", item.Id);
        }
    }
}
```

  Notes:
  - Database/container names are attribute constants — keep them in sync with
    `AppDbContext.cs:250` (`FinanceSyncQueue`) and `AppConfig.DatabaseName`
    (`LoansDb`); if the DB name must stay configurable, use the
    `%AppConfig__DatabaseName%` app-setting indirection in the attribute.
  - Lease container `FinanceSyncLeases` is auto-created by the trigger
    (EF `EnsureCreatedAsync` will not create it — that's fine).
  - Fresh lease container starts at "now": any items already `Pending` at first
    deploy are picked up by the drain timer / admin retry, not lost.

### 4. Processor changes (`Services/FinanceSyncProcessor.cs`)

- `DrainStaleAsync` (line 176): include stale `Processing` in the sweep —
  `Status in (Pending, Failed) || (Status == Processing && UpdatedAt < now-5m)`.
  Guards against host-death-mid-process, where the redelivered feed batch is
  filtered out by the `Pending` check.
- Everything else unchanged (`ProcessItemAsync` idempotency already covers
  at-least-once redelivery).

### 5. Drain timer + admin retry

- New `[TimerTrigger("0 */5 * * * *")]` calling `DrainStaleAsync()` (gate on
  `SyncMode == "changefeed"` so it doesn't double-run with queue-mode's
  opportunistic drain in `FinanceSyncFunction.Run`).
- `FinanceController`: expose `RetryPendingAsync` (already in
  `FinanceSyncProcessor.cs:211`) as admin-guarded `POST /api/finance/sync/retry`;
  frontend button in the sync-items panel (`frontend/src/repositories/finance.ts`
  mutation + `FINANCE_SYNC_ITEMS` invalidation).

## Phase 3 — Cleanup (after change feed proven in dev + Azure)

- Delete `[QueueTrigger]` function, `Data/Azure/FinanceSyncQueue.cs`,
  `SyncMode` gate; simplify DI to change-feed-only (publisher registration can
  be removed entirely — keep `IFinanceSyncQueue` no-op or delete the hook from
  `SaveChangesAsync`).
- Delete `finance-sync` + `finance-sync-poison` queues (Azurite + Azure).
- Update tests: `FinanceEnqueueHookTests.cs`, `AccountLinkRepoTests.cs`,
  `TestHelpers.cs` (`FakeFinanceSyncQueue` keeps working — same interface;
  decide in this phase whether to drop the publish hook and its assertions).

## Phase 4 — Verification

1. `func start` -> log shows change feed processor registered, `FinanceSyncLeases`
   container created in the emulator.
2. Create a loan payment -> trigger fires within seconds; Cosmos item
   `Pending -> Processing -> Completed`; finance API has the mirrored
   transaction; observe (and confirm harmless) re-fired invocations from the
   status writes.
3. Failure injection: stop finance API -> item ends `Failed` with `LastError`,
   checkpoint still advances (later items keep flowing) -> drain timer retries
   every 5 min -> completes once API is back.
4. Host-death injection: kill `func` while an item is `Processing` -> restart ->
   drain timer sweeps the stale `Processing` item.
5. Re-delivery check: manually bump a `Completed` item through the feed (touch
   `UpdatedAt`) -> no-op, no double mirror.
6. Rollback check: flip `SyncMode=queue` -> old path behaves unchanged.

## Azure deployment

- **No new resources.** Reuses the existing Cosmos account.
- App setting `CosmosDBConnection` — prefer RBAC: set
  `CosmosDBConnection__accountEndpoint` (no key) and grant the function app
  identity *Cosmos DB Built-in Data Contributor* on the account (it likely
  already has data access for EF Core — same identity, same role).
- `AppConfig__Finance__SyncMode = "changefeed"`.
- Works on the current hosting plan; throughput impact is negligible (a few
  extra no-op invocations per item from status writes).

## Risks

- **Feed stall on unhandled exception** — mitigated by the catch-all in the
  trigger (see Key Design Decisions); review any future edits for rethrows.
- **Single partition key (`"default"`)** — one physical partition means ordered
  but serialized processing, and one lease. Fine at our volume (2-3 events per
  journal event); scaling out later requires re-keying `FinanceSyncItem` — out
  of scope.
- **`Processing` items invisible to the feed filter** — mitigated by extending
  `DrainStaleAsync` (Phase 2.4); worst-case recovery latency is ~10 min.
- **Emulator change-feed fidelity** — vNext emulator supports change feed v1
  (what the trigger uses); if a local gap appears, the `SyncMode=queue` flag
  keeps behavior unchanged while debugging.
- **Host bug (#11849) affects the storage-queue trigger in both local and
  Azure** (reproduced on a Linux dedicated App Service plan). The Cosmos DB
  trigger uses a different listener/dispatch path, so it should not apply — but
  if it somehow regresses too, flip `SyncMode=queue` + rely on drain timer.
