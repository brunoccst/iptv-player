using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Backend.Core.Library;
using Backend.Infrastructure.Library;
using Backend.Infrastructure.Pipeline;
using Backend.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests;

public class LibraryEndpointTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public LibraryEndpointTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Login_QueuesMovieAndSeriesJobs_WithCamelCasePayload()
    {
        var login = await _client.LoginAndAuthorizeAsync();

        var statuses = await WaitForJobsAsync();

        var movies = statuses.Single(s => s.MediaKind == LibraryKind.Movie);
        Assert.Equal(JobStatus.Pending, movies.JobStatus);
        Assert.Equal(2, movies.ItemCount);
        Assert.Equal(0, movies.MasterCount);

        await using var scope = _factory.Services.CreateAsyncScope();
        var job = await scope.ServiceProvider.GetRequiredService<PipelineDbContext>().NormalizationJobs
            .SingleAsync(j => j.MediaKind == LibraryKind.Movie);
        Assert.Equal(login.Account.Id.ToString(), job.AccountId);
        using var payload = JsonDocument.Parse(job.Payload);
        var first = payload.RootElement[0];
        Assert.Equal("55", first.GetProperty("id").GetString());
        Assert.Equal("The Movie (2020) 4K", first.GetProperty("name").GetString());
        Assert.Equal("mkv", first.GetProperty("containerExtension").GetString());
    }

    [Fact]
    public async Task Enqueue_ReplacesPendingJobInsteadOfDuplicating()
    {
        var accountId = Guid.NewGuid();
        await using var scope = _factory.Services.CreateAsyncScope();
        var sync = scope.ServiceProvider.GetRequiredService<LibrarySyncService>();
        var item = new LibraryPayloadItem("1", "A", null, null, null, null, null);

        var first = await sync.EnqueueAsync(accountId, LibraryKind.Movie, [item], CancellationToken.None);
        var second = await sync.EnqueueAsync(accountId, LibraryKind.Movie, [item, item with { Id = "2" }], CancellationToken.None);

        Assert.Equal(first, second);
        var job = await scope.ServiceProvider.GetRequiredService<PipelineDbContext>().NormalizationJobs.AsNoTracking().SingleAsync();
        Assert.Equal(2, job.ItemCount);
    }

    [Fact]
    public async Task Library_ListsMastersWithPagingFiltersAndIsolation()
    {
        var login = await _client.LoginAndAuthorizeAsync();
        await SeedAsync(login.Account.Id.ToString());
        await SeedAsync(Guid.NewGuid().ToString(), idPrefix: "other-");

        var page = await _client.GetFromJsonAsync<LibraryPage>("/api/library/movies?limit=1", ApiClientExtensions.Json);
        Assert.Equal(2, page!.Total);
        Assert.Equal("Alpha", Assert.Single(page.Items).Title);

        var byCategory = await _client.GetFromJsonAsync<LibraryPage>("/api/library/movies?categoryId=4k", ApiClientExtensions.Json);
        Assert.Equal(["Zulu"], byCategory!.Items.Select(i => i.Title));

        var bySearch = await _client.GetFromJsonAsync<LibraryPage>("/api/library/movies?search=ZUL", ApiClientExtensions.Json);
        Assert.Equal(["Zulu"], bySearch!.Items.Select(i => i.Title));

        Assert.Equal(0, (await _client.GetFromJsonAsync<LibraryPage>("/api/library/series", ApiClientExtensions.Json))!.Total);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/library/podcasts")).StatusCode);
    }

    [Fact]
    public async Task Library_DetailsReturnVariantsBestFirst()
    {
        var login = await _client.LoginAndAuthorizeAsync();
        await SeedAsync(login.Account.Id.ToString());

        var details = await _client.GetFromJsonAsync<MasterDetails>("/api/library/movies/zulu", ApiClientExtensions.Json);

        Assert.NotNull(details);
        Assert.Equal(["2", "3"], details.Variants.Select(v => v.StreamId));
        Assert.Equal(["ENG", "ESP"], details.Variants[0].AudioLanguages);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/library/movies/other-zulu")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/library/series/zulu")).StatusCode);
    }

    [Fact]
    public async Task Sync_Returns202()
    {
        await _client.LoginAndAuthorizeAsync();

        Assert.Equal(HttpStatusCode.Accepted, (await _client.PostAsync("/api/library/sync", null)).StatusCode);
    }

    private async Task<IReadOnlyList<LibraryStatus>> WaitForJobsAsync()
    {
        for (var attempt = 0; attempt < 50; attempt++)
        {
            var statuses = await _client.GetFromJsonAsync<List<LibraryStatus>>("/api/library/status", ApiClientExtensions.Json);
            if (statuses!.All(s => s.JobStatus is not null))
            {
                return statuses!;
            }

            await Task.Delay(100);
        }

        throw new TimeoutException("Library sync jobs were not queued.");
    }

    /// <summary>Simulates the Python worker's output.</summary>
    private async Task SeedAsync(string accountId, string idPrefix = "")
    {
        await using var scope = _factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<PipelineDbContext>();

        MediaVariant Variant(string streamId, string masterId, int score, string category, string audio) => new()
        {
            AccountId = accountId,
            MediaKind = LibraryKind.Movie,
            StreamId = idPrefix + streamId,
            MasterId = masterId,
            RawTitle = $"raw {streamId}",
            Label = $"label {streamId}",
            QualityScore = score,
            CategoryId = category,
            AudioLanguages = audio,
        };

        db.MasterMedia.AddRange(
            new MasterMedia
            {
                Id = idPrefix + "zulu",
                AccountId = accountId,
                MediaKind = LibraryKind.Movie,
                Title = "Zulu",
                NormalizedKey = "zulu",
                VariantCount = 2,
                Variants = [Variant("3", idPrefix + "zulu", 10, "hd", "[]"), Variant("2", idPrefix + "zulu", 90, "4k", "[\"ENG\",\"ESP\"]")],
            },
            new MasterMedia
            {
                Id = idPrefix + "alpha",
                AccountId = accountId,
                MediaKind = LibraryKind.Movie,
                Title = "Alpha",
                NormalizedKey = "alpha",
                VariantCount = 1,
                Variants = [Variant("1", idPrefix + "alpha", 50, "hd", "[]")],
            });
        await db.SaveChangesAsync();
    }
}
