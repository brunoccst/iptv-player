# Backend.Core

Class library with no database or outbound HTTP code.

| Folder | Purpose |
|--------|---------|
| `Accounts/` | Entities (`ProviderAccount`, `Profile`, `UserSession`), `ICredentialProtector`. |
| `Configuration/` | `.env` loading, `AppOptions`, `BackendOptions`. |
| `Media/` | Provider-agnostic catalog models. |
| `Providers/` | `IMediaProvider`, resolver, provider exceptions. |
| `Streaming/` | `HlsPlaylistRewriter`. |
