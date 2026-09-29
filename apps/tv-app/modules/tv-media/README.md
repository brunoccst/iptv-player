# tv-media

Local Expo module (Android only). Media3 1.9 ExoPlayer view and offline downloads (AES-encrypted, key wrapped by Android Keystore, D-050). Auto-linked by Expo from `modules/`.

| Path | Purpose |
|------|---------|
| `index.ts`, `src/index.ts` | JS API: `TvPlayerView` component, `TvMedia` download functions, types. |
| `expo-module.config.json` | Registers `expo.modules.tvmedia.TvMediaModule`. |
| `android/build.gradle` | Library build; Media3 dependencies; optional FFmpeg audio extension (`iptvFfmpegAudio` / `IPTV_FFMPEG_AUDIO`, D-059). |
| `android/consumer-rules.pro` | Keeps the FFmpeg renderer for R8 (Media3 loads it by reflection). |
| `android/src/main/AndroidManifest.xml` | `TvDownloadService` + foreground-service permissions; `<queries>` for video players (D-057). |
| `android/src/main/java/expo/modules/tvmedia/` | Kotlin sources (see its README). |
| `android/src/main/res/values/strings.xml` | Download notification channel name. |

## JS API

| Export | Description |
|--------|-------------|
| `TvPlayerView` | Props: `source` (`uri` + `isHls`, or `offlineId`), `paused`. Events: `onStatus`, `onProgress` (500 ms), `onTracks`, `onEnd`, `onError`. Ref: `seekTo(ms)`, `selectTrack(type, group, track)`, `addSubtitle(srt, language, label)` (OpenSubtitles, D-111; streams only). |
| `TvMedia.startDownload(id, uri, isHls, metadataJson)` | Queues a download (foreground service). |
| `TvMedia.pauseDownload / resumeDownload / removeDownload(id)` | Control a download. |
| `TvMedia.removeAllDownloads()` | Deletes every download (sign-out, account change, D-050). |
| `TvMedia.setUserAgent(ua)` | HTTP User-Agent for playback and downloads; saved natively so resumed downloads use it too (D-038). |
| `TvMedia.listDownloads()` | All downloads with state, percent, metadata. |
| `TvMedia.ffmpegAudioAvailable()` | True when the FFmpeg audio decoders are bundled (D-059). |
| `TvMedia.openExternalPlayer(uri, mimeType, title, headers)` | Opens the stream in another player app with `ACTION_VIEW` (headers in the `headers` extra); the app chooser when no default player is set. Returns `opened`, `chooser` or `none` (D-057). |
| `onDownloadsChanged` event | Fired on state changes (not on every progress tick). |

Tests replace this module with `test/tvMediaMock.tsx` (Jest `moduleNameMapper`).

`CrashLog.kt` (D-113): a native crash is written to `last-crash.txt` and handed to the next start (`takeLastCrash()`), which puts it in the Log; `memoryInfo()` reports the Java heap limit and the device's RAM.

`ListReader.kt`, `JsonArraySplitter.kt` (D-115): provider lists downloaded on a background thread and cut into batches of whole entries (`openList`, `readList`, `closeList`); JavaScript parses each batch with `JSON.parse`.

`Sha1Batch.kt` (D-118): `sha1Batch` hashes many title ids at once with `MessageDigest`.

`LibraryDb.kt` (D-121): the library database in Android's own SQLite (no library added to the APK). `dbRun(statementsJson)` runs statements with rows of parameters in one transaction; `dbQuery(sql, paramsJson)` answers rows as a JSON array of arrays. Writes and reads each have their own thread (write-ahead logging), and characters outside the BMP cross as JSON escapes both ways. All library logic is in `@iptv/shared` (`sqlLibrary.ts`).
