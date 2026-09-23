using Backend.Core.Media;

namespace Backend.Core.Epg;

/// <summary>One guide entry from a provider. <see cref="ChannelKey"/> is a normalized XMLTV id or a stream id.</summary>
public sealed record EpgProgramme(string ChannelKey, DateTimeOffset Start, DateTimeOffset End, string Title, string? Description);

/// <summary>Grid readiness. <c>Refreshing</c>: first download still running. <c>Unavailable</c>: provider has no usable guide.</summary>
public enum EpgStatus
{
    Ready,
    Refreshing,
    Unavailable,
}

public sealed record EpgListing(DateTimeOffset Start, DateTimeOffset End, string Title, string? Description);

public sealed record EpgChannelRow(LiveChannel Channel, IReadOnlyList<EpgListing> Programmes);

/// <summary>One page of channels with their programmes overlapping [<see cref="From"/>, <see cref="To"/>).</summary>
public sealed record EpgGrid(
    EpgStatus Status,
    DateTimeOffset? UpdatedAt,
    DateTimeOffset From,
    DateTimeOffset To,
    int TotalChannels,
    IReadOnlyList<EpgChannelRow> Channels);

public static class EpgChannelKeys
{
    /// <summary>XMLTV channel ids match <c>epg_channel_id</c> case-insensitively on real panels.</summary>
    public static string? Normalize(string? epgChannelId) =>
        string.IsNullOrWhiteSpace(epgChannelId) ? null : epgChannelId.Trim().ToLowerInvariant();

    /// <summary>Key for programmes fetched per stream (short EPG), which has no XMLTV id.</summary>
    public static string ForStream(string streamId) => "stream:" + streamId;
}
