using Backend.Core.Streaming;
using Backend.Infrastructure;
using Backend.Infrastructure.Streaming;

namespace Backend.Api.Endpoints;

/// <summary>Streams upstream media through the backend. Auth = signed token in the path. See DECISIONS.md#d-013.</summary>
public static class RelayEndpoints
{
    private const int MaxPlaylistBytes = 5 * 1024 * 1024;

    private static readonly string[] ForwardedResponseHeaders =
        ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "Last-Modified", "ETag"];

    public static IEndpointRouteBuilder MapRelayEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/relay/{token}/{fileName}", RelayAsync).WithTags("Relay").AllowAnonymous();
        return app;
    }

    private static async Task RelayAsync(
        string token, HttpContext context, RelayTokenService relayTokens, IHttpClientFactory httpClientFactory, ILoggerFactory loggerFactory)
    {
        var upstreamUrl = relayTokens.ReadToken(token);
        if (upstreamUrl is null)
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return;
        }

        var ct = context.RequestAborted;
        using var request = new HttpRequestMessage(HttpMethod.Get, upstreamUrl);
        if (context.Request.Headers.Range.Count > 0)
        {
            request.Headers.TryAddWithoutValidation("Range", context.Request.Headers.Range.ToString());
        }

        var client = httpClientFactory.CreateClient(DependencyInjection.RelayHttpClient);
        HttpResponseMessage response;
        try
        {
            response = await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        }
        catch (HttpRequestException exception)
        {
            loggerFactory.CreateLogger(nameof(RelayEndpoints)).LogWarning(exception, "Relay upstream unreachable: {Host}", upstreamUrl.Host);
            context.Response.StatusCode = StatusCodes.Status502BadGateway;
            return;
        }

        using (response)
        {
            // Redirects are followed automatically; relative playlist URIs resolve against the final URL.
            var finalUrl = response.RequestMessage?.RequestUri ?? upstreamUrl;
            var contentType = response.Content.Headers.ContentType?.MediaType;

            context.Response.StatusCode = (int)response.StatusCode;
            if (!response.IsSuccessStatusCode)
            {
                return;
            }

            if (HlsPlaylistRewriter.LooksLikePlaylist(contentType, finalUrl)
                && (response.Content.Headers.ContentLength ?? 0) <= MaxPlaylistBytes)
            {
                var playlist = await response.Content.ReadAsStringAsync(ct);
                var rewritten = HlsPlaylistRewriter.Rewrite(playlist, finalUrl, relayTokens.CreatePath);
                context.Response.ContentType = "application/vnd.apple.mpegurl";
                context.Response.Headers.CacheControl = "no-cache";
                await context.Response.WriteAsync(rewritten, ct);
                return;
            }

            foreach (var header in ForwardedResponseHeaders)
            {
                if (response.Content.Headers.TryGetValues(header, out var values) || response.Headers.TryGetValues(header, out values))
                {
                    context.Response.Headers[header] = values.ToArray();
                }
            }

            try
            {
                await using var body = await response.Content.ReadAsStreamAsync(ct);
                await body.CopyToAsync(context.Response.Body, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Player closed the connection (seek, stop, channel change). Expected.
            }
        }
    }
}
