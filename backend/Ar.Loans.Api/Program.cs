using System.Text;
using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Azure;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Data.OpenRouter;
using Ar.Loans.Api.Middlewares;
using Ar.Loans.Api.Utilities;
using Ar.Loans.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Telegram.Bot;


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
    options.Authority = appConfig.JwtConfig.Authority; // From env var AppConfig__JwtConfig__Authority
    options.Audience = appConfig.JwtConfig.Audience;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true, // Uses Discovery to validate
        ValidIssuer = appConfig.JwtConfig.Authority,
        ValidAudience = appConfig.JwtConfig.Audience
    };
});


builder.Services.AddScoped<CurrentUser>();

builder.Services
    .AddApplicationInsightsTelemetryWorkerService()
    .ConfigureFunctionsApplicationInsights();


builder.Services.AddCosmosDbContext(config);
builder.Services.AddHttpClient();
builder.Services.AddHttpClient<AuthorityService>();
builder.Services.AddHttpClient<ArGoService>();
builder.Services.AddHttpClient<FinanceService>();
builder.Services.AddSingleton<IFinanceSyncQueue, Ar.Loans.Api.Data.Azure.FinanceSyncQueue>();
builder.Services.AddScoped<FinanceSyncProcessor>();
builder.Services.AddScoped<LogService>();
builder.Services.AddScoped<TelegramService>();
builder.Services.AddSingleton<IAiService, AiService>();
builder.Services.AddSingleton<AzureFileRepo>();

builder.Services.AddSingleton<ITelegramBotClient>(sp =>
{
    // Local dev: skip webhook registration when no bot secret is configured
    // so `func start` works out-of-the-box without a real Telegram token.
    if (string.IsNullOrWhiteSpace(appConfig.Telegram.ClientSecret))
    {
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("Telegram");
        logger.LogWarning("Telegram ClientSecret is empty - Telegram bot disabled for local dev.");
        return new TelegramBotClient("0000000000:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    }

    string? webhookUrl = !string.IsNullOrEmpty(appConfig.BaseUrl)
        ? $"{appConfig.BaseUrl.TrimEnd('/')}/telegram/webhook"
        : appConfig.Telegram.WebhookUrl;

    var bot = new TelegramBotClient(appConfig.Telegram.ClientSecret);
    if (!string.IsNullOrWhiteSpace(webhookUrl))
    {
        bot.SetWebhook(webhookUrl, allowedUpdates: []).Wait();
    }
    return bot;
});
builder.Services.AddMemoryCache();

webapp.UseMiddleware<AppMiddleware>();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<Ar.Loans.Api.Data.Cosmos.AppDbContext>();
    dbContext.Database.EnsureCreatedAsync().Wait();
}

app.Run();
