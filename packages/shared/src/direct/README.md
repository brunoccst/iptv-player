# direct

Direct mode: native apps talk to the IPTV provider without a backend. Rationale: [D-038](../../../../documentation/DECISIONS.md#d-038).

| File | Exports |
|------|---------|
| `directApiClient.ts` | `createDirectApiClient`: the whole `ApiClient` on the device. Credentials in secure storage; profiles, progress and the library cache in data storage; library rebuilt in the background when older than 12 h; guide from short EPG. |
| `hybridApiClient.ts` | `createHybridApiClient`: routes each call to the direct or server client by `connectionStore`. |
| `xtream.ts` | `normalizeServerUrl`, `createXtreamClient` (validate, categories, live channels, movies, series, details, short EPG, direct playback URLs). Same DTOs as the backend. |
| `looseJson.ts` | Tolerant field readers for panel JSON (string/number/null mixes). |
| `base64Text.ts` | `decodeMaybeBase64` for short-EPG titles. |
| `normalizer/` | TypeScript port of the title normalizer. |
| `xtream.test.ts`, `directApiClient.test.ts` | Unit tests with a fake `fetch` / fake panel. |

Errors use the backend codes (`invalid_provider_credentials`, `provider_credentials_rejected`, `provider_unavailable`), so screens show the same messages.
