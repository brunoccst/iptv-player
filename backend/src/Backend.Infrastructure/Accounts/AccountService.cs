using Backend.Core.Accounts;
using Backend.Core.Providers;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Accounts;

/// <summary>Upstream-authenticated login, plus decrypted credential lookup for server-side calls.</summary>
public sealed class AccountService(
    AppDbContext db,
    IMediaProviderResolver providers,
    ICredentialProtector protector,
    TimeProvider clock)
{
    /// <summary>Validates against the provider, then creates or updates the local account.</summary>
    /// <exception cref="ArgumentException">Server URL is malformed.</exception>
    /// <exception cref="ProviderException">Provider rejected the login or is unreachable.</exception>
    public async Task<ProviderAccount> LoginAsync(
        string providerType, string serverUrl, string username, string password, CancellationToken cancellationToken)
    {
        var provider = providers.Get(providerType);
        var normalizedUrl = provider.NormalizeServerUrl(serverUrl);
        var credentials = new ProviderCredentials(normalizedUrl, username.Trim(), password);
        var info = await provider.ValidateAsync(credentials, cancellationToken);

        var now = clock.GetUtcNow();
        var serverKey = normalizedUrl.ToString();
        var account = await db.ProviderAccounts
            .Include(a => a.Profiles)
            .SingleOrDefaultAsync(a => a.ProviderType == provider.ProviderType && a.ServerUrl == serverKey && a.Username == credentials.Username, cancellationToken);

        if (account is null)
        {
            account = new ProviderAccount
            {
                Id = Guid.NewGuid(),
                ProviderType = provider.ProviderType,
                ServerUrl = serverKey,
                Username = credentials.Username,
                EncryptedPassword = string.Empty,
                CreatedAt = now,
            };
            account.Profiles.Add(new Profile { Id = Guid.NewGuid(), Name = credentials.Username, CreatedAt = now });
            db.ProviderAccounts.Add(account);
        }

        account.EncryptedPassword = protector.Protect(password);
        account.Status = info.Status;
        account.ExpiresAt = info.ExpiresAt;
        account.MaxConnections = info.MaxConnections;
        account.AllowedOutputFormats = string.Join(',', info.AllowedOutputFormats);
        account.LastLoginAt = now;

        await db.SaveChangesAsync(cancellationToken);
        return account;
    }

    public Task<ProviderAccount?> FindAsync(Guid accountId, CancellationToken cancellationToken) =>
        db.ProviderAccounts.AsNoTracking().SingleOrDefaultAsync(a => a.Id == accountId, cancellationToken);

    /// <summary>Returns provider + decrypted credentials for an account. Throws if the account no longer exists.</summary>
    public async Task<ProviderContext> GetProviderContextAsync(Guid accountId, CancellationToken cancellationToken)
    {
        var account = await FindAsync(accountId, cancellationToken)
            ?? throw new InvalidOperationException($"Account {accountId} not found.");

        var credentials = new ProviderCredentials(new Uri(account.ServerUrl), account.Username, protector.Unprotect(account.EncryptedPassword));
        var accountInfo = new ProviderAccountInfo(
            account.Status ?? "Unknown",
            account.ExpiresAt,
            account.MaxConnections,
            ActiveConnections: null,
            account.AllowedOutputFormats.Split(',', StringSplitOptions.RemoveEmptyEntries));

        return new ProviderContext(account.Id, providers.Get(account.ProviderType), credentials, accountInfo);
    }
}

public sealed record ProviderContext(Guid AccountId, IMediaProvider Provider, ProviderCredentials Credentials, ProviderAccountInfo AccountInfo);
