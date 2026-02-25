using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Utilities
{
		public class CurrentUser
		{
				public Guid UserId { get; set; }
				public string EmailAddress { get; set; } = "";

				public string[] Roles { get; set; } = Array.Empty<string>();
				public string App { get; set; } = "";
				public string Name { get; set; } = "";
				public bool IsAuthenticated { get; set; } = false;  


				public bool IsAuthorized(string roles)
				{
						if (!IsAuthenticated) return false;
						if (!roles.ToLower().Split(",").Any(e=>Roles.Any(r=>r.ToLower()==e.ToLower()))) return false;
						return true;
				}
		}
}
