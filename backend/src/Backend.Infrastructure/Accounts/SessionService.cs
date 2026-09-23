using System.Security.Cryptography;
using System.Text;
using Backend.Core.Accounts;
using Backend.Core.Configuration;
using Backend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure.Accounts;

/// <summary>Issues and validates opaque bearer tokens. See DECISIONS.md#d-012.</summary>
public sealed class SessionService(AppDbContext db, IOptions<BackendOptions> options, TimeProvider clock)
{
    public async Task<IssuedSession> CreateAsync(Guid accountId, CancellationToken cancellationToken)
    {
        var token = Base64Url(RandomNumberGenerator.GetBytes(32));
        var now = clock.GetUtcNow();
        var session = new UserSession
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            TokenHash = Hash(token),
            CreatedAt = now,
            ExpiresAt = now.AddDays(options.Value.SessionDays),
        };

        db.UserSessions.Add(session);
        await db.SaveChangesAsync(cancellationToken);
        return new IssuedSession(token, session.ExpiresAt);
    }

    public async Task<UserSession?> ValidateAsync(string token, CancellationToken cancellationToken)
    {
        var hash = Hash(token);
        var now = clock.GetUtcNow();
        return await db.UserSessions.AsNoTracking()
            .SingleOrDefaultAsync(s => s.TokenHash == hash && s.ExpiresAt > now, cancellationToken);
    }

    public async Task RevokeAsync(Guid sessionId, CancellationToken cancellationToken) =>
        await db.UserSessions.Where(s => s.Id == sessionId).ExecuteDeleteAsync(cancellationToken);

    private static string Hash(string token) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64Url(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed record IssuedSession(string Token, DateTimeOffset ExpiresAt);
