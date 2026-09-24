# normalizer

TypeScript port of `services/title-normalizer` (parser, tags, grouping, masters). Rationale: [D-017](../../../../../documentation/DECISIONS.md#d-017), [D-038](../../../../../documentation/DECISIONS.md#d-038).

| File | Python source | Exports |
|------|---------------|---------|
| `tags.ts` | `tags.py` | Tag tables and quality ranks. |
| `parser.ts` | `parser.py` | `parseTitle`, `normalizeKey`, `parseYear`, `compactKey`, `numberTokens`. |
| `matching.ts` | `matching.py` | `groupTitles`, `isFuzzyMatch`, `ratio` (same result as rapidfuzz `fuzz.ratio`). |
| `pipeline.ts` | `pipeline.py` | `buildMasters`, `qualityScore`, `variantLabel`, `masterId`. |
| `sha1.ts` | `hashlib.sha1` | `sha1Hex`, so master ids equal the Python ones. |
| `normalizer.test.ts` | — | Runs `services/title-normalizer/tests/cases/*.json`, the same cases as the Python tests. |

Change a rule in both languages and add the case to the JSON files.
