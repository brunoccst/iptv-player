# ui

| File | Purpose |
|------|---------|
| `uiStore.ts` | View, search, details modal, playing item. Mirrored into browser history (Back closes player/modal). `libraryRevision` triggers row reloads. |
| `targets.ts` | Build `PlayTarget` / `DownloadTarget` from library, episode, progress and download data. |
| `errorText.ts` | User-facing text for `ApiError` codes. |
