# tv

| File | Purpose |
|------|---------|
| `remote.ts` | `useRemote(handler)` wraps `useTVEventHandler`; maps `eventKeyAction` to `down` / `up` / `unknown`, normalizes, and logs events when `APP_TV_DEBUG_REMOTE=1`. |
| `remoteEvents.ts` | `createRemoteNormalizer`: a release without a press becomes press + release, so every key arrives as a pair. |
| `remoteEvents.test.ts` | Normalizer tests (release-only, held keys, no action). |
| `watchNext.ts` | The home screen's "Continue watching" row on Android TV and Google TV (D-147): `watchNextEntries` (the active profile's Continue Watching), `watchNextPlan` (rows to insert, update, remove), `useWatchNextSync` (10 s after progress changes; empty at the profile picker and signed out), `useWatchNextLaunch` / `useOpenWatchNext` (a title chosen there plays over its details page). |
| `watchNext.test.ts` | Entries, plan, sync and opening a title from the row. |
