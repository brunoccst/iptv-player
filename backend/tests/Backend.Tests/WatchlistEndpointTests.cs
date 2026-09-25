using System.Net;
using System.Net.Http.Json;
using Backend.Api.Endpoints;
using Backend.Tests.Support;

namespace Backend.Tests;

public class WatchlistEndpointTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public WatchlistEndpointTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Add_IsIdempotent_ListsNewestFirst_AndRemoves()
    {
        var login = await _client.LoginAndAuthorizeAsync();
        var path = $"/api/profiles/{login.Profiles[0].Id}/watchlist";

        (await _client.PutAsJsonAsync($"{path}/movies/m1", new WatchlistRequest("Heat", 1995, "http://img/h.jpg"))).EnsureSuccessStatusCode();
        await Task.Delay(5);
        (await _client.PutAsJsonAsync($"{path}/series/s1", new WatchlistRequest("Dark", null, null))).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync($"{path}/movies/m1", new WatchlistRequest("Heat (1995)", 1995, null))).EnsureSuccessStatusCode();

        var list = await _client.GetFromJsonAsync<List<WatchlistDto>>(path, ApiClientExtensions.Json);
        Assert.Equal(["s1", "m1"], list!.Select(i => i.MasterId));
        Assert.Equal("Heat (1995)", list![1].Title);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"{path}/movies/m1")).StatusCode);
        Assert.Equal(["s1"], (await _client.GetFromJsonAsync<List<WatchlistDto>>(path, ApiClientExtensions.Json))!.Select(i => i.MasterId));
    }

    [Fact]
    public async Task ForeignProfile_Returns404_InvalidInput400()
    {
        await _client.LoginAndAuthorizeAsync();
        var foreign = $"/api/profiles/{Guid.NewGuid()}/watchlist";

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(foreign)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"{foreign}/movies/m1", new WatchlistRequest("A", null, null))).StatusCode);
        var login = await _client.LoginAndAuthorizeAsync();
        var path = $"/api/profiles/{login.Profiles[0].Id}/watchlist";
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"{path}/live/x", new WatchlistRequest("A", null, null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PutAsJsonAsync($"{path}/movies/x", new WatchlistRequest(" ", null, null))).StatusCode);
    }
}
