using Backend.Core.Providers;
using Microsoft.AspNetCore.Diagnostics;

namespace Backend.Api.Errors;

/// <summary>Maps upstream provider failures to 502 problem responses with a machine-readable <c>code</c>.</summary>
public sealed class ProviderExceptionHandler(IProblemDetailsService problemDetails, ILogger<ProviderExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        if (exception is not ProviderException providerException)
        {
            return false;
        }

        logger.LogWarning(exception, "Provider call failed: {Message}", exception.Message);

        var code = providerException is ProviderAuthenticationException
            ? ErrorCodes.ProviderCredentialsRejected
            : ErrorCodes.ProviderUnavailable;

        context.Response.StatusCode = StatusCodes.Status502BadGateway;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails =
            {
                Status = StatusCodes.Status502BadGateway,
                Title = "IPTV provider error",
                Detail = exception.Message,
                Extensions = { ["code"] = code },
            },
        });
    }
}

public static class ErrorCodes
{
    public const string InvalidProviderCredentials = "invalid_provider_credentials";
    public const string ProviderCredentialsRejected = "provider_credentials_rejected";
    public const string ProviderUnavailable = "provider_unavailable";
    public const string ValidationFailed = "validation_failed";
}
