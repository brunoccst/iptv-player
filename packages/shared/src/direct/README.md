# direct

Direct mode: native apps talk to the IPTV provider without a backend. Rationale: [D-038](../../../../documentation/DECISIONS.md#d-038).

| File | Exports |
|------|---------|
| `xtream.ts` | `normalizeServerUrl`, `createXtreamClient` (validate, categories, live channels, movies, series, details, short EPG, direct playback URLs). Same DTOs as the backend. |
| `looseJson.ts` | Tolerant field readers for panel JSON (string/number/null mixes). |
| `base64Text.ts` | `decodeMaybeBase64` for short-EPG titles. |
| `normalizer/` | TypeScript port of the title normalizer. |
| `xtream.test.ts` | Unit tests with a fake `fetch`. |

Errors use the backend codes (`invalid_provider_credentials`, `provider_credentials_rejected`, `provider_unavailable`), so screens show the same messages.
