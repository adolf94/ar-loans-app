using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace Ar.Loans.Api.Utilities
{
		public class JwtTokenHelper
		{
				public static JwtSecurityToken ConvertJwtStringToJwtSecurityToken(string? jwt)
				{
						var handler = new JwtSecurityTokenHandler();
						var token = handler.ReadJwtToken(jwt);

						return token;
				}
				public static ClaimsPrincipal? ReadClaimsFromJwt(string token, string secretKey, string validIssuer, string validAudience)
				{
						// Define the token validation parameters
						var tokenValidationParameters = new TokenValidationParameters
						{
								ValidateIssuer = true,
								ValidIssuer = validIssuer,
								ValidateAudience = true,
								ValidAudience = validAudience,
								ValidateIssuerSigningKey = true,
								IssuerSigningKey = new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(secretKey)),
								ValidateLifetime = true, // Ensure the token is not expired
								ClockSkew = TimeSpan.FromMinutes(5) // Optional: Adjust for clock skew
						};

						try
						{
								// Create a token handler
								var tokenHandler = new JwtSecurityTokenHandler();

								// Validate the token and extract the principal
								ClaimsPrincipal principal = tokenHandler.ValidateToken(token, tokenValidationParameters, out SecurityToken validatedToken);

								// Read claims from the token
								return principal;
						}
						catch (Exception ex)
						{
								Console.WriteLine($"Token validation failed: {ex.Message}");
								return null;
						}
				}
		}
}
