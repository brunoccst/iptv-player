using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Text;
using Backend.Core.Epg;
using Backend.Core.Providers;
using Backend.Infrastructure.Epg;
using Backend.Infrastructure.Xtream;
using Backend.Tests.Support;

namespace Backend.Tests;

public class XmltvParserTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 23, 12, 30, 0, TimeSpan.Zero);

    private static async Task<List<EpgProgramme>> ParseAsync(string xml, DateTimeOffset from, DateTimeOffset to)
    {
        var list = new List<EpgProgramme>();
        await foreach (var programme in XmltvParser.ParseAsync(new MemoryStream(Encoding.UTF8.GetBytes(xml)), from, to))
        {
            list.Add(programme);
        }
        return list;
    }

    [Theory]
    [InlineData("20260923120000 +0000", "2026-09-23T12:00:00+00:00")]
    [InlineData("20260923140000 +0200", "2026-09-23T12:00:00+00:00")]
    [InlineData("20260923070000 -0500", "2026-09-23T12:00:00+00:00")]
    [InlineData("20260923120000", "2026-09-23T12:00:00+00:00")]
    [InlineData("202609231200", "2026-09-23T12:00:00+00:00")]
    public void ParseTime_HandlesOffsets(string value, string expected)
    {
        Assert.Equal(DateTimeOffset.Parse(expected), XmltvParser.ParseTime(value)!.Value.ToUniversalTime());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("yesterday")]
    public void ParseTime_RejectsInvalid(string? value) => Assert.Null(XmltvParser.ParseTime(value));

    [Fact]
    public async Task Parse_NormalizesChannel_TakesFirstTitle_AndKeepsWindow()
    {
        var programmes = await ParseAsync(XtreamFixtures.Xmltv(Now), Now, Now.AddHours(2));

        // Hourly shows from 11:00; the window 12:30-14:30 overlaps 12:00, 13:00 and 14:00.
        Assert.Equal([12, 13, 14], programmes.Select(p => p.Start.Hour));
        Assert.All(programmes, p => Assert.Equal("news.us", p.ChannelKey));
        Assert.Equal("News at 0", programmes[0].Title);
        Assert.Equal("Headlines & weather.", programmes[0].Description);
    }

    [Fact]
    public async Task Parse_SkipsBrokenEntries_AndHandlesEmptyElements()
    {
        const string xml = """
            <tv>
              <programme start="20260923120000 +0000" channel="a"><title>No stop</title></programme>
              <programme start="20260923120000 +0000" stop="20260923110000 +0000" channel="a"><title>Backwards</title></programme>
              <programme start="20260923120000 +0000" stop="20260923130000 +0000" channel="a"/>
              <programme start="20260923120000 +0000" stop="20260923130000 +0000"><title>No channel</title></programme>
              <programme start="20260923120000 +0000" stop="20260923130000 +0000" channel="a"><desc>d</desc><title><![CDATA[Kept <1>]]></title></programme>
            </tv>
            """;

        var programme = Assert.Single(await ParseAsync(xml, Now.AddDays(-1), Now.AddDays(1)));
        Assert.Equal("Kept <1>", programme.Title);
        Assert.Equal("d", programme.Description);
    }

    [Fact]
    public async Task GzipSniffer_DecompressesGzip_AndPassesPlainThrough()
    {
        var bytes = Encoding.UTF8.GetBytes("<tv/>");
        using var zipped = new MemoryStream();
        await using (var gzip = new GZipStream(zipped, CompressionLevel.Fastest, leaveOpen: true))
        {
            await gzip.WriteAsync(bytes);
        }

        foreach (var input in new[] { zipped.ToArray(), bytes, [] })
        {
            await using var stream = await GzipSniffer.OpenAsync(new MemoryStream(input), CancellationToken.None);
            using var reader = new StreamReader(stream);
            Assert.Equal(input.Length == 0 ? "" : "<tv/>", await reader.ReadToEndAsync());
        }
    }
}

public class XtreamEpgTests
{
    private static readonly ProviderCredentials Credentials =
        new(new Uri(FakeXtreamServer.BaseUrl), FakeXtreamServer.Username, FakeXtreamServer.Password);

    [Fact]
    public async Task ShortEpg_DecodesBase64_AndKeysByStream()
    {
        var provider = new XtreamCodesProvider(new HttpClient(new StubHttpHandler(FakeXtreamServer.Handle)));

        var programmes = await provider.GetShortEpgAsync(Credentials, "43", 10, CancellationToken.None);

        Assert.Equal(["Live Match", "Post-game"], programmes.Select(p => p.Title));
        Assert.Equal("Final.", programmes[0].Description);
        Assert.Null(programmes[1].Description);
        Assert.All(programmes, p => Assert.Equal("stream:43", p.ChannelKey));
    }

