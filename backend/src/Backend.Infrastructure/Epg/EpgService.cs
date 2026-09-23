using Backend.Core.Configuration;
using Backend.Core.Epg;
using Backend.Core.Media;
using Backend.Core.Providers;
using Backend.Infrastructure.Accounts;
using Backend.Infrastructure.Catalog;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure.Epg;

public sealed record EpgGridQuery(string? CategoryId, DateTimeOffset? From, int Hours, int Offset, int Limit);

/// <summary>Builds guide pages from the cached XMLTV data, with per-channel short EPG as fallback. See DECISIONS.md#d-031.</summary>
public sealed class EpgService(
    AppDbContext db,
    CatalogService catalog,
    AccountService accounts,
    EpgRefreshQueue queue,
    IMemoryCache cache,
    IOptions<BackendOptions> options,
    TimeProvider clock)
{
    public const int MaxHours = 12;
    public const int MaxLimit = 200;
    public static readonly TimeSpan SlotSize = TimeSpan.FromMinutes(30);

    /// <summary>A failed download is not retried sooner than this.</summary>
    private static readonly TimeSpan RetryAfter = TimeSpan.FromMinutes(15);
    private static readonly TimeSpan ShortEpgCache = TimeSpan.FromMinutes(30);
    private const int ShortEpgLimit = 12;
    private const int ShortEpgParallelism = 4;

    public async Task<EpgGrid> GetGridAsync(Guid accountId, EpgGridQuery query, CancellationToken ct)
    {
        var now = clock.GetUtcNow();
        var from = query.From?.ToUniversalTime() ?? FloorToSlot(now);
        var to = from + TimeSpan.FromHours(Math.Clamp(query.Hours, 1, MaxHours));
        var status = await EnsureFreshAsync(accountId, now, ct);

        var channels = await catalog.GetLiveChannelsAsync(accountId, query.CategoryId, ct);
        var page = channels.Skip(Math.Max(0, query.Offset)).Take(Math.Clamp(query.Limit, 1, MaxLimit)).ToList();

        var byKey = await LoadCachedAsync(accountId, page, from, to, ct);
        var rows = page.Select(channel => (Channel: channel, Programmes: ProgrammesFor(channel, byKey))).ToList();

        // Channels the XMLTV feed does not cover (or no feed at all): ask the panel per channel.
        var missing = rows.Where(row => row.Programmes.Count == 0).Select(row => row.Channel).ToList();
        if (missing.Count > 0 && status.Status != EpgStatus.Refreshing)
        {
            var shortEpg = await LoadShortEpgAsync(accountId, missing, ct);
            rows = rows.Select(row => row.Programmes.Count > 0 || !shortEpg.TryGetValue(row.Channel.Id, out var found)
                ? row
                : (row.Channel, found.Where(p => p.End > from && p.Start < to).ToList())).ToList();
        }

        return new EpgGrid(status.Status, status.UpdatedAt, from, to, channels.Count,
            rows.Select(row => new EpgChannelRow(row.Channel,
                row.Programmes.Select(p => new EpgListing(p.Start, p.End, p.Title, p.Description)).ToList())).ToList());
    }

    /// <summary>Queues a download when the guide is missing or stale. Serves the old guide meanwhile.</summary>
    public async Task<(EpgStatus Status, DateTimeOffset? UpdatedAt)> EnsureFreshAsync(Guid accountId, DateTimeOffset now, CancellationToken ct)
    {
        var key = accountId.ToString();
        var state = await db.EpgStates.AsNoTracking().SingleOrDefaultAsync(s => s.AccountId == key, ct);
        var stale = state?.UpdatedAt is null || state.UpdatedAt < now - TimeSpan.FromHours(options.Value.EpgRefreshHours);
        var recentlyTried = state?.LastAttemptAt is { } attempted && attempted > now - RetryAfter;
        if (stale && !recentlyTried)
        {
            queue.Request(accountId);
        }

        var status = state?.UpdatedAt is not null ? EpgStatus.Ready
            : queue.IsPending(accountId) ? EpgStatus.Refreshing
            : EpgStatus.Unavailable;
        return (status, state?.UpdatedAt);
    }

    public static DateTimeOffset FloorToSlot(DateTimeOffset time)
    {
        var utc = time.ToUniversalTime();
        return new DateTimeOffset(utc.UtcTicks - utc.UtcTicks % SlotSize.Ticks, TimeSpan.Zero);
    }

    private async Task<Dictionary<string, List<EpgProgramme>>> LoadCachedAsync(
        Guid accountId, IReadOnlyList<LiveChannel> page, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var account = accountId.ToString();
        var keys = page.Select(c => EpgChannelKeys.Normalize(c.EpgChannelId)).OfType<string>().Distinct().ToList();
        if (keys.Count == 0)
        {
            return [];
        }

        var rows = await db.EpgProgrammes.AsNoTracking()
            .Where(p => p.AccountId == account && keys.Contains(p.ChannelKey) && p.End > from && p.Start < to)
            .OrderBy(p => p.Start)
            .ToListAsync(ct);
        return rows.GroupBy(r => r.ChannelKey).ToDictionary(
            g => g.Key,
            g => g.Select(r => new EpgProgramme(r.ChannelKey, r.Start, r.End, r.Title, r.Description)).ToList());
    }

    private static List<EpgProgramme> ProgrammesFor(LiveChannel channel, Dictionary<string, List<EpgProgramme>> byKey) =>
        EpgChannelKeys.Normalize(channel.EpgChannelId) is { } key && byKey.TryGetValue(key, out var found) ? found : [];

    private async Task<Dictionary<string, IReadOnlyList<EpgProgramme>>> LoadShortEpgAsync(
        Guid accountId, IReadOnlyList<LiveChannel> channels, CancellationToken ct)
    {
        var result = new Dictionary<string, IReadOnlyList<EpgProgramme>>();
        var toFetch = new List<LiveChannel>();
        foreach (var channel in channels)
        {
            if (cache.TryGetValue(ShortEpgKey(accountId, channel.Id), out IReadOnlyList<EpgProgramme>? cached) && cached is not null)
            {
                result[channel.Id] = cached;
            }
            else
            {
                toFetch.Add(channel);
            }
        }
        if (toFetch.Count == 0)
        {
            return result;
        }

        var context = await accounts.GetProviderContextAsync(accountId, ct);
        var fetched = new System.Collections.Concurrent.ConcurrentDictionary<string, IReadOnlyList<EpgProgramme>>();
        await Parallel.ForEachAsync(toFetch, new ParallelOptions { MaxDegreeOfParallelism = ShortEpgParallelism, CancellationToken = ct },
            async (channel, token) =>
            {
                IReadOnlyList<EpgProgramme> programmes;
                try
                {
                    programmes = await context.Provider.GetShortEpgAsync(context.Credentials, channel.Id, ShortEpgLimit, token);
                }
                catch (ProviderException)
                {
                    // Guide data is optional; an empty row is cached like "no guide for this channel".
                    programmes = [];
                }
                fetched[channel.Id] = programmes;
                cache.Set(ShortEpgKey(accountId, channel.Id), programmes, ShortEpgCache);
            });

        foreach (var (id, programmes) in fetched)
        {
            result[id] = programmes;
        }
        return result;
    }

    private static string ShortEpgKey(Guid accountId, string channelId) => $"epg-short:{accountId}:{channelId}";
}
