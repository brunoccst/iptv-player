using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Backend.Api.OpenApi;

/// <summary>
/// Sets <c>required</c> so generated TypeScript types match the wire format. See DECISIONS.md#d-020.
/// </summary>
public sealed class RequiredPropertiesSchemaTransformer : IOpenApiSchemaTransformer
{
    public Task TransformAsync(OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
    {
        if (schema.Properties is not { Count: > 0 } properties)
        {
            return Task.CompletedTask;
        }

        var isRequestBody = context.JsonTypeInfo.Type.Name.EndsWith("Request", StringComparison.Ordinal);
        schema.Required = new HashSet<string>(properties
            .Where(property => !isRequestBody || !IsNullable(property.Value))
            .Select(property => property.Key));

        return Task.CompletedTask;
    }

    private static bool IsNullable(IOpenApiSchema schema) =>
        schema.Type is { } type && type.HasFlag(JsonSchemaType.Null);
}
