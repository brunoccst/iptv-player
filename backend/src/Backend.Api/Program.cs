using System.Reflection;
using System.Text.Json.Serialization;
using Backend.Api.Auth;
using Backend.Api.Endpoints;
using Backend.Api.Errors;
using Backend.Api.OpenApi;
using Backend.Core.Configuration;
using Backend.Infrastructure;
using Backend.Infrastructure.Persistence;
using Backend.Infrastructure.Pipeline;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// `dotnet build` starts the app to export OpenAPI; keep it away from real data. See DECISIONS.md#d-020.
var isOpenApiExport = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

builder.Configuration.AddRootDotEnv(builder.Environment.ContentRootPath);
if (isOpenApiExport)
{
    builder.Configuration["DATA_DIR"] = Path.Combine(Path.GetTempPath(), "backend-openapi-export");
}
builder.Services.AddAppOptions();
builder.Services.AddBackendOptions(builder.Environment.ContentRootPath);

builder.Services.AddInfrastructure();

builder.Services.AddAuthentication(SessionAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, SessionAuthenticationHandler>(SessionAuthenticationHandler.SchemeName, null);
builder.Services.AddAuthorization();

builder.Services.AddCors();
builder.Services.AddOptions<CorsOptions>().Configure<IOptions<BackendOptions>>((cors, backend) =>
    cors.AddDefaultPolicy(policy => policy
        .WithOrigins(backend.Value.CorsOrigins)
        .AllowAnyHeader()
        .AllowAnyMethod()
        .WithExposedHeaders("Content-Range", "Content-Length", "Accept-Ranges")));

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase));
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProviderExceptionHandler>();
builder.Services.AddOpenApi(options => options.AddSchemaTransformer<RequiredPropertiesSchemaTransformer>());

var app = builder.Build();

if (!isOpenApiExport)
{
    await using var scope = app.Services.CreateAsyncScope();
    // WAL lets the Python worker read/write pipeline.db while the API is running. See DECISIONS.md#d-016.
    foreach (DbContext db in new DbContext[] { scope.ServiceProvider.GetRequiredService<AppDbContext>(), scope.ServiceProvider.GetRequiredService<PipelineDbContext>() })
    {
        await db.Database.MigrateAsync();
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
    }
}

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapHealthEndpoints();
app.MapAuthEndpoints();
app.MapProfileEndpoints();
app.MapProgressEndpoints();
app.MapWatchlistEndpoints();
app.MapCatalogEndpoints();
app.MapEpgEndpoints();
app.MapPlaybackEndpoints();
app.MapLibraryEndpoints();
app.MapRelayEndpoints();

app.Run();

// Exposes the implicit Program class to WebApplicationFactory in tests.
public partial class Program;
