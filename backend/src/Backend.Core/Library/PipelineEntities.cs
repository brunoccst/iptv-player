namespace Backend.Core.Library;

/// <summary>
/// Rows in <c>pipeline.db</c>, shared with the Python title normalizer. Timestamps are Unix seconds. See DECISIONS.md#d-016.
/// </summary>
public sealed class NormalizationJob
{
    public long Id { get; set; }
    public required string AccountId { get; set; }
    public required string MediaKind { get; set; }
    public required string Status { get; set; }

    /// <summary>JSON array of <see cref="LibraryPayloadItem"/>.</summary>
    public required string Payload { get; set; }

    public int ItemCount { get; set; }
    public int Attempts { get; set; }
    public string? Error { get; set; }
    public string? LockedBy { get; set; }
    public long CreatedAt { get; set; }
    public long? StartedAt { get; set; }
    public long? FinishedAt { get; set; }
}

/// <summary>One deduplicated title. Written only by the Python worker.</summary>
public sealed class MasterMedia
{
    public required string Id { get; set; }
    public required string AccountId { get; set; }
    public required string MediaKind { get; set; }
    public required string Title { get; set; }
    public required string NormalizedKey { get; set; }
    public int? Year { get; set; }
    public string? PosterUrl { get; set; }
    public double? Rating { get; set; }
    public string? BestQuality { get; set; }
    public int VariantCount { get; set; }

    /// <summary>Newest provider "added" time among the variants (Unix seconds).</summary>
    public long? AddedAt { get; set; }

    /// <summary>Release date as YYYYMMDD for sorting; a year-only date is YYYY0000.</summary>
    public int? ReleaseKey { get; set; }

    public long UpdatedAt { get; set; }
    public List<MediaVariant> Variants { get; set; } = [];
}

/// <summary>One provider stream grouped under a <see cref="MasterMedia"/>. Written only by the Python worker.</summary>
public sealed class MediaVariant
{
    public required string AccountId { get; set; }
    public required string MediaKind { get; set; }
    public required string StreamId { get; set; }
    public required string MasterId { get; set; }
    public required string RawTitle { get; set; }
    public required string Label { get; set; }
    public string? Quality { get; set; }
    public string? Source { get; set; }

    /// <summary>JSON array of language codes, e.g. <c>["ENG","ESP"]</c>.</summary>
    public string AudioLanguages { get; set; } = "[]";

    /// <summary>JSON array of subtitle language codes from the name ("SUB ITA", "VOSTFR"); <c>MULTI</c> = several (D-063).</summary>
    public string SubtitleLanguages { get; set; } = "[]";

    public string? AudioTag { get; set; }
    public bool IsHdr { get; set; }
    public int QualityScore { get; set; }
    public string? CategoryId { get; set; }
    public string? PosterUrl { get; set; }
    public double? Rating { get; set; }
    public string? ContainerExtension { get; set; }
    public MasterMedia? Master { get; set; }
}

public static class JobStatus
{
    public const string Pending = "pending";
    public const string Processing = "processing";
    public const string Done = "done";
    public const string Failed = "failed";
}

public static class LibraryKind
{
    public const string Movie = "movie";
    public const string Series = "series";

    public static readonly string[] All = [Movie, Series];
}

/// <summary>Library list order. Missing values sort last; ties go by title, then year.</summary>
public enum LibrarySort
{
    Added,
    Title,
    Released,
}

public enum SortOrder
{
    Asc,
    Desc,
}

/// <summary>Job payload item. Serialized camelCase. Python reads the same field names.</summary>
public sealed record LibraryPayloadItem(
    string Id,
    string Name,
    string? CategoryId,
    string? PosterUrl,
    double? Rating,
    string? ContainerExtension,
    string? ReleaseDate,
    long? AddedAt,
    string? TmdbId = null);
