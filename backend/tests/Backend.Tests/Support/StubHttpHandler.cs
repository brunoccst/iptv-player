using System.Net;
using System.Text;

namespace Backend.Tests.Support;

/// <summary>In-memory HTTP handler. Routes each request through a delegate.</summary>
public sealed class StubHttpHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
{
    public System.Collections.Concurrent.ConcurrentQueue<HttpRequestMessage> Requests { get; } = new();

    /// <summary>Per-test override; returning null falls through to the default responder.</summary>
    public Func<HttpRequestMessage, HttpResponseMessage?>? Override { get; set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        Requests.Enqueue(request);
        var response = Override?.Invoke(request) ?? respond(request);
        response.RequestMessage ??= request;
        return Task.FromResult(response);
    }

    public static HttpResponseMessage Json(string json, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    public static string? Query(HttpRequestMessage request, string key) =>
        System.Web.HttpUtility.ParseQueryString(request.RequestUri!.Query)[key];
}
