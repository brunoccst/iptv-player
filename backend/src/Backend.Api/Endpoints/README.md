# Endpoints

| File | Routes |
|------|--------|
| `AuthEndpoints.cs` | `/api/auth/*` |
| `ProfileEndpoints.cs` | `/api/profiles/*` |
| `CatalogEndpoints.cs` | `/api/catalog/*` |
| `PlaybackEndpoints.cs` | `/api/playback/{kind}/{id}` |
| `RelayEndpoints.cs` | `/api/relay/{token}/{fileName}` |
| `LibraryEndpoints.cs` | `/api/library/*` |
| `HealthEndpoints.cs` | `/api/health` |
| `Dtos.cs` | Request/response records. |

All handlers return `TypedResults` so response types appear in the OpenAPI document.
