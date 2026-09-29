# hooks

| File                 | Purpose                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| `stores.ts`          | `useSession`, `useLibrary`, `useProgress`, `useDownloads`, `useUi`, … (selectors are shallow-compared). |
| `usePagedLibrary.ts` | Page-by-page library loading for rows and grids (`loadMore`, `loadingMore`).                            |
| `useAsync.ts`        | One-off cached reads outside the shared stores (movie metadata, series episodes).                       |
