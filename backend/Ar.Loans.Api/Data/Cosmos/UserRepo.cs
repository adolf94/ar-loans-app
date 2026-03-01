using Ar.Loans.Api.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
		public class UserRepo : IUserRepo
		{
				private readonly AppDbContext _ctx;
				private readonly IQueryable<User> _q;

				public UserRepo(AppDbContext ctx)
				{
						_ctx = ctx;
						_q = ctx.Users.Where(e => e.PartitionKey == "default");
				}

				public async Task<User?> GetUserById(Guid id)
				{
						return await _q.Where(e => e.Id == id).FirstOrDefaultAsync();
				}

				public async Task<User[]> GetAllUsers()
				{
						return await _q.ToArrayAsync();
				}


				public async Task<User?> GetUser(Guid id)
				{
						return await _q.FirstOrDefaultAsync(e => e.Id == id);
				}

				public async Task<User> CreateUser(User item)
				{

						User? user = null;

						if(!string.IsNullOrEmpty(item.MobileNumber) || !string.IsNullOrEmpty(item.EmailAddress))
						{
								user = await _q.Where(e=>(!string.IsNullOrEmpty(item.EmailAddress) && e.EmailAddress == item.EmailAddress) || (item.MobileNumber != "" && e.MobileNumber == item.MobileNumber)).FirstOrDefaultAsync();
								
								if(user != null)
								{
										user.Accounts = item.Accounts
														.UnionBy(user.Accounts, a => a.AccountNumber)
														.ToList();
										_ctx.Update(user);
										return user;
								}
						}
								
								
								
						
						if(user == null)
						{
								var existingUser = await GetUserByEmailOrMobile(item.EmailAddress, item.MobileNumber);

								if (existingUser != null)
								{
										item.Id = existingUser.Id;
										item.Name = existingUser.Name ?? item.Name;
										item.EmailAddress = existingUser.EmailAddress ?? item.EmailAddress;
										item.MobileNumber = existingUser.MobileNumber ?? item.MobileNumber;
								}
						}


						await _ctx.Users.AddAsync(item);
						return item;
				}

				private async Task<User?> GetUserByEmailOrMobile(string email, string mobile)
				{
						var client = _ctx.Database.GetCosmosClient();
						var container = client.GetContainer("FinanceAppLocal", "User");

						var query = new Microsoft.Azure.Cosmos.QueryDefinition("SELECT * FROM c WHERE (c.EmailAddress = @email AND @email != '') OR (c.MobileNumber = @mobile AND @mobile != '')")
								.WithParameter("@email", email ?? "")
								.WithParameter("@mobile", mobile ?? "");

						using var iterator = container.GetItemQueryIterator<dynamic>(query);
						if (iterator.HasMoreResults)
						{
								var response = await iterator.ReadNextAsync();
								var item = response.FirstOrDefault();
								if (item != null)
								{
										return new User
										{
												Id = Guid.TryParse((string)item.id, out var id) ? id : Guid.Empty,
												Name = item.GoogleName,
												Role = "Client", // default mapping
												EmailAddress = (string)item.EmailAddress,
												MobileNumber = (string)item.MobileNumber
										};
								}
						}
						
						return null;
				}

		}
}
