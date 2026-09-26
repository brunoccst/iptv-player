using System.Net;
using Backend.Core.Media;
using Backend.Core.Providers;
using Backend.Infrastructure.Xtream;
using Backend.Tests.Support;

namespace Backend.Tests;

public class XtreamCodesProviderTests
{
    private static readonly ProviderCredentials Credentials =
        new(new Uri(FakeXtreamServer.BaseUrl), FakeXtreamServer.Username, FakeXtreamServer.Password);

    private static XtreamCodesProvider CreateProvider(Func<HttpRequestMessage, HttpResponseMessage> respond) =>
        new(new HttpClient(new StubHttpHandler(respond)));

    private static XtreamCodesProvider CreateProvider(string json) => CreateProvider(_ => StubHttpHandler.Json(json));

    [Theory]
    [InlineData("http://host.test:8080", "http://host.test:8080/")]
    [InlineData("host.test:8080/", "http://host.test:8080/")]
    [InlineData("https://host.test/player_api.php", "https://host.test/")]
    [InlineData("http://host.test:80/panel/get.php?username=x", "http://host.test/panel/")]
    public void NormalizeServerUrl_ProducesCanonicalBase(string input, string expected)
    {
        Assert.Equal(expected, CreateProvider("{}").NormalizeServerUrl(input).ToString());
    }

    [Theory]
    [InlineData("")]
    [InlineData("ftp://host.test")]
    [InlineData("http://")]
    public void NormalizeServerUrl_RejectsInvalid(string input)
    {
        Assert.Throws<ArgumentException>(() => CreateProvider("{}").NormalizeServerUrl(input));
    }

    [Fact]
    public async Task ValidateAsync_ParsesAccountInfo()
    {
        var info = await CreateProvider(XtreamFixtures.LoginActive).ValidateAsync(Credentials, CancellationToken.None);

        Assert.Equal("Active", info.Status);
        Assert.Equal(DateTimeOffset.FromUnixTimeSeconds(1893456000), info.ExpiresAt);
        Assert.Equal(2, info.MaxConnections);
        Assert.Equal(["m3u8", "ts"], info.AllowedOutputFormats);
    }

    [Theory]
    [InlineData("""{"user_info":{"auth":0}}""")]
    [InlineData(XtreamFixtures.LoginExpired)]
    [InlineData("[]")]
    public async Task ValidateAsync_RejectsBadOrInactiveAccounts(string json)
    {
        await Assert.ThrowsAsync<ProviderAuthenticationException>(() =>
            CreateProvider(json).ValidateAsync(Credentials, CancellationToken.None));
    }

    [Fact]
    public async Task Requests_SendEscapedCredentialsAndAction()
    {
        var handler = new StubHttpHandler(_ => StubHttpHandler.Json("[]"));
        var provider = new XtreamCodesProvider(new HttpClient(handler));

        await provider.GetMoviesAsync(Credentials, "10", CancellationToken.None);

        var request = Assert.Single(handler.Requests);
        Assert.Equal("/player_api.php", request.RequestUri!.AbsolutePath);
        Assert.Equal(FakeXtreamServer.Password, StubHttpHandler.Query(request, "password"));
        Assert.Equal("get_vod_streams", StubHttpHandler.Query(request, "action"));
        Assert.Equal("10", StubHttpHandler.Query(request, "category_id"));
    }

