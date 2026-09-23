# tv

| File | Purpose |
|------|---------|
| `remote.ts` | `useRemote(handler)` wraps `useTVEventHandler`; maps `eventKeyAction` to `down` / `up` / `unknown`, normalizes, and logs events when `APP_TV_DEBUG_REMOTE=1`. |
| `remoteEvents.ts` | `createRemoteNormalizer`: a release without a press becomes press + release, so every key arrives as a pair. |
| `remoteEvents.test.ts` | Normalizer tests (release-only, held keys, no action). |
