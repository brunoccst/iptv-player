# offline

Secure in-app offline viewing. No media file ever reaches the user's filesystem.

| File                       | Runs in | Purpose                                                                              |
| -------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `types.ts`                 | both    | Constants, `DownloadRecord`, URL helpers.                                            |
| `chunkCrypto.ts`           | both    | AES-GCM 256 encrypt/decrypt per chunk (non-extractable key).                         |
| `offlineDb.ts`             | both    | IndexedDB: `downloads` records, `keys` (CryptoKey per download).                     |
| `chunkStore.ts`            | both    | Cache API storage of encrypted chunks and posters (+ in-memory version for tests).   |
| `hlsPlaylist.ts`           | page    | Pick best rendition; list resources; build local playlist. Refuses live.             |
| `ranges.ts`                | SW      | HTTP `Range` parsing and chunk clamping.                                             |
| `offlineResponder.ts`      | SW      | Serves `/__offline__/{id}/index.m3u8`, `/r/{n}`, `/file` (ranged), `/poster`.        |
| `downloadManager.ts`       | page    | Queue (1 at a time), HLS or chunked-file download, encrypt, resume, pause, remove.   |
| `downloadsStore.ts`        | page    | Zustand store over the manager for the UI.                                           |
| `serviceWorker.ts`         | SW      | Entry: offline responder + app-shell cache. Bundled to `/sw.js` by `vite.config.ts`. |
| `registerServiceWorker.ts` | page    | Registers `/sw.js`.                                                                  |

Download formats:

| Source                | Stored parts                                       | Served as                             |
| --------------------- | -------------------------------------------------- | ------------------------------------- |
| Panel HLS (preferred) | Every playlist resource (segments, init map, keys) | Local `index.m3u8` → hls.js           |
| MP4/M4V/WebM/MOV file | 4 MiB byte ranges                                  | `/file` with HTTP 206 range responses |
| MKV/AVI without HLS   | –                                                  | Refused: browsers cannot play them    |
