# hooks

| File | Purpose |
|------|---------|
| `stores.ts` | `useSession`, `useLibrary`, `useProgress`, `useDownloads`, `useUi`, … (selectors are shallow-compared). |
| `useAsync.ts` | One-off cached reads outside the shared stores (movie metadata, series episodes). |
