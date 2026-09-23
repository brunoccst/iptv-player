using Backend.Core.Configuration;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddRootDotEnv(builder.Environment.ContentRootPath);
builder.Services.AddAppOptions();

var app = builder.Build();

app.MapGet("/api/health", (IOptions<AppOptions> options) =>
    Results.Ok(new { status = "ok", app = options.Value.Name }));

app.Run();

// Exposes the implicit Program class to WebApplicationFactory in tests.
public partial class Program;
