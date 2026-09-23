using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Infrastructure.Accounts;

namespace Backend.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles").WithTags("Profiles").RequireAuthorization();

        group.MapGet("/", async (HttpContext context, ProfileService profiles, CancellationToken ct) =>
            Results.Ok((await profiles.ListAsync(context.User.GetAccountId(), ct)).Select(ProfileDto.From)));

        group.MapPost("/", async (ProfileRequest request, HttpContext context, ProfileService profiles, CancellationToken ct) =>
            ToResult(await profiles.CreateAsync(context.User.GetAccountId(), ToInput(request), ct), created: true));

        group.MapPut("/{profileId:guid}", async (Guid profileId, ProfileRequest request, HttpContext context, ProfileService profiles, CancellationToken ct) =>
            ToResult(await profiles.UpdateAsync(context.User.GetAccountId(), profileId, ToInput(request), ct)));

        group.MapDelete("/{profileId:guid}", async (Guid profileId, HttpContext context, ProfileService profiles, CancellationToken ct) =>
            await profiles.DeleteAsync(context.User.GetAccountId(), profileId, ct) switch
            {
                null => Results.NotFound(),
                { Error: { } error } => ValidationProblem(error),
                _ => Results.NoContent(),
            });

        return app;
    }

    private static ProfileInput ToInput(ProfileRequest request) => new(request.Name ?? string.Empty, request.AvatarKey, request.IsKids);

    private static IResult ToResult(ProfileResult? result, bool created = false) => result switch
    {
        null => Results.NotFound(),
        { Error: { } error } => ValidationProblem(error),
        { Profile: { } profile } when created => Results.Created($"/api/profiles/{profile.Id}", ProfileDto.From(profile)),
        { Profile: { } profile } => Results.Ok(ProfileDto.From(profile)),
        _ => Results.StatusCode(StatusCodes.Status500InternalServerError),
    };

    private static IResult ValidationProblem(string error) =>
        Results.Problem(error, statusCode: StatusCodes.Status400BadRequest,
            extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.ValidationFailed });
}
