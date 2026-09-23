# tvmedia (Kotlin)

| File | Purpose |
|------|---------|
| `TvMediaModule.kt` | Expo module definition: download functions, `onDownloadsChanged` event, `TvPlayerView` props/events/functions. |
| `TvPlayerView.kt` | `ExpoView` hosting a Media3 `PlayerView` (no controller). Online: relay URL; offline: `DownloadHelper.createMediaSource` over the private cache. |
| `DownloadCenter.kt` | Singleton `SimpleCache` in `filesDir/offline-media`, `DownloadManager` (1 parallel download), listeners, list/serialization. |
| `TvDownloadService.kt` | Media3 `DownloadService` with progress notification. |
