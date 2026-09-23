using System.Security.Claims;
using System.Text.Encodings.Web;
using Backend.Infrastructure.Accounts;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace Backend.Api.Auth;

/// <summary>Authenticates <c>Authorization: Bearer &lt;token&gt;</c> against stored sessions.</summary>
public sealed class SessionAuthenticationHandler(
    IOptionsMonitor<AuthenticationSchemeOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder,
    SessionService sessions)
    : AuthenticationHandler<AuthenticationSchemeOptions>(options, logger, encoder)
{
    public const string SchemeName = "Session";

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        var header = Request.Headers.Authorization.ToString();
        if (!header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.NoResult();
        }

        var session = await sessions.ValidateAsync(header["Bearer ".Length..].Trim(), Context.RequestAborted);
        if (session is null)
        {
            return AuthenticateResult.Fail("Invalid or expired session.");
        }

        var identity = new ClaimsIdentity(
        [
            new Claim(SessionClaims.AccountId, session.AccountId.ToString()),
            new Claim(SessionClaims.SessionId, session.Id.ToString()),
        ], SchemeName);

        return AuthenticateResult.Success(new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName));
    }
}

public static class SessionClaims
{
    public const string AccountId = "account_id";
    public const string SessionId = "session_id";

    public static Guid GetAccountId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(AccountId)!);

    public static Guid GetSessionId(this ClaimsPrincipal user) => Guid.Parse(user.FindFirstValue(SessionId)!);
}
