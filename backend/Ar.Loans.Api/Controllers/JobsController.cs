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
    /// Manual HTTP triggers for the jobs normally driven by [TimerTrigger]
    /// functions. Intended to be invoked by an external scheduler (cron)
    /// as a replacement for the timer host, authenticated with the
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
        /// Runs the interest accrual job (normally the daily 16:00 UTC
        /// InterestTimerFunction): accrues pending interest/penalties and
        /// sends Telegram notifications.
        /// </summary>
        [Function("RunInterestAccrual")]
        public async Task<IActionResult> RunInterestAccrual(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "jobs/interest-accrual")] HttpRequest req)
        {
            if (GuardCron() is { } denied) return denied;

            _logger.LogInformation("Interest accrual job triggered manually at {Time}", DateTime.UtcNow);
            await _interestTimer.Run(null!);
            return new OkObjectResult(new { job = "interest-accrual", status = "completed" });
        }

        /// <summary>
        /// Runs the interest notification job (normally the daily 02:00 UTC
        /// InterestNotificationFunction): sends reminders to clients and the
        /// upcoming-accruals summary to the guarantor channel.
        /// </summary>
        [Function("RunInterestNotification")]
        public async Task<IActionResult> RunInterestNotification(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "jobs/interest-notification")] HttpRequest req)
        {
            if (GuardCron() is { } denied) return denied;

            _logger.LogInformation("Interest notification job triggered manually at {Time}", DateTime.UtcNow);
            await _interestNotification.Run(null!);
            return new OkObjectResult(new { job = "interest-notification", status = "completed" });
        }

        /// <summary>
        /// Runs the finance sync drain job (normally the every-5-minute
        /// FinanceSyncDrain): sweeps stranded Pending/Failed and stale
        /// Processing sync items. No-ops unless Finance.SyncMode is
        /// "changefeed" and Finance integration is enabled.
        /// </summary>
        [Function("RunFinanceSyncDrain")]
        public async Task<IActionResult> RunFinanceSyncDrain(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "jobs/finance-sync-drain")] HttpRequest req)
        {
            if (GuardCron() is { } denied) return denied;

            _logger.LogInformation("Finance sync drain job triggered manually at {Time}", DateTime.UtcNow);
            await _financeSync.Drain(null!);
            return new OkObjectResult(new { job = "finance-sync-drain", status = "completed" });
        }
    }
}
