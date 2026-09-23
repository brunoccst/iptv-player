using System.Net;
using System.Net.Http.Headers;
using System.Text;

namespace Backend.Tests.Support;

/// <summary>Minimal Xtream Codes panel: login, catalog actions, HLS playlist and a byte-range segment.</summary>
public static class FakeXtreamServer
{
    public const string BaseUrl = "http://provider.test:8080/";
    public const string Username = "good";
    public const string Password = "p@ss/word";

    public static readonly byte[] SegmentBytes = Enumerable.Range(0, 100).Select(i => (byte)i).ToArray();

    public static HttpResponseMessage Handle(HttpRequestMessage request)
    {
        var uri = request.RequestUri!;
        if (uri.AbsolutePath == "/player_api.php")
        {
            var valid = StubHttpHandler.Query(request, "username") == Username && StubHttpHandler.Query(request, "password") == Password;
            if (!valid)
            {
                return StubHttpHandler.Json("""{"user_info":{"auth":0}}""");
            }

            return StubHttpHandler.Query(request, "action") switch
            {
                null => StubHttpHandler.Json(XtreamFixtures.LoginActive),
                "get_vod_categories" => StubHttpHandler.Json(XtreamFixtures.VodCategories),
                "get_vod_streams" => StubHttpHandler.Json(XtreamFixtures.VodStreams),
                "get_vod_info" => StubHttpHandler.Json(XtreamFixtures.VodInfo),
                "get_live_streams" => StubHttpHandler.Json(XtreamFixtures.LiveStreams),
                "get_series_info" when StubHttpHandler.Query(request, "series_id") == "7" => StubHttpHandler.Json(XtreamFixtures.SeriesInfoObjectEpisodes),
                "get_series_info" => StubHttpHandler.Json("""{"seasons":[],"info":[],"episodes":[]}"""),
                _ => StubHttpHandler.Json("[]"),
            };
        }

        if (uri.AbsolutePath == $"/live/{Username}/{Uri.EscapeDataString(Password)}/42.m3u8")
        {
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6.0,\nseg/1.ts\n", Encoding.UTF8, "application/vnd.apple.mpegurl"),
            };
        }

        if (uri.AbsolutePath == $"/live/{Username}/{Uri.EscapeDataString(Password)}/seg/1.ts")
        {
            return RangeResponse(request);
        }

        return new HttpResponseMessage(HttpStatusCode.NotFound);
    }

    private static HttpResponseMessage RangeResponse(HttpRequestMessage request)
    {
        var range = request.Headers.Range?.Ranges.FirstOrDefault();
        if (range is null)
        {
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = Bytes(SegmentBytes) };
        }

        var from = (int)(range.From ?? 0);
        var to = (int)(range.To ?? SegmentBytes.Length - 1);
        var content = Bytes(SegmentBytes[from..(to + 1)]);
        content.Headers.ContentRange = new ContentRangeHeaderValue(from, to, SegmentBytes.Length);
        return new HttpResponseMessage(HttpStatusCode.PartialContent) { Content = content };
    }

    private static ByteArrayContent Bytes(byte[] bytes)
    {
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue("video/mp2t");
        return content;
    }
}
