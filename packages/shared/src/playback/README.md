# playback

Pure functions used by both players.

| File | Exports |
|------|---------|
| `rules.ts` | `SKIP_SECONDS` (10), `NEXT_UP_COUNTDOWN_SECONDS` (10), `isCompleted`, `resumePosition`, `continueWatching`, `introWindow` / `isInIntro` (episodes ≥ 10 min: 5–90 s), `nextUpCountdown`, `orderedEpisodes`, `nextEpisode`, `episodeLabel`, `clampTime`. |
| `sources.ts` | `webPlaybackAttempts` (HLS first, then original file), `isBrowserNativeContainer`, `mimeTypeForContainer`. |
