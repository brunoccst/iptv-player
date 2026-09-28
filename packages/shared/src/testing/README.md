# testing

| File | Purpose |
|------|---------|
| `fakeBackend.ts` | The app's data as a fake: `createFakeBackend` (answers per route, call log), `createFakeApi` (an `ApiClient` whose calls become those routes, e.g. `GET /api/library/movies`), `createTestAppContext` (an app context that uses it). |
| `fakePanel.ts` | In-memory Xtream panel `fetch` for direct-mode tests; `offline()` simulates a dead network. |

Used by `*.test.ts`. Not exported from the package.
