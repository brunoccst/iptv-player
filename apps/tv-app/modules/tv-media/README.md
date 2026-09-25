# tv-media

Local Expo module (Android only). Media3 1.9 ExoPlayer view and offline downloads (AES-encrypted, key wrapped by Android Keystore, D-050). Auto-linked by Expo from `modules/`.

| Path | Purpose |
|------|---------|
| `index.ts`, `src/index.ts` | JS API: `TvPlayerView` component, `TvMedia` download functions, types. |
| `expo-module.config.json` | Registers `expo.modules.tvmedia.TvMediaModule`. |
| `android/build.gradle` | Library build; Media3 dependencies. |
| `android/src/main/AndroidManifest.xml` | `TvDownloadService` + foreground-service permissions. |
| `android/src/main/java/expo/modules/tvmedia/` | Kotlin sources (see its README). |
| `android/src/main/res/values/strings.xml` | Download notification channel name. |

## JS API

| Export | Description |
|--------|-------------|
| `TvPlayerView` | Props: `source` (`uri` + `isHls`, or `offlineId`), `paused`. Events: `onStatus`, `onProgress` (500 ms), `onTracks`, `onEnd`, `onError`. Ref: `seekTo(ms)`, `selectTrack(type, group, track)`. |
| `TvMedia.startDownload(id, uri, isHls, metadataJson)` | Queues a download (foreground service). |
| `TvMedia.pauseDownload / resumeDownload / removeDownload(id)` | Control a download. |
| `TvMedia.removeAllDownloads()` | Deletes every download (sign-out, account change, D-050). |
| `TvMedia.setUserAgent(ua)` | HTTP User-Agent for playback and downloads; saved natively so resumed downloads use it too (D-038). |
| `TvMedia.listDownloads()` | All downloads with state, percent, metadata. |
| `onDownloadsChanged` event | Fired on state changes (not on every progress tick). |

Tests replace this module with `test/tvMediaMock.tsx` (Jest `moduleNameMapper`).
