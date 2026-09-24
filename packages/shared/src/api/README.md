# api

| File | Purpose |
|------|---------|
| `httpClient.ts` | `fetch` wrapper: base URL (string, or a function read per request), bearer token, JSON, timeout (30 s), `ApiError` mapping, 401 hook. |
| `apiClient.ts` | `createApiClient()`: one function per backend endpoint (`auth`, `profiles`, `progress`, `catalog`, `epg`, `library`, `playback`, `health`). |
| `types.ts` | Friendly aliases for generated schemas (`MasterCard`, `VariantInfo`, …), route unions, `ApiErrorCode`, `OperationResult`. |
| `generated/` | `schema.ts` from openapi-typescript. Do not edit. |

`ApiError.code` values:

| Code | Source |
|------|--------|
| `validation_failed`, `invalid_provider_credentials`, `provider_credentials_rejected`, `provider_unavailable` | Backend problem body. |
| `unauthorized`, `not_found`, `http_error` | HTTP status without a backend code. |
| `network_error`, `timeout`, `aborted` | Client side (`status` = 0). |
