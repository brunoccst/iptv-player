namespace Backend.Core.Accounts;

/// <summary>One upstream IPTV login. Password is stored encrypted.</summary>
public sealed class ProviderAccount
{
    public Guid Id { get; set; }
    public required string ProviderType { get; set; }
    public required string ServerUrl { get; set; }
    public required string Username { get; set; }
    public required string EncryptedPassword { get; set; }
    public string? Status { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public int? MaxConnections { get; set; }
    public string AllowedOutputFormats { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset LastLoginAt { get; set; }
    public List<Profile> Profiles { get; set; } = [];
}

/// <summary>Viewer profile under an account (Netflix-style "Who's watching?").</summary>
public sealed class Profile
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public required string Name { get; set; }
    public string? AvatarKey { get; set; }
    public bool IsKids { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public ProviderAccount? Account { get; set; }
}

/// <summary>Client login session. Only the SHA-256 hash of the bearer token is stored.</summary>
public sealed class UserSession
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public required string TokenHash { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public ProviderAccount? Account { get; set; }
}

/// <summary>Playback position of one movie or episode for one profile. Feeds "Continue Watching".</summary>
public sealed class WatchProgress
{
    public Guid Id { get; set; }
    public Guid ProfileId { get; set; }

    /// <summary><c>movie</c> or <c>episode</c>.</summary>
    public required string Kind { get; set; }

    /// <summary>Provider stream id (what <c>/api/playback</c> takes).</summary>
    public required string ItemId { get; set; }

    public string? MasterId { get; set; }
    public string? SeriesId { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public required string Title { get; set; }
    public string? PosterUrl { get; set; }
    public string? ContainerExtension { get; set; }
    public double PositionSeconds { get; set; }
    public double DurationSeconds { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public Profile? Profile { get; set; }
}

/// <summary>A title a profile saved to watch later ("My List", D-055). Points at a library master.</summary>
public sealed class WatchlistItem
{
    public Guid Id { get; set; }
    public Guid ProfileId { get; set; }

    /// <summary><c>movies</c> or <c>series</c> (library section).</summary>
    public required string Section { get; set; }

    public required string MasterId { get; set; }
    public required string Title { get; set; }
    public int? Year { get; set; }
    public string? PosterUrl { get; set; }
    public DateTimeOffset AddedAt { get; set; }
    public Profile? Profile { get; set; }
}
