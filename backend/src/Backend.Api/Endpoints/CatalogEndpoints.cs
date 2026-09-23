using Backend.Api.Auth;
using Backend.Core.Media;
using Backend.Infrastructure.Catalog;

namespace Backend.Api.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/catalog").WithTags("Catalog").RequireAuthorization();

        group.MapGet("/live/categories", (HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetCategoriesAsync(c.User.GetAccountId(), MediaKind.Live, ct));
        group.MapGet("/live/channels", (string? categoryId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetLiveChannelsAsync(c.User.GetAccountId(), categoryId, ct));

        group.MapGet("/movies/categories", (HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetCategoriesAsync(c.User.GetAccountId(), MediaKind.Movie, ct));
        group.MapGet("/movies", (string? categoryId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetMoviesAsync(c.User.GetAccountId(), categoryId, ct));
        group.MapGet("/movies/{movieId}", async (string movieId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            await catalog.GetMovieAsync(c.User.GetAccountId(), movieId, ct) is { } movie ? Results.Ok(movie) : Results.NotFound());

        group.MapGet("/series/categories", (HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetCategoriesAsync(c.User.GetAccountId(), MediaKind.Series, ct));
        group.MapGet("/series", (string? categoryId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetSeriesAsync(c.User.GetAccountId(), categoryId, ct));
        group.MapGet("/series/{seriesId}", async (string seriesId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            await catalog.GetSeriesDetailsAsync(c.User.GetAccountId(), seriesId, ct) is { } series ? Results.Ok(series) : Results.NotFound());

        return app;
    }
}
