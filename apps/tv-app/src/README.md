# src

| Path | Purpose |
|------|---------|
| `App.tsx` | Gate (restore → login → profiles → shell), Back handling, library watcher. |
| `appContext.ts` | Shared app context (secure-store session), navigation store, downloads store. |
| `config.ts` | `appConfig` from `Constants.expoConfig.extra`. |
| `hooks.ts` | Store hooks (`useSession`, `useLibrary`, `useDownloads`, `useNav`, …). |
| `useAsync.ts` | Cached one-off reads (movie metadata, series episodes). |
| `useLibraryWatcher.ts` | Polls library status while empty/processing; reloads rows when done. |
| `theme.ts` | Colours, spacing, TV-safe margins, font and card sizes. |
| `components/` | Focusable building blocks. |
| `navigation/` | Stack navigation store. |
| `screens/` | Login, profiles, home, browse, live, details, downloads. |
| `player/` | Player screen, seek overlay, quick drawer. |
| `downloads/` | Store bridging the native download manager. |
| `tv/` | Remote-control event wrapper. |
