using System.Security.Cryptography;
using Backend.Core.Configuration;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure.Streaming;

/// <summary>Signs + encrypts upstream URLs into opaque, expiring relay tokens. See DECISIONS.md#d-013.</summary>
public sealed class RelayTokenService(IDataProtectionProvider provider, IOptions<BackendOptions> options, TimeProvider clock)
{
    private readonly ITimeLimitedDataProtector _protector = provider.CreateProtector("StreamRelay.v1").ToTimeLimitedDataProtector();

    public string CreateToken(Uri upstreamUrl) =>
        _protector.Protect(upstreamUrl.AbsoluteUri, clock.GetUtcNow().AddHours(options.Value.RelayTokenHours));

    /// <returns>The upstream URL, or <c>null</c> if the token is invalid, tampered or expired.</returns>
    public Uri? ReadToken(string token)
    {
        try
        {
            var url = _protector.Unprotect(token, out var expiration);
            return expiration > clock.GetUtcNow() && Uri.TryCreate(url, UriKind.Absolute, out var uri) ? uri : null;
        }
        catch (CryptographicException)
        {
            return null;
        }
    }

    /// <summary>Root-relative relay path. <paramref name="fileName"/> is cosmetic; players use its extension to pick a demuxer.</summary>
    public string CreatePath(Uri upstreamUrl)
    {
        var fileName = Path.GetFileName(upstreamUrl.AbsolutePath);
        if (string.IsNullOrEmpty(fileName))
        {
            fileName = "stream";
        }

        return $"/api/relay/{CreateToken(upstreamUrl)}/{Uri.EscapeDataString(fileName)}";
    }
}