    [Fact]
    public async Task ServerErrors_BecomeProviderUnavailable()
    {
        await Assert.ThrowsAsync<ProviderUnavailableException>(() =>
            CreateProvider(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError)).GetMoviesAsync(Credentials, null, CancellationToken.None));
        await Assert.ThrowsAsync<ProviderUnavailableException>(() =>
            CreateProvider("<html>not json").GetMoviesAsync(Credentials, null, CancellationToken.None));
        await Assert.ThrowsAsync<ProviderUnavailableException>(() =>
            CreateProvider(_ => throw new HttpRequestException("down")).GetMoviesAsync(Credentials, null, CancellationToken.None));
    }

    [Fact]
    public async Task HttpUnauthorized_BecomesAuthenticationError()
    {
        await Assert.ThrowsAsync<ProviderAuthenticationException>(() =>
            CreateProvider(_ => new HttpResponseMessage(HttpStatusCode.Forbidden)).GetMoviesAsync(Credentials, null, CancellationToken.None));
    }

    [Fact]
    public async Task GetCategoriesAsync_SkipsEntriesWithoutId()
    {
        var categories = await CreateProvider(XtreamFixtures.VodCategories).GetCategoriesAsync(Credentials, MediaKind.Movie, CancellationToken.None);

        Assert.Equal([new MediaCategory("10", "Action", MediaKind.Movie)], categories);
    }

    [Fact]
    public async Task GetMoviesAsync_HandlesMixedTypes()
    {
        var movies = await CreateProvider(XtreamFixtures.VodStreams).GetMoviesAsync(Credentials, null, CancellationToken.None);

        Assert.Equal(2, movies.Count);
        Assert.Equal(new MovieSummary("55", "The Movie (2020) 4K", "10", "http://img/55.jpg", 7.1,
            DateTimeOffset.FromUnixTimeSeconds(1600000000), "mkv", "603"), movies[0]);
        Assert.Equal("56", movies[1].Id);
        Assert.Equal("10", movies[1].CategoryId);
        Assert.Null(movies[1].Rating);
        Assert.Null(movies[1].AddedAt);
        Assert.Null(movies[1].TmdbId);
    }

    [Fact]
    public async Task GetMovieAsync_MapsInfoAndMovieData()
    {
        var movie = await CreateProvider(XtreamFixtures.VodInfo).GetMovieAsync(Credentials, "55", CancellationToken.None);

        Assert.NotNull(movie);
        Assert.Equal("http://img/55-big.jpg", movie.Summary.PosterUrl);
        Assert.Equal(7.5, movie.Summary.Rating);
        Assert.Equal(5400, movie.DurationSeconds);
        Assert.Equal(["http://img/bd1.jpg"], movie.BackdropUrls);
        Assert.Equal("abc", movie.TrailerYoutubeId);
    }

    [Fact]
    public async Task GetMovieAsync_ToleratesEmptyInfoArray()
    {
        var movie = await CreateProvider(XtreamFixtures.VodInfoEmptyInfo).GetMovieAsync(Credentials, "77", CancellationToken.None);

        Assert.NotNull(movie);
        Assert.Equal("77", movie.Summary.Id);
        Assert.Null(movie.Plot);
        Assert.Empty(movie.BackdropUrls);
    }

    [Fact]
    public async Task GetLiveChannelsAsync_ParsesChannels()
    {
        var channels = await CreateProvider(XtreamFixtures.LiveStreams).GetLiveChannelsAsync(Credentials, null, CancellationToken.None);

        Assert.Equal(new LiveChannel("42", "News HD", "5", 1, "http://img/42.png", "news.us", true), channels[0]);
        Assert.Equal(new LiveChannel("43", "Sports", "5", 2, null, null, false), channels[1]);
    }

    [Fact]
    public async Task GetSeriesDetailsAsync_GroupsAndSortsEpisodes_DropsEmptySeasons()
    {
        var series = await CreateProvider(XtreamFixtures.SeriesInfoObjectEpisodes).GetSeriesDetailsAsync(Credentials, "7", CancellationToken.None);

        Assert.NotNull(series);
        Assert.Equal("7", series.Summary.Id);
        Assert.Equal(["http://img/show-bd.jpg"], series.BackdropUrls);
        var season = Assert.Single(series.Seasons);
        Assert.Equal("Season One", season.Name);
        Assert.Equal(["1001", "1002"], season.Episodes.Select(e => e.Id));
        Assert.Equal(2700, season.Episodes[1].DurationSeconds);
    }

    [Fact]
    public async Task GetSeriesDetailsAsync_AcceptsArrayOfArraysEpisodes()
    {
        var series = await CreateProvider(XtreamFixtures.SeriesInfoArrayEpisodes).GetSeriesDetailsAsync(Credentials, "8", CancellationToken.None);

        var season = Assert.Single(series!.Seasons);
        Assert.Equal(3, season.Number);
        Assert.Equal("Season 3", season.Name);
    }

    [Theory]
    [InlineData(PlaybackKind.Live, null, "live/good/p%40ss%2Fword/42.m3u8", "m3u8", true)]
    [InlineData(PlaybackKind.Live, "ts", "live/good/p%40ss%2Fword/42.ts", "ts", true)]
    [InlineData(PlaybackKind.Movie, "MKV", "movie/good/p%40ss%2Fword/42.mkv", "mkv", false)]
    [InlineData(PlaybackKind.Episode, "../evil", "series/good/p%40ss%2Fword/42.mp4", "mp4", false)]
    public void BuildPlaybackSource_BuildsXtreamPaths(PlaybackKind kind, string? container, string expectedPath, string expectedContainer, bool isLive)
    {
        var source = CreateProvider("{}").BuildPlaybackSource(Credentials, new PlaybackRequest(kind, "42", container), accountInfo: null);

        Assert.Equal(FakeXtreamServer.BaseUrl + expectedPath, source.Url.AbsoluteUri);
        Assert.Equal(expectedContainer, source.Container);
        Assert.Equal(isLive, source.IsLive);
    }

    [Fact]
    public void BuildPlaybackSource_LiveFallsBackToAllowedFormat()
    {
        var info = new ProviderAccountInfo("Active", null, 1, 0, ["ts"]);

        var source = CreateProvider("{}").BuildPlaybackSource(Credentials, new PlaybackRequest(PlaybackKind.Live, "1", "m3u8"), info);

        Assert.Equal("ts", source.Container);
    }
}
