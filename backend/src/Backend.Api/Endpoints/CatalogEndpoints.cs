using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Core.Media;
using Backend.Infrastructure.Catalog;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Endpoints;

public static class CatalogEndpoints
{
    public static IEndpointRouteBuilder MapCatalogEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/catalog").WithTags("Catalog").RequireAuthorization().ProducesProviderErrors();

        group.MapGet("/live/categories", (HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetCategoriesAsync(c.User.GetAccountId(), MediaKind.Live, ct)).WithName("listLiveCategories");
        group.MapGet("/live/channels", (string? categoryId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetLiveChannelsAsync(c.User.GetAccountId(), categoryId, ct)).WithName("listLiveChannels");

        group.MapGet("/movies/categories", (HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetCategoriesAsync(c.User.GetAccountId(), MediaKind.Movie, ct)).WithName("listMovieCategories");
        group.MapGet("/movies", (string? categoryId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetMoviesAsync(c.User.GetAccountId(), categoryId, ct)).WithName("listMovies");
        group.MapGet("/movies/{movieId}", async Task<Results<Ok<MovieDetails>, NotFound>> (
                string movieId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            await catalog.GetMovieAsync(c.User.GetAccountId(), movieId, ct) is { } movie ? TypedResults.Ok(movie) : TypedResults.NotFound())
            .WithName("getMovie");

        group.MapGet("/series/categories", (HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetCategoriesAsync(c.User.GetAccountId(), MediaKind.Series, ct)).WithName("listSeriesCategories");
        group.MapGet("/series", (string? categoryId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            catalog.GetSeriesAsync(c.User.GetAccountId(), categoryId, ct)).WithName("listSeries");
        group.MapGet("/series/{seriesId}", async Task<Results<Ok<SeriesDetails>, NotFound>> (
                string seriesId, HttpContext c, CatalogService catalog, CancellationToken ct) =>
            await catalog.GetSeriesDetailsAsync(c.User.GetAccountId(), seriesId, ct) is { } series ? TypedResults.Ok(series) : TypedResults.NotFound())
            .WithName("getSeries");

        return app;
    }
}
