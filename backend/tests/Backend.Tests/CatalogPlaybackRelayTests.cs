using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Backend.Core.Media;
using Backend.Infrastructure.Streaming;
using Backend.Tests.Support;

namespace Backend.Tests;

public class CatalogPlaybackRelayTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public CatalogPlaybackRelayTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Catalog_ReturnsProviderDataAndCachesIt()
    {
        await _client.LoginAndAuthorizeAsync();

        var first = await _client.GetFromJsonAsync<List<MovieSummary>>("/api/catalog/movies", ApiClientExtensions.Json);
        var second = await _client.GetFromJsonAsync<List<MovieSummary>>("/api/catalog/movies", ApiClientExtensions.Json);

        Assert.Equal(2, first!.Count);
        Assert.Equal(first, second);
        Assert.Single(_factory.Upstream.Requests, r => r.RequestUri!.Query.Contains("action=get_vod_streams"));
    }

    [Fact]
    public async Task Catalog_SerializesEnumsAsCamelCaseStrings()
    {
        await _client.LoginAndAuthorizeAsync();

        var json = await _client.GetStringAsync("/api/catalog/movies/categories");

        Assert.Contains("\"kind\":\"movie\"", json);
    }

    [Fact]
    public async Task Catalog_UnknownSeries_Returns404_KnownSeriesReturnsSeasons()
    {
        await _client.LoginAndAuthorizeAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/catalog/series/999")).StatusCode);
        var series = await _client.GetFromJsonAsync<SeriesDetails>("/api/catalog/series/7", ApiClientExtensions.Json);
        Assert.Equal(2, Assert.Single(series!.Seasons).Episodes.Count);
    }

    [Fact]
    public async Task Playback_ReturnsRelayUrlWithoutCredentials()
    {
        await _client.LoginAndAuthorizeAsync();

        var info = await _client.GetFromJsonAsync<PlaybackInfo>("/api/playback/live/42", ApiClientExtensions.Json);

        Assert.NotNull(info);
        Assert.Equal("relay", info.DeliveryMode);
        Assert.True(info.IsLive);
        Assert.StartsWith("http://localhost/api/relay/", info.Url);
        Assert.EndsWith("/42.m3u8", info.Url);
        Assert.DoesNotContain(FakeXtreamServer.Username + "/", info.Url);
    }

    [Fact]
    public async Task Playback_UnknownKind_Returns404()
    {
        await _client.LoginAndAuthorizeAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/playback/podcast/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/playback/1/1")).StatusCode);
    }

    [Fact]
    public async Task Relay_RewritesPlaylist_AndProxiesSegmentRanges()
    {
        await _client.LoginAndAuthorizeAsync();
        var info = await _client.GetFromJsonAsync<PlaybackInfo>("/api/playback/live/42", ApiClientExtensions.Json);
        var anonymous = _factory.CreateClient();

        var playlistResponse = await anonymous.GetAsync(new Uri(info!.Url).PathAndQuery);
        var playlist = await playlistResponse.Content.ReadAsStringAsync();
        Assert.Equal("application/vnd.apple.mpegurl", playlistResponse.Content.Headers.ContentType?.MediaType);
        var segmentPath = playlist.Split('\n').Single(line => line.StartsWith("/api/relay/", StringComparison.Ordinal));
        Assert.EndsWith("/1.ts", segmentPath);
        Assert.DoesNotContain(FakeXtreamServer.Username, playlist);

        var request = new HttpRequestMessage(HttpMethod.Get, segmentPath) { Headers = { Range = new RangeHeaderValue(10, 19) } };
        var segment = await anonymous.SendAsync(request);

        Assert.Equal(HttpStatusCode.PartialContent, segment.StatusCode);
        Assert.Equal(FakeXtreamServer.SegmentBytes[10..20], await segment.Content.ReadAsByteArrayAsync());
        Assert.Equal("bytes 10-19/100", segment.Content.Headers.ContentRange?.ToString());
    }

    [Fact]
    public async Task Relay_RejectsTamperedToken()
    {
        var response = await _client.GetAsync("/api/relay/not-a-valid-token/stream.m3u8");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }
}
