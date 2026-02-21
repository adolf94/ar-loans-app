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
				public string VertexProject { get; set; }
				public string VertexLocation { get; set; }
				public string AuthUrl { get; set; }
				public string AzureStorage { get; set; }
		}
}
