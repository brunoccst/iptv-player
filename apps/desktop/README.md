# desktop

Desktop app for Windows, macOS and Linux ([D-071](../../documentation/DECISIONS.md#d-071)): the web player (`apps/web-player`) in its own window. Like the TV app it talks to the IPTV provider directly (D-038, D-088). Users install it from the `desktop` release (links in the [root README](../../README.md#install-the-apps)).

Not an npm workspace: it has its own `package-lock.json`, so other pipelines do not download Electron.

| Path | Purpose |
|------|---------|
| `main.mjs` | Main process: serves the bundled web player on `http://127.0.0.1:47831`, adds the player User-Agent and CORS permission to provider requests, system-encrypted and file storage for the page, the pairing server for phone sync (D-072), one window, in-app updates (electron-updater on Windows and AppImage, the download page elsewhere, D-073). |
| `preload.cjs` | Gives the page `window.iptvDesktop` (version, `secure` and `data` storage, `db` (the library database, D-121), `pairing`, `openInVlc`: VLC with the provider User-Agent, D-081; `setTexts`: the update dialogs in the app's language, D-084), read by `apps/web-player/src/desktop.ts`. |
| `lib/libraryDb.mjs` | The library database (D-121): `library.db` in the app's data folder, in the SQLite built into Electron's Node (no library added). The page runs statements and queries through `iptvDesktop.db`, like the TV app's native module. |
| `lib/helpers.mjs` | Pure helpers: static file paths, CORS and request headers, storage file names, release version, home network address, where VLC is and its arguments (D-081). |
| `scripts/prepare.mjs` | Writes `build-config.json` (name, User-Agent, update repository) from the root `.env` and CI variables; copies the icon. |
| `electron-builder.config.cjs` | Installers: NSIS setup wizard with folder choice (Windows), DMG (macOS universal), AppImage and deb (Linux), with fixed file names; English Chromium texts only, maximum compression (D-072). |
| `test/` | Unit tests (`npm test`, Node's test runner). |
| `e2e/smoke.mjs` | Starts the app against the fake panel: sign-in, the phone-sync server answering through the app, a movie that plays, sign-in kept after a restart. |

## Commands

```bash
npm run build --workspace=@iptv/web-player       # from the repository root, first
cd apps/desktop && npm ci
npm start                                        # the app from this folder
npm test                                         # unit tests
npm run dist -- --linux                          # installers in release/ (--win, --mac on those systems)
xvfb-run -a node e2e/smoke.mjs                   # needs the fake panel on :8090 (tools/fake-xtream-server)
```

Update test: `IPTV_DESKTOP_UPDATE_FEED=<url>` points a packaged app at a local copy of the release (a folder with the installer and `latest*.yml`).

Version: MAJOR.MINOR in `package.json` (raise by hand, write `X.Y.0`); PATCH counts the builds on `main` (`scripts/app-version.mjs apps/desktop/package.json`, D-070). The developer tools open with Ctrl+Shift+I (Cmd+Option+I on macOS); F11 toggles full screen.
