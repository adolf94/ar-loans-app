using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Utilities
{
		public enum AuthorizeLookUp
		{
				Role = 0,
				Scope = 1
		}
		public class CurrentUser
		{
				private readonly string resourceId = "api://ar-loans-api/";
				public CurrentUser(AppConfig config)
				{
						resourceId = $"api://{config.JwtConfig.Audience}";
				}
				public Guid UserId { get; set; }
				public string OidcUid { get; set; } = "";
				public string EmailAddress { get; set; } = "";
				public string MobileNumber { get; set; } = "";

				public string[] Roles { get; set; } = Array.Empty<string>();
				public string[] Scopes { get; set; } = Array.Empty<string>();
				public string App { get; set; } = "";
				public string Name { get; set; } = "";
				public bool IsAuthenticated { get; set; } = false;
				public string? AuthFailureReason { get; set; }


				public bool IsAuthorized(string roles = "user", AuthorizeLookUp[]? lookIn = null)
				{
						if (!IsAuthenticated)
						{
								AuthFailureReason = "User is not authenticated.";
								return false;
						}

						if (lookIn == null)
						{
								if (roles.Equals("user", StringComparison.OrdinalIgnoreCase))
								{
										lookIn = new[] { AuthorizeLookUp.Scope };
								}
								else
								{
										lookIn = new[] { AuthorizeLookUp.Role, AuthorizeLookUp.Scope };
								}
						}

						var requiredRoles = roles.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

						var result = requiredRoles.Any(req =>
						{
								if (lookIn.Contains(AuthorizeLookUp.Role) && Roles.Any(r => string.Equals(r, req, StringComparison.OrdinalIgnoreCase)))
										return true;

								if (lookIn.Contains(AuthorizeLookUp.Scope))
								{
										if (Scopes.Any(s => string.Equals(s, req, StringComparison.OrdinalIgnoreCase)))
												return true;

										// Check with resourceId prefix
										var prefixedScope = $"{resourceId}/{req}";
										if (Scopes.Any(s => string.Equals(s, prefixedScope, StringComparison.OrdinalIgnoreCase)))
												return true;
								}

								return false;
						});

						if (!result)
						{
								AuthFailureReason = $"User missing required role/scope: {roles}";
						}

						return result;
				}
		}
}
