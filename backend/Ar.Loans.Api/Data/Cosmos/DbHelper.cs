using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
		public class DbHelper : IDbHelper
		{
				private readonly AppDbContext _ctx;

				public DbHelper(AppDbContext ctx)
				{
						_ctx = ctx;
				}

				public async Task<int> SaveChangesAsync()
				{
						return await _ctx.SaveChangesAsync();
				}

				public Task SetUpdated<T>(T item)
				{
						throw new NotImplementedException();
				}
		}
}
