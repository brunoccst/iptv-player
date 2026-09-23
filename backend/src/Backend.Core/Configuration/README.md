# Configuration

| File | Purpose |
|------|---------|
| `DotEnvParser.cs` | Parses `KEY=VALUE` lines. |
| `DotEnvConfigurationExtensions.cs` | `AddRootDotEnv()`: finds nearest `.env` upward, loads `.env` + `.env.local`, then env vars. |
| `AppOptions.cs` | Typed `APP_NAME` / `APP_SLUG`. |
| `AppOptionsServiceCollectionExtensions.cs` | `AddAppOptions()`: binds and validates on startup. |
| `BackendOptions.cs` | Typed `BACKEND_*` keys. |
| `BackendOptionsServiceCollectionExtensions.cs` | `AddBackendOptions()`: binds, resolves data dir, validates. |
