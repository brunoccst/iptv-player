# Providers

| File | Purpose |
|------|---------|
| `IMediaProvider.cs` | Contract every IPTV source implements. |
| `IMediaProviderResolver.cs` | Picks a provider by `ProviderType` string. |
| `ProviderModels.cs` | `ProviderCredentials`, `ProviderAccountInfo`, `PlaybackRequest`, `PlaybackSource`. |
| `ProviderExceptions.cs` | `ProviderAuthenticationException`, `ProviderUnavailableException`. |
