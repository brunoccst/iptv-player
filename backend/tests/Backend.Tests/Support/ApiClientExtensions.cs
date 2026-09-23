using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Backend.Api.Endpoints;

namespace Backend.Tests.Support;

public static class ApiClientExtensions
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) },
    };

    public static Task<HttpResponseMessage> LoginAsync(this HttpClient client, string password = FakeXtreamServer.Password) =>
        client.PostAsJsonAsync("/api/auth/login", new LoginRequest("provider.test:8080", FakeXtreamServer.Username, password, null));

    /// <summary>Logs in with valid credentials and attaches the bearer token to <paramref name="client"/>.</summary>
    public static async Task<LoginResponse> LoginAndAuthorizeAsync(this HttpClient client)
    {
        var response = await client.LoginAsync();
        response.EnsureSuccessStatusCode();
        var body = (await response.Content.ReadFromJsonAsync<LoginResponse>(Json))!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", body.Token);
        return body;
    }

    public static async Task<string?> ProblemCodeAsync(this HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }
}
