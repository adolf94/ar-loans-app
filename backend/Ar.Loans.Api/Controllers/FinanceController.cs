using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Ar.Loans.Api.Controllers
{
    public class FinanceController(
        FinanceService financeService,
        IAccountLinkRepo linkRepo,
        IAccountRepo accountRepo,
        ILoanRepo loanRepo,
        AppDbContext db,
        AppConfig appConfig,
        CurrentUser user,
        ILogger<FinanceController> logger)
    {
        private readonly FinanceService _financeService = financeService;
        private readonly IAccountLinkRepo _linkRepo = linkRepo;
        private readonly IAccountRepo _accountRepo = accountRepo;
        private readonly ILoanRepo _loanRepo = loanRepo;
        private readonly AppDbContext _db = db;
        private readonly AppConfig _appConfig = appConfig;
        private readonly CurrentUser _user = user;
        private readonly ILogger<FinanceController> _logger = logger;

        private IActionResult? GuardAdmin()
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("admin")) return new ForbidResult();
            return null;
        }

        /// <summary>List finance_app accounts for the link picker.</summary>
        [Function("GetFinanceAccounts")]
        public async Task<IActionResult> GetFinanceAccounts(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "finance/accounts")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;
            var accounts = await _financeService.GetAccountsAsync(_user.OidcUid);
            return new OkObjectResult(accounts);
        }

        /// <summary>List finance_app account groups for the link picker.</summary>
        [Function("GetFinanceAccountGroups")]
        public async Task<IActionResult> GetFinanceAccountGroups(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "finance/account-groups")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;
            var groups = await _financeService.GetAccountGroupsAsync(_user.OidcUid);
            return new OkObjectResult(groups);
        }

        /// <summary>List current loan account -> finance account links.</summary>
        [Function("GetAccountLinks")]
        public async Task<IActionResult> GetAccountLinks(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "finance/account-links")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;
            var links = await _linkRepo.GetAllLinks();
            return new OkObjectResult(links);
        }

        /// <summary>Create or replace a link between a loan account and a finance account.</summary>
        [Function("UpsertAccountLink")]
        public async Task<IActionResult> UpsertAccountLink(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "finance/account-links")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;

            var dto = await req.ReadFromJsonAsync<UpsertLinkRequest>();
            if (dto == null || dto.LoanAccountId == Guid.Empty || string.IsNullOrWhiteSpace(dto.FinanceAccountId))
                return new BadRequestObjectResult("loanAccountId and financeAccountId are required.");

            var accounts = await _accountRepo.GetAllAccounts();
            if (accounts.All(a => a.Id != dto.LoanAccountId))
                return new BadRequestObjectResult("Unknown loan account.");

            var link = await _linkRepo.UpsertLink(dto.LoanAccountId, dto.FinanceAccountId, _user.OidcUid);
            return new OkObjectResult(link);
        }

        /// <summary>Remove a link.</summary>
        [Function("DeleteAccountLink")]
        public async Task<IActionResult> DeleteAccountLink(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "finance/account-links/{id}")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;

            if (!Guid.TryParse(req.RouteValues["id"]?.ToString(), out var id))
                return new BadRequestResult();

            var deleted = await _linkRepo.DeleteLink(id);
            return deleted ? new NoContentResult() : new NotFoundResult();
        }

        /// <summary>Loan accounts with their linked finance account + both balances.</summary>
        [Function("GetLinkedBalances")]
        public async Task<IActionResult> GetLinkedBalances(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "finance/linked-balances")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();

            var accounts = await _accountRepo.GetAllAccounts();
            var links = await _linkRepo.GetAllLinks();

            // Accounts are owner-scoped in finance_app; fetch per distinct FinanceUserId.
            var financeAccountsByUser = new Dictionary<string, List<FinanceAccount>>();
            foreach (var financeUserId in links
                         .Select(l => l.FinanceUserId)
                         .Where(id => !string.IsNullOrWhiteSpace(id))
                         .Distinct())
            {
                financeAccountsByUser[financeUserId] = await _financeService.GetAccountsAsync(financeUserId);
            }

            var rows = accounts.OrderBy(a => a.Section).ThenBy(a => a.Name).Select(a =>
            {
                var link = links.FirstOrDefault(l => l.LoanAccountId == a.Id);
                var financeAccount = link != null
                    ? financeAccountsByUser.GetValueOrDefault(link.FinanceUserId)?.FirstOrDefault(f => f.Id == link.FinanceAccountId)
                    : null;

                return new LinkedBalanceRow
                {
                    LoanAccountId = a.Id,
                    LoanAccountName = a.Name,
                    Section = a.Section,
                    LoanBalance = a.Balance,
                    FinanceAccountId = link?.FinanceAccountId,
                    FinanceAccountName = financeAccount?.Name ?? (link != null ? "(not found)" : null),
                    FinanceBalance = financeAccount?.CurrentBalance,
                    IsLinked = link != null
                };
            }).ToList();

            return new OkObjectResult(rows);
        }

        /// <summary>
        /// Proxy to the Notification Ingester: list ingestion records for the SIGNED-IN
        /// USER (forwards the caller's bearer token - ingestions are scoped to {sub}).
        /// </summary>
        [Function("GetIngestions")]
        public async Task<IActionResult> GetIngestions(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "finance/ingestions")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;
            if (!_appConfig.Finance.Enabled)
                return new BadRequestObjectResult("Finance integration is not enabled.");

            var auth = req.Headers.Authorization.ToString();
            if (string.IsNullOrWhiteSpace(auth)) return new UnauthorizedResult();

            var status = req.Query["status"].FirstOrDefault() ?? "Pending";
            var topRaw = req.Query["$top"].FirstOrDefault() ?? req.Query["top"].FirstOrDefault();
            if (!int.TryParse(topRaw, out var top) || top <= 0) top = 50;

            var result = await _financeService.GetIngestionsAsync(auth, status, top);
            return new ContentResult { Content = result.Body, StatusCode = result.StatusCode, ContentType = "application/json" };
        }

        /// <summary>
        /// Process a selected ingestion into a loan payment:
        /// 1) creates the local payment (and any accrual/rebalance side-effects),
        /// 2) the finance transaction is created async by the sync worker (tagged with the
        ///    ingestionId), which then marks the ingestion Pending -> Confirmed.
        /// </summary>
        [Function("ProcessIngestion")]
        public async Task<IActionResult> ProcessIngestion(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "finance/ingestions/{ingestionId}/process")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;
            if (!_appConfig.Finance.Enabled)
                return new BadRequestObjectResult("Finance integration is not enabled.");

            var ingestionId = req.RouteValues["ingestionId"]?.ToString();
            if (string.IsNullOrWhiteSpace(ingestionId)) return new BadRequestResult();

            var dto = await req.ReadFromJsonAsync<IngestionProcessRequest>();
            if (dto == null || dto.LoanId == Guid.Empty || dto.DestinationAccountId == Guid.Empty || dto.Amount <= 0)
                return new BadRequestObjectResult("loanId, destinationAccountId and a positive amount are required.");

            // The mirrored finance transaction needs both sides linked (payment entry:
            // DR destination account / CR Loan Receivables).
            var destinationLink = await _linkRepo.GetByLoanAccountId(dto.DestinationAccountId);
            var receivablesLink = await _linkRepo.GetByLoanAccountId(AccountConstants.LoanReceivables);
            if (destinationLink == null || receivablesLink == null)
                return new BadRequestObjectResult(
                    "The destination account and/or Loan Receivables is not linked to a finance account. Configure the links in Finance settings first.");

            var loan = (await _loanRepo.GetAllLoans()).FirstOrDefault(l => l.Id == dto.LoanId);
            if (loan == null) return new NotFoundObjectResult("Loan not found.");
            if (loan.Status != "Active")
                return new BadRequestObjectResult("Loan is not active.");

            var payment = new Payment
            {
                Id = Guid.CreateVersion7(),
                UserId = loan.ClientId,
                LoanId = loan.Id,
                Amount = dto.Amount,
                Date = dto.Date ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)),
                Description = string.IsNullOrWhiteSpace(dto.Note)
                    ? $"Ingestion payment ({ingestionId})"
                    : dto.Note,
                DestinationAcctId = dto.DestinationAccountId,
                FinanceIngestionId = ingestionId
            };

            try
            {
                var result = await _loanRepo.RecordPayment(payment);
                return new OkObjectResult(new
                {
                    result.Payment,
                    result.Loan,
                    result.ClientName,
                    ingestionId,
                    message = "Payment recorded. Finance transaction and ingestion confirmation are processed asynchronously."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process ingestion {IngestionId}", ingestionId);
                return new BadRequestObjectResult(ex.Message);
            }
        }

        /// <summary>Recent sync-queue items (visibility/debugging for the settings UI).</summary>
        [Function("GetFinanceSyncItems")]
        public async Task<IActionResult> GetFinanceSyncItems(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "finance/sync-items")] HttpRequest req)
        {
            if (GuardAdmin() is { } denied) return denied;

            var status = req.Query["status"].FirstOrDefault();
            var query = _db.FinanceSyncItems.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
                query = query.Where(s => s.Status == status);

            var items = await query
                .OrderByDescending(s => s.CreatedAt)
                .Take(30)
                .ToListAsync();
            return new OkObjectResult(items);
        }
    }

    public class UpsertLinkRequest
    {
        [JsonPropertyName("loanAccountId")] public Guid LoanAccountId { get; set; }
        [JsonPropertyName("financeAccountId")] public string FinanceAccountId { get; set; } = string.Empty;
    }

    public class IngestionProcessRequest
    {
        [JsonPropertyName("loanId")] public Guid LoanId { get; set; }
        [JsonPropertyName("destinationAccountId")] public Guid DestinationAccountId { get; set; }
        [JsonPropertyName("amount")] public decimal Amount { get; set; }
        [JsonPropertyName("date")] public DateOnly? Date { get; set; }
        [JsonPropertyName("note")] public string? Note { get; set; }
    }

    public class LinkedBalanceRow
    {
        [JsonPropertyName("loanAccountId")] public Guid LoanAccountId { get; set; }
        [JsonPropertyName("loanAccountName")] public string LoanAccountName { get; set; } = string.Empty;
        [JsonPropertyName("section")] public string Section { get; set; } = string.Empty;
        [JsonPropertyName("loanBalance")] public decimal LoanBalance { get; set; }
        [JsonPropertyName("financeAccountId")] public string? FinanceAccountId { get; set; }
        [JsonPropertyName("financeAccountName")] public string? FinanceAccountName { get; set; }
        [JsonPropertyName("financeBalance")] public decimal? FinanceBalance { get; set; }
        [JsonPropertyName("isLinked")] public bool IsLinked { get; set; }
    }
}
