using Backend.Core.Accounts;
using Backend.Core.Configuration;
using Backend.Core.Providers;
using Backend.Infrastructure.Accounts;
using Backend.Infrastructure.Catalog;
using Backend.Infrastructure.Library;
using Backend.Infrastructure.Pipeline;
using Backend.Infrastructure.Persistence;
using Backend.Infrastructure.Security;
using Backend.Infrastructure.Streaming;
using Backend.Infrastructure.Xtream;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.DataProtection.KeyManagement;
using Microsoft.AspNetCore.DataProtection.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure;

public static class DependencyInjection
{
    public const string RelayHttpClient = "relay";

    /// <summary>Registers persistence, providers, security and streaming services. Needs <see cref="BackendOptions"/> registered.</summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddMemoryCache();

        services.AddDbContext<AppDbContext>((provider, options) =>
            options.UseSqlite($"Data Source={Path.Combine(DataDirectory(provider), "app.db")}"));
        services.AddDbContext<PipelineDbContext>((provider, options) =>
            options.UseSqlite($"Data Source={Path.Combine(DataDirectory(provider), "pipeline.db")}"));

        // Fixed application name: keys must survive an APP_NAME/APP_SLUG rename.
        services.AddDataProtection().SetApplicationName("backend");
        services.AddOptions<KeyManagementOptions>()
            .Configure<IServiceProvider>((keyOptions, provider) => keyOptions.XmlRepository = new FileSystemXmlRepository(
                new DirectoryInfo(Path.Combine(DataDirectory(provider), "keys")),
                provider.GetRequiredService<ILoggerFactory>()));

        services.AddHttpClient<IMediaProvider, XtreamCodesProvider>(ConfigureProviderClient);
        services.AddSingleton<IMediaProviderResolver, MediaProviderResolver>();

        services.AddHttpClient(RelayHttpClient, (provider, client) =>
        {
            ConfigureProviderClient(provider, client);
            client.Timeout = Timeout.InfiniteTimeSpan;
        });

        services.AddSingleton<ICredentialProtector, DataProtectionCredentialProtector>();
        services.AddSingleton<RelayTokenService>();
        services.AddScoped<AccountService>();
        services.AddScoped<SessionService>();
        services.AddScoped<ProfileService>();
        services.AddScoped<CatalogService>();
        services.AddScoped<PlaybackService>();
        services.AddScoped<LibrarySyncService>();
        services.AddScoped<LibraryService>();
        services.AddSingleton<LibrarySyncQueue>();
        services.AddHostedService<LibrarySyncWorker>();

        return services;
    }

    /// <summary>Creates the data directory on first use and returns it.</summary>
    private static string DataDirectory(IServiceProvider provider)
    {
        var directory = provider.GetRequiredService<IOptions<BackendOptions>>().Value.DataDirectory;
        Directory.CreateDirectory(directory);
        return directory;
    }

    private static void ConfigureProviderClient(IServiceProvider provider, HttpClient client)
    {
        client.Timeout = TimeSpan.FromSeconds(60);
        var userAgent = provider.GetRequiredService<IOptions<BackendOptions>>().Value.ProviderUserAgent;
        if (userAgent is not null)
        {
            client.DefaultRequestHeaders.UserAgent.TryParseAdd(userAgent);
        }
    }
}
