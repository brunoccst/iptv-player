# src

| Path | Purpose |
|------|---------|
| `App.tsx` | Gate (restore → login → profiles → shell), Back handling, library watcher. |
| `appContext.ts` | Shared app context with direct mode enabled (secure-store credentials, file data storage), navigation store, downloads store; sets the provider User-Agent on the native player. |
| `dataStorage.ts` | `fileStorage`: JSON files in app-private storage for profiles, progress and the library cache (direct mode). |
| `playbackSettings.ts` | Player settings (audio decoder choice, D-059), saved in `fileStorage` and included in backups (D-056). |
| `config.ts` | `appConfig` from `Constants.expoConfig.extra` (API address optional), `providerUserAgent`. |
| `hooks.ts` | Store hooks (`useSession`, `useConnection`, `useLibrary`, `useDownloads`, `useNav`, …) and `connectionStore`. |
| `useAsync.ts` | Cached one-off reads (movie metadata, series episodes). |
| `useLibraryWatcher.ts` | Polls library status while empty/processing; reloads rows when done. |
| `theme.ts` | Colours, spacing, TV-safe margins, font and card sizes. |
| `components/` | Focusable building blocks. |
| `navigation/` | Stack navigation store. |
| `screens/` | Login, profiles, home, browse, live, details, downloads. |
| `player/` | Player screen, seek overlay, quick drawer. |
| `pairing/` | Phone-to-TV sign-in and sync (D-060): `usePairingServer` (TV), `connectToTv` (phone), QR code, dialogs. Play on TV (D-061): `remote.ts` (`useRemoteServer` on the TV, `playOnTv` and the paired TV on the phone). |
| `update/` | Self-update from the GitHub `tv-apk` release (D-062): `updates.ts` (release parsing, check, download, install), `UpdateDialog.tsx`. |
| `downloads/` | Store bridging the native download manager. |
| `tv/` | Remote-control event wrapper. |
