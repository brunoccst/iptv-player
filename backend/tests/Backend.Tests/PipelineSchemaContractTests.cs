using Backend.Infrastructure.Pipeline;
using Microsoft.EntityFrameworkCore;

namespace Backend.Tests;

/// <summary>Keeps the committed pipeline schema snapshot (used by Python tests) identical to the EF model.</summary>
public class PipelineSchemaContractTests
{
    public const string UpdateVariable = "UPDATE_PIPELINE_SCHEMA";

    [Fact]
    public void SchemaSnapshot_MatchesEfModel()
    {
        var options = new DbContextOptionsBuilder<PipelineDbContext>().UseSqlite("Data Source=:memory:").Options;
        using var db = new PipelineDbContext(options);
        var expected = Normalize(db.Database.GenerateCreateScript());
        var snapshotPath = Path.Combine(RepoRoot(), "backend", "src", "Backend.Infrastructure", "Pipeline", "pipeline-schema.sql");

        if (Environment.GetEnvironmentVariable(UpdateVariable) == "1")
        {
            File.WriteAllText(snapshotPath, expected);
        }

        Assert.True(File.Exists(snapshotPath), $"Missing {snapshotPath}. Run tests with {UpdateVariable}=1 to create it.");
        Assert.True(expected == Normalize(File.ReadAllText(snapshotPath)),
            $"pipeline-schema.sql is stale. Run `{UpdateVariable}=1 dotnet test backend/Backend.sln` and commit the file.");
    }

    private static string Normalize(string sql) => sql.Replace("\r\n", "\n").Trim() + "\n";

    private static string RepoRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "turbo.json")))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException("Repository root (turbo.json) not found.");
    }
}
