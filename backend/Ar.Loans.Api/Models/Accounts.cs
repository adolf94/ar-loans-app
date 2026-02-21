using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Models
{
		public class Account
		{
				public Guid Id { get; set; }
				public string Name { get; set; }
				public string PartitionKey { get; set; } = "default";
				public string Section { get; set; }
				public decimal Balance { get; set; }
		}
}
