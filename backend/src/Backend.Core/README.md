# Backend.Core

Class library with no database or outbound HTTP code.

| Folder | Purpose |
|--------|---------|
| `Accounts/` | Entities (`ProviderAccount`, `Profile`, `UserSession`), `ICredentialProtector`. |
| `Configuration/` | `.env` loading, `AppOptions`, `BackendOptions`. |
| `Library/` | `pipeline.db` entities (jobs, master media, variants) and payload shape. |
| `Media/` | Provider-agnostic catalog models. |
| `Providers/` | `IMediaProvider`, resolver, provider exceptions. |
| `Streaming/` | `HlsPlaylistRewriter`. |
