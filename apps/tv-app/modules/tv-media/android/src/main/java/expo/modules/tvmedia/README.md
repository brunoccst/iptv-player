# tvmedia (Kotlin)

| File | Purpose |
|------|---------|
| `TvMediaModule.kt` | Expo module definition: download functions, `onDownloadsChanged` event, `TvPlayerView` props/events/functions. |
| `TvPlayerView.kt` | `ExpoView` hosting a Media3 `PlayerView` (no controller). Online: relay URL; offline: `DownloadHelper.createMediaSource` over the private cache. |
| `DownloadCenter.kt` | Singleton `SimpleCache` in `filesDir/offline-media` (AES-encrypted reads/writes), `DownloadManager` (1 parallel download), listeners, list/serialization. |
| `OfflineKey.kt` | Per-install AES key for downloads, saved wrapped by a non-exportable Android Keystore key. A new key deletes older downloads (D-050). |
| `TvDownloadService.kt` | Media3 `DownloadService` with progress notification. |
