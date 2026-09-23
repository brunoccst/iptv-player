using Microsoft.AspNetCore.Http.HttpResults;

namespace Backend.Api.Errors;

public static class Problems
{
    public static ProblemHttpResult Validation(string detail) =>
        TypedResults.Problem(detail, statusCode: StatusCodes.Status400BadRequest,
            extensions: new Dictionary<string, object?> { ["code"] = ErrorCodes.ValidationFailed });

    /// <summary>Documents the 400/401/502 problem responses of endpoints that call the IPTV provider.</summary>
    public static TBuilder ProducesProviderErrors<TBuilder>(this TBuilder builder) where TBuilder : IEndpointConventionBuilder =>
        builder
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status502BadGateway);
}
