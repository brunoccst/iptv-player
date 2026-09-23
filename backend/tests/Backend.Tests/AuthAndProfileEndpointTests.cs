using System.Net;
using System.Net.Http.Json;
using Backend.Api.Endpoints;
using Backend.Infrastructure.Persistence;
using Backend.Tests.Support;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Backend.Tests;

public class AuthAndProfileEndpointTests : IDisposable
{
    private readonly ApiFactory _factory = new();
    private readonly HttpClient _client;

    public AuthAndProfileEndpointTests() => _client = _factory.CreateClient();

    public void Dispose() => _factory.Dispose();

    [Fact]
    public async Task Login_WithWrongPassword_Returns401WithCode()
    {
        var response = await _client.LoginAsync(password: "wrong");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("invalid_provider_credentials", await response.ProblemCodeAsync());
    }

    [Fact]
    public async Task Login_WithBadServerUrl_Returns400()
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest("ftp://x", "u", "p", null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_CreatesAccountWithDefaultProfile_AndEncryptsPassword()
    {
        var login = await _client.LoginAndAuthorizeAsync();

        Assert.False(string.IsNullOrEmpty(login.Token));
        Assert.Equal("http://provider.test:8080/", login.Account.ServerUrl);
        Assert.Equal(2, login.Account.MaxConnections);
        var profile = Assert.Single(login.Profiles);
        Assert.Equal(FakeXtreamServer.Username, profile.Name);

        await using var scope = _factory.Services.CreateAsyncScope();
        var account = await scope.ServiceProvider.GetRequiredService<AppDbContext>().ProviderAccounts.SingleAsync();
        Assert.NotEqual(FakeXtreamServer.Password, account.EncryptedPassword);
        Assert.DoesNotContain(FakeXtreamServer.Password, await (await _client.GetAsync("/api/auth/me")).Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task SecondLogin_ReusesAccountAndProfiles()
    {
        var first = await _client.LoginAndAuthorizeAsync();
        var second = await _factory.CreateClient().LoginAndAuthorizeAsync();

        Assert.Equal(first.Account.Id, second.Account.Id);
        Assert.Single(second.Profiles);
        Assert.NotEqual(first.Token, second.Token);
    }

    [Fact]
    public async Task ProtectedEndpoints_RequireValidToken()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/profiles")).StatusCode);

        _client.DefaultRequestHeaders.Authorization = new("Bearer", "not-a-token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/profiles")).StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesToken()
    {
        await _client.LoginAndAuthorizeAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await _client.PostAsync("/api/auth/logout", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Profiles_CrudWithValidation()
    {
        var login = await _client.LoginAndAuthorizeAsync();

        var created = await _client.PostAsJsonAsync("/api/profiles", new ProfileRequest("Kids", "owl", true));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var kids = (await created.Content.ReadFromJsonAsync<ProfileDto>(ApiClientExtensions.Json))!;
        Assert.True(kids.IsKids);

        var duplicate = await _client.PostAsJsonAsync("/api/profiles", new ProfileRequest(" kids ", null, false));
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Equal("validation_failed", await duplicate.ProblemCodeAsync());

        var renamed = await _client.PutAsJsonAsync($"/api/profiles/{kids.Id}", new ProfileRequest("Children", "owl", true));
        Assert.Equal("Children", (await renamed.Content.ReadFromJsonAsync<ProfileDto>(ApiClientExtensions.Json))!.Name);

        Assert.Equal(HttpStatusCode.NoContent, (await _client.DeleteAsync($"/api/profiles/{kids.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.DeleteAsync($"/api/profiles/{kids.Id}")).StatusCode);

        var lastDelete = await _client.DeleteAsync($"/api/profiles/{login.Profiles[0].Id}");
        Assert.Equal(HttpStatusCode.BadRequest, lastDelete.StatusCode);
    }

    [Fact]
    public async Task Profiles_LimitedPerAccount()
    {
        await _client.LoginAndAuthorizeAsync();
        for (var i = 1; i < 5; i++)
        {
            (await _client.PostAsJsonAsync("/api/profiles", new ProfileRequest($"P{i}", null, false))).EnsureSuccessStatusCode();
        }

        var sixth = await _client.PostAsJsonAsync("/api/profiles", new ProfileRequest("P6", null, false));

        Assert.Equal(HttpStatusCode.BadRequest, sixth.StatusCode);
    }
}
