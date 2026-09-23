# Known Issues

Bugs, external limitations, technical debt and risks.

| ID | Type | Area | Status |
|----|------|------|--------|
| [KI-001](#ki-001) | Risk | backend | Resolved |
| [KI-002](#ki-002) | Limitation | web-player | Open (deferred by owner) |
| [KI-003](#ki-003) | Limitation | tv-app | Open (deferred by owner) |
| [KI-004](#ki-004) | Limitation | backend | Open |
| [KI-005](#ki-005) | Limitation | tv-app | Open |
| [KI-006](#ki-006) | Tech debt | tooling | Open |
| [KI-007](#ki-007) | Limitation | build env | Open |
| [KI-008](#ki-008) | Risk | backend | Open |
| [KI-009](#ki-009) | Risk | backend | Open (accepted for phase 1) |
| [KI-010](#ki-010) | Limitation | web-player | Open |
| [KI-011](#ki-011) | Risk | backend | Open |
| [KI-012](#ki-012) | Tech debt | backend | Open |

---

## KI-001

**.NET 8 end of support: 2026-11-10** — logged 2026-09-23 · resolved 2026-09-23

Resolved by moving to .NET 10 LTS (D-009).

## KI-002

**Offline cache on web is not tamper-proof** — logged 2026-09-23

Cache API / IndexedDB content is inside the browser sandbox (no `.mp4` file in the user's Downloads), but DevTools can read cached responses. Obfuscation raises the bar; it does not stop a technical user. Real protection needs DRM (Widevine/PlayReady via EME), which Xtream Codes sources do not provide. Owner decision (2026-09-23): acceptable while the app is private.

## KI-003

**Android offline cache is not encrypted by default** — logged 2026-09-23

ExoPlayer/Media3 `SimpleCache` in app-private storage is unreadable without root. On rooted devices, cached segments are readable. Possible fix: encrypt segments with a key in Android Keystore. Owner decision (2026-09-23): acceptable while the app is private.

## KI-004

**Upstream IPTV provider constraints** — logged 2026-09-23 · updated 2026-09-23

- Many Xtream panels are HTTP-only and send no CORS headers. Handled by the relay (D-013).
- Providers limit concurrent connections per account (`max_connections`). Each playing client uses one. The API does not enforce the limit yet; the provider rejects extra streams.
- Providers may block datacenter IP ranges. Not relevant while local-only (D-010); relevant for a future cloud move.
- Provider uptime is outside our control. Failures surface as `502 provider_unavailable`.

## KI-005

**`expo-video` does not expose ExoPlayer `DownloadManager`** — logged 2026-09-23

Playback via `expo-video` uses Media3 ExoPlayer, but offline downloads need a custom Expo native module (Kotlin) wrapping `DownloadManager` + `DownloadService`, sharing the same cache with the player. Planned for Step 6.

## KI-006

**Transitive npm deprecation warnings** — logged 2026-09-23

`npm install` warns about `uuid@7` and `glob@11` pulled by Expo tooling and `@react-native-tvos/config-tv`. Build-time only; not shipped to users. Resolve by upgrading when upstream releases fixes.

## KI-007

**Agent sandbox network limits** — logged 2026-09-23 · updated 2026-09-23

In the Claude Code cloud sandbox two `expo-doctor` checks fail because Expo's schema API and React Native Directory are unreachable. Not a project defect; run `npx expo-doctor` locally for a full check.

## KI-008

**Login accepts any server URL (SSRF surface)** — logged 2026-09-23

`POST /api/auth/login` makes the backend call whatever `serverUrl` the client sends, including LAN addresses. Low risk while the API is local and single-household. Before any public exposure: block private/loopback ranges or allow-list provider hosts, and rate-limit login.

## KI-009

**Plain HTTP on the LAN** — logged 2026-09-23

The API listens on `0.0.0.0:5080` without TLS (D-010). Anyone on the same network can sniff bearer tokens and relay URLs. Accepted for phase 1. Fix: local HTTPS (dev certificate trusted on TV) or a reverse proxy with TLS.

## KI-010

**MKV/AVI VOD files will not play in browsers** — logged 2026-09-23

Many Xtream VOD items use `container_extension: mkv`. Browsers play MP4/WebM/HLS only; MKV often fails in `<video>`. The relay forwards bytes unchanged. Options for Step 5: prefer `m3u8` if the panel offers it for VOD, remux on the backend (ffmpeg), or mark items as TV-only. The TV app (ExoPlayer) plays MKV natively.

## KI-011

**Credentials in logs if log levels are raised** — logged 2026-09-23

Xtream stream URLs contain the username and password in the path. `appsettings.json` sets `System.Net.Http.HttpClient.relay` to `Warning` to keep them out of logs. Lowering that level to `Information` writes credentials to logs. `player_api.php` query strings are redacted by .NET 10 by default.

## KI-012

**Catalog cache is memory-only** — logged 2026-09-23

`CatalogService` cache (D-015) is lost on restart and holds full lists in RAM (large VOD catalogs can reach tens of MB per account). Acceptable for one local user. Step 3 master media objects will move durable metadata to the database.
