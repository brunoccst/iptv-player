using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Core.Configuration;

public static class BackendOptionsServiceCollectionExtensions
{
    /// <summary>Binds <see cref="BackendOptions"/> from flat <c>BACKEND_*</c> keys. Relative data dir resolves against <paramref name="contentRoot"/>.</summary>
    public static IServiceCollection AddBackendOptions(this IServiceCollection services, string contentRoot)
    {
        services.AddOptions<BackendOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                var dataDirectory = configuration[BackendOptions.EnvKeys.DataDirectory]?.Trim();
                options.DataDirectory = Path.GetFullPath(string.IsNullOrEmpty(dataDirectory) ? ".data" : dataDirectory, contentRoot);

                if (Enum.TryParse<StreamDeliveryMode>(configuration[BackendOptions.EnvKeys.StreamDelivery], ignoreCase: true, out var mode))
                {
                    options.StreamDelivery = mode;
                }

                options.CorsOrigins = (configuration[BackendOptions.EnvKeys.CorsOrigins] ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                options.SessionDays = ReadInt(configuration, BackendOptions.EnvKeys.SessionDays, options.SessionDays);
                options.RelayTokenHours = ReadInt(configuration, BackendOptions.EnvKeys.RelayTokenHours, options.RelayTokenHours);
                options.CatalogCacheMinutes = ReadInt(configuration, BackendOptions.EnvKeys.CatalogCacheMinutes, options.CatalogCacheMinutes);

                var userAgent = configuration[BackendOptions.EnvKeys.ProviderUserAgent]?.Trim();
                options.ProviderUserAgent = string.IsNullOrEmpty(userAgent) ? null : userAgent;
            })
            .Validate(options => options.SessionDays > 0 && options.RelayTokenHours > 0 && options.CatalogCacheMinutes >= 0,
                "BACKEND_SESSION_DAYS and BACKEND_RELAY_TOKEN_HOURS must be > 0; BACKEND_CATALOG_CACHE_MINUTES must be >= 0.")
            .ValidateOnStart();

        return services;
    }

    private static int ReadInt(IConfiguration configuration, string key, int fallback) =>
        int.TryParse(configuration[key], out var value) ? value : fallback;
}
