using Backend.Api.Auth;
using Backend.Core.Library;
using Backend.Infrastructure.Library;

namespace Backend.Api.Endpoints;

/// <summary>Deduplicated library (master media + variants) produced by the title normalizer.</summary>
public static class LibraryEndpoints
{
    public static IEndpointRouteBuilder MapLibraryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/library").WithTags("Library").RequireAuthorization();

        group.MapPost("/sync", (HttpContext context, LibrarySyncQueue queue) =>
        {
            queue.Request(context.User.GetAccountId());
            return Results.Accepted("/api/library/status");
        });

        group.MapGet("/status", (HttpContext context, LibraryService library, CancellationToken ct) =>
            library.GetStatusAsync(context.User.GetAccountId(), ct));

        group.MapGet("/{kind}", async (
            string kind, string? categoryId, string? search, int? offset, int? limit,
            HttpContext context, LibraryService library, CancellationToken ct) =>
            ToMediaKind(kind) is { } mediaKind
                ? Results.Ok(await library.ListAsync(context.User.GetAccountId(), mediaKind,
                    new LibraryQuery(categoryId, search, offset ?? 0, limit ?? 100), ct))
                : Results.NotFound());

        group.MapGet("/{kind}/{masterId}", async (string kind, string masterId, HttpContext context, LibraryService library, CancellationToken ct) =>
            ToMediaKind(kind) is { } mediaKind && await library.GetAsync(context.User.GetAccountId(), mediaKind, masterId, ct) is { } master
                ? Results.Ok(master)
                : Results.NotFound());

        return app;
    }

    /// <summary>Route uses plural names (<c>movies</c>, <c>series</c>); storage uses <see cref="LibraryKind"/>.</summary>
    private static string? ToMediaKind(string kind) => kind.ToLowerInvariant() switch
    {
        "movies" => LibraryKind.Movie,
        "series" => LibraryKind.Series,
        _ => null,
    };
}
