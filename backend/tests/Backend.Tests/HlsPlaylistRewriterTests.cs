using Backend.Core.Streaming;

namespace Backend.Tests;

public class HlsPlaylistRewriterTests
{
    private static readonly Uri BaseUri = new("http://cdn.test/hls/abc/index.m3u8?token=1");

    [Fact]
    public void Rewrite_MapsSegmentLinesAndUriAttributes_KeepsOtherTags()
    {
        const string playlist = "#EXTM3U\r\n#EXT-X-KEY:METHOD=AES-128,URI=\"key.bin\",IV=0x1\r\n#EXTINF:6.0,\r\nseg1.ts\r\n\r\n#EXTINF:6.0,\r\n/root/seg2.ts\r\nhttps://other.test/seg3.ts\r\n";

        var result = HlsPlaylistRewriter.Rewrite(playlist, BaseUri, uri => $"R[{uri.AbsoluteUri}]");

        Assert.Equal(
            "#EXTM3U\n" +
            "#EXT-X-KEY:METHOD=AES-128,URI=\"R[http://cdn.test/hls/abc/key.bin]\",IV=0x1\n" +
            "#EXTINF:6.0,\n" +
            "R[http://cdn.test/hls/abc/seg1.ts]\n" +
            "\n" +
            "#EXTINF:6.0,\n" +
            "R[http://cdn.test/root/seg2.ts]\n" +
            "R[https://other.test/seg3.ts]\n",
            result);
    }

    [Fact]
    public void Rewrite_HandlesMasterPlaylistMediaTags()
    {
        const string playlist = "#EXTM3U\n#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID=\"a\",URI=\"audio/eng.m3u8\"\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvideo/720.m3u8";

        var result = HlsPlaylistRewriter.Rewrite(playlist, BaseUri, uri => uri.AbsolutePath);

        Assert.Contains("URI=\"/hls/abc/audio/eng.m3u8\"", result);
        Assert.EndsWith("/hls/abc/video/720.m3u8\n", result);
    }

    [Theory]
    [InlineData("application/vnd.apple.mpegurl", "http://x/a", true)]
    [InlineData("audio/x-mpegURL", "http://x/a", true)]
    [InlineData(null, "http://x/a/index.M3U8", true)]
    [InlineData("video/mp2t", "http://x/a/1.ts", false)]
    public void LooksLikePlaylist_UsesContentTypeOrExtension(string? contentType, string url, bool expected)
    {
        Assert.Equal(expected, HlsPlaylistRewriter.LooksLikePlaylist(contentType, new Uri(url)));
    }
}
