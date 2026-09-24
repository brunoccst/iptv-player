# testing

| File | Purpose |
|------|---------|
| `fakeBackend.ts` | In-memory backend `fetch` with per-route responses and a call log. |
| `fakePanel.ts` | In-memory Xtream panel `fetch` for direct-mode tests; `offline()` simulates a dead network. |

Used by `*.test.ts`. Not exported from the package.
