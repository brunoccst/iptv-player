using Backend.Core.Configuration;
using Microsoft.Extensions.Options;

namespace Backend.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/health", (IOptions<AppOptions> options) => new HealthResponse("ok", options.Value.Name))
            .WithTags("Health").WithName("getHealth").AllowAnonymous();
        return app;
    }
}

public sealed record HealthResponse(string Status, string App);
