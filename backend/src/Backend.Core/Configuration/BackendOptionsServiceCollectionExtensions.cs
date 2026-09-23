using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Core.Configuration;

public static class BackendOptionsServiceCollectionExtensions
{
    /// <summary>Binds <see cref="BackendOptions"/> from flat keys. Relative <c>DATA_DIR</c> resolves against the <c>.env</c> directory, else <paramref name="contentRoot"/>.</summary>
    public static IServiceCollection AddBackendOptions(this IServiceCollection services, string contentRoot)
    {
        services.AddOptions<BackendOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                var dataDirectory = configuration[BackendOptions.EnvKeys.DataDirectory]?.Trim();
                var baseDirectory = configuration[DotEnvConfigurationExtensions.DotEnvDirectoryKey] ?? contentRoot;
                options.DataDirectory = Path.GetFullPath(string.IsNullOrEmpty(dataDirectory) ? ".data" : dataDirectory, baseDirectory);

                if (Enum.TryParse<StreamDeliveryMode>(configuration[BackendOptions.EnvKeys.StreamDelivery], ignoreCase: true, out var mode))
                {
                    options.StreamDelivery = mode;
                }

                options.CorsOrigins = (configuration[BackendOptions.EnvKeys.CorsOrigins] ?? string.Empty)
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

                options.SessionDays = ReadInt(configuration, BackendOptions.EnvKeys.SessionDays, options.SessionDays);
                options.RelayTokenHours = ReadInt(configuration, BackendOptions.EnvKeys.RelayTokenHours, options.RelayTokenHours);
                options.CatalogCacheMinutes = ReadInt(configuration, BackendOptions.EnvKeys.CatalogCacheMinutes, options.CatalogCacheMinutes);
                options.EpgRefreshHours = ReadInt(configuration, BackendOptions.EnvKeys.EpgRefreshHours, options.EpgRefreshHours);

                var publicBaseUrl = configuration[BackendOptions.EnvKeys.PublicBaseUrl]?.Trim();
                options.PublicBaseUrl = string.IsNullOrEmpty(publicBaseUrl) ? null : new Uri(publicBaseUrl.TrimEnd('/') + "/", UriKind.RelativeOrAbsolute);

                var userAgent = configuration[BackendOptions.EnvKeys.ProviderUserAgent]?.Trim();
                options.ProviderUserAgent = string.IsNullOrEmpty(userAgent) ? null : userAgent;
            })
            .Validate(options => options.SessionDays > 0 && options.RelayTokenHours > 0 && options.CatalogCacheMinutes >= 0 && options.EpgRefreshHours > 0,
                "BACKEND_SESSION_DAYS, BACKEND_RELAY_TOKEN_HOURS and BACKEND_EPG_REFRESH_HOURS must be > 0; BACKEND_CATALOG_CACHE_MINUTES must be >= 0.")
            .Validate(options => options.PublicBaseUrl is null
                    || (options.PublicBaseUrl.IsAbsoluteUri && options.PublicBaseUrl.Scheme is "http" or "https"),
                "BACKEND_PUBLIC_BASE_URL must be an absolute http(s) URL.")
            .ValidateOnStart();

        return services;
    }

    private static int ReadInt(IConfiguration configuration, string key, int fallback) =>
        int.TryParse(configuration[key], out var value) ? value : fallback;
}
