using Ar.Loans.Api.Models;
using Ar.Loans.Api.Services;
using Ar.Loans.Api.Utilities;
using Azure.Identity;
using Microsoft.EntityFrameworkCore;
using ConnectionMode = Microsoft.Azure.Cosmos.ConnectionMode;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
    public class AppDbContext : DbContext
    {

        private readonly IConfiguration _configuration;
        private readonly IFinanceSyncQueue? _syncQueue;
        private FinanceConfiguration? _financeConfig;

        public AppDbContext(DbContextOptions<AppDbContext> options, IConfiguration config, IFinanceSyncQueue? syncQueue = null) : base(options)
        {
            _configuration = config;
            _syncQueue = syncQueue;
        }


        public virtual DbSet<User> Users { get; set; }
        public virtual DbSet<Loan> Loans { get; set; }
        public virtual DbSet<Payment> Payment { get; set; }
        public virtual DbSet<Account> Accounts { get; set; }
        public virtual DbSet<Entry> Entries { get; set; }
        public virtual DbSet<UserBankAccount> BankAccounts { get; set; }
        public virtual DbSet<BlobFile> Files { get; set; }
        public virtual DbSet<InterestRule> InterestRules { get; set; }
        public virtual DbSet<LogEntry> Logs { get; set; }
        public virtual DbSet<Comment> Comments { get; set; } = null!;
        public virtual DbSet<AccountLink> AccountLinks { get; set; } = null!;
        public virtual DbSet<FinanceSyncItem> FinanceSyncItems { get; set; } = null!;

        private static readonly JsonSerializerOptions PayloadJsonOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true
        };

        internal FinanceConfiguration FinanceConfig =>
            _financeConfig ??= _configuration.GetSection("AppConfig:Finance").Get<FinanceConfiguration>() ?? new FinanceConfiguration();

        /// <summary>
        /// Finance mirroring hook: whenever journal entries are created/deleted and the
        /// involved accounts are linked to finance_app accounts, enqueue durable
        /// FinanceSyncItems and push event-driven queue messages after a successful save.
        /// </summary>
        public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
        {
            var publishedItemIds = new List<Guid>();

            if (FinanceConfig.Enabled)
            {
                var addedEntries = ChangeTracker.Entries<Entry>()
                    .Where(e => e.State == EntityState.Added).Select(e => e.Entity).ToList();
                var deletedEntries = ChangeTracker.Entries<Entry>()
                    .Where(e => e.State == EntityState.Deleted).Select(e => e.Entity).ToList();
                var addedPayments = ChangeTracker.Entries<Payment>()
                    .Where(e => e.State == EntityState.Added).Select(e => e.Entity).ToList();

                if (addedEntries.Count > 0 || deletedEntries.Count > 0)
                {
                    var links = await AccountLinks.AsNoTracking().ToListAsync(cancellationToken);
                    var now = DateTime.UtcNow;

                    foreach (var entry in addedEntries)
                    {
                        if (entry.SkipFinanceSync || !string.IsNullOrEmpty(entry.FinanceTransactionId)) continue;

                        var debitLink = links.FirstOrDefault(l => l.LoanAccountId == entry.DebitId);
                        var creditLink = links.FirstOrDefault(l => l.LoanAccountId == entry.CreditId);
                        if (debitLink == null || creditLink == null) continue;

                        var linkedPayment = addedPayments.FirstOrDefault(p => p.LedgerId == entry.Id);
                        var payload = new FinanceSyncPayload
                        {
                            DebitFinanceAccountId = debitLink.FinanceAccountId,
                            CreditFinanceAccountId = creditLink.FinanceAccountId,
                            FinanceUserId = !string.IsNullOrEmpty(debitLink.FinanceUserId) ? debitLink.FinanceUserId : creditLink.FinanceUserId,
                            Amount = entry.Amount,
                            Date = ToIsoUtc(entry.Date),
                            Note = entry.Description,
                            IngestionId = linkedPayment?.FinanceIngestionId
                        };

                        var item = new FinanceSyncItem
                        {
                            Id = Guid.CreateVersion7(),
                            Kind = FinanceSyncKinds.Create,
                            EntryId = entry.Id,
                            Status = FinanceSyncStatuses.Pending,
                            PayloadJson = JsonSerializer.Serialize(payload, PayloadJsonOptions),
                            CreatedAt = now,
                            UpdatedAt = now
                        };
                        FinanceSyncItems.Add(item);
                        publishedItemIds.Add(item.Id);
                    }

                    foreach (var entry in deletedEntries)
                    {
                        // A Create item that has not been processed yet is cancelled instead of reversed.
                        var pendingCreates = await FinanceSyncItems
                            .Where(s => s.EntryId == entry.Id
                                        && s.Kind == FinanceSyncKinds.Create
                                        && (s.Status == FinanceSyncStatuses.Pending || s.Status == FinanceSyncStatuses.Failed))
                            .ToListAsync(cancellationToken);
                        foreach (var p in pendingCreates)
                        {
                            p.Status = FinanceSyncStatuses.Cancelled;
                            p.UpdatedAt = now;
                        }

                        if (string.IsNullOrEmpty(entry.FinanceTransactionId)) continue;

                        var debitLink = links.FirstOrDefault(l => l.LoanAccountId == entry.DebitId);
                        var creditLink = links.FirstOrDefault(l => l.LoanAccountId == entry.CreditId);
                        if (debitLink == null || creditLink == null) continue;

                        var payload = new FinanceSyncPayload
                        {
                            DebitFinanceAccountId = debitLink.FinanceAccountId,
                            CreditFinanceAccountId = creditLink.FinanceAccountId,
                            FinanceUserId = !string.IsNullOrEmpty(debitLink.FinanceUserId) ? debitLink.FinanceUserId : creditLink.FinanceUserId,
                            Amount = entry.Amount,
                            Date = ToIsoUtc(entry.Date),
                            Note = $"Reversal: {entry.Description}"
                        };

                        var item = new FinanceSyncItem
                        {
                            Id = Guid.CreateVersion7(),
                            Kind = FinanceSyncKinds.Delete,
                            EntryId = entry.Id,
                            FinanceTransactionId = entry.FinanceTransactionId,
                            Status = FinanceSyncStatuses.Pending,
                            PayloadJson = JsonSerializer.Serialize(payload, PayloadJsonOptions),
                            CreatedAt = now,
                            UpdatedAt = now
                        };
                        FinanceSyncItems.Add(item);
                        publishedItemIds.Add(item.Id);
                    }
                }
            }

            var result = await base.SaveChangesAsync(cancellationToken);

            if (publishedItemIds.Count > 0 && _syncQueue != null)
            {
                foreach (var id in publishedItemIds)
                {
                    await _syncQueue.PublishAsync(id);
                }
            }

            return result;
        }

        internal static string ToIsoUtc(DateOnly date) => date.ToString("yyyy-MM-dd") + "T00:00:00Z";

        protected override void OnModelCreating(ModelBuilder builder)
        {


            builder.Entity<LogEntry>()
                    .ToContainer("Logs")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<LogEntry>()
                    .Property(e => e.Data)
                    .ToJsonProperty("Data");
            builder.Entity<User>()
                    .ToContainer("Users")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<Loan>()
                    .ToContainer("Loans")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<Payment>()
                    .ToContainer("Payments")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<Account>()
                    .ToContainer("Accounts")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<Account>().HasData(
                    new Account { Id = AccountConstants.ArGoTyme, Name = AccountConstants.GetName(AccountConstants.ArGoTyme), Section = "Assets", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.ArNonGoTyme, Name = AccountConstants.GetName(AccountConstants.ArNonGoTyme), Section = "Assets", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.MarkGoTyme, Name = AccountConstants.GetName(AccountConstants.MarkGoTyme), Section = "Assets", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.LoanReceivables, Name = AccountConstants.GetName(AccountConstants.LoanReceivables), Section = "Assets", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.ArIncome, Name = AccountConstants.GetName(AccountConstants.ArIncome), Section = "Income", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.MarkIncome, Name = AccountConstants.GetName(AccountConstants.MarkIncome), Section = "Income", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.AccruedInterest, Name = AccountConstants.GetName(AccountConstants.AccruedInterest), Section = "Income", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.InterestIncome, Name = AccountConstants.GetName(AccountConstants.InterestIncome), Section = "Income", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.LatePenaltyIncome, Name = AccountConstants.GetName(AccountConstants.LatePenaltyIncome), Section = "Income", PartitionKey = "default", Balance = 0 },
                    new Account { Id = AccountConstants.Unionbank, Name = AccountConstants.GetName(AccountConstants.Unionbank), Section = "Liabilities", PartitionKey = "default", Balance = 0 }
            );

            builder.Entity<InterestRule>().HasData(
                    new InterestRule { Id = new Guid("019cbbab-e1dd-7e68-b501-f2962425d11d"), Name = "Default", InterestPerMonth = 10, GracePeriodDays = 0, GracePeriodInterest = 0, LatePaymentPenalty = 0, DefaultTerms = 0, InterestBase = "principal", PartitionKey = "default" }
            );

            builder.Entity<Entry>()
                    .ToContainer("Entries")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);
            builder.Entity<BlobFile>()
                    .ToContainer("Files")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);
            builder.Entity<UserBankAccount>()
                    .ToContainer("BankAccounts")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);
            builder.Entity<InterestRule>()
                    .ToContainer("InterestRules")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);
            builder.Entity<Comment>()
                    .ToContainer("Comments")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<AccountLink>()
                    .ToContainer("AccountLinks")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);

            builder.Entity<FinanceSyncItem>()
                    .ToContainer("FinanceSyncQueue")
                    .HasPartitionKey(e => e.PartitionKey)
                    .HasKey(c => c.Id);


        }
    }

    public static class ServiceExtension
    {
        public static IServiceCollection AddCosmosDbContext(this IServiceCollection services, IConfiguration Configuration)
        {
            string? db = Environment.GetEnvironmentVariable("AppConfig__DatabaseName");
            services.AddDbContext<AppDbContext>(opt =>
            {
                var cosmosEndpoint = Environment.GetEnvironmentVariable("AppConfig__CosmosEndpoint")!;

                // var encrypted = Configuration.GetConnectionString("CosmosDb")!;
                // var connection = AesOperation.DecryptString(passkey, encrypted);

                // The Emulator requires the well-known Auth Key
                string EmulatorKey = Environment.GetEnvironmentVariable("AppConfig__CosmosKey");
                opt.UseCosmos(cosmosEndpoint, EmulatorKey, db, cosmosOptions =>
                {
                    cosmosOptions.ConnectionMode(ConnectionMode.Gateway);
                });


            });

            services.AddScoped<IDbHelper, DbHelper>();
            services.AddScoped<IUserRepo, UserRepo>();
            services.AddScoped<IBankAccountRepo, BankAccountRepo>();
            services.AddScoped<IFileRepo, FileRepo>();
            services.AddScoped<ILoanRepo, LoanRepo>();
            services.AddScoped<IAccountRepo, AccountRepo>();
            services.AddScoped<IEntryRepo, EntryRepo>();
            services.AddScoped<IInterestRuleRepo, InterestRuleRepo>();
            services.AddScoped<ICommentRepo, CommentRepo>();
            services.AddScoped<IAccountLinkRepo, AccountLinkRepo>();

            return services;
        }
    }

}
