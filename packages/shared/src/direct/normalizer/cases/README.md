# cases

JSON test cases for the title normalizer (`normalizer.test.ts`). Rationale: [D-017](../../../../../../documentation/DECISIONS.md#d-017), [D-038](../../../../../../documentation/DECISIONS.md#d-038).

| File            | Used by                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------- |
| `parser.json`   | `parse` (title, year, tags; missing fields are not checked) and `keys` (`normalizeKey`). |
| `matching.json` | `groups`: titles and the expected number of groups.                                      |
| `pipeline.json` | `masters`: provider items and the expected masters, including their ids.                 |
