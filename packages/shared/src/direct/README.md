# direct

The apps talk to the IPTV provider directly. Rationale: [D-038](../../../../documentation/DECISIONS.md#d-038), [D-088](../../../../documentation/DECISIONS.md#d-088).

| File | Exports |
|------|---------|
| `libraryCodec.ts` | Packs the library into arrays with a poster-prefix table (about a third of plain JSON); older files are ignored and deleted. |
| `directApiClient.ts` | `createDirectApiClient`: the whole `ApiClient` on the device. Credentials in secure storage; profiles, progress and the library cache in data storage; library saved in a compact format (`libraryCodec.ts`) and rebuilt in the background when older than 24 h; library lists sorted as set in D-049; guide from short EPG. |
| `xtream.ts` | `normalizeServerUrl`, `createXtreamClient` (validate, categories, live channels, movies, series, details, short EPG, direct playback URLs). Returns the app's types (`api/types.ts`), including the TMDB id some panels send in their lists (D-065). |
| `looseJson.ts` | Tolerant field readers for panel JSON (string/number/null mixes). |
| `base64Text.ts` | `decodeMaybeBase64` for short-EPG titles. |
| `normalizer/` | The title normalizer: parser, tags, grouping, masters. |
| `xtream.test.ts`, `directApiClient.test.ts` | Unit tests with a fake `fetch` / fake panel. |

Errors use the app's codes (`invalid_provider_credentials`, `provider_credentials_rejected`, `provider_unavailable`), so screens show the same messages.
