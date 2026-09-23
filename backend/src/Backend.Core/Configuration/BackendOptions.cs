namespace Backend.Core.Configuration;

public enum StreamDeliveryMode
{
    /// <summary>Clients receive backend relay URLs. Provider credentials stay server-side.</summary>
    Relay,

    /// <summary>Clients receive upstream URLs, which embed provider credentials.</summary>
    Direct,
}

/// <summary>Backend-only settings. Env keys listed in <see cref="EnvKeys"/>.</summary>
public sealed class BackendOptions
{
    public static class EnvKeys
    {
        public const string DataDirectory = "BACKEND_DATA_DIR";
        public const string StreamDelivery = "BACKEND_STREAM_DELIVERY";
        public const string CorsOrigins = "BACKEND_CORS_ORIGINS";
        public const string SessionDays = "BACKEND_SESSION_DAYS";
        public const string RelayTokenHours = "BACKEND_RELAY_TOKEN_HOURS";
        public const string ProviderUserAgent = "BACKEND_PROVIDER_USER_AGENT";
        public const string CatalogCacheMinutes = "BACKEND_CATALOG_CACHE_MINUTES";
    }

    /// <summary>Absolute path for the SQLite database and Data Protection keys.</summary>
    public string DataDirectory { get; set; } = string.Empty;

    public StreamDeliveryMode StreamDelivery { get; set; } = StreamDeliveryMode.Relay;

    public string[] CorsOrigins { get; set; } = [];

    public int SessionDays { get; set; } = 30;

    public int RelayTokenHours { get; set; } = 12;

    public string? ProviderUserAgent { get; set; }

    public int CatalogCacheMinutes { get; set; } = 15;
}
