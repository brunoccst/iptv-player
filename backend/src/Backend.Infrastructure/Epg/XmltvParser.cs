using System.Globalization;
using System.Runtime.CompilerServices;
using System.Xml;
using Backend.Core.Epg;

namespace Backend.Infrastructure.Epg;

/// <summary>
/// Streams <c>&lt;programme&gt;</c> entries from an XMLTV document without loading it (feeds reach hundreds of MB).
/// Keeps entries overlapping [<paramref name="from"/>, <paramref name="to"/>). See DECISIONS.md#d-031.
/// </summary>
public static class XmltvParser
{
    private static readonly XmlReaderSettings Settings = new()
    {
        Async = true,
        DtdProcessing = DtdProcessing.Ignore,
        XmlResolver = null,
        IgnoreComments = true,
        IgnoreWhitespace = true,
        IgnoreProcessingInstructions = true,
        CheckCharacters = false,
    };

    public static async IAsyncEnumerable<EpgProgramme> ParseAsync(
        Stream xml, DateTimeOffset from, DateTimeOffset to, [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        using var reader = XmlReader.Create(xml, Settings);
        while (await reader.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (reader.NodeType != XmlNodeType.Element || reader.LocalName != "programme")
            {
                continue;
            }

            var channel = EpgChannelKeys.Normalize(reader.GetAttribute("channel"));
            var start = ParseTime(reader.GetAttribute("start"));
            var stop = ParseTime(reader.GetAttribute("stop"));
            var (title, description) = await ReadTextsAsync(reader);

            if (channel is null || start is null || stop is null || stop <= start || string.IsNullOrWhiteSpace(title))
            {
                continue;
            }
            if (stop <= from || start >= to)
            {
                continue;
            }

            yield return new EpgProgramme(channel, start.Value, stop.Value, title.Trim(), string.IsNullOrWhiteSpace(description) ? null : description.Trim());
        }
    }

    /// <summary>First <c>title</c> and <c>desc</c> of the current <c>programme</c>; leaves the reader on its end.</summary>
    private static async Task<(string? Title, string? Description)> ReadTextsAsync(XmlReader reader)
    {
        if (reader.IsEmptyElement)
        {
            return (null, null);
        }

        string? title = null, description = null;
        var depth = reader.Depth;
        await reader.ReadAsync();
        while (!reader.EOF && reader.Depth > depth)
        {
            if (reader.NodeType == XmlNodeType.Element && reader.Depth == depth + 1 && reader.LocalName is "title" or "desc")
            {
                var name = reader.LocalName;
                // Advances past the element's end tag.
                var text = await reader.ReadElementContentAsStringAsync();
                if (name == "title") title ??= text;
                else description ??= text;
                continue;
            }
            await reader.ReadAsync();
        }
        return (title, description);
    }

    /// <summary>XMLTV time: <c>yyyyMMddHHmmss</c> with optional <c>±HHmm</c> offset (UTC when absent).</summary>
    public static DateTimeOffset? ParseTime(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var parts = value.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var stamp = parts[0];
        if (stamp.Length < 12 || !DateTime.TryParseExact(stamp.Length >= 14 ? stamp[..14] : stamp[..12] + "00",
                "yyyyMMddHHmmss", CultureInfo.InvariantCulture, DateTimeStyles.None, out var local))
        {
            return null;
        }

        var offset = TimeSpan.Zero;
        if (parts.Length > 1 && parts[1].Length == 5 && (parts[1][0] == '+' || parts[1][0] == '-')
            && int.TryParse(parts[1].AsSpan(1, 2), out var hours) && int.TryParse(parts[1].AsSpan(3, 2), out var minutes))
        {
            offset = new TimeSpan(hours, minutes, 0) * (parts[1][0] == '-' ? -1 : 1);
        }

        return new DateTimeOffset(local, offset);
    }
}
