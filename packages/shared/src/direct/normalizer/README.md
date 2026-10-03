# normalizer

Groups the provider's listings into titles with versions (parser, tags, grouping, masters). Rationale: [D-017](../../../../../documentation/DECISIONS.md#d-017), [D-038](../../../../../documentation/DECISIONS.md#d-038).

| File                 | Exports                                                                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tags.ts`            | Tag tables and quality ranks.                                                                                                                                                                         |
| `parser.ts`          | `parseTitle`, `normalizeKey`, `parseYear`, `compactKey`, `numberTokens`.                                                                                                                              |
| `matching.ts` | `groupTitles`: same key and year, or same TMDB id and year (D-133); the database groups by the same rules. |
| `pipeline.ts` | `buildMasters`, `buildMastersInChunks` (the library in memory; yields, reports progress), `savedItem` and `versionsOf` (the database's items and titles), `qualityScore`, `variantLabel`, `masterId`. |
| `sha1.ts`            | `sha1Hex`, for stable master ids.                                                                                                                                                                     |
| `normalizer.test.ts` | Runs the JSON cases in `cases/`.                                                                                                                                                                      |

Add a case to `cases/` with every rule change.
