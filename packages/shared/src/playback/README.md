# playback

Pure functions used by both players.

| File | Exports |
|------|---------|
| `rules.ts` | `SKIP_SECONDS` (10), `NEXT_UP_COUNTDOWN_SECONDS` (10), `isCompleted`, `resumePosition`, `continueWatching`, `skipAheadWindow` / `isInSkipAheadWindow` ("Skip ahead" shows 5–90 s into episodes ≥ 10 min), `SKIP_AHEAD_OPTIONS` (30 s, 1, 2, 3 min) with labels, `nextUpCountdown`, `orderedEpisodes`, `nextEpisode`, `episodeLabel`, `clampTime`. |
| `offlineAccess.ts` | `offlineAccess(account, lastOnlineAt)`: downloads play only with an unexpired subscription and an online check within `OFFLINE_RECHECK_DAYS` (30); `formatOfflineDate` (D-050). |
| `sources.ts` | `webPlaybackAttempts` (HLS first, then original file), `isBrowserNativeContainer`, `mimeTypeForContainer`. |
