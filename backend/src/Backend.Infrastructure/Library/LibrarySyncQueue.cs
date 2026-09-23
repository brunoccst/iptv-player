using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Backend.Infrastructure.Library;

/// <summary>In-process queue of accounts waiting for a library sync. Keeps provider fetches off request threads.</summary>
public sealed class LibrarySyncQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>();

    public void Request(Guid accountId) => _channel.Writer.TryWrite(accountId);

    internal ChannelReader<Guid> Reader => _channel.Reader;
}

/// <summary>Drains <see cref="LibrarySyncQueue"/> and runs <see cref="LibrarySyncService"/> for each account.</summary>
public sealed class LibrarySyncWorker(LibrarySyncQueue queue, IServiceScopeFactory scopes, ILogger<LibrarySyncWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var accountId in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var jobIds = await scope.ServiceProvider.GetRequiredService<LibrarySyncService>().SyncAccountAsync(accountId, stoppingToken);
                logger.LogInformation("Queued normalization jobs {JobIds} for account {AccountId}", jobIds, accountId);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Library sync failed for account {AccountId}", accountId);
            }
        }
    }
}
