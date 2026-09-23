using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Core.Providers;
using Backend.Infrastructure.Accounts;
using Backend.Infrastructure.Xtream;

namespace Backend.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", LoginAsync).AllowAnonymous();
        group.MapPost("/logout", LogoutAsync).RequireAuthorization();
        group.MapGet("/me", MeAsync).RequireAuthorization();

        return app;
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request, AccountService accounts, SessionService sessions, ProfileService profiles, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
        {
            return Results.Problem("Username and password are required.", statusCode: StatusCodes.Status400BadRequest,
                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.ValidationFailed });
        }

        try
        {
            var account = await accounts.LoginAsync(
                request.ProviderType ?? XtreamCodesProvider.Type, request.ServerUrl, request.Username, request.Password, ct);
            var session = await sessions.CreateAsync(account.Id, ct);
            var accountProfiles = await profiles.ListAsync(account.Id, ct);

            return Results.Ok(new LoginResponse(
                session.Token, session.ExpiresAt, AccountDto.From(account), accountProfiles.Select(ProfileDto.From).ToList()));
        }
        catch (ArgumentException exception)
        {
            return Results.Problem(exception.Message, statusCode: StatusCodes.Status400BadRequest,
                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.ValidationFailed });
        }
        catch (ProviderAuthenticationException exception)
        {
            return Results.Problem(exception.Message, statusCode: StatusCodes.Status401Unauthorized,
                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.InvalidProviderCredentials });
        }
    }

    private static async Task<IResult> LogoutAsync(HttpContext context, SessionService sessions, CancellationToken ct)
    {
        await sessions.RevokeAsync(context.User.GetSessionId(), ct);
        return Results.NoContent();
    }

    private static async Task<IResult> MeAsync(HttpContext context, AccountService accounts, CancellationToken ct)
    {
        var account = await accounts.FindAsync(context.User.GetAccountId(), ct);
        return account is null ? Results.Unauthorized() : Results.Ok(AccountDto.From(account));
    }
}
