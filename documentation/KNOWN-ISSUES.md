# Known Issues

Bugs, external limitations, technical debt and risks.

| ID | Type | Area | Status |
|----|------|------|--------|
| [KI-001](#ki-001) | Risk | backend | Resolved |
| [KI-002](#ki-002) | Limitation | web-player | Open (mitigated by D-024, D-050; needs DRM to close) |
| [KI-003](#ki-003) | Limitation | tv-app | Resolved (D-050) |
| [KI-004](#ki-004) | Limitation | backend | Open |
| [KI-005](#ki-005) | Limitation | tv-app | Resolved |
| [KI-006](#ki-006) | Tech debt | tooling | Open |
| [KI-007](#ki-007) | Limitation | build env | Open |
| [KI-008](#ki-008) | Risk | backend | Open |
| [KI-009](#ki-009) | Risk | backend | Open (accepted for phase 1) |
| [KI-010](#ki-010) | Limitation | web-player | Mitigated |
| [KI-011](#ki-011) | Risk | backend | Open |
| [KI-012](#ki-012) | Tech debt | backend | Open |
| [KI-013](#ki-013) | Limitation | title-normalizer | Open |
| [KI-014](#ki-014) | Limitation | title-normalizer | Open |
| [KI-015](#ki-015) | Risk | backend + worker | Open |
| [KI-016](#ki-016) | Limitation | backend | Resolved (D-051) |
| [KI-017](#ki-017) | Risk | web-player | Open (accepted for phase 1) |
| [KI-018](#ki-018) | Tech debt | shared + backend | Resolved |
| [KI-019](#ki-019) | Limitation | players | Resolved |
| [KI-020](#ki-020) | Risk | web-player | Open |
| [KI-021](#ki-021) | Limitation | web-player | Open |
| [KI-022](#ki-022) | Limitation | web-player | Open |
| [KI-023](#ki-023) | Limitation | web-player | Open |
| [KI-024](#ki-024) | Limitation | web-player | Open |
| [KI-025](#ki-025) | Limitation | series | Open |
| [KI-026](#ki-026) | Limitation | tv-app | Open |
| [KI-027](#ki-027) | Limitation | tv-app | Resolved |
| [KI-028](#ki-028) | Limitation | tv-app | Open |
| [KI-029](#ki-029) | Limitation | build env | Open |
| [KI-030](#ki-030) | Limitation | backend | Open |
| [KI-031](#ki-031) | Limitation | web-player, tv-app | Open |
| [KI-032](#ki-032) | Limitation | backend, clients | Open |
| [KI-033](#ki-033) | Risk | tv-app CI | Resolved |
| [KI-034](#ki-034) | Limitation | tv-app (direct mode) | Open |
| [KI-035](#ki-035) | Limitation | tv-app (direct mode) | Open |
| [KI-036](#ki-036) | Limitation | tv-app (direct mode) | Open |
| [KI-037](#ki-037) | Limitation | tv-app | Open |
| [KI-038](#ki-038) | Limitation | web-player, tv-app | Open |
| [KI-039](#ki-039) | Limitation | shared, clients | Mitigated (D-054, D-064) |
| [KI-040](#ki-040) | Limitation | tv-app, web-player | Open |
| [KI-041](#ki-041) | Limitation | tv-app | Open |
| [KI-042](#ki-042) | Bug | tv-app (direct mode) | Resolved |
| [KI-043](#ki-043) | Limitation | tv-app | Open |
| [KI-044](#ki-044) | Bug | shared (direct mode) | Resolved |

---

## KI-001

**.NET 8 end of support: 2026-11-10** — logged 2026-09-23 · resolved 2026-09-23

Resolved by moving to .NET 10 LTS (D-009).

## KI-002

**Offline cache on web is not tamper-proof** — logged 2026-09-23

Cache API / IndexedDB content is inside the browser sandbox (no `.mp4` file in the user's Downloads). Since 2026-09-23 chunks are AES-GCM encrypted with a non-extractable key (D-024): copied cache files are ciphertext. But any script on the origin, including DevTools, can ask the Service Worker for decrypted bytes. It raises the bar; it does not stop a technical user. Real protection needs DRM (Widevine/PlayReady via EME), which Xtream Codes sources do not provide. Owner decision (2026-09-23): acceptable while the app is private.

Update 2026-09-25 (D-050): downloads are now deleted on sign-out and account change, and only play while the subscription is active and the app was online within 30 days. The DevTools gap stays.

## KI-003

**Android offline cache is not encrypted by default** — logged 2026-09-23

ExoPlayer/Media3 `SimpleCache` in app-private storage is unreadable without root. On rooted devices, cached segments are readable. Possible fix: encrypt segments with a key in Android Keystore. Owner decision (2026-09-23): acceptable while the app is private.

Resolved 2026-09-25 (D-050): segments are AES-encrypted; the key is stored wrapped by a non-exportable Android Keystore key. On a rooted device, code running as the app can still unwrap it.

## KI-004

**Upstream IPTV provider constraints** — logged 2026-09-23 · updated 2026-09-23

- Many Xtream panels are HTTP-only and send no CORS headers. Handled by the relay (D-013).
- Providers limit concurrent connections per account (`max_connections`). Each playing client uses one. The API does not enforce the limit yet; the provider rejects extra streams.
- Providers may block datacenter IP ranges. Not relevant while local-only (D-010); relevant for a future cloud move.
- Provider uptime is outside our control. Failures surface as `502 provider_unavailable`.

## KI-005

**`expo-video` does not expose ExoPlayer `DownloadManager`** — logged 2026-09-23

Playback via `expo-video` uses Media3 ExoPlayer, but offline downloads need a custom Expo native module (Kotlin) wrapping `DownloadManager` + `DownloadService`, sharing the same cache with the player. Resolved 2026-09-23 by the local `tv-media` module (D-029).

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

Many Xtream VOD items use `container_extension: mkv`. Browsers play MP4/WebM/HLS only. Mitigated 2026-09-23 (D-023): the web player first requests the panel's HLS output, which plays MKV sources; if the panel has none, MKV/AVI titles show "only available as MKV… use the TV app". Remaining gap: panels without HLS output. Backend remuxing (ffmpeg) would close it at CPU cost.

## KI-011

**Credentials in logs if log levels are raised** — logged 2026-09-23

Xtream stream URLs contain the username and password in the path. `appsettings.json` sets `System.Net.Http.HttpClient.relay` to `Warning` to keep them out of logs. Lowering that level to `Information` writes credentials to logs. `player_api.php` query strings are redacted by .NET 10 by default.

## KI-012

**Catalog cache is memory-only** — logged 2026-09-23

`CatalogService` cache (D-015) is lost on restart and holds full lists in RAM (large VOD catalogs can reach tens of MB per account). Acceptable for one local user. The deduplicated library (`/api/library`) is persisted in `pipeline.db`; the raw `/api/catalog` endpoints still use this cache.

## KI-013

**Master ids can change between syncs** — logged 2026-09-23

A master id derives from the group's most frequent spelling + year (D-017). If a provider renames entries so another spelling becomes most frequent, or a year appears/disappears, the id changes. Anything stored against the old id (future "continue watching", "My list") would orphan. Mitigation when those features land: store the variant `stream_id` too, or re-link by `normalized_key`.

## KI-014

**Matching blind spots** — logged 2026-09-23

- Typos in the first 4 characters are never fuzzy-matched (blocking, D-017).
- A year-less title with a typo does not join a dated group (fuzzy needs equal years).
- Translated titles ("La Casa de Papel" vs "Money Heist") never merge; needs external IDs (TMDB).
- Only English leading articles are ignored in keys.
- Unusual tags not in `tags.py` stay in the title and can split groups. Fix: add the token and a test case.

## KI-015

**Two processes write SQLite** — logged 2026-09-23

The worker's library replace holds a write lock for the transaction (≈ 1 s for 50k items). Backend writes to `pipeline.db` (new jobs) wait up to 30 s (busy timeout). `app.db` is unaffected. Moving to cloud requires replacing SQLite with a server database and queue (D-018).

## KI-016

**Library refreshes only on login or manual sync** — logged 2026-09-23

`/api/library` data is refreshed after each login and on `POST /api/library/sync`. Sessions last 30 days, so new provider titles can be missing for weeks. The worker must also be running; otherwise jobs stay `pending` (visible in `/api/library/status`).

Resolved 2026-09-25 (D-051): the backend re-syncs signed-in accounts every 12 h (`BACKEND_LIBRARY_REFRESH_HOURS`). The worker must still be running.

## KI-017

**Web session token in `localStorage`** — logged 2026-09-23

Any script running on the web player's origin can read the bearer token (XSS). No third-party scripts are loaded today and the app is local-only. Before public hosting: move to an HttpOnly, SameSite cookie with CSRF protection, or shorten token lifetime (D-022).

## KI-018

**API contract update is two manual steps** — logged 2026-09-23

After a backend API change, `dotnet build` rewrites the OpenAPI JSON, but `npm run generate:api` must be run separately. Resolved 2026-09-23: `ci.yml` builds the backend, regenerates the types and fails on `git diff`.

## KI-019

**Skip Intro uses a fixed window** — logged 2026-09-23 · resolved 2026-09-24

Providers supply no intro markers. The button shows on episodes ≥ 10 min between 5 s and 90 s and jumps to 90 s. Wrong for shows with cold opens or long intros. Fix options: per-series markers learned from user skips, or audio fingerprinting across episodes.

Resolved 2026-09-24 without detection (D-042): the button is now "Skip ahead" and the viewer picks 30 s, 1, 2 or 3 min, so it no longer claims to know where the intro ends.

## KI-020

**Timeline previews use a second stream connection** — logged 2026-09-23

Hovering the timeline creates a hidden low-quality copy of the stream (D-023). On accounts with `max_connections = 1`, strict panels may reject it (preview stays blank) or, worse, drop the main stream. Previews are only created on hover and destroyed on close. Server-side trickplay sprites would remove the extra connection.

## KI-021

**Web downloads run in the page** — logged 2026-09-23

Closing the tab stops a download; it resumes (from the last chunk) only when the user presses Resume. One download at a time. Background Fetch API (Chromium only) could continue downloads after the tab closes. Storage is subject to browser quota; `navigator.storage.persist()` is requested but browsers may still evict under pressure.

## KI-022

**Live channels need HLS output in the browser** — logged 2026-09-23

The web player requests live streams as `.m3u8`. Panels that only allow `ts` output (MPEG-TS over HTTP) will not play in the browser. `mpegts.js` could play them.

## KI-023

**No deep links in the web player** — logged 2026-09-23

Navigation state lives in `history.state` (D-025), not in URLs. Reloading returns to Home; titles cannot be shared by URL.

## KI-024

**Hero trailers depend on YouTube** — logged 2026-09-23

Trailers use the provider's YouTube id via `youtube-nocookie.com`. Needs internet access, loads a third-party frame, and fails silently for removed videos (backdrop stays).

## KI-025

**"Best" series version can have fewer episodes** — logged 2026-09-23

Series variants are ranked by title tags (e.g. `1080p` beats an untagged listing), not by episode count. A higher-ranked duplicate can contain only part of the series. Users can switch versions in the details modal. Fix: include episode counts when ranking series variants (needs `get_series_info` per variant during normalization).

## KI-026

**TV downloads depend on relay URLs that expire** — logged 2026-09-23

Media3 stores the relay URL (token valid `BACKEND_RELAY_TOKEN_HOURS`, default 12 h) in the download request. A download paused longer than that cannot resume and must be deleted and restarted. Offline playback is unaffected (it reads the cache). HLS downloads without stream keys fetch every rendition of multi-bitrate playlists (Xtream VOD playlists usually have one).

## KI-027

**TV profiles are pick-only** — logged 2026-09-23

Profiles can be selected on TV but only created, renamed or deleted in the web app.

Resolved 2026-09-24: the TV/phone app has the web's Manage Profiles (add, edit, delete) (D-041).

## KI-028

**Hold-to-scrub not covered by device tests** — logged 2026-09-23

Maestro sends single key presses; long-press behaviour is verified by unit/component tests only (D-030). Remotes or setups that report a key only once (no key-up, or only key-up, as the Android TV emulator does for arrows when the player's focus anchor holds focus) fall back to taps and cannot scrub. Verify on a real TV remote.

## KI-029

**No Android build or emulator in the Claude Code sandbox** — logged 2026-09-23

No `/dev/kvm`, and `dl.google.com` (Android SDK, Google Maven) is blocked by the environment's network policy. Native changes are verified by the `tv-app.yml` GitHub Actions workflow. Allowing `dl.google.com` in the environment's network settings would enable APK builds (not emulation) in the sandbox.

## KI-030

**XMLTV programmes without `stop` are dropped** — logged 2026-09-23

The parser keeps only programmes with a valid start and stop (D-031). Some feeds omit `stop` and expect it to be inferred from the next programme's start. Those channels show gaps unless short EPG covers them.

## KI-031

**Guide windows align to UTC half hours** — logged 2026-09-23

The backend default `from` and the client slot math round to 30 minutes in UTC. In time zones with a 15/45-minute offset (for example UTC+5:45) the grid starts on a local :15/:45.

## KI-032

**No catch-up (archive) playback** — logged 2026-09-23

Channels report `hasCatchup`, but past programmes cannot be played; selecting one plays the live channel (D-032). Needs `timeshift` URLs in `IMediaProvider` and the relay.

## KI-033

**TV playback in the emulator not yet verified green** — logged 2026-09-23

Run 6 of `tv-app.yml` showed the player ready but the position at 0:00. The emulator now runs with a sound device (D-030); until a green run confirms it, TV playback is verified by Jest tests only.

Resolved 2026-09-23: `tv-app.yml` run 15 is green (login, playback, pause, +10 s skip, quick drawer, download, TV guide, offline playback). The runs on the way found and fixed three device bugs Jest could not see: no focused view on the player (D-028), `select` reported on release only, and release-only arrow events (remote normalizer).

## KI-034

**Direct mode: no sync between devices** — logged 2026-09-24

In direct mode (D-038) profiles, progress and the library live on each device. Continue Watching on the TV does not show what was watched on the web app or another TV. Workaround: use "My server". Planned: optional sync to a backend (NEXT-STEPS).

## KI-035

**Direct mode: library grouping runs on the UI thread** — logged 2026-09-24

Title parsing runs in chunks of 500 with a yield between them, but the grouping pass itself runs in one go on the JavaScript thread. On a catalog with tens of thousands of titles the TV can stutter briefly after sign-in and every 24 h. Home shows per-kind progress (downloading, grouping N of M). Movies and series download in parallel; on a phone the download is usually the slow part. The cached library keeps later starts fast.

## KI-036

**Direct mode: shorter guide, credentials in stream URLs** — logged 2026-09-24

The guide uses the provider's short EPG (up to 12 programmes per channel), so it reaches fewer hours ahead than the backend's XMLTV cache. Playback URLs contain the provider username and password (Xtream format); in server mode the relay hides them. They stay on the device, but can appear in Android logs.


## KI-037

**TV Home and My Downloads avoid FlatList** — logged 2026-09-24

On Android TV, Home and My Downloads render in a plain ScrollView. On the Android TV emulator, FlatList screens never scrolled (by D-pad or swipe), and their rows showed only buttons to UI automation (no text); the cause is unknown. Home has at most 13 rows, each loading its first 10 titles when Home opens. Phones keep the virtualized Home. The Movies/Series grids and horizontal rows still use FlatList.

## KI-038

**Download rules run inside the apps** — logged 2026-09-25

The 30-day online check, the subscription check and sign-out deletion (D-050) are enforced by the web and TV apps, not by the stored files. A modified app, DevTools (web) or root access (Android) can get around them. Media3 also keeps each download's source URL in its private database; in direct mode that URL contains the provider username and password (see KI-036).

## KI-039

**Kids profiles filter by category name, without a PIN** — logged 2026-09-25

Providers send no age ratings, so Kids profiles show only categories whose names look like children's content (D-053). A kids title in a general category ("Movies 2024") is hidden, and an unsuitable title inside a "Kids" category is shown. Any profile can pick another profile or untick "Kids profile" without a PIN, so this is a convenience filter, not a lock.

Update 2026-09-25 (D-054): an optional parental PIN now locks leaving a Kids profile and managing profiles. The PIN is per device, and the name-based filter is unchanged.

Update 2026-09-26 (D-064): parents can pick a Kids profile's categories per section. Titles are still allowed or hidden by category, so an unsuitable title inside an allowed category remains visible.

## KI-040

**Backups: no password recovery, and TV pickers need a file manager** — logged 2026-09-25

A backup file (D-056) can only be opened with its password; a forgotten password cannot be recovered. On Android TV the system folder and file pickers come from a file manager app; some TVs ship without one, and saving or restoring then fails with a message saying so (a file manager from the store fixes it). A server-mode session in a backup expires like any other session, so an old backup may need a new sign-in. The TV app's JS engine (Hermes) has no secure random source, so its salt and nonce come from `Math.random`; they only need to be unique, not secret, and each backup gets a new salt and so a new key, but a secure source would be better.

## KI-041

**External players: no progress, and not every app sends the User-Agent** — logged 2026-09-25

Titles opened in another player (D-057) do not save progress, so Continue Watching and Resume stay where they were. The provider User-Agent goes in the `headers` extra, which MX Player and Just Player read; VLC uses its own User-Agent, so providers that only accept certain players may refuse the stream in VLC. In server mode the relay link expires after a while, so a paused stream in the other app may stop when resumed much later.

## KI-042

**Some providers refuse streams with HTTP 401 while the login works** — logged 2026-09-25

Reported on a phone in direct mode: every movie and episode failed with `HTTP 401 Unauthorized` from the provider's stream server (file and HLS, both stream addresses), while login and catalog requests succeeded and the account showed 0 of 1 connections in use. Not reproduced with the fake panel. Likely causes on the provider side: a connection still counted for another app or device, or a temporary block after many requests in a short time (full library download, bursts of guide requests; one guide request got HTTP 503). The player now explains a 401/403 in plain words and the log records the User-Agent of each attempt; guide requests to the provider run 2 at a time instead of 4. Next step: compare with the same title in another player (D-057).

Update 2026-09-26: three hours later the same account played again (movies and episodes, same app version and User-Agent), so the 401s were a temporary block on the provider's side, most likely after the burst of requests. Guide requests stay at 2 in parallel.

## KI-043

**Some audio formats fail on some devices' hardware decoders** — logged 2026-09-26

The player uses the device's own decoders. On a Pixel phone (Android 16), an episode with Dolby Digital Plus 5.1 audio (E-AC3) failed in `c2.dolby.eac3.decoder` although the device reports support. The player now stops at once with a message naming the format and suggesting another version or an external player (VLC brings its own decoders), instead of retrying the same file on the other server address and as HLS. A lasting fix would bundle a software audio decoder (Media3 FFmpeg extension, several MB larger APK).

Update 2026-09-26 (D-059): FFmpeg audio decoders are bundled. The device's decoders still come first by default; on devices like this Pixel, choose account menu → Playback → FFmpeg first (the audio error message says so).

## KI-044

**TV froze at the end of "grouping titles" with a large library** — logged 2026-09-26, resolved the same day

With 159,801 movies the TV stopped responding at "grouping titles 158,000 of 159,801". Only reading the names yielded to the UI; matching them into titles, building the titles and saving the library ran as one block. Matching also had quadratic parts: lists were copied on every insert, and the fuzzy pass compared every pair of titles sharing a 4-letter prefix with a full LCS each. On a PC with 160,000 synthetic titles this block took 22 s; a TV CPU is many times slower.

Fix: the fuzzy pass only compares titles with the same prefix, year and numbers (a match needs those anyway), sorted by length so hopeless pairs are skipped, with a cheap shared-letters bound before the LCS; lists grow in place; SHA-1 ids without per-round allocations. Matching, building and saving (`packLibraryText`) now pause regularly, and progress runs across all steps as a percentage. Same groups as before (checked on 30,000 titles with typos). On the PC the longest block is now about 0.1 s.

