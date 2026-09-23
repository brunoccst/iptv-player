using Backend.Core.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Backend.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<ProviderAccount> ProviderAccounts => Set<ProviderAccount>();
    public DbSet<Profile> Profiles => Set<Profile>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();

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
