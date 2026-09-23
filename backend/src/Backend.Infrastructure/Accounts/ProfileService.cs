using Backend.Core.Accounts;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Accounts;

/// <summary>CRUD for viewer profiles. Enforces name rules and per-account limits.</summary>
public sealed class ProfileService(AppDbContext db, TimeProvider clock)
{
    public async Task<IReadOnlyList<Profile>> ListAsync(Guid accountId, CancellationToken cancellationToken) =>
        (await db.Profiles.AsNoTracking().Where(p => p.AccountId == accountId).ToListAsync(cancellationToken))
            .OrderBy(p => p.CreatedAt)
            .ToList();

    public async Task<ProfileResult> CreateAsync(Guid accountId, ProfileInput input, CancellationToken cancellationToken)
    {
        var existing = await ListAsync(accountId, cancellationToken);
        if (existing.Count >= ProfileLimits.MaxPerAccount)
        {
            return ProfileResult.Fail($"An account can have at most {ProfileLimits.MaxPerAccount} profiles.");
        }

        if (Validate(input, existing, excludeId: null) is { } error)
        {
            return ProfileResult.Fail(error);
        }

        var profile = new Profile
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            Name = input.Name.Trim(),
            AvatarKey = input.AvatarKey,
            IsKids = input.IsKids,
            CreatedAt = clock.GetUtcNow(),
        };
        db.Profiles.Add(profile);
        await db.SaveChangesAsync(cancellationToken);
        return ProfileResult.Ok(profile);
    }

    /// <returns><c>null</c> when the profile does not exist in this account.</returns>
    public async Task<ProfileResult?> UpdateAsync(Guid accountId, Guid profileId, ProfileInput input, CancellationToken cancellationToken)
    {
        var profile = await db.Profiles.SingleOrDefaultAsync(p => p.AccountId == accountId && p.Id == profileId, cancellationToken);
        if (profile is null)
        {
            return null;
        }

        if (Validate(input, await ListAsync(accountId, cancellationToken), excludeId: profileId) is { } error)
        {
            return ProfileResult.Fail(error);
        }

        profile.Name = input.Name.Trim();
        profile.AvatarKey = input.AvatarKey;
        profile.IsKids = input.IsKids;
        await db.SaveChangesAsync(cancellationToken);
        return ProfileResult.Ok(profile);
    }

    /// <returns><c>null</c> when the profile does not exist in this account.</returns>
    public async Task<ProfileResult?> DeleteAsync(Guid accountId, Guid profileId, CancellationToken cancellationToken)
    {
        var profiles = await db.Profiles.Where(p => p.AccountId == accountId).ToListAsync(cancellationToken);
        var profile = profiles.SingleOrDefault(p => p.Id == profileId);
        if (profile is null)
        {
            return null;
        }

        if (profiles.Count == 1)
        {
            return ProfileResult.Fail("The last profile cannot be deleted.");
        }

        db.Profiles.Remove(profile);
        await db.SaveChangesAsync(cancellationToken);
        return ProfileResult.Ok(profile);
    }

    private static string? Validate(ProfileInput input, IReadOnlyList<Profile> existing, Guid? excludeId)
    {
        var name = input.Name?.Trim() ?? string.Empty;
        if (name.Length is 0 or > ProfileLimits.MaxNameLength)
        {
            return $"Name must be 1-{ProfileLimits.MaxNameLength} characters.";
        }

        if (input.AvatarKey is { Length: > 64 })
        {
            return "Avatar key must be at most 64 characters.";
        }

        return existing.Any(p => p.Id != excludeId && p.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
            ? $"A profile named '{name}' already exists."
            : null;
    }
}

public sealed record ProfileInput(string Name, string? AvatarKey, bool IsKids);

public sealed record ProfileResult(Profile? Profile, string? Error)
{
    public static ProfileResult Ok(Profile profile) => new(profile, null);

    public static ProfileResult Fail(string error) => new(null, error);
}
