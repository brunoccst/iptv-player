using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Infrastructure.Accounts;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Endpoints;

public static class ProfileEndpoints
{
    public static IEndpointRouteBuilder MapProfileEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/profiles").WithTags("Profiles").RequireAuthorization();

        group.MapGet("/", ListAsync).WithName("listProfiles");
        group.MapPost("/", CreateAsync).WithName("createProfile").ProducesProblem(StatusCodes.Status400BadRequest);
        group.MapPut("/{profileId:guid}", UpdateAsync).WithName("updateProfile").ProducesProblem(StatusCodes.Status400BadRequest);
        group.MapDelete("/{profileId:guid}", DeleteAsync).WithName("deleteProfile").ProducesProblem(StatusCodes.Status400BadRequest);

        return app;
    }

    private static async Task<Ok<List<ProfileDto>>> ListAsync(HttpContext context, ProfileService profiles, CancellationToken ct) =>
        TypedResults.Ok((await profiles.ListAsync(context.User.GetAccountId(), ct)).Select(ProfileDto.From).ToList());

    private static async Task<Results<Created<ProfileDto>, ProblemHttpResult>> CreateAsync(
        ProfileRequest request, HttpContext context, ProfileService profiles, CancellationToken ct)
    {
        var result = await profiles.CreateAsync(context.User.GetAccountId(), ToInput(request), ct);
        return result.Profile is { } profile
            ? TypedResults.Created($"/api/profiles/{profile.Id}", ProfileDto.From(profile))
            : Problems.Validation(result.Error!);
    }

    private static async Task<Results<Ok<ProfileDto>, NotFound, ProblemHttpResult>> UpdateAsync(
        Guid profileId, ProfileRequest request, HttpContext context, ProfileService profiles, CancellationToken ct) =>
        await profiles.UpdateAsync(context.User.GetAccountId(), profileId, ToInput(request), ct) switch
        {
            null => TypedResults.NotFound(),
            { Profile: { } profile } => TypedResults.Ok(ProfileDto.From(profile)),
            { Error: var error } => Problems.Validation(error!),
        };

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteAsync(
        Guid profileId, HttpContext context, ProfileService profiles, CancellationToken ct) =>
        await profiles.DeleteAsync(context.User.GetAccountId(), profileId, ct) switch
        {
            null => TypedResults.NotFound(),
            { Error: { } error } => Problems.Validation(error),
            _ => TypedResults.NoContent(),
        };

    private static ProfileInput ToInput(ProfileRequest request) => new(request.Name ?? string.Empty, request.AvatarKey, request.IsKids);
}
