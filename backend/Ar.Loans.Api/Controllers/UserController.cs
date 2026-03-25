using Ar.Loans.Api.Data;
using Ar.Loans.Api.Models;
using Ar.Loans.Api.Utilities;
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
    public class UserController(IUserRepo repo, IDbHelper db, AppConfig config, CurrentUser user, IMemoryCache cache)
    {
        private readonly IDbHelper _db = db;
        private readonly IUserRepo _repo = repo;
        private readonly AppConfig _config = config;
        private readonly CurrentUser _user = user;
        private readonly IMemoryCache _cache = cache;
        
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
                    req.Body.Position = 0;
                    var body = await req.ReadFromJsonAsync<dynamic>();
                    state = body?.state;
                }
                catch { /* ignore */ }
            }

            if (!string.IsNullOrEmpty(state) && _cache.TryGetValue(state, out Guid targetUserId))
            {
                existingUser = await _repo.GetUserById(targetUserId);
                if (existingUser != null)
                {
                    existingUser.OidcUid = _user.OidcUid;
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
                // Update OIDC ID if it was missing or different (Linking)
                if (existingUser.OidcUid != _user.OidcUid)
                {
                    if (!string.IsNullOrEmpty(existingUser.OidcUid))
                    {
                        return new BadRequestObjectResult("This profile is already linked to another OIDC account.");
                    }

                    existingUser.OidcUid = _user.OidcUid;
                    await _repo.UpdateUser(existingUser);
                    await _db.SaveChangesAsync();
                }
                return new OkObjectResult(existingUser);
            }

            // 4. Return 200 for unlinked account with transient data
            Guid transientId = Guid.Empty;
            if (Guid.TryParse(_user.OidcUid, out var guidOidc)) transientId = guidOidc;

            var transientUser = new
            {
                Id = transientId,
                anonymous_id = _user.OidcUid,
                Name = _user.Name,
                EmailAddress = _user.EmailAddress,
                MobileNumber = _user.MobileNumber,
                OidcUid = _user.OidcUid,
                Role = "Client"
            };

            return new OkObjectResult(transientUser);
        }

        [Function(nameof(GenerateMagicUrl))]
        public async Task<IActionResult> GenerateMagicUrl([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/link-magic-url")] HttpRequest req)
        {
            if (!_user.IsAuthenticated) return new UnauthorizedResult();
            if (!_user.IsAuthorized(",coop_guarantor")) return new ForbidResult();

            string? targetUserIdStr = req.Query["targetUserId"];
            if (!Guid.TryParse(targetUserIdStr, out var targetUserId)) return new BadRequestObjectResult("Invalid targetUserId");

            var targetUser = await _repo.GetUserById(targetUserId);
            if (targetUser == null) return new NotFoundObjectResult("User not found");
            if (!string.IsNullOrEmpty(targetUser.OidcUid)) return new BadRequestObjectResult("User is already linked to an OIDC account");

            // Create a signed token for the magic link (HMAC-SHA256)
            string token = JwtTokenHelper.CreateInternalToken(targetUserIdStr, _config.JwtConfig.SecretKey ?? "", "", "");

            var host = req.Headers["Host"];
            var scheme = req.Scheme ?? "https";
            string magicUrl = $"{scheme}://{host}/api/users/m?token={token}";

            return new OkObjectResult(new { url = magicUrl });
        }

        [Function(nameof(MagicRedirect))]
        public async Task<IActionResult> MagicRedirect([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/m")] HttpRequest req)
        {
            string? token = req.Query["token"];
            if (string.IsNullOrEmpty(token)) return new BadRequestObjectResult("Token is required");

            string? targetUserIdStr = JwtTokenHelper.ValidateInternalToken(token, _config.JwtConfig.SecretKey ?? "", "", "");
            if (string.IsNullOrEmpty(targetUserIdStr) || !Guid.TryParse(targetUserIdStr, out var targetUserId)) 
                return new BadRequestObjectResult("Invalid or expired token");

            // Generate state and store in memory
            string state = Guid.NewGuid().ToString("N");
            _cache.Set(state, targetUserId, TimeSpan.FromMinutes(15));

            // Discover and construct a formal OIDC authorize URL
            string authority = _config.JwtConfig.Authority ?? "";
            string? authorizeEndpoint = await JwtTokenHelper.GetAuthorizationEndpoint(authority);

            if (!string.IsNullOrEmpty(authorizeEndpoint))
            {
                var queryParams = new Dictionary<string, string>
                {
                    { "client_id", _config.JwtConfig.ClientId ?? "" },
                    { "response_type", "code" },
                    { "scope", _config.JwtConfig.Scope ?? "openid profile email" },
                    { "redirect_uri", _config.JwtConfig.RedirectUri ?? "" },
                    { "state", state }
                };

                string queryString = string.Join("&", queryParams.Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value)}"));
                string authorizeUrl = $"{authorizeEndpoint}{(authorizeEndpoint.Contains("?") ? "&" : "?")}{queryString}";

                return new RedirectResult(authorizeUrl);
            }

            // Fallback (should not happen if discovery is working)
            string authBaseUrl = _config.AuthUrl?.TrimEnd('/') ?? "";
            string redirectUrl = $"{authBaseUrl}/api/auth/redirectSignIn?state={state}";

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
