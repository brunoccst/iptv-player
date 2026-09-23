# backend

C# ASP.NET Core Web API (.NET 8). Deploy target: Azure App Service.
Role: proxy between clients and IPTV providers (`IMediaProvider`), user profiles, EPG/metadata cache.

Current state: scaffold. Exposes `GET /api/health`.

## Requirements

- .NET 8 SDK (`global.json` allows any 8.0.1xx+ feature band).

## Commands

```bash
dotnet build backend/Backend.sln
dotnet test backend/Backend.sln
dotnet run --project backend/src/Backend.Api     # http://localhost:5080
```

## Config

Loads the repo root `.env`, then `.env.local`, then real environment variables (last wins).
Startup fails if `APP_NAME` or `APP_SLUG` is missing.

## Structure

| Path | Purpose |
|------|---------|
| `Backend.sln` | Solution file. |
| `Directory.Build.props` | Shared MSBuild settings (target framework, nullable, warnings as errors). |
| `Directory.Packages.props` | Central NuGet version list. |
| `src/Backend.Api` | HTTP host: endpoints, DI wiring. |
| `src/Backend.Core` | Domain + configuration. No HTTP dependencies beyond abstractions. |
| `tests/Backend.Tests` | xUnit tests. |
