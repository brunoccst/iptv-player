# normalizer

Groups the provider's listings into titles with versions (parser, tags, grouping, masters). Rationale: [D-017](../../../../../documentation/DECISIONS.md#d-017), [D-038](../../../../../documentation/DECISIONS.md#d-038).

| File                 | Exports                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tags.ts`            | Tag tables and quality ranks.                                                                                                                                                                         |
| `parser.ts`          | `parseTitle`, `normalizeKey`, `parseYear`, `compactKey`, `numberTokens`.                                                                                                                              |
| `matching.ts`        | `groupTitles` (typo-tolerant: years and numbers must match, short keys only exactly), `ratio` (same result as rapidfuzz `fuzz.ratio`).                                                                |
| `pipeline.ts`        | `buildMasters`, `buildMastersInChunks` (yields every 500 titles, reports progress), `mergeByTmdb` (joins translated titles with the same TMDB id, D-065), `qualityScore`, `variantLabel`, `masterId`. |
| `sha1.ts`            | `sha1Hex`, for stable master ids.                                                                                                                                                                     |
| `normalizer.test.ts` | Runs the JSON cases in `cases/`.                                                                                                                                                                      |

Add a case to `cases/` with every rule change.
