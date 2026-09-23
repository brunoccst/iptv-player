# Backend.Api

ASP.NET Core minimal API host. Endpoint list: see [`backend/README.md`](../../README.md#endpoints).

| Path | Purpose |
|------|---------|
| `Program.cs` | Config loading, DI, middleware, route mapping, startup migration. |
| `Auth/` | Bearer session authentication handler. |
| `Endpoints/` | Route groups and request/response DTOs. |
| `Errors/` | Exception → problem details mapping. |
| `Properties/` | Local launch profile. |
| `appsettings.json` | Logging levels. |

Run: `dotnet run --project backend/src/Backend.Api` (port `5080`, all interfaces).
