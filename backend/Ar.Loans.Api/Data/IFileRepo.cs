using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Data
{
		public interface IFileRepo
		{
				public Task SaveFileRecord(Models.BlobFile file);

		}
}
