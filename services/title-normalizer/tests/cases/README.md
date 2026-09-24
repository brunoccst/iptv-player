# cases

JSON test cases shared by the Python tests and the TypeScript port (`packages/shared/src/direct/normalizer`). Rationale: [D-038](../../../../documentation/DECISIONS.md#d-038).

| File | Used by |
|------|---------|
| `parser.json` | `parse` (title, year, tags; missing fields are not checked) and `keys` (`normalize_key`). |
| `matching.json` | `groups`: titles and the expected number of groups. |
| `pipeline.json` | `masters`: provider items and the expected masters, including ids hashed by Python. |
