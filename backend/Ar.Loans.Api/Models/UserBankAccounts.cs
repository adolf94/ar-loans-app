using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Models
{
		public class UserBankAccount
		{
				public Guid Id { get; set; } = Guid.CreateVersion7();
				public string AccountNumber { get; set; }
				public string Bank { get; set; }
				public string Name { get; set; }
				public string QrData { get; set; } = "";
				public string PartitionKey { get; set; } = "default";
				public Guid UserId { get; set; }
				public Guid? AccountId { get; set; }
				[JsonIgnore]
				public User? User { get; set; } = null;
		}
}
