using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Core.Accounts;
using Backend.Infrastructure.Accounts;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Endpoints;

/// <summary>Per-profile "My List" of movies and series (D-055). Shared by web and TV.</summary>
public static class WatchlistEndpoints
{
    public static IEndpointRouteBuilder MapWatchlistEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles/{profileId:guid}/watchlist").WithTags("Watchlist").RequireAuthorization();

        group.MapGet("/", async Task<Results<Ok<List<WatchlistDto>>, NotFound>> (
                Guid profileId, HttpContext context, WatchlistService watchlist, CancellationToken ct) =>
            await watchlist.ListAsync(context.User.GetAccountId(), profileId, ct) is { } items
                ? TypedResults.Ok(items.Select(WatchlistDto.From).ToList())
                : TypedResults.NotFound())
            .WithName("listWatchlist");

        group.MapPut("/{section}/{masterId}", async Task<Results<Ok<WatchlistDto>, NotFound, ProblemHttpResult>> (
                Guid profileId, string section, string masterId, WatchlistRequest request, HttpContext context,
                WatchlistService watchlist, CancellationToken ct) =>
            {
                if (!WatchlistService.Sections.Contains(section) || string.IsNullOrWhiteSpace(request.Title) || masterId.Length > 64)
                {
                    return Problems.Validation("Section must be 'movies' or 'series'; title is required; masterId max 64 chars.");
                }

                if (await watchlist.CountAsync(profileId, ct) >= WatchlistService.MaxItems)
                {
                    return Problems.Validation($"My List holds at most {WatchlistService.MaxItems} titles.");
                }

                var title = request.Title.Trim();
                var input = new WatchlistInput(title[..Math.Min(title.Length, 300)], request.Year, request.PosterUrl);
                return await watchlist.AddAsync(context.User.GetAccountId(), profileId, section, masterId, input, ct) is { } saved
                    ? TypedResults.Ok(WatchlistDto.From(saved))
                    : TypedResults.NotFound();
            })
            .WithName("addToWatchlist")
            .ProducesProblem(StatusCodes.Status400BadRequest);

        group.MapDelete("/{section}/{masterId}", async Task<Results<NoContent, NotFound>> (
                Guid profileId, string section, string masterId, HttpContext context, WatchlistService watchlist, CancellationToken ct) =>
            await watchlist.RemoveAsync(context.User.GetAccountId(), profileId, section, masterId, ct)
                ? TypedResults.NoContent()
                : TypedResults.NotFound())
            .WithName("removeFromWatchlist");

        return app;
    }
}

public sealed record WatchlistRequest(string Title, int? Year, string? PosterUrl);

public sealed record WatchlistDto(string Section, string MasterId, string Title, int? Year, string? PosterUrl, DateTimeOffset AddedAt)
{
    public static WatchlistDto From(WatchlistItem i) => new(i.Section, i.MasterId, i.Title, i.Year, i.PosterUrl, i.AddedAt);
}
