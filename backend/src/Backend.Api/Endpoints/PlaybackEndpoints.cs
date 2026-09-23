using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Core.Media;
using Backend.Core.Providers;
using Backend.Infrastructure.Streaming;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Endpoints;

public static class PlaybackEndpoints
{
    public static IEndpointRouteBuilder MapPlaybackEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/playback/{kind}/{id}", async Task<Results<Ok<PlaybackInfo>, NotFound>> (
                string kind, string id, string? container, HttpContext context, PlaybackService playback, CancellationToken ct) =>
            {
                if (!Enum.TryParse<PlaybackKind>(kind, ignoreCase: true, out var playbackKind) || int.TryParse(kind, out _))
                {
                    return TypedResults.NotFound();
                }

                var baseUrl = new Uri($"{context.Request.Scheme}://{context.Request.Host}{context.Request.PathBase}/");
                var info = await playback.GetPlaybackAsync(
                    context.User.GetAccountId(), new PlaybackRequest(playbackKind, id, container), baseUrl, ct);
                return TypedResults.Ok(info);
            })
            .WithTags("Playback")
            .WithName("getPlayback")
            .ProducesProviderErrors()
            .RequireAuthorization();

        return app;
    }
}
