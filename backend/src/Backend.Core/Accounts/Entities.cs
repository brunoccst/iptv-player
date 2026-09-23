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
