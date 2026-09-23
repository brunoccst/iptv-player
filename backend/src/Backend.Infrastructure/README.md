# Backend.Infrastructure

Implementations of `Backend.Core` contracts plus application services.

| Folder | Purpose |
|--------|---------|
| `Xtream/` | `XtreamCodesProvider` and lenient JSON readers. |
| `Persistence/` | `AppDbContext` (SQLite) and migrations. |
| `Security/` | Data Protection–based `ICredentialProtector`. |
| `Accounts/` | `AccountService`, `SessionService`, `ProfileService`. |
| `Catalog/` | `CatalogService` (cached catalog reads). |
| `Streaming/` | `PlaybackService`, `RelayTokenService`. |
| `DependencyInjection.cs` | `AddInfrastructure()`: registers everything above. |
