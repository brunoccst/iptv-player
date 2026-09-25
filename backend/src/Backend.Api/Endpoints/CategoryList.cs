namespace Backend.Api.Endpoints;

/// <summary>Comma-separated category ids from a query string. Null when absent; empty list when given but empty.</summary>
internal static class CategoryList
{
    public static IReadOnlyList<string>? Parse(string? value) =>
        value is null ? null : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
