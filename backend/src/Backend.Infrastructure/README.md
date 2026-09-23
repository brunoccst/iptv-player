# Backend.Infrastructure

Implementations of `Backend.Core` contracts plus application services.

| Folder | Purpose |
|--------|---------|
| `Xtream/` | `XtreamCodesProvider` and lenient JSON readers. |
| `Persistence/` | `AppDbContext` (SQLite) and migrations. |
| `Security/` | Data Protection–based `ICredentialProtector`. |
| `Accounts/` | `AccountService`, `SessionService`, `ProfileService`. |
| `Catalog/` | `CatalogService` (cached catalog reads). |
| `Epg/` | XMLTV download + streaming parser, guide cache refresh (queue + worker), grid reads with short-EPG fallback. |
| `Library/` | Library sync (enqueue jobs) and deduplicated library reads. |
| `Pipeline/` | `PipelineDbContext` (`pipeline.db`), migrations, schema snapshot. |
| `Streaming/` | `PlaybackService`, `RelayTokenService`. |
| `DependencyInjection.cs` | `AddInfrastructure()`: registers everything above. |
