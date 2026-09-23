using System.Text;
using Backend.Core.Library;
using Microsoft.EntityFrameworkCore;

namespace Backend.Infrastructure.Pipeline;

/// <summary>
/// Owns the <c>pipeline.db</c> schema (snake_case names, read/written by Python too). See DECISIONS.md#d-016.
/// </summary>
public sealed class PipelineDbContext(DbContextOptions<PipelineDbContext> options) : DbContext(options)
{
    public DbSet<NormalizationJob> NormalizationJobs => Set<NormalizationJob>();
    public DbSet<MasterMedia> MasterMedia => Set<MasterMedia>();
    public DbSet<MediaVariant> MediaVariants => Set<MediaVariant>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<NormalizationJob>(job =>
        {
            job.ToTable("normalization_jobs");
            job.HasIndex(j => new { j.Status, j.Id });
            job.HasIndex(j => new { j.AccountId, j.MediaKind, j.Status });
        });

        modelBuilder.Entity<MasterMedia>(master =>
        {
            master.ToTable("master_media");
            master.HasIndex(m => new { m.AccountId, m.MediaKind, m.Title });
            master.HasMany(m => m.Variants).WithOne(v => v.Master).HasForeignKey(v => v.MasterId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<MediaVariant>(variant =>
        {
            variant.ToTable("media_variants");
            variant.HasKey(v => new { v.AccountId, v.MediaKind, v.StreamId });
            variant.HasIndex(v => new { v.AccountId, v.MediaKind, v.CategoryId });
        });

        foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(type => type.GetProperties()))
        {
            property.SetColumnName(ToSnakeCase(property.Name));
        }
    }

    public static string ToSnakeCase(string name)
    {
        var builder = new StringBuilder(name.Length + 8);
        for (var i = 0; i < name.Length; i++)
        {
            if (char.IsUpper(name[i]) && i > 0)
            {
                builder.Append('_');
            }

            builder.Append(char.ToLowerInvariant(name[i]));
        }

        return builder.ToString();
    }
}
