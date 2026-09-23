using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Core.Configuration;

public static class AppOptionsServiceCollectionExtensions
{
    /// <summary>Binds <see cref="AppOptions"/> from flat env keys and fails startup if any are missing.</summary>
    public static IServiceCollection AddAppOptions(this IServiceCollection services)
    {
        services.AddOptions<AppOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.Name = configuration[AppOptions.EnvKeys.Name]?.Trim() ?? string.Empty;
                options.Slug = configuration[AppOptions.EnvKeys.Slug]?.Trim() ?? string.Empty;
            })
            .ValidateDataAnnotations()
            .ValidateOnStart();

        return services;
    }
}
