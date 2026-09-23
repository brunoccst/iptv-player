# Backend.Api

ASP.NET Core minimal API host.

| Endpoint | Response |
|----------|----------|
| `GET /api/health` | `{ "status": "ok", "app": "<APP_NAME>" }` |

Run: `dotnet run --project backend/src/Backend.Api` (port `5080`, see `Properties/launchSettings.json`).
