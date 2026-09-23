using System.Text.Json.Serialization;
using Backend.Api.Auth;
using Backend.Api.Endpoints;
using Backend.Api.Errors;
using Backend.Core.Configuration;
using Backend.Infrastructure;
using Backend.Infrastructure.Persistence;
using Backend.Infrastructure.Pipeline;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddRootDotEnv(builder.Environment.ContentRootPath);
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
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(System.Text.Json.JsonNamingPolicy.CamelCase)));
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProviderExceptionHandler>();
builder.Services.AddOpenApi();

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
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

app.MapGet("/api/health", (IOptions<AppOptions> options) =>
    Results.Ok(new { status = "ok", app = options.Value.Name })).WithTags("Health");
app.MapAuthEndpoints();
app.MapProfileEndpoints();
app.MapCatalogEndpoints();
app.MapPlaybackEndpoints();
app.MapLibraryEndpoints();
app.MapRelayEndpoints();

app.Run();

// Exposes the implicit Program class to WebApplicationFactory in tests.
public partial class Program;
