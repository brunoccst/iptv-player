# tvmedia (Kotlin)

| File | Purpose |
|------|---------|
| `TvMediaModule.kt` | Expo module definition: download functions, `openExternalPlayer` (D-057), pairing (`startPairing`, `respondPairing`, `stopPairing`, `scanQrCode`, D-060), `onDownloadsChanged` and `onPairingRequest` events, `TvPlayerView` props/events/functions. |
| `PairingServer.kt` | Phone-to-TV pairing (D-060): one-time HTTP server on the home network (`POST /pair`), hands bodies to JS and sends its answers; LAN address and random key. |
| `TvPlayerView.kt` | `ExpoView` hosting a Media3 `PlayerView` (no controller). Online: relay URL; offline: `DownloadHelper.createMediaSource` over the private cache. |
| `DownloadCenter.kt` | Singleton `SimpleCache` in `filesDir/offline-media` (AES-encrypted reads/writes), `DownloadManager` (1 parallel download), listeners, list/serialization. |
| `OfflineKey.kt` | Per-install AES key for downloads, saved wrapped by a non-exportable Android Keystore key. A new key deletes older downloads (D-050). |
| `TvDownloadService.kt` | Media3 `DownloadService` with progress notification. |
