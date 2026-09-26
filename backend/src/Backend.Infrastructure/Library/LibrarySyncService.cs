using System.Text.Json;
using Backend.Core.Library;
using Backend.Infrastructure.Accounts;
using Backend.Infrastructure.Pipeline;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Library;

/// <summary>Fetches the raw VOD/series list from the provider and queues it for the Python normalizer.</summary>
public sealed class LibrarySyncService(AccountService accounts, PipelineDbContext db, TimeProvider clock)
{
    private static readonly JsonSerializerOptions PayloadJson = new(JsonSerializerDefaults.Web);

    /// <summary>Queues one job per library kind. Returns the job ids.</summary>
    public async Task<IReadOnlyList<long>> SyncAccountAsync(Guid accountId, CancellationToken ct)
    {
        var context = await accounts.GetProviderContextAsync(accountId, ct);
        var jobIds = new List<long>();

        var movies = await context.Provider.GetMoviesAsync(context.Credentials, categoryId: null, ct);
        jobIds.Add(await EnqueueAsync(accountId, LibraryKind.Movie,
            movies.Select(m => new LibraryPayloadItem(m.Id, m.Name, m.CategoryId, m.PosterUrl, m.Rating, m.ContainerExtension, null, m.AddedAt?.ToUnixTimeSeconds(), m.TmdbId)).ToList(), ct));

        var series = await context.Provider.GetSeriesAsync(context.Credentials, categoryId: null, ct);
        jobIds.Add(await EnqueueAsync(accountId, LibraryKind.Series,
            series.Select(s => new LibraryPayloadItem(s.Id, s.Name, s.CategoryId, s.PosterUrl, s.Rating, null, s.ReleaseDate, s.LastModifiedAt?.ToUnixTimeSeconds(), s.TmdbId)).ToList(), ct));

        return jobIds;
    }

    /// <summary>Replaces the payload of an existing pending job for the same account + kind, else inserts a new job.</summary>
    public async Task<long> EnqueueAsync(Guid accountId, string mediaKind, IReadOnlyList<LibraryPayloadItem> items, CancellationToken ct)
    {
        var account = accountId.ToString();
        var payload = JsonSerializer.Serialize(items, PayloadJson);
        var now = clock.GetUtcNow().ToUnixTimeSeconds();

        var job = await db.NormalizationJobs.SingleOrDefaultAsync(
            j => j.AccountId == account && j.MediaKind == mediaKind && j.Status == JobStatus.Pending, ct);

        if (job is null)
        {
            job = new NormalizationJob { AccountId = account, MediaKind = mediaKind, Status = JobStatus.Pending, Payload = payload };
            db.NormalizationJobs.Add(job);
        }

        job.Payload = payload;
        job.ItemCount = items.Count;
        job.CreatedAt = now;

        await db.SaveChangesAsync(ct);
        return job.Id;
    }
}
