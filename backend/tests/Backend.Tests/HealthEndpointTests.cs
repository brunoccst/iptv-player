using System.Net.Http.Json;
using Backend.Tests.Support;

namespace Backend.Tests;

public class HealthEndpointTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory _factory;

    public HealthEndpointTests(ApiFactory factory) => _factory = factory;

    [Fact]
    public async Task Health_ReturnsOkAndConfiguredAppName()
    {
        var body = await _factory.CreateClient().GetFromJsonAsync<HealthResponse>("/api/health");

        Assert.NotNull(body);
        Assert.Equal("ok", body.Status);
        Assert.Equal("Test App", body.App);
    }

    private sealed record HealthResponse(string Status, string App);
}
