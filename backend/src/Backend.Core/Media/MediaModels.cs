namespace Backend.Core.Media;

/// <summary>Catalog section a category belongs to.</summary>
public enum MediaKind
{
    Live,
    Movie,
    Series,
}

/// <summary>What a playback request points at. Episodes are playable; series are not.</summary>
public enum PlaybackKind
{
    Live,
    Movie,
    Episode,
}

public sealed record MediaCategory(string Id, string Name, MediaKind Kind);

public sealed record LiveChannel(
    string Id,
    string Name,
    string? CategoryId,
    int? Number,
    string? LogoUrl,
    string? EpgChannelId,
    bool HasCatchup);

public sealed record MovieSummary(
    string Id,
    string Name,
    string? CategoryId,
    string? PosterUrl,
    double? Rating,
    DateTimeOffset? AddedAt,
    string? ContainerExtension,
    string? TmdbId = null);

public sealed record MovieDetails(
    MovieSummary Summary,
    string? Plot,
    string? Genre,
    string? Cast,
    string? Director,
    string? ReleaseDate,
    int? DurationSeconds,
    IReadOnlyList<string> BackdropUrls,
    string? TrailerYoutubeId,
    string? TmdbId);

public sealed record SeriesSummary(
    string Id,
    string Name,
    string? CategoryId,
    string? PosterUrl,
    double? Rating,
    string? Plot,
    string? Genre,
    string? ReleaseDate,
    DateTimeOffset? LastModifiedAt,
    string? TmdbId = null);

public sealed record Episode(
    string Id,
    int SeasonNumber,
    int? EpisodeNumber,
    string Title,
    string? Plot,
    int? DurationSeconds,
    string? StillUrl,
    string? ContainerExtension);

public sealed record Season(int Number, string Name, string? CoverUrl, IReadOnlyList<Episode> Episodes);

public sealed record SeriesDetails(
    SeriesSummary Summary,
    string? Cast,
    string? Director,
    IReadOnlyList<string> BackdropUrls,
    string? TrailerYoutubeId,
    IReadOnlyList<Season> Seasons);
