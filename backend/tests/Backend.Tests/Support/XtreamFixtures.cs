namespace Backend.Tests.Support;

/// <summary>Trimmed real-world Xtream responses, including the type inconsistencies panels produce.</summary>
public static class XtreamFixtures
{
    public const string LoginActive = """
        {"user_info":{"username":"good","auth":1,"status":"Active","exp_date":"1893456000","max_connections":"2",
          "active_cons":0,"allowed_output_formats":["m3u8","ts"]},
         "server_info":{"url":"provider.test","port":"8080","timezone":"UTC"}}
        """;

    public const string LoginExpired = """
        {"user_info":{"auth":1,"status":"Expired","exp_date":null,"max_connections":"1","allowed_output_formats":[]}}
        """;

    public const string VodCategories = """
        [{"category_id":"10","category_name":"Action","parent_id":0},{"category_id":null,"category_name":"Broken"}]
        """;

    public const string VodStreams = """
        [
          {"num":1,"name":"The Movie (2020) 4K","stream_type":"movie","stream_id":55,"stream_icon":"http://img/55.jpg",
           "rating":"7.1","added":"1600000000","category_id":"10","container_extension":"mkv"},
          {"num":2,"name":"Other","stream_id":"56","rating":"","added":null,"category_id":10,"container_extension":"mp4"},
          {"num":3,"name":"No id"}
        ]
        """;

    public const string VodInfo = """
        {"info":{"movie_image":"http://img/55-big.jpg","tmdb_id":"123","backdrop_path":["http://img/bd1.jpg",""],
                 "youtube_trailer":"abc","genre":"Action","plot":"Plot.","cast":"A, B","director":"D","releasedate":"2020-01-01",
                 "duration_secs":5400,"rating":"7.5"},
         "movie_data":{"stream_id":55,"name":"The Movie (2020) 4K","added":"1600000000","category_id":"10","container_extension":"mkv"}}
        """;

    public const string VodInfoEmptyInfo = """
        {"info":[],"movie_data":{"stream_id":"77","name":"Bare","container_extension":"mp4"}}
        """;

    public const string LiveStreams = """
        [{"num":1,"name":"News HD","stream_type":"live","stream_id":42,"stream_icon":"http://img/42.png",
          "epg_channel_id":"news.us","category_id":"5","tv_archive":1},
         {"num":"2","name":"Sports","stream_id":"43","epg_channel_id":null,"category_id":"5","tv_archive":"0"}]
        """;

    public const string SeriesInfoObjectEpisodes = """
        {"seasons":[{"season_number":1,"name":"Season One","cover":"http://img/s1.jpg"},{"season_number":2,"name":"Empty"}],
         "info":{"name":"Show","cover":"http://img/show.jpg","plot":"Series plot","genre":"Drama","rating":"8","category_id":"3",
                 "backdrop_path":"http://img/show-bd.jpg","last_modified":"1600000000"},
         "episodes":{"1":[
            {"id":"1002","episode_num":2,"title":"Show S01E02","container_extension":"mkv","season":1,"info":{"duration_secs":2700}},
            {"id":"1001","episode_num":"1","title":"Show S01E01","container_extension":"mkv","season":"1","info":[]}
         ]}}
        """;

    public const string SeriesInfoArrayEpisodes = """
        {"seasons":[],"info":{"name":"Show"},
         "episodes":[[{"id":"2001","episode_num":1,"title":"E1","season":3,"container_extension":"mp4"}]]}
        """;

    /// <summary>XMLTV guide for <c>news.us</c> (upper-case id, like real feeds): hourly shows from one hour before <paramref name="now"/>.</summary>
    public static string Xmltv(DateTimeOffset now)
    {
        var hour = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, 0, 0, TimeSpan.Zero);
        var programmes = string.Concat(Enumerable.Range(-1, 6).Select(i =>
            $"""
            <programme start="{hour.AddHours(i):yyyyMMddHHmmss} +0000" stop="{hour.AddHours(i + 1):yyyyMMddHHmmss} +0000" channel="NEWS.us">
              <title lang="en">News at {i}</title><title lang="es">Noticias</title><desc>Headlines &amp; weather.</desc>
            </programme>
            """));
        return $"""
            <?xml version="1.0" encoding="UTF-8"?>
            <!DOCTYPE tv SYSTEM "xmltv.dtd">
            <tv><channel id="NEWS.us"><display-name>News</display-name></channel>{programmes}</tv>
            """;
    }

    /// <summary><c>get_short_epg</c> with base64 titles (as real panels send) for a channel without an XMLTV id.</summary>
    public static string ShortEpg(DateTimeOffset now)
    {
        static string B64(string text) => Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(text));
        var start = now.AddMinutes(-20).ToUnixTimeSeconds();
        return $$"""
            {"epg_listings":[
              {"title":"{{B64("Live Match")}}","description":"{{B64("Final.")}}","start_timestamp":"{{start}}","stop_timestamp":"{{start + 7200}}"},
              {"title":"{{B64("Post-game")}}","description":"","start_timestamp":"{{start + 7200}}","stop_timestamp":"{{start + 9000}}"}]}
            """;
    }
}
