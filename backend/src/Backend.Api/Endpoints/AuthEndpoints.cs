using Backend.Api.Auth;
using Backend.Api.Errors;
using Backend.Core.Providers;
using Backend.Infrastructure.Accounts;
using Backend.Infrastructure.Library;
using Backend.Infrastructure.Xtream;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Endpoints;

public static class AuthEndpoints
{
    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/login", LoginAsync).AllowAnonymous().WithName("login").ProducesProviderErrors();
        group.MapPost("/logout", LogoutAsync).RequireAuthorization().WithName("logout");
        group.MapGet("/me", MeAsync).RequireAuthorization().WithName("getMe");

        return app;
    }

    private static async Task<Results<Ok<LoginResponse>, ProblemHttpResult>> LoginAsync(
        LoginRequest request, AccountService accounts, SessionService sessions, ProfileService profiles, LibrarySyncQueue librarySync,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password))
        {
            return Problems.Validation("Username and password are required.");
        }

        try
        {
            var account = await accounts.LoginAsync(
                request.ProviderType ?? XtreamCodesProvider.Type, request.ServerUrl, request.Username, request.Password, ct);
            var session = await sessions.CreateAsync(account.Id, ct);
            var accountProfiles = await profiles.ListAsync(account.Id, ct);
            librarySync.Request(account.Id);

            return TypedResults.Ok(new LoginResponse(
                session.Token, session.ExpiresAt, AccountDto.From(account), accountProfiles.Select(ProfileDto.From).ToList()));
        }
        catch (ArgumentException exception)
        {
            return Problems.Validation(exception.Message);
        }
        catch (ProviderAuthenticationException exception)
        {
            return TypedResults.Problem(exception.Message, statusCode: StatusCodes.Status401Unauthorized,
                extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.InvalidProviderCredentials });
        }
    }

    private static async Task<NoContent> LogoutAsync(HttpContext context, SessionService sessions, CancellationToken ct)
    {
        await sessions.RevokeAsync(context.User.GetSessionId(), ct);
        return TypedResults.NoContent();
    }

    private static async Task<Results<Ok<AccountDto>, UnauthorizedHttpResult>> MeAsync(
        HttpContext context, AccountService accounts, CancellationToken ct)
    {
        var account = await accounts.FindAsync(context.User.GetAccountId(), ct);
        return account is null ? TypedResults.Unauthorized() : TypedResults.Ok(AccountDto.From(account));
    }
}
