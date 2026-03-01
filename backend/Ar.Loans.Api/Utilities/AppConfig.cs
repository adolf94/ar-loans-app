using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Utilities
{
		public class AppConfig
		{
				public string DatabaseName { get; set; }
				public string GeminiKey { get; set; }
				public string UsersDb { get; set; }
				public string CosmosEndpoint { get; set; }
				public string CosmosKey { get; set; } = "";
 				public string AuthUrl { get; set; }
				public string AzureStorage { get; set; }

				public JwtConfiguration JwtConfig { get; set; } = new();
		}
		public class JwtConfiguration
		{
				public string Issuer { get; set; }
				public string Audience {get;set;}
				public string SecretKey {get; set;}
		}
}
