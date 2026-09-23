using Backend.Core.Configuration;
using Backend.Core.Media;
using Backend.Infrastructure.Accounts;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure.Catalog;

/// <summary>Account-scoped catalog reads with an in-memory cache in front of the provider.</summary>
public sealed class CatalogService(AccountService accounts, IMemoryCache cache, IOptions<BackendOptions> options)
{
    public Task<IReadOnlyList<MediaCategory>> GetCategoriesAsync(Guid accountId, MediaKind kind, CancellationToken ct) =>
        CachedAsync(accountId, $"categories:{kind}", ctx => ctx.Provider.GetCategoriesAsync(ctx.Credentials, kind, ct), ct);

    public Task<IReadOnlyList<LiveChannel>> GetLiveChannelsAsync(Guid accountId, string? categoryId, CancellationToken ct) =>
        CachedAsync(accountId, $"live:{categoryId}", ctx => ctx.Provider.GetLiveChannelsAsync(ctx.Credentials, categoryId, ct), ct);

    public Task<IReadOnlyList<MovieSummary>> GetMoviesAsync(Guid accountId, string? categoryId, CancellationToken ct) =>
        CachedAsync(accountId, $"movies:{categoryId}", ctx => ctx.Provider.GetMoviesAsync(ctx.Credentials, categoryId, ct), ct);

    public Task<MovieDetails?> GetMovieAsync(Guid accountId, string movieId, CancellationToken ct) =>
        CachedAsync(accountId, $"movie:{movieId}", ctx => ctx.Provider.GetMovieAsync(ctx.Credentials, movieId, ct), ct);

    public Task<IReadOnlyList<SeriesSummary>> GetSeriesAsync(Guid accountId, string? categoryId, CancellationToken ct) =>
        CachedAsync(accountId, $"series:{categoryId}", ctx => ctx.Provider.GetSeriesAsync(ctx.Credentials, categoryId, ct), ct);

    public Task<SeriesDetails?> GetSeriesDetailsAsync(Guid accountId, string seriesId, CancellationToken ct) =>
        CachedAsync(accountId, $"series-details:{seriesId}", ctx => ctx.Provider.GetSeriesDetailsAsync(ctx.Credentials, seriesId, ct), ct);

    private async Task<T> CachedAsync<T>(Guid accountId, string key, Func<ProviderContext, Task<T>> load, CancellationToken ct)
    {
        var cacheKey = $"catalog:{accountId}:{key}";
        if (cache.TryGetValue(cacheKey, out T? cached) && cached is not null)
        {
            return cached;
        }

        var context = await accounts.GetProviderContextAsync(accountId, ct);
        var value = await load(context);
        if (value is not null && options.Value.CatalogCacheMinutes > 0)
        {
            cache.Set(cacheKey, value, TimeSpan.FromMinutes(options.Value.CatalogCacheMinutes));
        }

        return value;
    }
}
