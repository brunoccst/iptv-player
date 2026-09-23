using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Core.Accounts;
using Backend.Infrastructure.Accounts;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Endpoints;

/// <summary>Watch progress per profile ("Continue Watching"). Shared by web and TV.</summary>
public static class ProgressEndpoints
{
    public static IEndpointRouteBuilder MapProgressEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles/{profileId:guid}/progress").WithTags("Progress").RequireAuthorization();

        group.MapGet("/", async Task<Results<Ok<List<ProgressDto>>, NotFound>> (
                Guid profileId, int? limit, HttpContext context, ProgressService progress, CancellationToken ct) =>
            await progress.ListAsync(context.User.GetAccountId(), profileId, limit ?? 50, ct) is { } items
                ? TypedResults.Ok(items.Select(ProgressDto.From).ToList())
                : TypedResults.NotFound())
            .WithName("listProgress");

        group.MapPut("/{kind}/{itemId}", async Task<Results<Ok<ProgressDto>, NotFound, ProblemHttpResult>> (
                Guid profileId, string kind, string itemId, ProgressRequest request, HttpContext context, ProgressService progress,
                CancellationToken ct) =>
            {
                if (!ProgressService.Kinds.Contains(kind) || string.IsNullOrWhiteSpace(request.Title) || itemId.Length > 64)
                {
                    return Problems.Validation("Kind must be 'movie' or 'episode'; title is required; itemId max 64 chars.");
                }

                var input = new ProgressInput(request.Title.Trim()[..Math.Min(request.Title.Trim().Length, 300)], request.PositionSeconds,
                    request.DurationSeconds, request.MasterId, request.SeriesId, request.SeasonNumber, request.EpisodeNumber,
                    request.PosterUrl, request.ContainerExtension);
                return await progress.UpsertAsync(context.User.GetAccountId(), profileId, kind, itemId, input, ct) is { } saved
                    ? TypedResults.Ok(ProgressDto.From(saved))
                    : TypedResults.NotFound();
            })
            .WithName("saveProgress")
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapDelete("/{kind}/{itemId}", async Task<Results<NoContent, NotFound>> (
                Guid profileId, string kind, string itemId, HttpContext context, ProgressService progress, CancellationToken ct) =>
            await progress.DeleteAsync(context.User.GetAccountId(), profileId, kind, itemId, ct)
                ? TypedResults.NoContent()
                : TypedResults.NotFound())
            .WithName("deleteProgress");

        return app;
    }
}

public sealed record ProgressRequest(
    string Title,
    double PositionSeconds,
    double DurationSeconds,
    string? MasterId,
    string? SeriesId,
    int? SeasonNumber,
    int? EpisodeNumber,
    string? PosterUrl,
    string? ContainerExtension);

public sealed record ProgressDto(
    string Kind,
    string ItemId,
    string? MasterId,
    string? SeriesId,
    int? SeasonNumber,
    int? EpisodeNumber,
    string Title,
    string? PosterUrl,
    string? ContainerExtension,
    double PositionSeconds,
    double DurationSeconds,
    DateTimeOffset UpdatedAt)
{
    public static ProgressDto From(WatchProgress p) => new(
        p.Kind, p.ItemId, p.MasterId, p.SeriesId, p.SeasonNumber, p.EpisodeNumber, p.Title, p.PosterUrl, p.ContainerExtension,
        p.PositionSeconds, p.DurationSeconds, p.UpdatedAt);
}
