using System.Net;
using System.Text;

namespace Backend.Tests.Support;

/// <summary>In-memory HTTP handler. Routes each request through a delegate.</summary>
public sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public List<HttpRequestMessage> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Add(request);
        var response = respond(request);
        response.RequestMessage ??= request;
        return Task.FromResult(response);
    }

    public static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    public static string? Query(HttpRequestMessage request, string key) =>
        System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)[key];
}
