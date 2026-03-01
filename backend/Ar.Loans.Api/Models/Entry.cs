using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Models
{
		public class Entry
		{
				public Guid Id { get; set; }
				public string Description { get; set; }
				public DateOnly Date { get; set; }
				public Guid DebitId { get; set; }
				public Guid CreditId { get; set; }
				public decimal Amount { get; set; }
				public Guid AddedBy { get; set; }
				public string? FileId { get; set; } = null;
				public string PartitionKey { get; set; } = "default";
		}
}
