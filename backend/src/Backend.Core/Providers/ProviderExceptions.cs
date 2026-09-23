namespace Backend.Core.Providers;

/// <summary>Base type for failures talking to an upstream IPTV provider.</summary>
public abstract class ProviderException(string message, Exception? innerException = null)
    : Exception(message, innerException);

/// <summary>Upstream rejected the username/password or the account is disabled/expired.</summary>
public sealed class ProviderAuthenticationException(string message)
    : ProviderException(message);

/// <summary>Upstream unreachable, timed out, or returned an unusable response.</summary>
public sealed class ProviderUnavailableException(string message, Exception? innerException = null)
    : ProviderException(message, innerException);
