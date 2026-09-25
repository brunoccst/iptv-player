using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Infrastructure.Epg;

namespace Backend.Api.Endpoints;

/// <summary>TV guide (EPG) grid. See DECISIONS.md#d-031.</summary>
public static class EpgEndpoints
{
    public static IEndpointRouteBuilder MapEpgEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/epg").WithTags("Epg").RequireAuthorization().ProducesProviderErrors();

        // `from` defaults to the current half hour; `hours` is clamped to 1..12 and `limit` (channels) to 1..200.
        // `categoryIds` (comma-separated) keeps only channels in those categories (Kids profiles, D-053).
        group.MapGet("/", (string? categoryId, DateTimeOffset? from, int? hours, int? offset, int? limit, string? categoryIds,
                HttpContext context, EpgService epg, CancellationToken ct) =>
            epg.GetGridAsync(context.User.GetAccountId(),
                new EpgGridQuery(categoryId, from, hours ?? 3, offset ?? 0, limit ?? 50, CategoryList.Parse(categoryIds)), ct))
            .WithName("getEpgGrid");

        group.MapPost("/refresh", (HttpContext context, EpgRefreshQueue queue) =>
        {
            queue.Request(context.User.GetAccountId());
            return TypedResults.Accepted("/api/epg");
        }).WithName("refreshEpg");

        return app;
    }
}
