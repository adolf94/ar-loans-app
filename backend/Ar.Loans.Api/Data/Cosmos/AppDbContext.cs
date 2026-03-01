using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Azure.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
		public class AppDbContext : DbContext
		{

				private readonly IConfiguration _configuration;
				public AppDbContext(DbContextOptions<AppDbContext> options, IConfiguration config) : base(options)
				{
						_configuration = config;
						base.Database.EnsureCreatedAsync().Wait();
				}


				public DbSet<User> Users { get; set; }
				public DbSet<Loan> Loans { get; set; }
				public DbSet<Payment> Payment { get; set; }
				public DbSet<Account> Accounts { get; set; }
				public DbSet<Entry> Entries { get; set; }
				public DbSet<UserBankAccount> BankAccounts { get; set; }
				public DbSet<BlobFile> Files { get; set; }


				protected override void OnModelCreating(ModelBuilder builder)
				{


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
								new Account { Id = AccountConstants.InterestIncome, Name = AccountConstants.GetName(AccountConstants.InterestIncome), Section = "Income", PartitionKey = "default", Balance = 0 },
								new Account { Id = AccountConstants.Unionbank, Name = AccountConstants.GetName(AccountConstants.Unionbank), Section = "Liabilities", PartitionKey = "default", Balance = 0 }
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
								opt.UseCosmos(cosmosEndpoint, EmulatorKey, db);
								
								
						});

						services.AddScoped<IDbHelper, DbHelper>();
						services.AddScoped<IUserRepo, UserRepo>();
						services.AddScoped<IBankAccountRepo, BankAccountRepo>();
						services.AddScoped<IFileRepo, FileRepo>();
						services.AddScoped<ILoanRepo, LoanRepo>();
						services.AddScoped<IAccountRepo, AccountRepo>();
						services.AddScoped<IEntryRepo, EntryRepo>();
						return services;
				}
		}

}
