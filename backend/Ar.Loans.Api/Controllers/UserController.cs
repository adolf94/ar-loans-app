using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
using Ar.Loans.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Memory;

namespace Ar.Loans.Api.Controllers
{
    public class UserController(IUserRepo repo, IDbHelper db, AppConfig config, CurrentUser user, IMemoryCache cache, AuthorityService authorityService, ArGoService arGoService)
    {
        private readonly IDbHelper _db = db;
        private readonly IUserRepo _repo = repo;
        private readonly AppConfig _config = config;
        private readonly IUserRepo _userRepo = repo;
        private readonly CurrentUser _user = user;
        private readonly IMemoryCache _cache = cache;
        private readonly AuthorityService _authority = authorityService;
        private readonly ArGoService _arGo = arGoService;
        
        [Function(nameof(SyncUser))]
        public async Task<IActionResult> SyncUser([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/sync")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();

            User? existingUser = null;

            // 0. Check for a linking state from memory if provided
            string? state = req.Query["state"];
            if (string.IsNullOrEmpty(state))
            {
                try
                {
                    var body = await req.ReadFromJsonAsync<Dictionary<string, string>>();
                    if (body != null && body.TryGetValue("state", out var bodyState))
                    {
                        state = bodyState;
                    }
                }
                catch { /* ignore */ }
            }
 
            if (!string.IsNullOrEmpty(state) && _cache.TryGetValue(state, out Guid targetUserId))
            {
                existingUser = await _repo.GetUserById(targetUserId);
                if (existingUser != null)
                {
                    existingUser.OidcUid = _user.OidcUid;
                    existingUser.MagicLinkToken = null;
                    existingUser.MagicLinkTokenExpiration = null;
                    await _repo.UpdateUser(existingUser);
                    await _db.SaveChangesAsync();
                    _cache.Remove(state);
                }
            }

            // 1. Try to find user by internal ID from token
            if (existingUser == null && _user.UserId != Guid.Empty)
            {
                existingUser = await _repo.GetUserById(_user.UserId);
            }

            // 2. Fallback: Find by OIDC subject (sub)
            if (existingUser == null && !string.IsNullOrEmpty(_user.OidcUid))
            {
                existingUser = await _repo.GetUserByOidcUid(_user.OidcUid);
            }

            // 3. Fallback: Find by Email or Mobile (linking existing records)
            if (existingUser == null)
            {
                existingUser = await _repo.GetUserByEmailOrMobile(_user.EmailAddress, _user.MobileNumber);
            }

            if (existingUser != null)
            {
                // Link account only if we have a valid OIDC UID and the profile is not already linked
                if (!string.IsNullOrEmpty(_user.OidcUid) && existingUser.OidcUid != _user.OidcUid)
                {
                    if (!string.IsNullOrEmpty(existingUser.OidcUid))
                    {
                        return new BadRequestObjectResult("This profile is already linked to another OIDC account.");
                    }

                    existingUser.OidcUid = _user.OidcUid;
                    await _repo.UpdateUser(existingUser);
                    await _db.SaveChangesAsync();
                }
                if (!string.IsNullOrEmpty(existingUser.OidcUid))
                {
                    try
                    {

												var authDetails = await _authority.GetUserDetailsAsync(existingUser.OidcUid);
												if (authDetails != null)
												{
														existingUser.EmailAddress = authDetails.Email;
														existingUser.MobileNumber = authDetails.MobileNumber ?? existingUser.MobileNumber;
														existingUser.TelegramId = authDetails.GetTelegramId() ?? existingUser.TelegramId;
														await _repo.UpdateUser(existingUser);
														await _db.SaveChangesAsync();
												}
												else
												{
														existingUser.OidcUid = null;
														await _repo.UpdateUser(existingUser);
														await _db.SaveChangesAsync();
												}
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("");
                    }
								}
                return new OkObjectResult(existingUser);
            }

            // 4. Return 200 for unlinked account with transient data
            Guid transientId = Guid.Empty;
            if (Guid.TryParse(_user.OidcUid, out var guidOidc)) transientId = guidOidc;

            string transientEmail = _user.EmailAddress;
            string transientMobile = _user.MobileNumber;
            //string? transientTelegram = null;

            //if (!string.IsNullOrEmpty(_user.OidcUid))
            //{
            //    var authDetails = await _authority.GetUserDetailsAsync(_user.OidcUid);
            //    if (authDetails != null)
            //    {
            //        transientEmail = authDetails.Email;
            //        transientMobile = authDetails.MobileNumber ?? transientMobile;
            //        transientTelegram = authDetails.GetTelegramId();
            //    }
            //}

            var transientUser = new
            {
                Id = transientId,
                anonymous_id = _user.OidcUid,
                Name = _user.Name,
                EmailAddress = transientEmail,
                MobileNumber = transientMobile,
                OidcUid = _user.OidcUid,
                Role = "Client"
            };

            return new OkObjectResult(transientUser);
        }

        [Function(nameof(GenerateMagicUrl))]
        public async Task<IActionResult> GenerateMagicUrl([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/link-magic-url")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("admin,guarantor")) return new ForbidResult();

            string? targetUserIdStr = req.Query["targetUserId"];
            if (!Guid.TryParse(targetUserIdStr, out var targetUserId)) return new BadRequestObjectResult("Invalid targetUserId");

            var targetUser = await _repo.GetUserById(targetUserId);
            if (targetUser == null) return new NotFoundObjectResult("User not found");
            if (!string.IsNullOrEmpty(targetUser.OidcUid)) return new BadRequestObjectResult("User is already linked to an OIDC account");

            // Create a signed token for the magic link (HMAC-SHA256)
            string token = JwtTokenHelper.CreateInternalToken(targetUserIdStr, _config.JwtConfig.SecretKey ?? "", "", "");
            
            // Persist token in the database for 24h
            targetUser.MagicLinkToken = token;
            targetUser.MagicLinkTokenExpiration = DateTime.UtcNow.AddHours(24);
            await _repo.UpdateUser(targetUser);
            await _db.SaveChangesAsync();

            var host = req.Headers["Host"];
            var scheme = req.Scheme ?? "https";
            string magicUrl = $"{scheme}://{host}/api/users/m?token={Uri.EscapeDataString(token)}";

            string shortenedUrl = await _arGo.ShortenUrlAsync(
                magicUrl, 
                $"Magic Link for {targetUser.Name}", 
                targetUserIdStr
            );

            return new OkObjectResult(new { url = shortenedUrl });
        }

        [Function(nameof(GetMagicRedirect))]
        public async Task<IActionResult> GetMagicRedirect([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/m")] HttpRequest req)
        {
            string? token = req.Query["token"];
            if (string.IsNullOrEmpty(token)) return new BadRequestObjectResult("Token is required");

            // Normalize token (handle potential + vs space issues from URL decoding)
            token = token.Replace(" ", "+");

            string? targetUserIdStr = JwtTokenHelper.ValidateInternalToken(token, _config.JwtConfig.SecretKey ?? "", "", "");
            if (string.IsNullOrEmpty(targetUserIdStr) || !Guid.TryParse(targetUserIdStr, out var targetUserId)) 
                return new BadRequestObjectResult("Invalid or expired token");

            // Verify the token exists in DB and hasn't expired
            var targetUser = await _repo.GetUserById(targetUserId);
            if (targetUser == null || targetUser.MagicLinkToken != token || (targetUser.MagicLinkTokenExpiration.HasValue && targetUser.MagicLinkTokenExpiration < DateTime.UtcNow))
            {
                return new BadRequestObjectResult("This magic link has already been used or is expired.");
            }

            // DO NOT Remove token from database immediately after use.
            // Some services (like URL shorteners or social crawlers) visit the link once to check headers.
            // If we clear it now, the actual user click will fail.
            // targetUser.MagicLinkToken = null;
            // targetUser.MagicLinkTokenExpiration = null;
            // await _repo.UpdateUser(targetUser);
            // await _db.SaveChangesAsync();

            // Generate state and store in memory for OIDC flow
            string state = Guid.NewGuid().ToString("N");
            _cache.Set(state, targetUserId, TimeSpan.FromMinutes(15));

            // Redirect to frontend instead of OIDC provider directly
            // This allows the frontend auth-client to handle PKCE and state management correctly
            string frontendUrl = _config.JwtConfig.RedirectUri ?? "";
            string redirectUrl = $"{frontendUrl}/m{(frontendUrl.Contains("?") ? "&" : "?")}link_state={state}";

            return new RedirectResult(redirectUrl);
        }


        [Function(nameof(CreateAccount))]
        public async Task<IActionResult> CreateAccount([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var user = await req.ReadFromJsonAsync<User>();
            if (user == null) return new BadRequestResult();
            var newUser = await _repo.CreateUser(user);
            await _db.SaveChangesAsync();
            return await Task.FromResult(new CreatedResult($"/users/{user.Id}", newUser));
        }

        [Function(nameof(UpdateUser))]
        public async Task<IActionResult> UpdateUser([HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "users/{id}")] HttpRequest req, Guid id)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();

            var user = await req.ReadFromJsonAsync<User>();
            if (user == null) return new BadRequestResult();

            user.Id = id;
            var updatedUser = await _repo.UpdateUser(user);
            await _db.SaveChangesAsync();

            return await Task.FromResult(new OkObjectResult(updatedUser));
        }

        [Function(nameof(GetAllUsers))]
        public async Task<IActionResult> GetAllUsers([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var items = await _repo.GetAllUsers();

            return await Task.FromResult(new OkObjectResult(items));
        }

        [Function(nameof(GetUser))]
        public async Task<IActionResult> GetUser([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/{id}")] HttpRequest req, Guid id)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (_user.UserId != id && !_user.IsAuthorized("guarantor,admin")) return new ForbidResult();
            var items = await _repo.GetUser(id);

            return await Task.FromResult(new OkObjectResult(items));
        }
    }
}
