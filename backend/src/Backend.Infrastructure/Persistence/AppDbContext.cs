using Backend.Core.Accounts;
using Backend.Core.Epg;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Backend.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ProviderAccount> ProviderAccounts => Set<ProviderAccount>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<WatchProgress> WatchProgress => Set<WatchProgress>();
    public DbSet<EpgProgrammeRow> EpgProgrammes => Set<EpgProgrammeRow>();
    public DbSet<EpgState> EpgStates => Set<EpgState>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProviderAccount>(account =>
        {
            account.HasIndex(a => new { a.ProviderType, a.ServerUrl, a.Username }).IsUnique();
            account.Property(a => a.ProviderType).HasMaxLength(32);
            account.Property(a => a.ServerUrl).HasMaxLength(512);
            account.Property(a => a.Username).HasMaxLength(256);
            account.HasMany(a => a.Profiles).WithOne(p => p.Account).HasForeignKey(p => p.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Profile>(profile =>
        {
            profile.Property(p => p.Name).HasMaxLength(ProfileLimits.MaxNameLength);
            profile.Property(p => p.AvatarKey).HasMaxLength(64);
        });

        modelBuilder.Entity<UserSession>(session =>
        {
            session.HasIndex(s => s.TokenHash).IsUnique();
            session.HasOne(s => s.Account).WithMany().HasForeignKey(s => s.AccountId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<WatchProgress>(progress =>
        {
            progress.HasIndex(p => new { p.ProfileId, p.Kind, p.ItemId }).IsUnique();
            progress.HasIndex(p => new { p.ProfileId, p.UpdatedAt });
            progress.Property(p => p.Kind).HasMaxLength(16);
            progress.Property(p => p.ItemId).HasMaxLength(64);
            progress.Property(p => p.Title).HasMaxLength(300);
            progress.HasOne(p => p.Profile).WithMany().HasForeignKey(p => p.ProfileId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<EpgProgrammeRow>(programme =>
        {
            programme.ToTable("EpgProgrammes");
            programme.HasIndex(p => new { p.AccountId, p.ChannelKey, p.Start });
            programme.Property(p => p.AccountId).HasMaxLength(36);
            programme.Property(p => p.ChannelKey).HasMaxLength(200);
            programme.Property(p => p.Title).HasMaxLength(300);
            programme.Property(p => p.Description).HasMaxLength(2000);
        });

        modelBuilder.Entity<EpgState>(state =>
        {
            state.HasKey(s => s.AccountId);
            state.Property(s => s.AccountId).HasMaxLength(36);
            state.Property(s => s.LastError).HasMaxLength(500);
        });

        // SQLite cannot ORDER BY or compare DateTimeOffset; store as UTC ticks.
        var converter = new ValueConverter<DateTimeOffset, long>(value => value.UtcTicks, ticks => new DateTimeOffset(ticks, TimeSpan.Zero));
        foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(type => type.GetProperties())
                     .Where(property => property.ClrType == typeof(DateTimeOffset) || property.ClrType == typeof(DateTimeOffset?)))
        {
            property.SetValueConverter(converter);
        }
    }
}

/// <summary>Profile limits shared by persistence and API validation.</summary>
public static class ProfileLimits
{
    public const int MaxNameLength = 50;
    public const int MaxPerAccount = 5;
}
