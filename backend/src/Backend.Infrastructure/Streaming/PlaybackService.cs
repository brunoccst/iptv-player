using Backend.Core.Configuration;
using Backend.Core.Providers;
using Backend.Infrastructure.Accounts;
using Microsoft.Extensions.Options;

namespace Backend.Infrastructure.Streaming;

/// <summary>Resolves a playback request to a client-facing URL (relay or direct).</summary>
public sealed class PlaybackService(AccountService accounts, RelayTokenService relayTokens, IOptions<BackendOptions> options)
{
    /// <param name="publicBaseUrl">Scheme + host the client used to reach this API. Relay URLs are built on it.</param>
    public async Task<PlaybackInfo> GetPlaybackAsync(Guid accountId, PlaybackRequest request, Uri publicBaseUrl, CancellationToken ct)
    {
        var context = await accounts.GetProviderContextAsync(accountId, ct);
        var source = context.Provider.BuildPlaybackSource(context.Credentials, request, context.AccountInfo);
        var mode = options.Value.StreamDelivery;

        var url = mode == StreamDeliveryMode.Relay
            ? new Uri(publicBaseUrl, relayTokens.CreatePath(source.Url))
            : source.Url;

        return new PlaybackInfo(url.AbsoluteUri, source.Container, source.IsLive, mode.ToString().ToLowerInvariant());
    }
}

public sealed record PlaybackInfo(string Url, string Container, bool IsLive, string DeliveryMode);
