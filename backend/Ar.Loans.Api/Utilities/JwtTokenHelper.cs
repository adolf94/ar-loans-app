using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Utilities
{
		public class JwtTokenHelper
		{
				private static readonly ConcurrentDictionary<string, ConfigurationManager<OpenIdConnectConfiguration>> _configManagers = new();

				public static JwtSecurityToken ConvertJwtStringToJwtSecurityToken(string? jwt)
				{
						var handler = new JwtSecurityTokenHandler();
						var token = handler.ReadJwtToken(jwt);

						return token;
				}

				public static async Task<string?> GetAuthorizationEndpoint(string authority)
				{
						if (string.IsNullOrEmpty(authority)) return null;
						var manager = _configManagers.GetOrAdd(authority, (auth) =>
						{
								string configUrl = auth.TrimEnd('/') + "/.well-known/openid-configuration";
								return new ConfigurationManager<OpenIdConnectConfiguration>(configUrl, new OpenIdConnectConfigurationRetriever());
						});

						try
						{
								var config = await manager.GetConfigurationAsync(CancellationToken.None);
								return config.AuthorizationEndpoint;
						}
						catch
						{
								return null;
						}
				}

				public static async Task<ClaimsPrincipal?> ReadClaimsFromJwt(string token, string validIssuer, string validAudience, string? authority = null)
				{
						var tokenHandler = new JwtSecurityTokenHandler();
						var tokenValidationParameters = new TokenValidationParameters
						{
								ValidateIssuer = true,
								ValidIssuer = validIssuer,
								ValidateAudience = true,
								ValidAudience = validAudience,
								ValidateLifetime = true,
								ClockSkew = TimeSpan.FromMinutes(5)
						};

								// Discovery logic
								var manager = _configManagers.GetOrAdd(authority, (auth) =>
								{
										string configUrl = auth.TrimEnd('/') + "/.well-known/openid-configuration";
										return new ConfigurationManager<OpenIdConnectConfiguration>(configUrl, new OpenIdConnectConfigurationRetriever());
								});

								try
								{
										var config = await manager.GetConfigurationAsync(CancellationToken.None);
										tokenValidationParameters.IssuerSigningKeys = config.SigningKeys;
										tokenValidationParameters.ValidateIssuerSigningKey = true;
								}
								catch (Exception ex)
								{
										Console.WriteLine($"OIDC Discovery failed for {authority}: {ex.Message}");
										return null;
								}
						try
						{
								var principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken validatedToken);
								return principal;
						}
						catch (Exception ex)
						{
								Console.WriteLine($"Token validation failed: {ex.Message}");
								return null;
						}
				}

				public static string CreateInternalToken(string userId, string secretKey, string issuer, string audience)
				{
						using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secretKey));
						var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(userId));
						var signature = Convert.ToBase64String(hash);

						return $"{userId}.{signature}";
				}

				public static string? ValidateInternalToken(string token, string secretKey, string issuer, string audience)
				{
						if (string.IsNullOrEmpty(token)) return null;

						var parts = token.Split('.');
						if (parts.Length != 2) return null;

						var userId = parts[0];
						var providedSignature = parts[1];

						using var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(secretKey));
						var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(userId));
						var expectedSignature = Convert.ToBase64String(hash);

						if (providedSignature == expectedSignature)
						{
								return userId;
						}

						return null;
				}
		}
}
