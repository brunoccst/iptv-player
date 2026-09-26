# tv

| File | Purpose |
|------|---------|
| `remote.ts` | `useRemote(handler)` wraps `useTVEventHandler`; maps `eventKeyAction` to `down` / `up` / `unknown`, normalizes, and logs events when `APP_TV_DEBUG_REMOTE=1`. |
| `remoteEvents.ts` | `createRemoteNormalizer`: a release without a press becomes press + release, so every key arrives as a pair. |
| `remoteEvents.test.ts` | Normalizer tests (release-only, held keys, no action). |
| `SleepMode.tsx` | Sleep mode (D-068): keeps the screen on while the app is open; after 10 minutes without a button press (not while a video plays) shows a dark screen with a moving clock; any button wakes it; after 3 hours asleep the screen may turn off. `sleepControl` is set by the player. |
