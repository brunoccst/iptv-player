using Backend.Core.Accounts;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Accounts;

/// <summary>Per-profile "My List" (D-055). All methods verify the profile belongs to the account.</summary>
public sealed class WatchlistService(AppDbContext db, TimeProvider clock)
{
    public static readonly string[] Sections = ["movies", "series"];
    public const int MaxItems = 500;

    /// <returns><c>null</c> when the profile is not part of the account. Newest first.</returns>
    public async Task<IReadOnlyList<WatchlistItem>?> ListAsync(Guid accountId, Guid profileId, CancellationToken ct)
    {
        if (!await OwnsProfileAsync(accountId, profileId, ct))
        {
            return null;
        }

        // Sorted in memory: SQLite stores DateTimeOffset through a converter (same as progress).
        var items = await db.Watchlist.AsNoTracking().Where(i => i.ProfileId == profileId).ToListAsync(ct);
        return items.OrderByDescending(i => i.AddedAt).ToList();
    }

    /// <returns><c>null</c> when the profile is not part of the account. Adding an existing title refreshes its details.</returns>
    public async Task<WatchlistItem?> AddAsync(Guid accountId, Guid profileId, string section, string masterId, WatchlistInput input, CancellationToken ct)
    {
        if (!await OwnsProfileAsync(accountId, profileId, ct))
        {
            return null;
        }

        var item = await db.Watchlist.SingleOrDefaultAsync(i => i.ProfileId == profileId && i.Section == section && i.MasterId == masterId, ct);
        if (item is null)
        {
            item = new WatchlistItem
            {
                Id = Guid.NewGuid(),
                ProfileId = profileId,
                Section = section,
                MasterId = masterId,
                Title = input.Title,
                AddedAt = clock.GetUtcNow(),
            };
            db.Watchlist.Add(item);
        }

        item.Title = input.Title;
        item.Year = input.Year;
        item.PosterUrl = input.PosterUrl;
        await db.SaveChangesAsync(ct);
        return item;
    }

    /// <returns><c>false</c> when the profile is not part of the account.</returns>
    public async Task<bool> RemoveAsync(Guid accountId, Guid profileId, string section, string masterId, CancellationToken ct)
    {
        if (!await OwnsProfileAsync(accountId, profileId, ct))
        {
            return false;
        }

        await db.Watchlist.Where(i => i.ProfileId == profileId && i.Section == section && i.MasterId == masterId).ExecuteDeleteAsync(ct);
        return true;
    }

    public Task<int> CountAsync(Guid profileId, CancellationToken ct) => db.Watchlist.CountAsync(i => i.ProfileId == profileId, ct);

    private Task<bool> OwnsProfileAsync(Guid accountId, Guid profileId, CancellationToken ct) =>
        db.Profiles.AnyAsync(p => p.Id == profileId && p.AccountId == accountId, ct);
}

public sealed record WatchlistInput(string Title, int? Year, string? PosterUrl);
