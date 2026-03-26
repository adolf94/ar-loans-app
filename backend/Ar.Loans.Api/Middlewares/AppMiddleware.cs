using Ar.Loans.Api.Data;
using Ar.Loans.Api.Utilities;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Azure.Cosmos.Linq;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace Ar.Loans.Api.Middlewares
{
		public class UserCacheItem
		{
				public Guid UserId { get; set; }
				public string OidcUid { get; set; } = "";
				public string Name { get; set; } = "";
				public string EmailAddress { get; set; } = "";
				public string MobileNumber { get; set; } = "";
				public string[] Roles { get; set; } = Array.Empty<string>();
				public string[] Scopes { get; set; } = Array.Empty<string>();
				public string App { get; set; } = "";
				public string Sid { get; set; } = "";
				public string Jti { get; set; } = "";
		}
		internal class AppMiddleware : IFunctionsWorkerMiddleware
		{
				private AppConfig _config;
				private IMemoryCache _cache;

				public AppMiddleware(AppConfig config, IMemoryCache cache)
				{
						_config = config;
						_cache = cache;
				}
				public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
				{
						var httpContext = context.GetHttpContext();
						if (httpContext != null && httpContext.Request.Headers.ContainsKey("Authorization"))
						{
								var _userRepo = httpContext.RequestServices.GetRequiredService<IUserRepo>();
								var _user = httpContext.RequestServices.GetRequiredService<CurrentUser>();
								
								var authHeader = httpContext.Request.Headers.Authorization.ToString();

								if (authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
								{
										var bearer = authHeader.Substring(7);
										var authority = _config.JwtConfig.Authority ?? "https://auth.adolfrey.com/api";
										var audience = _config.JwtConfig.Audience ?? "";
										
										// Extract sid (Session ID) or sub as the cache key
										var tokenContent = JwtTokenHelper.ConvertJwtStringToJwtSecurityToken(bearer);
										var sid = tokenContent.Claims.FirstOrDefault(e => e.Type == "sid")?.Value 
										?? tokenContent.Subject 
										?? tokenContent.Claims.FirstOrDefault(e => e.Type == "sub")?.Value;

										if (string.IsNullOrEmpty(sid)) {
												await next(context);
												return;
										}

										var cacheKey = $"AUTH_{sid}";

										if (!_cache.TryGetValue<UserCacheItem>(cacheKey, out var cacheItem))
										{
												var principal = await JwtTokenHelper.ReadClaimsFromJwt(bearer, authority, audience, authority);
												if (principal != null && (principal.Identity?.IsAuthenticated == true || principal.Claims.Any()))
												{
														cacheItem = new UserCacheItem
														{
																OidcUid = principal.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal.FindFirstValue("sub") ?? "",
																Name = principal.FindFirstValue(ClaimTypes.Name) ?? principal.FindFirstValue("name") ?? principal.FindFirstValue("preferred_username") ?? "",
																EmailAddress = principal.FindFirstValue(ClaimTypes.Email) ?? principal.FindFirstValue("email") ?? "",
																MobileNumber = principal.FindFirstValue(ClaimTypes.MobilePhone) ?? principal.FindFirstValue("phone_number") ?? principal.FindFirstValue("mobile") ?? "",
																App = principal.FindFirstValue("app") ?? principal.FindFirstValue("azp") ?? principal.FindFirstValue("appid") ?? "",
																Sid = principal.FindFirstValue("sid") ?? principal.FindFirstValue("sub") ?? sid,
																Jti = principal.FindFirstValue("jti") ?? ""
														};

														var userIdClaim = principal.Claims.FirstOrDefault(e => e.Type == "userId")?.Value;
														if (Guid.TryParse(userIdClaim, out var guidId))
														{
																cacheItem.UserId = guidId;
														}
														else
														{
																// Fallback to DB lookup if not in token
																var userByOidc = await _userRepo.GetUserByOidcUid(cacheItem.OidcUid);
																if (userByOidc != null)
																{
																		cacheItem.UserId = userByOidc.Id;
																}
														}

														// Extract roles
														cacheItem.Roles = principal.Claims
																.Where(e => e.Type == ClaimTypes.Role || e.Type == "role" || e.Type == "roles" || e.Type == "http://schemas.microsoft.com/identity/claims/role")
																.SelectMany(e => e.Value.Split(new[] { ' ', ',' }, StringSplitOptions.RemoveEmptyEntries))
																.Distinct()
																.ToArray();

														// Extract scopes
														var scopeClaims = principal.Claims
																.Where(e => e.Type == "scp" || e.Type == "scope" || e.Type == "http://schemas.microsoft.com/identity/claims/scope")
																.SelectMany(e => e.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries))
																.ToList();

														var apiScopes = principal.Claims
																.Where(e => e.Value.StartsWith("api://"))
																.Select(e => e.Value)
																.ToList();

														cacheItem.Scopes = scopeClaims.Concat(apiScopes).Distinct().ToArray();

														// Cache for 30 mins
														_cache.Set(cacheKey, cacheItem, TimeSpan.FromMinutes(30));
												}
										}

										if (cacheItem != null)
										{
												_user.UserId = cacheItem.UserId;
												_user.OidcUid = cacheItem.OidcUid;
												_user.Name = cacheItem.Name;
												_user.EmailAddress = cacheItem.EmailAddress;
												_user.MobileNumber = cacheItem.MobileNumber;
												_user.Roles = cacheItem.Roles;
												_user.Scopes = cacheItem.Scopes;
												_user.App = cacheItem.App;
												_user.Sid = cacheItem.Sid;
												_user.Jti = cacheItem.Jti;
												_user.IsAuthenticated = true;
										}
								}
						}

						await next(context);
						return;
				}
		}
}
