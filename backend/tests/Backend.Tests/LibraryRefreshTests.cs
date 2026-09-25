using Backend.Core.Accounts;
using Backend.Core.Configuration;
using Backend.Core.Library;
using Backend.Infrastructure.Library;
using Backend.Infrastructure.Persistence;
using Backend.Infrastructure.Pipeline;
using Backend.Tests.Support;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace Backend.Tests;

public class LibraryRefreshTests : IDisposable
{
    private readonly ApiFactory _factory = new();

    public LibraryRefreshTests() => _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task FindsSignedInAccountsWhoseLastSyncIsOlderThanTheInterval()
    {
        var now = DateTimeOffset.UtcNow;
        var stale = await SeedAccountAsync(now.AddDays(1), JobStatus.Done, now.AddHours(-13));
        var fresh = await SeedAccountAsync(now.AddDays(1), JobStatus.Done, now.AddHours(-2));
        var running = await SeedAccountAsync(now.AddDays(1), JobStatus.Pending, now.AddHours(-20));
        var neverSynced = await SeedAccountAsync(now.AddDays(1), status: null, jobCreatedAt: null);
        await SeedAccountAsync(now.AddDays(-1), JobStatus.Done, now.AddHours(-30)); // session expired

        var due = await FindDueAsync(hours: 12);

        Assert.Equal(new[] { stale, neverSynced }.Order(), due.Order());
        Assert.DoesNotContain(fresh, due);
        Assert.DoesNotContain(running, due);
        Assert.Empty(await FindDueAsync(hours: 0));
    }

    private async Task<IReadOnlyList<Guid>> FindDueAsync(int hours)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var services = scope.ServiceProvider;
        var service = new LibraryRefreshService(
            services.GetRequiredService<AppDbContext>(),
            services.GetRequiredService<PipelineDbContext>(),
            Options.Create(new BackendOptions { LibraryRefreshHours = hours }),
            TimeProvider.System);
        return await service.FindDueAccountsAsync(CancellationToken.None);
    }

    private async Task<Guid> SeedAccountAsync(DateTimeOffset sessionExpiresAt, string? status, DateTimeOffset? jobCreatedAt)
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var app = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var id = Guid.NewGuid();
        app.ProviderAccounts.Add(new ProviderAccount
        {
            Id = id,
            ProviderType = "xtream",
            ServerUrl = "http://panel.test/",
            Username = id.ToString("N"),
            EncryptedPassword = "x",
        });
        app.UserSessions.Add(new UserSession { Id = Guid.NewGuid(), AccountId = id, TokenHash = id.ToString("N"), ExpiresAt = sessionExpiresAt });
        await app.SaveChangesAsync();

        if (status is not null && jobCreatedAt is { } created)
        {
            var pipeline = scope.ServiceProvider.GetRequiredService<PipelineDbContext>();
            pipeline.NormalizationJobs.Add(new NormalizationJob
            {
                AccountId = id.ToString(),
                MediaKind = LibraryKind.Movie,
                Status = status,
                Payload = "[]",
                CreatedAt = created.ToUnixTimeSeconds(),
            });
            await pipeline.SaveChangesAsync();
        }

        return id;
    }
}
