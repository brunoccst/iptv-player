using Backend.Core.Configuration;
using Backend.Core.Library;
using Backend.Infrastructure.Persistence;
using Backend.Infrastructure.Pipeline;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure.Library;

/// <summary>Finds signed-in accounts whose library is older than <c>BACKEND_LIBRARY_REFRESH_HOURS</c>. See DECISIONS.md#d-051.</summary>
public sealed class LibraryRefreshService(AppDbContext app, PipelineDbContext pipeline, IOptions<BackendOptions> options, TimeProvider clock)
{
    /// <summary>Accounts with an unexpired session, no queued or running job, and no job newer than the refresh interval.</summary>
    public async Task<IReadOnlyList<Guid>> FindDueAccountsAsync(CancellationToken ct)
    {
        var hours = options.Value.LibraryRefreshHours;
        if (hours <= 0)
        {
            return [];
        }

        var now = clock.GetUtcNow();
        var accounts = await app.UserSessions.AsNoTracking()
            .Where(s => s.ExpiresAt > now)
            .Select(s => s.AccountId)
            .Distinct()
            .ToListAsync(ct);
        if (accounts.Count == 0)
        {
            return [];
        }

        var cutoff = now.AddHours(-hours).ToUnixTimeSeconds();
        var ids = accounts.Select(a => a.ToString()).ToList();
        var recent = await pipeline.NormalizationJobs.AsNoTracking()
            .Where(j => ids.Contains(j.AccountId)
                && (j.Status == JobStatus.Pending || j.Status == JobStatus.Processing || j.CreatedAt > cutoff))
            .Select(j => j.AccountId)
            .Distinct()
            .ToListAsync(ct);

        return accounts.Where(a => !recent.Contains(a.ToString())).ToList();
    }
}

/// <summary>Every 30 minutes, queues a library sync for accounts that <see cref="LibraryRefreshService"/> reports as due.</summary>
public sealed class LibraryRefreshScheduler(
    LibrarySyncQueue queue, IServiceScopeFactory scopes, IOptions<BackendOptions> options, TimeProvider clock,
    ILogger<LibraryRefreshScheduler> logger) : BackgroundService
{
    public static readonly TimeSpan CheckInterval = TimeSpan.FromMinutes(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (options.Value.LibraryRefreshHours <= 0)
        {
            return;
        }

        using var timer = new PeriodicTimer(CheckInterval, clock);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var due = await scope.ServiceProvider.GetRequiredService<LibraryRefreshService>().FindDueAccountsAsync(stoppingToken);
                foreach (var accountId in due)
                {
                    queue.Request(accountId);
                }

                if (due.Count > 0)
                {
                    logger.LogInformation("Periodic library sync queued for {Count} account(s)", due.Count);
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Periodic library sync check failed");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
