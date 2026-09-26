# tvmedia (Kotlin)

| File | Purpose |
|------|---------|
| `TvMediaModule.kt` | Expo module definition: download functions, `openExternalPlayer` (D-057), pairing (`startPairing`, `respondPairing`, `stopPairing`, `scanQrCode`, D-060), remote play (`startRemote`, `respondRemote`, `stopRemote`, `randomKey`, `deviceName`, D-061), `onDownloadsChanged`, `onPairingRequest` and `onRemoteRequest` events, `TvPlayerView` props/events/functions. |
| `PairingServer.kt` | Small HTTP server on the home network for pairing (`POST /pair`, one-time, D-060) and remote play (`POST /remote`, fixed port range, D-061): hands bodies to JS and sends its answers; LAN address and random keys. |
| `TvPlayerView.kt` | `ExpoView` hosting a Media3 `PlayerView` (no controller). Online: relay URL; offline: `DownloadHelper.createMediaSource` over the private cache. |
| `DownloadCenter.kt` | Singleton `SimpleCache` in `filesDir/offline-media` (AES-encrypted reads/writes), `DownloadManager` (1 parallel download), listeners, list/serialization. |
| `OfflineKey.kt` | Per-install AES key for downloads, saved wrapped by a non-exportable Android Keystore key. A new key deletes older downloads (D-050). |
| `TvDownloadService.kt` | Media3 `DownloadService` with progress notification. |
| `AppUpdater.kt` | Self-update (D-062): installed version, APK download with SHA-256 check, same package / newer / same signing key checks, install permission, system installer via `FileProvider`. |
