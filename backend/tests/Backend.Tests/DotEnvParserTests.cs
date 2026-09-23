using Backend.Core.Configuration;

namespace Backend.Tests;

public class DotEnvParserTests
{
    [Fact]
    public void Parse_ReadsKeyValues_SkipsCommentsAndInvalidLines()
    {
        var result = DotEnvParser.Parse(new[]
        {
            "# comment",
            "",
            "APP_NAME=My App",
            "QUOTED=\"with spaces\"",
            "EMPTY=",
            "not-a-pair",
            "=missing-key",
        });

        Assert.Equal("My App", result["APP_NAME"]);
        Assert.Equal("with spaces", result["QUOTED"]);
        Assert.Equal(string.Empty, result["EMPTY"]);
        Assert.Equal(3, result.Count);
    }

    [Fact]
    public void Parse_KeepsEqualsSignsInsideValue()
    {
        var result = DotEnvParser.Parse(new[] { "URL=https://x.test/?a=1&b=2" });

        Assert.Equal("https://x.test/?a=1&b=2", result["URL"]);
    }
}
