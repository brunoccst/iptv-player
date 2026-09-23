using System.Globalization;
using System.Text.Json;

namespace Backend.Infrastructure.Xtream;

/// <summary>
/// Readers that tolerate Xtream panels mixing strings, numbers, nulls and empty arrays for the same field.
/// </summary>
internal static class LooseJson
{
    public static JsonElement? Property(this JsonElement element, string name) =>
        element.ValueKind == JsonValueKind.Object && element.TryGetProperty(name, out var value) ? value : null;

    public static string? String(this JsonElement element, string name)
    {
        var value = element.Property(name);
        var text = value?.ValueKind switch
        {
            JsonValueKind.String => value.Value.GetString(),
            JsonValueKind.Number => value.Value.GetRawText(),
            JsonValueKind.True => "1",
            JsonValueKind.False => "0",
            _ => null,
        };
        return string.IsNullOrWhiteSpace(text) ? null : text.Trim();
    }

    public static int? Int(this JsonElement element, string name) =>
        double.TryParse(element.String(name), NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
            ? (int)number
            : null;

    public static double? Double(this JsonElement element, string name) =>
        double.TryParse(element.String(name), NumberStyles.Float, CultureInfo.InvariantCulture, out var number)
            ? number
            : null;

    public static bool Bool(this JsonElement element, string name) =>
        element.String(name) is { } text && (text == "1" || text.Equals("true", StringComparison.OrdinalIgnoreCase));

    public static DateTimeOffset? UnixTime(this JsonElement element, string name) =>
        long.TryParse(element.String(name), NumberStyles.Integer, CultureInfo.InvariantCulture, out var seconds) && seconds > 0
            ? DateTimeOffset.FromUnixTimeSeconds(seconds)
            : null;

    /// <summary>Reads a string array, a single string, or nothing. Drops blanks.</summary>
    public static IReadOnlyList<string> StringList(this JsonElement element, string name)
    {
        var value = element.Property(name);
        return value?.ValueKind switch
        {
            JsonValueKind.Array => value.Value.EnumerateArray()
                .Where(item => item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()))
                .Select(item => item.GetString()!.Trim())
                .ToList(),
            JsonValueKind.String when !string.IsNullOrWhiteSpace(value.Value.GetString()) => [value.Value.GetString()!.Trim()],
            _ => [],
        };
    }

    public static IEnumerable<JsonElement> ArrayItems(this JsonElement element) =>
        element.ValueKind == JsonValueKind.Array ? element.EnumerateArray() : [];
}
