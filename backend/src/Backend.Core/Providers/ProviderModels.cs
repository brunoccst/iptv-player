using Backend.Core.Media;

namespace Backend.Core.Providers;

/// <summary>Credentials for one upstream account. Never sent to clients.</summary>
public sealed record ProviderCredentials(Uri ServerUrl, string Username, string Password)
{
    public override string ToString() => $"{ServerUrl} ({Username})";
}

public sealed record ProviderAccountInfo(
    string Status,
    DateTimeOffset? ExpiresAt,
    int? MaxConnections,
    int? ActiveConnections,
    IReadOnlyList<string> AllowedOutputFormats);

/// <summary>Upstream location of a playable stream. <see cref="Url"/> embeds credentials; keep server-side.</summary>
public sealed record PlaybackSource(Uri Url, string Container, bool IsLive);

public sealed record PlaybackRequest(PlaybackKind Kind, string Id, string? Container);
