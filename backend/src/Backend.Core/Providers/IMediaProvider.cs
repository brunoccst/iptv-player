using Backend.Core.Epg;
using Backend.Core.Media;

namespace Backend.Core.Providers;

/// <summary>
/// Abstraction over one IPTV source type. Implementations are stateless; credentials are passed per call.
/// </summary>
public interface IMediaProvider
{
    /// <summary>Stable key stored with each account, e.g. <c>xtream</c>.</summary>
    string ProviderType { get; }

    /// <summary>Returns the canonical server URL (scheme, host, port, base path) or throws <see cref="ArgumentException"/>.</summary>
    Uri NormalizeServerUrl(string serverUrl);

    Task<ProviderAccountInfo> ValidateAsync(ProviderCredentials credentials, CancellationToken cancellationToken);

    Task<IReadOnlyList<MediaCategory>> GetCategoriesAsync(ProviderCredentials credentials, MediaKind kind, CancellationToken cancellationToken);

    Task<IReadOnlyList<LiveChannel>> GetLiveChannelsAsync(ProviderCredentials credentials, string? categoryId, CancellationToken cancellationToken);

    Task<IReadOnlyList<MovieSummary>> GetMoviesAsync(ProviderCredentials credentials, string? categoryId, CancellationToken cancellationToken);

    Task<MovieDetails?> GetMovieAsync(ProviderCredentials credentials, string movieId, CancellationToken cancellationToken);

    Task<IReadOnlyList<SeriesSummary>> GetSeriesAsync(ProviderCredentials credentials, string? categoryId, CancellationToken cancellationToken);

    Task<SeriesDetails?> GetSeriesDetailsAsync(ProviderCredentials credentials, string seriesId, CancellationToken cancellationToken);

    /// <summary>Opens the full XMLTV guide, decompressed. Caller disposes. Can be very large; read it as a stream.</summary>
    Task<Stream> OpenXmltvAsync(ProviderCredentials credentials, CancellationToken cancellationToken);

    /// <summary>Next few programmes for one channel, keyed by <see cref="EpgChannelKeys.ForStream"/>.</summary>
    Task<IReadOnlyList<EpgProgramme>> GetShortEpgAsync(ProviderCredentials credentials, string channelId, int limit, CancellationToken cancellationToken);

    /// <summary>Builds the upstream stream URL. Pure; no network call.</summary>
    PlaybackSource BuildPlaybackSource(ProviderCredentials credentials, PlaybackRequest request, ProviderAccountInfo? accountInfo);
}
