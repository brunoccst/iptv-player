using System.Collections.Concurrent;
using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Backend.Infrastructure.Epg;

/// <summary>Accounts waiting for a guide download. An account is queued at most once at a time.</summary>
public sealed class EpgRefreshQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>();
    private readonly ConcurrentDictionary<Guid, byte> _pending = new();

    /// <summary>Returns false when the account is already queued or downloading.</summary>
    public bool Request(Guid accountId) => _pending.TryAdd(accountId, 0) && _channel.Writer.TryWrite(accountId);

    public bool IsPending(Guid accountId) => _pending.ContainsKey(accountId);

    internal void Complete(Guid accountId) => _pending.TryRemove(accountId, out _);

    internal ChannelReader<Guid> Reader => _channel.Reader;
}

/// <summary>Drains <see cref="EpgRefreshQueue"/> one account at a time (feeds are large).</summary>
public sealed class EpgRefreshWorker(EpgRefreshQueue queue, IServiceScopeFactory scopes, ILogger<EpgRefreshWorker> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var accountId in queue.Reader.ReadAllAsync(stoppingToken))
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var count = await scope.ServiceProvider.GetRequiredService<EpgRefreshService>().RefreshAsync(accountId, stoppingToken);
                logger.LogInformation("Guide refreshed for account {AccountId}: {Count} programmes", accountId, count);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogWarning(exception, "Guide refresh failed for account {AccountId}", accountId);
            }
            finally
            {
                queue.Complete(accountId);
            }
        }
    }
}
