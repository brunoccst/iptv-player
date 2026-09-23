namespace Backend.Core.Providers;

public interface IMediaProviderResolver
{
    /// <summary>Returns the provider registered for <paramref name="providerType"/>. Throws if unknown.</summary>
    IMediaProvider Get(string providerType);
}

public sealed class MediaProviderResolver(IEnumerable<IMediaProvider> providers) : IMediaProviderResolver
{
    private readonly Dictionary<string, IMediaProvider> _providers =
        providers.ToDictionary(provider => provider.ProviderType, StringComparer.OrdinalIgnoreCase);

    public IMediaProvider Get(string providerType) =>
        _providers.TryGetValue(providerType, out var provider)
            ? provider
            : throw new InvalidOperationException($"No media provider registered for '{providerType}'.");
}
