using System.Text.Json;
using Backend.Core.Library;
using Backend.Infrastructure.Pipeline;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Library;

/// <summary>Reads deduplicated master media produced by the Python normalizer.</summary>
public sealed class LibraryService(PipelineDbContext db)
{
    public const int MaxPageSize = 500;

    public async Task<LibraryPage> ListAsync(Guid accountId, string mediaKind, LibraryQuery query, CancellationToken ct)
    {
        var account = accountId.ToString();
        var masters = db.MasterMedia.AsNoTracking().Where(m => m.AccountId == account && m.MediaKind == mediaKind);

        if (!string.IsNullOrWhiteSpace(query.CategoryId))
        {
            masters = masters.Where(m => m.Variants.Any(v => v.CategoryId == query.CategoryId));
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var pattern = $"%{query.Search.Trim().ToLowerInvariant()}%";
            masters = masters.Where(m => EF.Functions.Like(m.NormalizedKey, pattern) || EF.Functions.Like(m.Title, pattern));
        }

        var total = await masters.CountAsync(ct);
        var items = await Sort(masters, query.Sort, query.Order ?? DefaultOrder(query.Sort))
            .Skip(Math.Max(0, query.Offset))
            .Take(Math.Clamp(query.Limit, 1, MaxPageSize))
            .Select(m => new MasterCard(m.Id, m.Title, m.Year, m.PosterUrl, m.Rating, m.BestQuality, m.VariantCount))
            .ToListAsync(ct);

        var all = db.MasterMedia.AsNoTracking().Where(m => m.AccountId == account && m.MediaKind == mediaKind);
        var sorts = new List<LibrarySort>();
        if (await all.AnyAsync(m => m.AddedAt != null, ct))
        {
            sorts.Add(LibrarySort.Added);
        }

        sorts.Add(LibrarySort.Title);
        if (await all.AnyAsync(m => m.ReleaseKey != null, ct))
        {
            sorts.Add(LibrarySort.Released);
        }

        return new LibraryPage(total, items, sorts);
    }

    /// <summary>Dates default to newest first, titles to A–Z.</summary>
    public static SortOrder DefaultOrder(LibrarySort sort) => sort == LibrarySort.Title ? SortOrder.Asc : SortOrder.Desc;

    private static IOrderedQueryable<MasterMedia> Sort(IQueryable<MasterMedia> masters, LibrarySort sort, SortOrder order)
    {
        var desc = order == SortOrder.Desc;
        var sorted = sort switch
        {
            LibrarySort.Added => desc
                ? masters.OrderBy(m => m.AddedAt == null).ThenByDescending(m => m.AddedAt)
                : masters.OrderBy(m => m.AddedAt == null).ThenBy(m => m.AddedAt),
            LibrarySort.Released => desc
                ? masters.OrderBy(m => m.ReleaseKey == null).ThenByDescending(m => m.ReleaseKey)
                : masters.OrderBy(m => m.ReleaseKey == null).ThenBy(m => m.ReleaseKey),
            _ => desc ? masters.OrderByDescending(m => m.Title) : masters.OrderBy(m => m.Title),
        };
        return sorted.ThenBy(m => m.Title).ThenBy(m => m.Year).ThenBy(m => m.Id);
    }

    public async Task<MasterDetails?> GetAsync(Guid accountId, string mediaKind, string masterId, CancellationToken ct)
    {
        var account = accountId.ToString();
        var master = await db.MasterMedia.AsNoTracking()
            .Include(m => m.Variants)
            .SingleOrDefaultAsync(m => m.AccountId == account && m.MediaKind == mediaKind && m.Id == masterId, ct);

        if (master is null)
        {
            return null;
        }

        var variants = master.Variants
            .OrderByDescending(v => v.QualityScore).ThenBy(v => v.Label, StringComparer.Ordinal)
            .Select(v => new VariantInfo(
                v.StreamId, v.Label, v.Quality, v.Source, JsonSerializer.Deserialize<string[]>(v.AudioLanguages) ?? [],
                v.AudioTag, v.IsHdr, v.ContainerExtension, v.CategoryId, v.RawTitle))
            .ToList();

        return new MasterDetails(master.Id, master.Title, master.Year, master.PosterUrl, master.Rating, master.BestQuality, variants);
    }

    /// <summary>Latest job per kind plus current master count.</summary>
    public async Task<IReadOnlyList<LibraryStatus>> GetStatusAsync(Guid accountId, CancellationToken ct)
    {
        var account = accountId.ToString();
        var statuses = new List<LibraryStatus>();

        foreach (var kind in LibraryKind.All)
        {
            var job = await db.NormalizationJobs.AsNoTracking()
                .Where(j => j.AccountId == account && j.MediaKind == kind)
                .OrderByDescending(j => j.Id)
                .Select(j => new { j.Status, j.ItemCount, j.CreatedAt, j.FinishedAt, j.Error })
                .FirstOrDefaultAsync(ct);
            var masterCount = await db.MasterMedia.CountAsync(m => m.AccountId == account && m.MediaKind == kind, ct);

            statuses.Add(new LibraryStatus(
                kind, job?.Status, job?.ItemCount, FromUnix(job?.CreatedAt), FromUnix(job?.FinishedAt), job?.Error, masterCount));
        }

        return statuses;
    }

    private static DateTimeOffset? FromUnix(long? seconds) => seconds is { } value ? DateTimeOffset.FromUnixTimeSeconds(value) : null;
}

public sealed record LibraryQuery(
    string? CategoryId, string? Search, int Offset = 0, int Limit = 100, LibrarySort Sort = LibrarySort.Added, SortOrder? Order = null);

/// <summary><c>Sorts</c> lists the orders this library has data for; <c>title</c> is always there.</summary>
public sealed record LibraryPage(int Total, IReadOnlyList<MasterCard> Items, IReadOnlyList<LibrarySort> Sorts);

public sealed record MasterCard(string Id, string Title, int? Year, string? PosterUrl, double? Rating, string? BestQuality, int VariantCount);

public sealed record MasterDetails(
    string Id, string Title, int? Year, string? PosterUrl, double? Rating, string? BestQuality, IReadOnlyList<VariantInfo> Variants);

/// <summary>One entry of the "Version / Stream Quality" selector. Play it via <c>/api/playback/{movie|...}/{StreamId}</c>.</summary>
public sealed record VariantInfo(
    string StreamId,
    string Label,
    string? Quality,
    string? Source,
    IReadOnlyList<string> AudioLanguages,
    string? AudioTag,
    bool IsHdr,
    string? ContainerExtension,
    string? CategoryId,
    string RawTitle);

public sealed record LibraryStatus(
    string MediaKind,
    string? JobStatus,
    int? ItemCount,
    DateTimeOffset? QueuedAt,
    DateTimeOffset? FinishedAt,
    string? Error,
    int MasterCount);
