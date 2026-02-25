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

namespace Ar.Loans.Api.Controllers
{
		public class UserController
		{
				private readonly IDbHelper _db;
				private readonly IUserRepo _repo;
				private readonly AppConfig _config;
        private readonly CurrentUser _user;

        public UserController(IUserRepo repo, IDbHelper db, AppConfig config, CurrentUser user)
				{
						_db = db;
						_repo = repo;
						_config = config;
						_user = user;
				}


				[Function(nameof(CreateAccount))]
				public async Task<IActionResult> CreateAccount([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users")] HttpRequest req)
				{
						if (!_user.IsAuthenticated) return new UnauthorizedResult();
						if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
						var user = await req.ReadFromJsonAsync<User>();
						if (user == null) return new BadRequestResult();
						var newUser = await _repo.CreateUser(user);
						await _db.SaveChangesAsync();
						return await Task.FromResult(new CreatedResult($"/users/{user.Id}", newUser));
				}


				[Function(nameof(GetAllUsers))]
				public async Task<IActionResult> GetAllUsers([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users")] HttpRequest req)
				{
						if (!_user.IsAuthenticated) return new UnauthorizedResult();
						if (!_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
						var items = await _repo.GetAllUsers();

						return await Task.FromResult(new OkObjectResult(items));
				}

				[Function(nameof(GetUser))]
				public async Task<IActionResult> GetUser([HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/{id}")] HttpRequest req, Guid id)
				{
					if (!_user.IsAuthenticated) return new UnauthorizedResult();
					if(_user.UserId != id && !_user.IsAuthorized("coop_guarantor,coop_admin")) return new ForbidResult();
					var items = await _repo.GetUser(id);

					return await Task.FromResult(new OkObjectResult(items));
				}



				[Function(nameof(ProxyLogin))]
				public async Task<IActionResult> ProxyLogin([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/google_credential")] HttpRequest req)
				{
						if (string.IsNullOrEmpty(_config.AuthUrl)) return new NotFoundResult();
						var client = new HttpClient();
						var targetUrl = Path.Combine(_config.AuthUrl, "api/auth/google_credential");

						// 1. Read the incoming body as a string (or stream)
						using var reader = new StreamReader(req.Body);
						var bodyContent = await reader.ReadToEndAsync();

						// 2. Create the content with the specific Media Type
						var content = new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json");

						// 3. Send only the body to the destination
						var response = await client.PostAsync(targetUrl, content);

						// 4. Return the result to your frontend
						var result = await response.Content.ReadAsStringAsync();
						return new ContentResult()
						{
								Content = result,
								ContentType = response.Content.Headers.ContentType!.ToString(),
								StatusCode = (int)response.StatusCode
						};
				}
				[Function(nameof(ProxyRefresh))]
				public async Task<IActionResult> ProxyRefresh([HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "auth/refresh")] HttpRequest req)
				{
						var client = new HttpClient();

						if (string.IsNullOrEmpty(_config.AuthUrl)) return new NotFoundResult();

						var targetUrl = Path.Combine(_config.AuthUrl, "api/auth/refresh");

						// 1. Read the incoming body as a string (or stream)
						using var reader = new StreamReader(req.Body);
						var bodyContent = await reader.ReadToEndAsync();

						// 2. Create the content with the specific Media Type
						var content = new StringContent(bodyContent, System.Text.Encoding.UTF8, "application/json");

						// 3. Send only the body to the destination
						var response = await client.PostAsync(targetUrl, content);

						// 4. Return the result to your frontend
						var result = await response.Content.ReadAsStringAsync();

						if (response.StatusCode != System.Net.HttpStatusCode.OK) return new StatusCodeResult((int)response.StatusCode);

						return new ContentResult()
						{
								Content = result,
								ContentType = response.Content.Headers.ContentType!.ToString(),
								StatusCode = (int)response.StatusCode
						};
				}
		}
}
