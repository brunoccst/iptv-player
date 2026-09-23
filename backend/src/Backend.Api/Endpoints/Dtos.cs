using Backend.Core.Accounts;

namespace Backend.Api.Endpoints;

public sealed record LoginRequest(string ServerUrl, string Username, string Password, string? ProviderType);

public sealed record LoginResponse(string Token, DateTimeOffset ExpiresAt, AccountDto Account, IReadOnlyList<ProfileDto> Profiles);

/// <summary>Public account view. Never includes the provider password.</summary>
public sealed record AccountDto(
    Guid Id,
    string ProviderType,
    string ServerUrl,
    string Username,
    string? Status,
    DateTimeOffset? ExpiresAt,
    int? MaxConnections)
{
    public static AccountDto From(ProviderAccount account) => new(
        account.Id, account.ProviderType, account.ServerUrl, account.Username, account.Status, account.ExpiresAt, account.MaxConnections);
}

public sealed record ProfileDto(Guid Id, string Name, string? AvatarKey, bool IsKids)
{
    public static ProfileDto From(Profile profile) => new(profile.Id, profile.Name, profile.AvatarKey, profile.IsKids);
}

public sealed record ProfileRequest(string Name, string? AvatarKey, bool IsKids);
