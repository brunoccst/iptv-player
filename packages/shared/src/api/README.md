# api

| File | Purpose |
|------|---------|
| `apiClient.ts` | `ApiClient`: everything the apps read and change (`auth`, `profiles`, `progress`, `watchlist`, `catalog`, `library`, `epg`, `playback`), and the list queries. Implemented by `direct/directApiClient.ts`; tests use `testing/fakeBackend.ts`. |
| `types.ts` | The data types (`MasterCard`, `VariantInfo`, `ProgressDto`, …), section and kind unions, `ApiErrorCode`. |
| `errors.ts` | `ApiError` (`status` like HTTP, 0 = no answer; `code`). |

`ApiError.code` values:

| Code | Meaning |
|------|---------|
| `invalid_provider_credentials`, `provider_credentials_rejected` | The provider refused the login, or no longer accepts the saved one. |
| `provider_unavailable` | The provider did not answer, or answered something unreadable (the message has the detail). |
| `validation_failed` | A value the app cannot use (e.g. no server URL). |
| `unauthorized` | Not signed in on this device. |
| `not_found`, `http_error` | No such title; anything else. |
| `network_error`, `timeout`, `aborted` | Client side (`status` = 0). |
