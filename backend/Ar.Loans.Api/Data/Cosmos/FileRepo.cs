using Ar.Loans.Api.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data.Cosmos
{
		public class FileRepo
		{
				private readonly AppDbContext _context;

				public FileRepo(AppDbContext context)
				{
						_context = context;
				}

				public async Task SaveFileRecord(Models.BlobFile file)
				{
						await _context.Files.AddAsync(file);
				}

		}
}
