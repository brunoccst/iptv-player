using System.Globalization;
using System.Net;
using System.Text;
using System.Text.Json;
using Backend.Core.Epg;
using Backend.Core.Media;
using Backend.Core.Providers;
using Backend.Infrastructure.Epg;

namespace Backend.Infrastructure.Xtream;

/// <summary>
/// <see cref="IMediaProvider"/> for Xtream Codes panels (<c>player_api.php</c>). See DECISIONS.md#d-011.
/// </summary>
public sealed class XtreamCodesProvider(HttpClient httpClient) : IMediaProvider
{
    public const string Type = "xtream";

    private static readonly string[] KnownEndpointFiles = ["player_api.php", "get.php", "xmltv.php", "panel_api.php"];

    public string ProviderType => Type;

    public Uri NormalizeServerUrl(string serverUrl)
    {
        var text = serverUrl?.Trim() ?? string.Empty;
        if (text.Length == 0)
        {
            throw new ArgumentException("Server URL is required.", nameof(serverUrl));
        }

        if (!text.Contains("://", StringComparison.Ordinal))
        {
            text = "http://" + text;
        }

        if (!Uri.TryCreate(text, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new ArgumentException("Server URL must be an http(s) address.", nameof(serverUrl));
        }

        var path = uri.AbsolutePath.TrimEnd('/');
        var lastSegment = path[(path.LastIndexOf('/') + 1)..];
        if (KnownEndpointFiles.Contains(lastSegment, StringComparer.OrdinalIgnoreCase))
        {
            path = path[..path.LastIndexOf('/')];
        }

        return new UriBuilder(uri.Scheme, uri.Host, uri.Port, path + "/").Uri;
    }

    public async Task<ProviderAccountInfo> ValidateAsync(ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, action: null, parameters: null, cancellationToken);
        var root = document.RootElement;
        var userInfo = root.Property("user_info");

        if (userInfo is null || !userInfo.Value.Bool("auth"))
        {
            throw new ProviderAuthenticationException("Invalid username or password.");
        }

        var status = userInfo.Value.String("status") ?? "Unknown";
        if (!status.Equals("Active", StringComparison.OrdinalIgnoreCase))
        {
            throw new ProviderAuthenticationException($"Provider account status is '{status}'.");
        }

        return new ProviderAccountInfo(
            status,
            userInfo.Value.UnixTime("exp_date"),
            userInfo.Value.Int("max_connections"),
            userInfo.Value.Int("active_cons"),
            userInfo.Value.StringList("allowed_output_formats"));
    }

    public async Task<IReadOnlyList<MediaCategory>> GetCategoriesAsync(ProviderCredentials credentials, MediaKind kind, CancellationToken cancellationToken)
    {
        var action = kind switch
        {
            MediaKind.Live => "get_live_categories",
            MediaKind.Movie => "get_vod_categories",
            MediaKind.Series => "get_series_categories",
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null),
        };

