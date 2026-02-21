using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Models
{
		public class User
		{
				public Guid Id { get; set; }
				public string PartitionKey { get; set; } = "default";
				public string Name { get; set; }
				public string Role { get; set; }
				public string MobileNumber { get; set; }
				public string EmailAddress { get; set; }
				public List<UserBankAccount> Accounts { get; set; } = new List<UserBankAccount>();
		}


}
