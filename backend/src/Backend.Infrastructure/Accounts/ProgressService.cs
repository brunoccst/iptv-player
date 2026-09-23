using Backend.Core.Accounts;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Accounts;

/// <summary>Per-profile watch positions. All methods verify the profile belongs to the account.</summary>
public sealed class ProgressService(AppDbContext db, TimeProvider clock)
{
    public static readonly string[] Kinds = ["movie", "episode"];
    public const int MaxListSize = 200;

    /// <returns><c>null</c> when the profile is not part of the account.</returns>
    public async Task<IReadOnlyList<WatchProgress>?> ListAsync(Guid accountId, Guid profileId, int limit, CancellationToken ct)
    {
        if (!await OwnsProfileAsync(accountId, profileId, ct))
        {
            return null;
        }

        // Sorted client-side: SQLite stores DateTimeOffset as ticks via converter, ordering in memory keeps it simple.
        var items = await db.WatchProgress.AsNoTracking().Where(p => p.ProfileId == profileId).ToListAsync(ct);
        return items.OrderByDescending(p => p.UpdatedAt).Take(Math.Clamp(limit, 1, MaxListSize)).ToList();
    }

    /// <returns><c>null</c> when the profile is not part of the account.</returns>
    public async Task<WatchProgress?> UpsertAsync(Guid accountId, Guid profileId, string kind, string itemId, ProgressInput input, CancellationToken ct)
    {
        if (!await OwnsProfileAsync(accountId, profileId, ct))
        {
            return null;
        }

        var progress = await db.WatchProgress.SingleOrDefaultAsync(p => p.ProfileId == profileId && p.Kind == kind && p.ItemId == itemId, ct);
        if (progress is null)
        {
            progress = new WatchProgress { Id = Guid.NewGuid(), ProfileId = profileId, Kind = kind, ItemId = itemId, Title = input.Title };
            db.WatchProgress.Add(progress);
        }

        progress.Title = input.Title;
        progress.MasterId = input.MasterId;
        progress.SeriesId = input.SeriesId;
        progress.SeasonNumber = input.SeasonNumber;
        progress.EpisodeNumber = input.EpisodeNumber;
        progress.PosterUrl = input.PosterUrl;
        progress.ContainerExtension = input.ContainerExtension;
        progress.PositionSeconds = Math.Max(0, input.PositionSeconds);
        progress.DurationSeconds = Math.Max(0, input.DurationSeconds);
        progress.UpdatedAt = clock.GetUtcNow();

        await db.SaveChangesAsync(ct);
        return progress;
    }

    /// <returns><c>false</c> when the profile is not part of the account.</returns>
    public async Task<bool> DeleteAsync(Guid accountId, Guid profileId, string kind, string itemId, CancellationToken ct)
    {
        if (!await OwnsProfileAsync(accountId, profileId, ct))
        {
            return false;
        }

        await db.WatchProgress.Where(p => p.ProfileId == profileId && p.Kind == kind && p.ItemId == itemId).ExecuteDeleteAsync(ct);
        return true;
    }

    private Task<bool> OwnsProfileAsync(Guid accountId, Guid profileId, CancellationToken ct) =>
        db.Profiles.AnyAsync(p => p.Id == profileId && p.AccountId == accountId, ct);
}

public sealed record ProgressInput(
    string Title,
    double PositionSeconds,
    double DurationSeconds,
    string? MasterId,
    string? SeriesId,
    int? SeasonNumber,
    int? EpisodeNumber,
    string? PosterUrl,
    string? ContainerExtension);
