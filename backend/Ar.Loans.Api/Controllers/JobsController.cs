using System;
using System.Threading.Tasks;
using Ar.Loans.Api.Functions;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Controllers
{
    /// <summary>
    /// HTTP triggers for the jobs previously driven by [TimerTrigger]
    /// functions (InterestTimerFunction, InterestNotificationFunction,
    /// FinanceSyncDrain). Intended to be invoked by an external scheduler
    /// (cron) as a replacement for the timer host, authenticated with the
    /// api://{JwtConfig.Audience}/cron:execute scope.
    /// </summary>
    public class JobsController(
        InterestTimerFunction interestTimer,
        InterestNotificationFunction interestNotification,
        FinanceSyncFunction financeSync,
        CurrentUser user,
        ILogger<JobsController> logger)
    {
        private readonly InterestTimerFunction _interestTimer = interestTimer;
        private readonly InterestNotificationFunction _interestNotification = interestNotification;
        private readonly FinanceSyncFunction _financeSync = financeSync;
        private readonly CurrentUser _user = user;
        private readonly ILogger<JobsController> _logger = logger;

        private IActionResult? GuardCron()
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("cron:execute", new[] { AuthorizeLookUp.Scope })) return new ForbidResult();
            return null;
        }

        /// <summary>
        /// Runs the interest accrual job: accrues pending interest/penalties
        /// and sends Telegram notifications. Intended to be invoked by an
        /// external scheduler daily at 16:00 UTC (replacing the disabled
        /// InterestTimerFunction timer trigger).
        /// </summary>
        [Function("RunInterestAccrual")]
        public async Task<IActionResult> RunInterestAccrual(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "jobs/interest-accrual")] HttpRequest req)
        {
            if (GuardCron() is { } denied) return denied;

            _logger.LogInformation("Interest accrual job triggered manually at {Time}", DateTime.UtcNow);
            await _interestTimer.RunAsync();
            return new OkObjectResult(new { job = "interest-accrual", status = "completed" });
        }

        /// <summary>
        /// Runs the interest notification job: sends reminders to clients and
        /// the upcoming-accruals summary to the guarantor channel. Intended to
        /// be invoked by an external scheduler daily at 02:00 UTC (replacing
        /// the disabled InterestNotificationFunction timer trigger).
        /// </summary>
        [Function("RunInterestNotification")]
        public async Task<IActionResult> RunInterestNotification(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "jobs/interest-notification")] HttpRequest req)
        {
            if (GuardCron() is { } denied) return denied;

            _logger.LogInformation("Interest notification job triggered manually at {Time}", DateTime.UtcNow);
            await _interestNotification.RunAsync();
            return new OkObjectResult(new { job = "interest-notification", status = "completed" });
        }

        /// <summary>
        /// Runs the finance sync drain job: sweeps stranded Pending/Failed and
        /// stale Processing sync items. Intended to be invoked by an external
        /// scheduler once a day as a low-frequency safety net (replacing the
        /// disabled FinanceSyncDrain timer trigger) - the primary recovery
        /// paths are the opportunistic drains in the queue and change-feed
        /// triggers. No-ops unless Finance.SyncMode is "changefeed" and
        /// Finance integration is enabled.
        /// </summary>
        [Function("RunFinanceSyncDrain")]
        public async Task<IActionResult> RunFinanceSyncDrain(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "jobs/finance-sync-drain")] HttpRequest req)
        {
            if (GuardCron() is { } denied) return denied;

            _logger.LogInformation("Finance sync drain job triggered manually at {Time}", DateTime.UtcNow);
            await _financeSync.DrainAsync();
            return new OkObjectResult(new { job = "finance-sync-drain", status = "completed" });
        }
    }
}
