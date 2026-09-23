using System.Text;
using System.Text.RegularExpressions;

namespace Backend.Core.Streaming;

/// <summary>Rewrites every URI in an HLS playlist (segment lines and <c>URI="..."</c> attributes).</summary>
public static partial class HlsPlaylistRewriter
{
    public static bool LooksLikePlaylist(string? contentType, Uri url) =>
        (contentType?.Contains("mpegurl", StringComparison.OrdinalIgnoreCase) ?? false)
        || url.AbsolutePath.EndsWith(".m3u8", StringComparison.OrdinalIgnoreCase);

    /// <param name="baseUri">Final playlist URL after redirects. Relative URIs resolve against it.</param>
    /// <param name="mapUri">Maps an absolute upstream URI to the URI written into the output.</param>
    public static string Rewrite(string playlist, Uri baseUri, Func<Uri, string> mapUri)
    {
        var output = new StringBuilder(playlist.Length * 2);

        foreach (var rawLine in playlist.Split('\n'))
        {
            var line = rawLine.TrimEnd('\r');
            var trimmed = line.Trim();

            if (trimmed.Length == 0)
            {
                output.Append('\n');
                continue;
            }

            if (trimmed.StartsWith('#'))
            {
                output.Append(UriAttributeRegex().Replace(line, match =>
                    $"URI=\"{mapUri(new Uri(baseUri, match.Groups[1].Value))}\"")).Append('\n');
                continue;
            }

            output.Append(mapUri(new Uri(baseUri, trimmed))).Append('\n');
        }

        return output.ToString().TrimEnd('\n') + "\n";
    }

    [GeneratedRegex("URI=\"([^\"]+)\"", RegexOptions.IgnoreCase)]
    private static partial Regex UriAttributeRegex();
}
