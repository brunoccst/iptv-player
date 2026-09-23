using System.Net;
using System.Net.Http.Json;
using Backend.Api.Endpoints;
using Backend.Tests.Support;

namespace Backend.Tests;

public class ProgressEndpointTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public ProgressEndpointTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    private static ProgressRequest Request(double position, string title = "Heat") =>
        new(title, position, 6000, "m1", null, null, null, "http://img/p.jpg", "mp4");

    [Fact]
    public async Task Save_Upserts_AndListsNewestFirst()
    {
        var login = await _client.LoginAndAuthorizeAsync();
        var profileId = login.Profiles[0].Id;

        (await _client.PutAsJsonAsync($"/api/profiles/{profileId}/progress/movie/55", Request(100))).EnsureSuccessStatusCode();
        (await _client.PutAsJsonAsync($"/api/profiles/{profileId}/progress/episode/9", Request(30, "Show S01E01"))).EnsureSuccessStatusCode();
        var updated = await _client.PutAsJsonAsync($"/api/profiles/{profileId}/progress/movie/55", Request(250));

        var saved = await updated.Content.ReadFromJsonAsync<ProgressDto>(ApiClientExtensions.Json);
        Assert.Equal(250, saved!.PositionSeconds);
        var list = await _client.GetFromJsonAsync<List<ProgressDto>>($"/api/profiles/{profileId}/progress", ApiClientExtensions.Json);
        Assert.Equal(["55", "9"], list!.Select(p => p.ItemId));
        Assert.Equal("m1", list![0].MasterId);
    }

    [Fact]
    public async Task Delete_RemovesEntry()
    {
        var login = await _client.LoginAndAuthorizeAsync();
        var profileId = login.Profiles[0].Id;
        await _client.PutAsJsonAsync($"/api/profiles/{profileId}/progress/movie/55", Request(100));

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/profiles/{profileId}/progress/movie/55")).StatusCode);

        Assert.Empty((await _client.GetFromJsonAsync<List<ProgressDto>>($"/api/profiles/{profileId}/progress", ApiClientExtensions.Json))!);
    }

    [Fact]
    public async Task ForeignOrUnknownProfile_Returns404_InvalidInput400()
    {
        await _client.LoginAndAuthorizeAsync();
        var foreign = Guid.NewGuid();

        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync($"/api/profiles/{foreign}/progress")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.PutAsJsonAsync($"/api/profiles/{foreign}/progress/movie/1", Request(1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"/api/profiles/{foreign}/progress/movie/1")).StatusCode);

        var login = await _factory.CreateClient().LoginAndAuthorizeAsync();
        var bad = await _client.PutAsJsonAsync($"/api/profiles/{login.Profiles[0].Id}/progress/live/1", Request(1));
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
    }
}
