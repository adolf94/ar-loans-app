using Ar.Loans.Api.Utilities;

using Microsoft.Azure.Cosmos.Linq;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;

namespace Ar.Loans.Api.Middlewares
{
		internal class AppMiddleware : IFunctionsWorkerMiddleware
		{
				private AppConfig _config;

				public AppMiddleware(AppConfig config)
				{
						_config = config;
				}
				public Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
				{
						var httpContext = context.GetHttpContext();
						if (httpContext != null && httpContext.Request.Headers.ContainsKey("Authorization"))
						{
								var _user = httpContext.RequestServices.GetRequiredService<CurrentUser>();
								var jwt = _config.JwtConfig;
								var authorization = httpContext.Request.Headers.Authorization;
								var bearer = authorization.ToString().Substring(7);
								ClaimsPrincipal? principal = JwtTokenHelper.ReadClaimsFromJwt(bearer, jwt.SecretKey, jwt.Issuer, jwt.Audience);
								if (principal != null)
								{


										var type = principal.Claims.FirstOrDefault(e => e.Type == "typ" && e.Value == "access_token");
												if(type != null)
										{
												var userId = principal.Claims.FirstOrDefault(e => e.Type == "userId")?.Value;
												if (string.IsNullOrEmpty(userId))
												{
														return next(context);
												}
												httpContext.User = principal;
												_user.UserId = Guid.Parse(userId!);
												_user.Name = principal.FindFirstValue(ClaimTypes.Name)!;
												_user.EmailAddress = principal.FindFirstValue(ClaimTypes.Email)!;
												_user.IsAuthenticated = true;
												_user.Roles = principal.Claims.Where(e => e.Type == ClaimTypes.Role).Select(e => e.Value).ToArray();
												_user.App = principal.Claims.FirstOrDefault(e => e.Type == "app")?.Value ?? "";
										}
								}
						}



						return next(context); 
				}
		}
}