    [Fact]
    public async Task ShortEpg_KeepsPlainTextTitles()
    {
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var json = $$"""{"epg_listings":[{"title":"News","start_timestamp":"{{now}}","stop_timestamp":"{{now + 60}}"}]}""";
        var provider = new XtreamCodesProvider(new HttpClient(new StubHttpHandler(_ => StubHttpHandler.Json(json))));

        var programme = Assert.Single(await provider.GetShortEpgAsync(Credentials, "1", 10, CancellationToken.None));

        Assert.Equal("News", programme.Title);
    }

    [Fact]
    public async Task OpenXmltv_MapsHttpErrorsToProviderExceptions()
    {
        var provider = new XtreamCodesProvider(new HttpClient(new StubHttpHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound))));

        await Assert.ThrowsAsync<ProviderUnavailableException>(() => provider.OpenXmltvAsync(Credentials, CancellationToken.None));
    }
}

public class EpgEndpointTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public EpgEndpointTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    /// <summary>The first request queues the download; the worker finishes it in the background.</summary>
    private async Task<EpgGrid> WaitForReadyAsync(string query = "")
    {
        for (var attempt = 0; attempt < 100; attempt++)
        {
            var grid = (await _client.GetFromJsonAsync<EpgGrid>("/api/epg" + query, ApiClientExtensions.Json))!;
            if (grid.Status != EpgStatus.Refreshing)
            {
                return grid;
            }
            await Task.Delay(50);
        }
        throw new TimeoutException("Guide never finished refreshing.");
    }

    [Fact]
    public async Task Grid_UsesXmltvCache_AndShortEpgForChannelsWithoutGuideId()
    {
        await _client.LoginAndAuthorizeAsync();

        var grid = await WaitForReadyAsync("?hours=2");

        Assert.Equal(EpgStatus.Ready, grid.Status);
        Assert.NotNull(grid.UpdatedAt);
        Assert.Equal(TimeSpan.FromHours(2), grid.To - grid.From);
        Assert.Equal(0, grid.From.Minute % 30);
        Assert.Equal(2, grid.TotalChannels);

        var news = grid.Channels.Single(c => c.Channel.Id == "42");
        Assert.InRange(news.Programmes.Count, 2, 3);
        Assert.All(news.Programmes, p => Assert.True(p.End > grid.From && p.Start < grid.To));
        Assert.Equal("Headlines & weather.", news.Programmes[0].Description);

        var sports = grid.Channels.Single(c => c.Channel.Id == "43");
        Assert.Equal("Live Match", sports.Programmes[0].Title);

        // Second request: served from cache, no new downloads.
        await _client.GetFromJsonAsync<EpgGrid>("/api/epg?hours=2", ApiClientExtensions.Json);
        Assert.Single(_factory.Upstream.Requests, r => r.RequestUri!.AbsolutePath == "/xmltv.php");
        Assert.Single(_factory.Upstream.Requests, r => r.RequestUri!.Query.Contains("action=get_short_epg"));
    }

    [Fact]
    public async Task Grid_PagesChannels_AndClampsHours()
    {
        await _client.LoginAndAuthorizeAsync();

        var grid = await WaitForReadyAsync("?offset=1&limit=1&hours=99");

        Assert.Equal("43", Assert.Single(grid.Channels).Channel.Id);
        Assert.Equal(2, grid.TotalChannels);
        Assert.Equal(TimeSpan.FromHours(EpgService.MaxHours), grid.To - grid.From);
    }

    [Fact]
    public async Task Grid_WithoutXmltv_IsUnavailable_ButStillUsesShortEpg()
    {
        _factory.Upstream.Override = request => request.RequestUri!.AbsolutePath == "/xmltv.php" ? new HttpResponseMessage(HttpStatusCode.NotFound) : null;
        await _client.LoginAndAuthorizeAsync();

        var grid = await WaitForReadyAsync();

        Assert.Equal(EpgStatus.Unavailable, grid.Status);
        Assert.Null(grid.UpdatedAt);
        Assert.Empty(grid.Channels.Single(c => c.Channel.Id == "42").Programmes);
        Assert.NotEmpty(grid.Channels.Single(c => c.Channel.Id == "43").Programmes);
    }

    [Fact]
    public async Task Grid_RequiresLogin()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/epg")).StatusCode);
    }
}
