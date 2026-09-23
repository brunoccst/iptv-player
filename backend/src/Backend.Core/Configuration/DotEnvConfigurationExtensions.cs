using Microsoft.Extensions.Configuration;

namespace Backend.Core.Configuration;

public static class DotEnvConfigurationExtensions
{
    /// <summary>Config key holding the directory of the loaded <c>.env</c>. Relative paths in <c>.env</c> resolve against it.</summary>
    public const string DotEnvDirectoryKey = "DOTENV_DIRECTORY";

    /// <summary>Loads the nearest <c>.env</c> above <paramref name="startDirectory"/>, then <c>.env.local</c>.</summary>
    /// <remarks>Env vars are re-added last so they win. See DECISIONS.md#d-003.</remarks>
    public static IConfigurationBuilder AddRootDotEnv(this IConfigurationBuilder builder, string startDirectory)
    {
        var envDirectory = FindDirectoryContaining(startDirectory, ".env");
        if (envDirectory is null)
        {
            return builder;
        }

        builder.AddInMemoryCollection([new KeyValuePair<string, string?>(DotEnvDirectoryKey, envDirectory)]);

        foreach (var fileName in new[] { ".env", ".env.local" })
        {
            var path = Path.Combine(envDirectory, fileName);
            if (File.Exists(path))
            {
                builder.AddInMemoryCollection(
                    DotEnvParser.Parse(File.ReadAllLines(path)).Select(pair => new KeyValuePair<string, string?>(pair.Key, pair.Value)));
            }
        }

        return builder.AddEnvironmentVariables();
    }

    private static string? FindDirectoryContaining(string startDirectory, string fileName)
    {
        for (var directory = new DirectoryInfo(startDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, fileName)))
            {
                return directory.FullName;
            }
        }

        return null;
    }
}
