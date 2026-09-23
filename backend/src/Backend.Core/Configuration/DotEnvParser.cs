namespace Backend.Core.Configuration;

/// <summary>Parses <c>KEY=VALUE</c> lines. Ignores blanks and <c>#</c> comments. Strips matching outer quotes.</summary>
public static class DotEnvParser
{
    public static IReadOnlyDictionary<string, string> Parse(IEnumerable<string> lines)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            var value = Unquote(line[(separatorIndex + 1)..].Trim());
            values[key] = value;
        }

        return values;
    }

    private static string Unquote(string value)
    {
        if (value.Length >= 2 && (value[0] == '"' || value[0] == '\'') && value[^1] == value[0])
        {
            return value[1..^1];
        }

        return value;
    }
}
