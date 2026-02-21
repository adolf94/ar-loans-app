using Ar.Loans.Api.Data;
using Ar.Loans.Api.Data.Azure;
using Ar.Loans.Api.Data.Cosmos;
using Ar.Loans.Api.Data.GoogleAi;
using Ar.Loans.Api.Utilities;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

var config = builder.Configuration;


var appConfig = config.GetRequiredSection("AppConfig").Get<AppConfig>()!;
builder.Services.AddSingleton<AppConfig>(appConfig);

builder.Services
    .AddApplicationInsightsTelemetryWorkerService()
    .ConfigureFunctionsApplicationInsights();


builder.Services.AddCosmosDbContext(config);
builder.Services.AddSingleton<IAiService, AiService>();
builder.Services.AddSingleton<AzureFileRepo>();


builder.Build().Run();
