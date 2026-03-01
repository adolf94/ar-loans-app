using System.Text;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Azure;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Data.GoogleAi;
using Ar.Loans.Api.Middlewares;
using Ar.Loans.Api.Utilities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

var builder = FunctionsApplication.CreateBuilder(args);

var webapp = builder.ConfigureFunctionsWebApplication();

var config = builder.Configuration;



var appConfig = config.GetRequiredSection("AppConfig").Get<AppConfig>()!;
builder.Services.AddSingleton<AppConfig>(appConfig);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = appConfig.JwtConfig.Issuer,
        ValidAudience = appConfig.JwtConfig.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(appConfig.JwtConfig.SecretKey))
    };
});


builder.Services.AddScoped<CurrentUser>();

builder.Services
    .AddApplicationInsightsTelemetryWorkerService()
    .ConfigureFunctionsApplicationInsights();


builder.Services.AddCosmosDbContext(config);
builder.Services.AddSingleton<IAiService, AiService>();
builder.Services.AddSingleton<AzureFileRepo>();

webapp.UseMiddleware<AppMiddleware>();

builder.Build().Run();
