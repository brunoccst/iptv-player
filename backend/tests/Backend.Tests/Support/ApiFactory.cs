using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests.Support;

/// <summary>In-memory API host with an isolated temp data dir. All outbound HTTP goes to <see cref="FakeXtreamServer"/>.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string _dataDirectory = Path.Combine(Path.GetTempPath(), "backend-tests", Guid.NewGuid().ToString("N"));

    public StubHttpHandler Upstream { get; } = new(FakeXtreamServer.Handle);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureAppConfiguration((_, configuration) => configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["APP_NAME"] = "Test App",
            ["APP_SLUG"] = "test-app",
            ["BACKEND_DATA_DIR"] = _dataDirectory,
            ["BACKEND_STREAM_DELIVERY"] = "relay",
            ["BACKEND_CATALOG_CACHE_MINUTES"] = "5",
        }));

        builder.ConfigureServices(services =>
            services.ConfigureHttpClientDefaults(client => client.ConfigurePrimaryHttpMessageHandler(() => Upstream)));
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing && Directory.Exists(_dataDirectory))
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            Directory.Delete(_dataDirectory, recursive: true);
        }
    }
}