        using var document = await GetJsonAsync(credentials, action, parameters: null, cancellationToken);
        return document.RootElement.ArrayItems()
            .Select(item => (Id: item.String("category_id"), Name: item.String("category_name")))
            .Where(item => item.Id is not null)
            .Select(item => new MediaCategory(item.Id!, item.Name ?? item.Id!, kind))
            .ToList();
    }

    public async Task<IReadOnlyList<LiveChannel>> GetLiveChannelsAsync(ProviderCredentials credentials, string? categoryId, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, "get_live_streams", CategoryFilter(categoryId), cancellationToken);
        return document.RootElement.ArrayItems()
            .Where(item => item.String("stream_id") is not null)
            .Select(item => new LiveChannel(
                item.String("stream_id")!,
                item.String("name") ?? string.Empty,
                item.String("category_id"),
                item.Int("num"),
                item.String("stream_icon"),
                item.String("epg_channel_id"),
                item.Bool("tv_archive")))
            .ToList();
    }

    public async Task<IReadOnlyList<MovieSummary>> GetMoviesAsync(ProviderCredentials credentials, string? categoryId, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, "get_vod_streams", CategoryFilter(categoryId), cancellationToken);
        return document.RootElement.ArrayItems()
            .Where(item => item.String("stream_id") is not null)
            .Select(ReadMovieSummary)
            .ToList();
    }

    public async Task<MovieDetails?> GetMovieAsync(ProviderCredentials credentials, string movieId, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, "get_vod_info", new() { ["vod_id"] = movieId }, cancellationToken);
        var root = document.RootElement;
        var movieData = root.Property("movie_data");
        if (movieData is null || movieData.Value.String("stream_id") is null)
        {
            return null;
        }

        // `info` is an object on success but `[]` on some panels when empty.
        var info = root.Property("info") is { ValueKind: JsonValueKind.Object } infoElement ? infoElement : default;
        var summary = ReadMovieSummary(movieData.Value) with
        {
            PosterUrl = info.String("movie_image") ?? info.String("cover_big"),
            Rating = info.Double("rating"),
        };

        return new MovieDetails(
            summary,
            info.String("plot") ?? info.String("description"),
            info.String("genre"),
            info.String("cast") ?? info.String("actors"),
            info.String("director"),
            info.String("releasedate") ?? info.String("release_date"),
            info.Int("duration_secs"),
            info.StringList("backdrop_path"),
            info.String("youtube_trailer"),
            info.String("tmdb_id"));
    }

    public async Task<IReadOnlyList<SeriesSummary>> GetSeriesAsync(ProviderCredentials credentials, string? categoryId, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, "get_series", CategoryFilter(categoryId), cancellationToken);
        return document.RootElement.ArrayItems()
            .Where(item => item.String("series_id") is not null)
            .Select(item => ReadSeriesSummary(item, item.String("series_id")!))
            .ToList();
    }

    public async Task<SeriesDetails?> GetSeriesDetailsAsync(ProviderCredentials credentials, string seriesId, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, "get_series_info", new() { ["series_id"] = seriesId }, cancellationToken);
        var root = document.RootElement;
        if (root.Property("info") is not { ValueKind: JsonValueKind.Object } info)
        {
            return null;
        }

        var episodesBySeason = ReadEpisodes(root.Property("episodes"));
        var seasonMeta = root.Property("seasons")?.ArrayItems()
            .Where(season => season.Int("season_number") is not null)
            .GroupBy(season => season.Int("season_number")!.Value)
            .ToDictionary(group => group.Key, group => group.First())
            ?? [];

        var seasons = episodesBySeason.Keys.Union(seasonMeta.Keys)
            .Order()
            .Select(number =>
            {
                seasonMeta.TryGetValue(number, out var meta);
                return new Season(
                    number,
                    meta.String("name") ?? $"Season {number}",
                    meta.String("cover_big") ?? meta.String("cover"),
                    episodesBySeason.GetValueOrDefault(number) ?? []);
            })
            .Where(season => season.Episodes.Count > 0)
            .ToList();

        return new SeriesDetails(
            ReadSeriesSummary(info, seriesId),
            info.String("cast"),
            info.String("director"),
            info.StringList("backdrop_path"),
            info.String("youtube_trailer"),
            seasons);
    }

    public async Task<Stream> OpenXmltvAsync(ProviderCredentials credentials, CancellationToken cancellationToken)
    {
        var response = await SendAsync(credentials, "xmltv.php", [], "xmltv", cancellationToken);
        try
        {
            var body = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await GzipSniffer.OpenAsync(new OwnedStream(body, response), cancellationToken);
        }
        catch
        {
            response.Dispose();
            throw;
        }
    }

    public async Task<IReadOnlyList<EpgProgramme>> GetShortEpgAsync(
        ProviderCredentials credentials, string channelId, int limit, CancellationToken cancellationToken)
    {
        using var document = await GetJsonAsync(credentials, "get_short_epg",
            new() { ["stream_id"] = channelId, ["limit"] = limit.ToString(CultureInfo.InvariantCulture) }, cancellationToken);
        var key = EpgChannelKeys.ForStream(channelId);
        return (document.RootElement.Property("epg_listings") ?? default).ArrayItems()
            .Select(item => (Start: item.UnixTime("start_timestamp"), End: item.UnixTime("stop_timestamp"), Title: DecodeBase64(item.String("title")),
                Description: DecodeBase64(item.String("description"))))
            .Where(item => item.Start is not null && item.End > item.Start && !string.IsNullOrWhiteSpace(item.Title))
            .Select(item => new EpgProgramme(key, item.Start!.Value, item.End!.Value, item.Title!, item.Description))
            .ToList();
    }

    /// <summary>Short EPG titles are base64 on most panels and plain text on some.</summary>
    private static string? DecodeBase64(string? value)
    {
        if (value is null)
        {
            return null;
        }

        var buffer = new byte[value.Length];
        if (!Convert.TryFromBase64String(value, buffer, out var written) || written == 0)
        {
            return value;
        }

        try
        {
            var text = StrictUtf8.GetString(buffer, 0, written).Trim();
            // Plain words like "News" are also valid base64; garbage output means the value was plain text.
            return text.Length == 0 || text.Any(char.IsControl) ? value : text;
        }
        catch (DecoderFallbackException)
        {
            return value;
        }
    }

    private static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public PlaybackSource BuildPlaybackSource(ProviderCredentials credentials, PlaybackRequest request, ProviderAccountInfo? accountInfo)
    {
        var (segment, container, isLive) = request.Kind switch
        {
            PlaybackKind.Live => ("live", ChooseLiveContainer(request.Container, accountInfo), true),
            PlaybackKind.Movie => ("movie", SanitizeContainer(request.Container) ?? "mp4", false),
            PlaybackKind.Episode => ("series", SanitizeContainer(request.Container) ?? "mp4", false),
            _ => throw new ArgumentOutOfRangeException(nameof(request), request.Kind, null),
        };

        var path = string.Join('/',
            segment,
            Uri.EscapeDataString(credentials.Username),
            Uri.EscapeDataString(credentials.Password),
            $"{Uri.EscapeDataString(request.Id)}.{container}");

        return new PlaybackSource(new Uri(credentials.ServerUrl, path), container, isLive);
    }

    private static string ChooseLiveContainer(string? requested, ProviderAccountInfo? accountInfo)
    {
        var allowed = accountInfo?.AllowedOutputFormats ?? [];
        var preferred = SanitizeContainer(requested) ?? "m3u8";
        if (allowed.Count == 0 || allowed.Contains(preferred, StringComparer.OrdinalIgnoreCase))
        {
            return preferred;
        }

        return allowed.Contains("m3u8", StringComparer.OrdinalIgnoreCase) ? "m3u8" : "ts";
    }

    private static string? SanitizeContainer(string? container)
    {
        var value = container?.Trim().TrimStart('.').ToLowerInvariant();
        return !string.IsNullOrEmpty(value) && value.Length <= 8 && value.All(char.IsAsciiLetterOrDigit) ? value : null;
    }

    private static Dictionary<string, string>? CategoryFilter(string? categoryId) =>
        string.IsNullOrWhiteSpace(categoryId) ? null : new() { ["category_id"] = categoryId };

    private static MovieSummary ReadMovieSummary(JsonElement item) => new(
        item.String("stream_id")!,
        item.String("name") ?? string.Empty,
        item.String("category_id"),
        item.String("stream_icon"),
        item.Double("rating"),
        item.UnixTime("added"),
        item.String("container_extension"),
        TmdbId(item));

    private static SeriesSummary ReadSeriesSummary(JsonElement item, string seriesId) => new(
        seriesId,
        item.String("name") ?? string.Empty,
        item.String("category_id"),
        item.String("cover"),
        item.Double("rating"),
        item.String("plot"),
        item.String("genre"),
        item.String("releaseDate") ?? item.String("release_date"),
        item.UnixTime("last_modified"),
        TmdbId(item));

    /// <summary>Some panels send the TMDB id in their lists (<c>tmdb</c> or <c>tmdb_id</c>); used to merge translated titles (D-065).</summary>
    private static string? TmdbId(JsonElement item) => item.String("tmdb") ?? item.String("tmdb_id");

    /// <summary>Handles <c>episodes</c> as <c>{"1": [...]}</c> or as <c>[[...], [...]]</c> (both occur in the wild).</summary>
    private static Dictionary<int, List<Episode>> ReadEpisodes(JsonElement? episodes)
    {
        IEnumerable<JsonElement> groups = episodes?.ValueKind switch
        {
            JsonValueKind.Object => episodes.Value.EnumerateObject().Select(property => property.Value),
            JsonValueKind.Array => episodes.Value.EnumerateArray(),
            _ => [],
        };

        return groups
            .SelectMany(group => group.ArrayItems())
            .Where(item => item.String("id") is not null && item.Int("season") is not null)
            .Select(item =>
            {
                var info = item.Property("info") is { ValueKind: JsonValueKind.Object } infoElement ? infoElement : default;
                return new Episode(
                    item.String("id")!,
                    item.Int("season")!.Value,
                    item.Int("episode_num"),
                    item.String("title") ?? string.Empty,
                    info.String("plot"),
                    info.Int("duration_secs"),
                    info.String("movie_image"),
                    item.String("container_extension"));
            })
            .GroupBy(episode => episode.SeasonNumber)
            .ToDictionary(group => group.Key, group => group.OrderBy(episode => episode.EpisodeNumber ?? int.MaxValue).ToList());
    }

    private async Task<JsonDocument> GetJsonAsync(
        ProviderCredentials credentials,
        string? action,
        Dictionary<string, string>? parameters,
        CancellationToken cancellationToken)
    {
        var query = new Dictionary<string, string>();
        if (action is not null)
        {
            query["action"] = action;
        }
        foreach (var (key, value) in parameters ?? [])
        {
            query[key] = value;
        }

        var operation = action ?? "login";
        using var response = await SendAsync(credentials, "player_api.php", query, operation, cancellationToken);
        try
        {
            await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
            return await JsonDocument.ParseAsync(body, cancellationToken: cancellationToken);
        }
        catch (JsonException exception)
        {
            throw new ProviderUnavailableException($"Provider returned invalid JSON for '{operation}'.", exception);
        }
    }

    /// <summary>GET with credentials in the query. Maps network and HTTP failures to provider exceptions.</summary>
    private async Task<HttpResponseMessage> SendAsync(
        ProviderCredentials credentials,
        string file,
        Dictionary<string, string> parameters,
        string operation,
        CancellationToken cancellationToken)
    {
        var query = new Dictionary<string, string>
        {
            ["username"] = credentials.Username,
            ["password"] = credentials.Password,
        };
        foreach (var (key, value) in parameters)
        {
            query[key] = value;
        }

        var queryString = string.Join('&', query.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value)}"));
        var requestUri = new Uri(credentials.ServerUrl, file + "?" + queryString);

        HttpResponseMessage response;
        try
        {
            response = await httpClient.GetAsync(requestUri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            throw new ProviderUnavailableException($"Could not reach provider at {credentials.ServerUrl.Host}.", exception);
        }

        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            response.Dispose();
            throw new ProviderAuthenticationException("Provider rejected the credentials.");
        }

        if (!response.IsSuccessStatusCode)
        {
            response.Dispose();
            throw new ProviderUnavailableException($"Provider returned HTTP {(int)response.StatusCode} for '{operation}'.");
        }

        return response;
    }
}
