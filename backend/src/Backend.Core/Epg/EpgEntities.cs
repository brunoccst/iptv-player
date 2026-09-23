namespace Backend.Core.Epg;

/// <summary>Cached guide row. <see cref="AccountId"/> is the account GUID as text (bulk-inserted with raw SQL).</summary>
public sealed class EpgProgrammeRow
{
    public long Id { get; set; }
    public required string AccountId { get; set; }
    public required string ChannelKey { get; set; }
    public DateTimeOffset Start { get; set; }
    public DateTimeOffset End { get; set; }
    public required string Title { get; set; }
    public string? Description { get; set; }
}

/// <summary>Last guide download per account.</summary>
public sealed class EpgState
{
    public required string AccountId { get; set; }
    /// <summary>Last successful download; null until the first one.</summary>
    public DateTimeOffset? UpdatedAt { get; set; }
    public DateTimeOffset? LastAttemptAt { get; set; }
    public string? LastError { get; set; }
    public int ProgrammeCount { get; set; }
}
