# Decisions

Why the code is the way it is. Each entry states what holds today; git history has how it got there. Code comments cite entries as `DECISIONS.md#d-XXX`.

A new decision gets the next free number at the bottom and a row in the index. When a decision replaces or extends an older one, update the older entry instead of adding history to it, or merge the two and list the merged ID under the survivor.

| ID | Title |
|----|-------|
| [D-001](#d-001) | Monorepo: npm workspaces + Turborepo |
| [D-002](#d-002) | A README in every folder |
| [D-003](#d-003) | Central config in the root `.env` |
| [D-004](#d-004) | Frontend toolchain versions |
| [D-005](#d-005) | TV app: Expo + react-native-tvos |
| [D-007](#d-007) | The shared package ships TypeScript source |
| [D-011](#d-011) | Xtream client: lenient parsing |
| [D-017](#d-017) | Name parsing: rules, tags, languages and prefixes |
| [D-021](#d-021) | One app context with vanilla Zustand stores |
| [D-022](#d-022) | Session persistence per platform |
| [D-023](#d-023) | Web playback engine |
| [D-024](#d-024) | Web offline downloads: Service Worker + AES-GCM chunks |
| [D-025](#d-025) | Web UI architecture |
| [D-027](#d-027) | Fake Xtream panel + end-to-end tests |
| [D-028](#d-028) | TV app architecture: native focus, store navigation, remote events |
| [D-029](#d-029) | TV playback and downloads: local Expo module over Media3 |
| [D-030](#d-030) | TV tests and CI |
| [D-032](#d-032) | Live TV page and guide |
| [D-033](#d-033) | Linters, formatters and the dev stack |
| [D-039](#d-039) | Diagnostics log: on the device, masked, shared by hand |
| [D-040](#d-040) | Home rows, category pages and the app icon |
| [D-042](#d-042) | "Skip ahead" with fixed choices instead of Skip Intro |
| [D-045](#d-045) | Smaller APK |
| [D-046](#d-046) | Phone player gestures |
| [D-047](#d-047) | Category chips |
| [D-049](#d-049) | Library sort orders |
| [D-050](#d-050) | Download protection |
| [D-052](#d-052) | APK releases and release signing |
| [D-053](#d-053) | Kids profiles |
| [D-054](#d-054) | Optional parental PIN |
| [D-055](#d-055) | My List per profile |
| [D-056](#d-056) | Password-protected backup and restore |
| [D-057](#d-057) | Open in another player |
| [D-058](#d-058) | Guide over the playing channel |
| [D-059](#d-059) | Bundled FFmpeg audio decoders |
| [D-060](#d-060) | Sign in and sync by QR code |
| [D-061](#d-061) | Play on TV from the phone |
| [D-062](#d-062) | TV/phone self-update from the GitHub release |
| [D-063](#d-063) | Content language filter |
| [D-066](#d-066) | One episode list per series, across its versions |
| [D-069](#d-069) | TV focus rules |
| [D-070](#d-070) | App versions MAJOR.MINOR.PATCH |
| [D-071](#d-071) | Desktop app: the web player in Electron |
| [D-073](#d-073) | Desktop in-app updates |
| [D-074](#d-074) | Playback errors: ask the provider, say whose problem it is |
| [D-077](#d-077) | Player buttons and remote keys |
| [D-078](#d-078) | Card and episode menus |
| [D-079](#d-079) | Parity: one look and one feature set in every app |
| [D-081](#d-081) | Watched movies, episodes, seasons and series |
| [D-084](#d-084) | The app in four languages |
| [D-087](#d-087) | The version, audio and subtitles a title starts with |
| [D-088](#d-088) | No server: the apps talk to the provider directly |
| [D-090](#d-090) | Track names |
| [D-092](#d-092) | Pause when the headphones go away |
| [D-093](#d-093) | Large libraries on slow TVs |
| [D-094](#d-094) | TV pages: the focus in the middle, light grids |
| [D-110](#d-110) | Categories shown |
| [D-111](#d-111) | Automatic subtitles from OpenSubtitles.com |
| [D-115](#d-115) | Provider lists are streamed, natively on TV and phone |
| [D-119](#d-119) | Library progress and feedback |
| [D-121](#d-121) | Everything on the device in SQLite |
| [D-128](#d-128) | Seeking: presses in a row skip further |
| [D-129](#d-129) | Channels watched last |
| [D-130](#d-130) | Search |
| [D-131](#d-131) | A series' Play goes on to the next unwatched episode |
| [D-133](#d-133) | Title grouping in the database |
| [D-135](#d-135) | Library updates: only what changed |
| [D-141](#d-141) | Cinema-copy tag on covers |
| [D-143](#d-143) | Docs every change keeps current |
| [D-147](#d-147) | Continue watching on the TV home screen (Watch Next) |
| [D-151](#d-151) | "Who's watching?" every time; no TV sleep mode |
| [D-154](#d-154) | TV colour keys |
| [D-158](#d-158) | Details in columns on landscape screens |
| [D-174](#d-174) | Known issues and planned work are GitHub issues |
| [D-175](#d-175) | Connection limit: ask the provider before playing |
| [D-176](#d-176) | Better copies on My List |
| [D-177](#d-177) | No navigation bar on phones and tablets |
| [D-178](#d-178) | Every device shows a sync code; camera devices scan |
| [D-179](#d-179) | TV: the progress bar takes the focus |
| [D-180](#d-180) | TV and phone: preview frames on the progress bar |
| [D-181](#d-181) | TV rows keep the end cards clear of the screen sides |
| [D-182](#d-182) | Every card menu option has an icon |
| [D-183](#d-183) | Details: the icon buttons wrap beside Play |
| [D-184](#d-184) | Guide reminders |
| [D-185](#d-185) | Split and merge titles by hand |
| [D-186](#d-186) | Automatic sync through the paired TV |
| [D-187](#d-187) | Desktop: downloads go on with the window closed |
| [D-188](#d-188) | TV and phone: names read in the system WebView |
| [D-189](#d-189) | Desktop: FFmpeg converts what Chromium cannot decode |
| [D-190](#d-190) | Phones show no focus look |
| [D-191](#d-191) | Desktop: progress from VLC through its web interface |
| [D-192](#d-192) | Desktop conversion: every audio track, timeline pictures, downloads |
| [D-193](#d-193) | Shared screens with React Native Web: the My List trial |
| [D-194](#d-194) | Shared screens: one card for every app, the app brings a host |
| [D-195](#d-195) | Shared Movies and Series: one grid, three ways to scroll |
| [D-196](#d-196) | Shared Search |
| [D-197](#d-197) | Shared Home |
| [D-198](#d-198) | Shared My Downloads |
| [D-199](#d-199) | Shared sign-in |
| [D-200](#d-200) | Shared profiles |
| [D-201](#d-201) | Shared Live TV |
| [D-202](#d-202) | Shared details |
| [D-203](#d-203) | Shared details buttons |
| [D-204](#d-204) | Shared dialogs |
| [D-205](#d-205) | Shared language and subtitle settings |
| [D-206](#d-206) | Shared About and app language |
| [D-207](#d-207) | Shared account menu |
| [D-208](#d-208) | Shared top nav |
| [D-209](#d-209) | Shared guide over the playing channel |
| [D-210](#d-210) | Shared player panel (audio, subtitles, versions, episodes) |
| [D-211](#d-211) | Shared next-episode card |
| [D-212](#d-212) | Shared Skip ahead button |
| [D-213](#d-213) | Shared player top bar |
| [D-214](#d-214) | Shared guide reminder dialog |
| [D-215](#d-215) | Shared library banner and refresh notice |
| [D-216](#d-216) | Shared backup dialog |
| [D-217](#d-217) | Shared player buttons |
| [D-218](#d-218) | Shared progress bar |
| [D-219](#d-219) | Shared parental PIN keypad |
| [D-220](#d-220) | Shared log view |
| [D-221](#d-221) | Shared card menu |
| [D-222](#d-222) | Phone: guide reminders as system alarms |
| [D-223](#d-223) | Title splits and merges sync and back up |
| [D-224](#d-224) | Desktop: hardware H.264 encoders for conversions |
| [D-225](#d-225) | Profile settings carry dates and sync automatically |
| [D-226](#d-226) | Desktop: start with the computer, in the tray |
| [D-227](#d-227) | "Provider unavailable" apart from "offline" |
| [D-228](#d-228) | Changing the provider sign-in keeps the account |
| [D-229](#d-229) | Joined lists and the parental PIN sync by date |
| [D-230](#d-230) | Offline warning on every page, with the provider's own words |
| [D-231](#d-231) | Long dialog lists take the room left, not a shrunk size |
| [D-232](#d-232) | One Save and Cancel footer for every dialog that changes something |
| [D-233](#d-233) | Save and Cancel in a column on the right of the dialog |
| [D-234](#d-234) | New seasons of watched series |
| [D-235](#d-235) | Quality tags and upgrades in the profile's languages |
| [D-236](#d-236) | Desktop conversions keep subtitles; MKV read first |
| [D-237](#d-237) | An X closes every dialog, except on TV |
| [D-238](#d-238) | TV: a reminder opens the app |
| [D-239](#d-239) | Finding a TV that got a new address |

## Merged and retired IDs

Old IDs still appear in git history and older notes. Each points to the entry that now holds it.

| Old IDs | Now |
|---------|-----|
| <a id="d-006"></a><a id="d-008"></a><a id="d-009"></a><a id="d-010"></a><a id="d-012"></a><a id="d-013"></a><a id="d-014"></a><a id="d-015"></a><a id="d-016"></a><a id="d-018"></a><a id="d-019"></a><a id="d-020"></a><a id="d-026"></a><a id="d-031"></a><a id="d-035"></a><a id="d-036"></a><a id="d-051"></a>D-006, D-008 – D-010, D-012 – D-016, D-018 – D-020, D-026, D-031, D-035, D-036, D-051 | Retired with the server, the Python normalizer and the Codespaces setup: [D-088](#d-088) |
| D-037 | [D-052](#d-052) |
| D-038 | [D-088](#d-088) |
| D-041, D-080, D-124 | [D-079](#d-079) |
| D-043, D-122, D-153, D-157, D-159, D-160, D-161 | [D-040](#d-040) |
| D-044 | [D-030](#d-030) |
| D-048 | [D-025](#d-025) |
| D-064 | [D-053](#d-053) |
| D-065, D-156 | [D-133](#d-133) |
| D-067, D-086, D-145 | [D-063](#d-063) |
| D-068 | [D-151](#d-151) |
| D-072, D-162 | [D-060](#d-060) (D-072's installer and size: [D-071](#d-071)) |
| D-075, D-076, D-149, D-152, D-171 | [D-069](#d-069) (D-075's player buttons: [D-077](#d-077)) |
| D-082, D-104, D-132 | [D-081](#d-081) (D-104's menu items: [D-078](#d-078)) |
| D-083 | [D-078](#d-078) |
| D-085, D-091, D-105, D-108, D-112, D-114, D-170 | [D-047](#d-047) (D-108's search filter: [D-130](#d-130); D-112's prefixes: [D-017](#d-017), its menu trap: [D-069](#d-069)) |
| D-089 | [D-090](#d-090) (its languages: [D-017](#d-017); its episodes button: [D-077](#d-077)) |
| D-095, D-096, D-098, D-099 | [D-094](#d-094) |
| D-097, D-155 | [D-046](#d-046) |
| D-100 | [D-042](#d-042) (its focus glow: [D-069](#d-069)) |
| D-101, D-102 | [D-077](#d-077) |
| D-103, D-139, D-140 | [D-032](#d-032) |
| D-106 | [D-071](#d-071) |
| D-107, D-134, D-167 | [D-017](#d-017) |
| D-109, D-137, D-138 | [D-135](#d-135) |
| D-113 | [D-115](#d-115) (its saved parts: [D-121](#d-121); its crash log: [D-039](#d-039)) |
| D-116, D-118 | [D-093](#d-093) |
| D-117, D-142 | [D-119](#d-119) (D-117's saved file: [D-121](#d-121)) |
| D-120, D-123, D-125, D-126 | [D-121](#d-121) |
| D-127 | [D-110](#d-110) |
| D-136, D-144, D-148 | [D-087](#d-087) |
| D-146 | [D-066](#d-066) |
| D-150 | [D-128](#d-128) |
| D-163 | [D-143](#d-143) |
| D-164, D-165, D-168, D-169 | [D-158](#d-158) |
| D-166 | [D-073](#d-073) |
| D-172 | [D-074](#d-074) |
| D-173 | [D-039](#d-039) |

---

## D-001

**Monorepo: npm workspaces + Turborepo** — 2026-09-23

- npm workspaces for `apps/web-player`, `apps/tv-app` and `packages/*`; Turborepo runs `build`, `typecheck`, `test` and `dev` across them.
- `apps/desktop` is not a workspace (its own `package-lock.json`), so the other pipelines never download Electron.

Why: npm ships with Node; Expo detects npm workspaces and configures Metro itself (pnpm's symlinks need extra Metro config). Turborepo adds caching and dependency order with one small `turbo.json`.

## D-002

**A README in every folder** — 2026-09-23

Every folder has a `README.md` with facts only, except generated or tool folders (`node_modules`, `dist`, `android`, …), `documentation/` (the root README describes it), Android `res/` folders (the resource merger rejects other files; the parent's README covers them) and `.github/` (GitHub would show `.github/README.md` instead of the root README).

## D-003

**Central config in the root `.env`** — 2026-09-23

- The committed root `.env` holds public settings: `APP_NAME`, `APP_SLUG`, `APP_ANDROID_PACKAGE`, `APP_PROVIDER_USER_AGENT`. `.env.local` (git-ignored) overrides it; real environment variables override both.
- No code has a fallback app name; every consumer fails fast when a key is missing.
- Web player: Vite `envDir` is the repo root and only `APP_*` keys reach the bundle, where they are public. TV app: `dotenv` in `app.config.ts`. Desktop: `scripts/prepare.mjs`.

Why: the product name is undecided, so renaming is a one-line change; a committed `.env` lets CI and fresh clones build with no setup. Never put secrets under `APP_`.

## D-004

**Frontend toolchain versions** — 2026-09-23

- React `19.2.3` pinned exactly in every app, so npm hoists one React copy (two copies break hooks). Expo SDK 57 requires it.
- TypeScript `~5.9.3` everywhere: Expo and editor tooling rely on the 5.x compiler API.
- Vite 8 with `@vitejs/plugin-react` 6; Vitest 5 for `packages/shared` and the web player.

## D-005

**TV app: Expo + react-native-tvos** — 2026-09-23

- Expo SDK 57 with `react-native` aliased to `react-native-tvos@0.86.3-0` (the fork's minor must match the SDK's React Native minor). `@react-native-tvos/config-tv` with `isTV: true` adds the Android TV manifest. Platform: Android only.
- The root `package.json` `overrides.react-native` forces the fork everywhere; `expo.install.exclude: ["react-native"]` stops `expo install` from undoing the alias.
- `.npmrc` `legacy-peer-deps=true`: the fork's pre-release versions never satisfy peer ranges like `react-native >=0.78`, so peers npm used to add (`@testing-library/dom`, `@react-native/jest-preset`, `test-renderer`) are explicit devDependencies.

Why: core React Native dropped TV support; the fork provides `TVEventHandler`, `hasTVPreferredFocus` and focus events. Expo gives config plugins and native-module tooling.

## D-007

**The shared package ships TypeScript source** — 2026-09-23

`@iptv/shared` exports `src/index.ts` directly, with no build step: Vite and Metro both compile workspace TypeScript, so there are no watch processes or stale `dist`. Constraint: no DOM or React Native imports in shared code.

## D-011

**Xtream client: lenient parsing** — 2026-09-23

- Xtream JSON is read with lenient readers (`direct/looseJson.ts`), not strict types: panels send one field as `"55"`, `55`, `null` or `""`; `info` as `{}` or `[]`; `episodes` as an object by season or an array of arrays. Strict parsing fails on the first mismatch and takes a whole catalog down.
- The server address accepts `host:port`, strips `player_api.php` / `get.php` and keeps any sub-path.
- Container extensions are sanitized (letters and digits, at most 8) before they go into URLs.
- Live streams prefer `m3u8` and fall back to `ts` when `allowed_output_formats` excludes HLS.
- Code: `packages/shared/src/direct/xtream.ts`.

## D-017

<a id="d-086"></a><a id="d-089"></a><a id="d-107"></a><a id="d-112"></a><a id="d-134"></a><a id="d-167"></a>

**Name parsing: rules, tags, languages and prefixes** — 2026-09-23, updated 2026-10-08 (merges D-107, D-134, D-167 and the parsing parts of D-086, D-089, D-112)

Rule-based parsing (regexes and vocabularies in `direct/normalizer/tags.ts`), no ML model: IPTV names follow a small set of conventions, rules are fast and deterministic, and every failure becomes a JSON case in `normalizer/cases/`.

`parseTitle` (`normalizer/parser.ts`), in order: fold phrases (`WEB-DL`, `Dual Audio`) → strip leading prefix groups → brackets (years and tag-only groups removed) → scene names (dots and underscores to spaces) → cut at the first year or strong tag after word 1 → strip trailing tag words → tidy ("Matrix, The" → "The Matrix") → key (accents, case, punctuation, roman numerals, leading "the/a/an").

Guards against false positives:
- Two-letter language codes (`IT`, `US`, `DE`) count only in a prefix, in brackets or in capitals: "It (2017)" stays a title. `US`/`UK` are not languages.
- The first word is never cut ("1917"). Years outside 1900..next year are title words ("Blade Runner 2049").
- A short strong tag ("TS", "TC", "CAM", "WEB", "NF") ends the title only when nothing but tags follows it; longer tags ("1080p", "WEBRip") and years always do.
- Numbers inside words keep titles apart ("EP197" ≠ "EP196"); leading zeros do not count ("Part 02" = "Part 2").

Prefixes and languages:
- A leading prefix group (up to eight capitals, every part a known tag) before " - ", ":", "=" or between pipes sets the version's language: "EN - ", "|DE| ", "PL = ", "PUNJABI - ".
- An unknown group of two or three capitals before " - " or between pipes is dropped too, with no language ("XY - The Matrix"). Not before ":" or "=" ("CSI: Miami", "E=MC2"), not in mixed case, not four letters or more. Acronyms that start real names stay (`KEPT_PREFIX`: UFC, WWE, NBA, BBC, HBO, CSI, …).
- "BL - " (Bollywood) is dropped with no language.
- Languages include Albanian (`ALB`, `SQ`), Kurdish (`KUR`, `KU`), Greek (`GRE`, `GR`), Punjabi (`PAN`, `PA`; not "pan"), Ex-Yu (`EXYU`: Serbian, Croatian, Bosnian, which providers group together) and Polish (`PL`). "EAR" (capitals only) is English audio with Arabic subtitles burned into the picture.
- Subtitles come from a language next to a subtitle word ("SUB ITA", "[ENG SUB]") and from "VOSTFR", "VOSE", "Legendado", "Multi-Sub"; such a language is not audio.
- Registering a language in `tags.ts` is still worth it: only known prefixes set a language.

Versions: what the parser read from each name is kept in the library database under its own version, `NAME_RULES` in `sqlLibrary.ts`. Raise it only when `parseTitle` changes; raising the grouping rules (`NORMALIZER_RULES`, D-133) regroups titles without reading every name again.

## D-021

**One app context with vanilla Zustand stores** — 2026-09-23

- `createAppContext` (`packages/shared/src/appContext.ts`) builds the provider client and the stores: session, catalog, epg, library, player, progress, watchlist, PIN and profile preferences. Stores use `zustand/vanilla`; React reads them with `useAppStore(store, selector)`, which wraps selectors in `useShallow` (Zustand 5 loops forever on a selector that returns a new array).
- Dependencies (`storage`, `fetch`, the API) are injected, so tests run the real stores against a fake (`testing/fakeBackend.ts`).
- Remote data lives in `Resource<T>` records keyed by query; a loader shares one request between callers and has a generation counter, so a request still in flight after `reset()` (sign-out) cannot write stale data. Errors are stored, not thrown.
- An account change resets the account-scoped stores.

Why: vanilla stores work outside React and bind with one hook; one factory per app is the one place for cross-store rules.

## D-022

**Session persistence per platform** — 2026-09-23

The session store persists one snapshot through a `KeyValueStorage` adapter, written explicitly after each change (not the `persist` middleware): `expo-secure-store` (Android Keystore) on TV and phone, the system-encrypted storage (`safeStorage`) in the desktop app, `localStorage` in a plain browser (development only, D-088).

## D-023

**Web playback engine** — 2026-09-23

- `PlaybackEngine` tries sources in order and stops at the first that loads (`webPlaybackAttempts`): a completed download, then for VOD the panel's HLS output (`.m3u8`, which plays MKV sources in any browser) and then the original file; live tries HLS, then the panel's MPEG-TS output through `mpegts.js` for panels without HLS output (issue #220). An account whose allowed formats exclude HLS goes straight to MPEG-TS. A dropped MPEG-TS connection is reopened three times before the error.
- hls.js fatal errors after start: network → `startLoad()`, media → `recoverMediaError()` (twice), then an error message (D-074).
- Timeline previews: providers ship no trickplay sprites, so `frameGrabber.ts` opens a hidden, muted second video at the lowest rendition on the first timeline hover and draws frames into a canvas. It costs one extra stream connection while previewing, so it only runs where the account has one to spare (D-175).
- The player and hls.js are a lazily loaded chunk; `mpegts.js` loads only when a stream needs it.

## D-024

**Web offline downloads: Service Worker + AES-GCM chunks** — 2026-09-23

- A page-side `DownloadManager` fetches a download, encrypts each segment or 4 MiB chunk with a non-extractable AES-GCM key (IndexedDB), stores the ciphertext in the Cache API, and the Service Worker serves it back under `/__offline__/`, answering `Range` one chunk at a time.
- HLS downloads keep every playlist resource and a rewritten local playlist, so hls.js plays offline as online.
- Downloads at once: one per provider stream beyond the first, at most three (`downloadSlots`, D-187); resumable from the last chunk; interrupted downloads come back paused.
- The SW also precaches the app shell, so the app opens offline. It is bundled by a small Vite plugin with esbuild, not Workbox.

Why: no `.mp4`/`.mkv` is ever written to the user's files, and copied cache files are ciphertext. It is not DRM: scripts on the origin can still read decrypted bytes ([#213](https://github.com/brunoccst/iptv-player/issues/213)).

## D-025

<a id="d-048"></a>

**Web UI architecture** — 2026-09-23 (merges D-048)

- Navigation: a small Zustand `uiStore` mirrored into `history.pushState`, not a router. Browser Back closes the player, then the modal, then returns to the previous view. Each entry also writes the page into the address hash (view, category, search, details; not the player, so a reload never starts playback by itself), and a reload or a typed address opens that page. Details opened from an address get the page under them as their own history entry, so closing them stays in the app (issue #221). A hash, not a path: the desktop serves one `index.html` and needs no route fallback.
- Rows load when scrolled within 400 px of the viewport. Grid cards are memoized and use `content-visibility: auto`, which keeps scrolling smooth up to thousands of cards (stress test: `FAKE_PANEL_STRESS`, `scripts/stress-web.mjs`).
- Hero trailer: a muted `youtube-nocookie.com` embed fades in after 3 s when the provider has a trailer id; the backdrop otherwise.
- When a library update ends, `LibraryBanner` invalidates the library and bumps `libraryRevision`; mounted views reload.
- Plain CSS with tokens; no CSS framework.

## D-027

**Fake Xtream panel + end-to-end tests** — 2026-09-23

- `tools/fake-xtream-server` (Python standard library) emulates a panel: duplicates, sequels, MKV-only titles, series, live channels, XMLTV, 302 redirects to media, HTTP Range, a sliding live window and SVG artwork. It allows web pages to read its answers (CORS). `generate_media.py` builds VP9/Opus test media (plays in Playwright's Chromium).
- Playwright tests (`apps/web-player/e2e`) start the panel and a production web build on their own ports; the TV emulator flows and the desktop smoke test use the same panel.
- `FAKE_PANEL_STRESS` serves huge categories and libraries for stress runs.

Why: the provider → library → UI → player chain fails mostly in integration; the panel is also a demo target without a subscription.

## D-028

**TV app architecture: native focus, store navigation, remote events** — 2026-09-23

- Focus: Android's native focus search (react-native-tvos) between `Pressable`s, no JS spatial-navigation library. `hasTVPreferredFocus` sets the first focus per screen; `TVFocusGuideView` traps or remembers focus. The rules are in D-069.
- Navigation: a small Zustand stack (`navStore`) instead of React Navigation. Hardware Back pops; at the root Android exits.
- Remote events: `useRemote` wraps `useTVEventHandler`. react-native-tvos reports `select` and `playPause` on release only, arrows on press and release; some remotes and the emulator send arrows as release only, so `createRemoteNormalizer` turns a release without a press into press + release. `APP_TV_DEBUG_REMOTE=1` logs the events.
- The player holds a transparent full-screen `Pressable` with `hasTVPreferredFocus` whenever no buttons or panels are up: Android TV only delivers keys to `useTVEventHandler` while a view in the React root has focus.

## D-029

**TV playback and downloads: local Expo module over Media3** — 2026-09-23

- The local module `apps/tv-app/modules/tv-media` (Kotlin, Media3) provides `TvPlayerView`, downloads and the other native calls; `expo-video` is not used (it exposes neither its data source nor a download API).
- `DownloadCenter` owns the cache (`filesDir/offline-media`, private), the `DownloadManager` (one download at a time) and the data sources; offline playback uses the exact downloaded request. `TvDownloadService` keeps downloads alive in the background. Download metadata is JSON in `DownloadRequest.data`.
- The view has no built-in controller; React Native draws the UI.
- Playback order (`tvPlaybackAttempts`): a completed download → the original file (ExoPlayer plays MKV/MP4/TS) → the panel's HLS. Live: HLS, then TS.

## D-030

<a id="d-044"></a>

**TV tests and CI** — 2026-09-23 (merges D-044)

- Jest (`jest-expo/android`, React Native Testing Library) runs anywhere, with a mock of the native module and a remote mock (`pressRemote`).
- The cloud container has no `/dev/kvm` and no Android SDK ([#224](https://github.com/brunoccst/iptv-player/issues/224)), so APK builds and emulator runs happen in GitHub Actions: `tv-app.yml` builds an x86 release APK (the emulator's ABI only), boots an Android TV emulator against the fake panel and runs Maestro flows (D-pad, playback, drawer, download, offline, phone search, hold Right). `tv-stress.yml` runs the large-library flows by hand or on branches named `*stress*`.
- Emulator quirks: it runs with a sound device (ExoPlayer's clock follows audio output); flows pause before reading the clock (screen reads take seconds); the keyboard is closed with Enter (`hideKeyboard` sends Back). `e2e/run.sh` prints screen text and filtered logcat into the job log.
- Gradle's build cache is kept between runs (written by `main`, read by pull requests).
- `ci.yml` runs on pull requests and pushes to `main`; changes that touch only Markdown or `LICENSE` skip the builds.
- Not scriptable: holding a key (Maestro sends single presses); quick bursts stand in for it, the rest is unit-tested.

## D-032

<a id="d-103"></a><a id="d-139"></a><a id="d-140"></a>

**Live TV page and guide** — 2026-09-23, updated 2026-10-04 (merges D-103, D-139, D-140 and D-090's Live TV category)

- `@iptv/shared` owns the guide's layout (`layoutGuideRow`: clip to the window, trim overlaps, fill gaps) and paging (`useEpgGuide`). Cells carry fractions, so the web uses CSS percentages and TV multiplies by the row width.
- The guide comes from each channel's short EPG (12 programmes). Where it runs out, or has nothing, the full XMLTV guide saved for search (D-130, the next two days, no descriptions) fills in by the channel's guide id; a programme that overlaps one of the short EPG is left out, so the short EPG wins (issue #229). The grid only uses a guide already downloaded and starts the download when there is none. Guide windows start on local half hours, also in zones offset by 15 or 45 minutes (issue #225). A filled programme's description is looked up when it is opened, in the provider's guide for that channel (`get_simple_data_table`, cached half an hour), rather than saved: descriptions would make the saved guide several times larger on TV (issue #248).
- Catch-up (issue #226): a channel with `tv_archive` plays an ended programme from Xtream's `timeshift/<user>/<password>/<minutes>/<YYYY-MM-DD:HH-MM>/<id>.<m3u8|ts>`, the start written in the panel's `server_info.timezone` (UTC when it names none). The short EPG starts at the programme on now, so a recorded channel whose short EPG starts after the guide window also reads `get_simple_data_table` (the panel's full list for that channel, a day back kept, cached like the short EPG). The guides go back a day. A recording is a `PlayTarget` with `catchup`: the players treat it as a video (seeking, no LIVE tag) but save no progress and do not note the channel as watched last. TV: OK on an ended programme plays it, holding OK on the one on now plays it from its start; phone and web: buttons in the programme details. There is no check against `tv_archive_duration` (issue #247): a programme older than the provider keeps fails like any stream.
- Web/desktop: a 3-hour window, Earlier / Now / Later move 1 hour, a sticky channel column and time header, a red "now" line. The page is as tall as the window; the categories and the guide scroll on their own. Narrow windows (720 px or less) keep a scrolling page with chips.
- TV: a 2-hour window with fixed-height rows, so focus search moves naturally; the focused programme is described above the grid; Select plays the channel. The page does not scroll: the category list and the channels scroll on their own. Down at the last channel stays in the guide (`trapFocusDown`); Up from Earlier / Now / Later goes to "Live TV" in the nav (`nextFocusUp`). Left from a channel goes to the category list (the one exception to D-069). Right on a row's last programme moves the window an hour later; while the window is ahead of now the channel cell is not focusable and the row keeps Left, so Left on the first programme moves an hour earlier (issue #240). The key arrives before the focus moves, so the focused cell's place in its row decides.
- TV categories: ↑/↓ move one category and keep it in the middle; Channel +/− move a page.
- The chosen category lives in `navStore.categoryId`, so it survives the player.
- Guide rows are memoized and get only their own selection, so loading more channels does not re-render every row.

## D-033

<a id="d-034"></a>

**Linters, formatters and the dev stack** — 2026-09-23 (merges D-034)

- TS/TSX/JS: ESLint (`js` + `typescript-eslint` recommended, `react-hooks` `rules-of-hooks` and `exhaustive-deps` as errors) and Prettier (140 columns, single quotes). Only those two `react-hooks` rules: the React Compiler rules flag intentional patterns without a compiler in the build.
- Python (fake panel, `scripts/*.py`): Ruff (`ruff.toml`).
- Markdown, YAML and JSON are not formatted: docs keep hand-written tables and Mermaid.
- Bulk format commits are listed in `.git-blame-ignore-revs`.
- `npm run dev:all` (`scripts/dev.mjs`) starts the fake panel and the web dev server, with no extra dependency, on Windows too, and stops everything when any process exits.

## D-039

<a id="d-173"></a>

**Diagnostics log: on the device, masked, shared by hand** — 2026-09-24, updated 2026-10-11 (merges D-173 and D-113's crash log)

- A shared ring buffer (`appLog`, 600 lines, lines older than 3 days dropped) records provider requests, library steps, player sources, errors and uncaught errors, saved across restarts. Nothing leaves the device unless the user shares it: TV and phone use the share sheet, the desktop saves or copies it. No crash or analytics service.
- Masking (every app, `logger.ts`): `appLog.hide()` takes values to mask everywhere (the Xtream server URL, host, username and password; the OpenSubtitles key, username, password and token). `redact()` also masks every URL's host (except localhost, TMDB, OpenSubtitles and GitHub), `key`/`token`/`auth`-like query values, Bearer tokens, e-mail and IPv4 addresses and bare host names. Kept lines are masked again at start-up and when a value is hidden. Titles and stream ids stay.
- The phone fetches the TV's log: a sealed remote command `{ type: 'log' }` over the Play on TV channel (D-061); the phone's Log page has **Get TV log** and shares the answer. A TV's share sheet has nowhere useful to send text.
- Native crashes (TV, phone): `CrashLog.kt` writes the crash to a file and the next start adds it to the log; every start logs the Java heap limit and the device's RAM (`startupLog.ts`).

## D-040

<a id="d-043"></a><a id="d-122"></a><a id="d-153"></a><a id="d-157"></a><a id="d-159"></a><a id="d-160"></a><a id="d-161"></a>

**Home rows, category pages and the app icon** — 2026-09-24, updated 2026-10-07 (merges D-043, D-122, D-153, D-157, D-159, D-160, D-161)

- Row titles open the category: on TV and phone a category page, on the web the Movies/Series page with that chip.
- TV and phone: a Home row shows its first 10 items and, when the category has more, a "See all" card. Rows that loaded more while scrolling stuttered on phones.
- TV Home builds its first 4 rows at the start, then two below the focused row (and two more on a scroll near the end); a row fetches its titles when built.
- Desktop: rows load more as they scroll. The ‹ arrow hides at the row's start, › at its end, both when the cards fit; snap positions are offset by the gutter (`scroll-padding-inline`) so position 0 counts as the start.
- Top rated rows ("Top rated of the {count} newest movies/series", after Live TV): of the `TOP_RATED_POOL` (100) titles added last, the `TOP_RATED_COUNT` (25) best by the provider's rating, leaving out unrated titles and scores shown as 100 % (9.95 and up, usually one review). They are the app's own rows: no "See all", no title link. No trending row: IMDb has no free API, and TMDB lists need a user's own key.
- One icon design (`scripts/render-icons.mjs`) is rendered to every PNG (launcher, TV banner, splash, favicon) and committed, so builds need no image tooling. It has no text because `APP_NAME` is configurable.

## D-042

<a id="d-100"></a>

**"Skip ahead" with fixed choices instead of Skip Intro** — 2026-09-24, updated 2026-09-28 (merges D-100's window)

No intro detection: providers send no markers and detection needs server-side processing. Episodes of at least 10 minutes show **Skip ahead** from 5 to 15 s in (10 s on screen; it stays while its choices are open). It opens 30 s, 1 min, 2 min and 3 min; pressing it again, Back or Esc closes them. Same rule on every app (`SKIP_AHEAD_*` in `@iptv/shared`).

## D-045

**Smaller APK** — 2026-09-24

`expo-build-properties`: `useLegacyPackaging: true` (native libraries compressed in the APK), R8 and resource shrinking in release builds. 42.5 MB → about 16 MB. `tv-apk.yml` prints a size breakdown (`scripts/apk-size-report.py`). Not done: per-ABI APKs (many TVs run a 32-bit userland, and users would have to pick a file) and app bundles (only useful through Google Play).

## D-046

<a id="d-097"></a><a id="d-155"></a>

**Phone player gestures** — 2026-09-24, updated 2026-10-19 (merges D-097, D-155)

- The player locks to landscape (back to free rotation on close); the navigation bar stays hidden everywhere (D-177). The player keeps the screen on while video plays, on phones and TV.
- A tap shows or hides the controls; a second tap within 300 ms on the left or right third skips (D-128). The skip circle (`TapFlash`) takes no touches and is removed once faded.
- The timeline can be dragged and seeks once on release.
- A vertical slide on the left third sets the brightness, on the right third the media volume (`player/TouchLevels.tsx`); the middle is free for the live guide's swipe up (D-058). 60 % of the screen height is 0 to 100 %; slides from the top or bottom 8 % are left to the system. Brightness is the window's own (at least 1 %; the phone's comes back on close; kept for the next player of the run); volume is the system media volume without the system panel.
- Both level bars show whenever the controls are up (not with a panel or the guide open), so people see the sides that slide; otherwise one shows while sliding and a second after (2026-10-19).
- The Audio/Subtitles/Episodes panel has a back arrow and closes on a tap beside it: with the navigation bar hidden, phones have no Back key on screen (2026-10-19).
- Phones show the status bar outside the player, so screen cut-outs do not cover the header.

## D-047

<a id="d-085"></a><a id="d-091"></a><a id="d-105"></a><a id="d-108"></a><a id="d-114"></a><a id="d-170"></a>

**Category chips** — 2026-09-24, updated 2026-10-11 (merges D-085, D-091, D-105, D-108, D-114, D-170 and D-112's "Show all" box)

- Movies and Series (and Live TV on narrow screens) show the chips on one line. When they do not fit, **Show all** expands them into a full-width box of at most half the screen that scrolls on its own, with **Show less** in view; picking a chip or Show less returns to the line with the chosen chip in view. Same on every app (`ChipBar.tsx` in each app). Chip size stays readable and easy to hit.
- Phones render chips a page at a time (40 on the line, 150 in the box): thousands of categories stalled a Chromecast.
- TV bar: "All", as many categories as fit (measured off screen, one to three), ‹ › pinned to the right that page through them, then Show all. At the ends ‹ › stay enabled but do nothing (a disabled view loses the focus).
- TV focus: the collapsed bar and the expanded box are one tree, so Show all / Show less stays the same mounted view, keeps the focus and nothing scrolls the page. A chip in the box centers the whole box in the page, not itself.
- Web: the wheel scrolls the line sideways; a row title sits above the card track (`z-index: 1`) so the track's hover room does not take its clicks.

## D-049

**Library sort orders** — 2026-09-25, updated 2026-10-07 (merges D-153's sort)

- Movies/Series sort by date added (default, newest first), name, release date (each either way) or highest rated. Missing values go last; ties go by title, then year. The apps only offer orders the library has data for; the choice is kept per section until sign-out. Home rows use the default; search stays A–Z.
- Date added: newest provider time among the versions (movies `added`, series `last_modified`). Release: the provider's date, else the year in the name. Rating: the highest of the versions; 0 counts as missing.
- In SQLite, newest first is the row order and every other order is a table of row numbers made the first time a list asks for it (D-135).

## D-050

**Download protection** — 2026-09-25

- Android: downloads are AES-encrypted in the Media3 cache (`AesCipherDataSink`/`Source`) with a random key wrapped by a non-exportable Keystore key.
- Web: chunks are AES-GCM encrypted (D-024).
- Tied to the account: sign-out deletes the device's downloads (the menu warns); signing in with another account deletes the previous one's.
- Downloads play only while the subscription has not expired and the app reached the provider within 30 days; a clock set back before the last check blocks too. On start the app asks the provider for the account status (10 s limit): unreachable is offline, rejected signs out.

Limits: the rules run inside the apps ([#231](https://github.com/brunoccst/iptv-player/issues/231)); real protection needs DRM, which Xtream providers do not offer.

## D-052

<a id="d-037"></a>

**APK releases and release signing** — 2026-09-24, updated 2026-09-25 (merges D-037)

- `tv-apk.yml` builds an ARM APK (`armeabi-v7a`, `arm64-v8a`) after every push to `main` that changes the app (Markdown and emulator flows excluded), and publishes it as `tv.apk` to the `tv-apk` prerelease. A newer merge cancels a running build.
- The version code is the run number, so each APK is newer than the last.
- Signing: `scripts/create-signing-key.sh` creates one release key in the git-ignored `.signing/` and saves the secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` with the GitHub CLI (`--replace` and `--delete` ask first). `plugins/withReleaseSigning.js` uses the key when `ANDROID_KEYSTORE_FILE` is set; without the secrets the workflow warns and falls back to the debug key. The emulator CI signs with a throwaway key from the same script.
- Back up `.signing/`: a lost key means a new key and one uninstall on every device (Android refuses a different signature).

Why: Expo's debug key is public, so anyone could sign an APK that replaces the app and reads its data.

## D-053

<a id="d-064"></a>

**Kids profiles** — 2026-09-25, updated 2026-09-26 (merges D-064)

- Providers send no age ratings. A Kids profile sees only kids categories: by name in several languages (Kids, Kinder, Cartoons, Animation, Family, Disney, …, unless the name also says Adult, XXX, 18+; `profiles/kidsFilter.ts`), or the categories a parent ticked per section in the profile editor (Manage Profiles, behind the PIN). An untouched section keeps the name rule; an empty choice shows nothing.
- `withKidsFilter` in the shared client applies it to categories, live channels, the guide, library lists and search. A provider with no kids categories shows a Kids profile nothing, not everything. Switching between kids and regular profiles drops cached lists.
- A Kids profile's account menu only switches profile and closes the app; it has no "Open in another player".

Limits: a filter by category, not a lock ([#232](https://github.com/brunoccst/iptv-player/issues/232)).

## D-054

**Optional parental PIN** — 2026-09-25

- Account menu → Parental PIN sets a 4-digit PIN (typed twice); off until set; changing or removing it needs the current PIN.
- With a PIN, opening a regular profile from a Kids profile or "Who's watching?" and managing profiles ask for it. Opening a Kids profile, or switching between regular profiles, never asks.
- Stored per account on the device as a salted, repeatedly hashed value; five wrong tries lock checks for a minute. Signing out removes it, so a forgotten PIN costs one sign-in with the provider password.

## D-055

**My List per profile** — 2026-09-25

A round button in details saves a movie or series; saved titles show as a Home row and a page. An entry points at a library title (section + master id) and keeps its title, year and poster, so the list shows without the library. Kept on the device per profile (at most 500), in backups; changes show at once and are undone if saving fails.

## D-056

**Password-protected backup and restore** — 2026-09-25

- One `.iptvbackup` file holds the saved sign-in, the PIN, per profile the profiles, progress and My List, and the device settings each app lists in `BackupStorages.settingsKeys`. The library, downloads and the log stay out.
- Encrypted with a password of 8+ characters: PBKDF2-SHA256 (100,000 rounds, random salt; on TV and phone `crypto.getRandomValues` comes from Android's SecureRandom, issue #233), then XChaCha20-Poly1305 (`@noble/hashes`, `@noble/ciphers`: plain JavaScript for browsers and Hermes). A wrong password or a changed file writes nothing. Files from a newer app version are refused.
- Restore signs in without restarting (`AppContext.reload()`). TV and phone use the system pickers (`expo-file-system`); a TV without a file manager cannot ([#233](https://github.com/brunoccst/iptv-player/issues/233)).

## D-057

**Open in another player** — 2026-09-25, updated 2026-09-27 (merges D-081's VLC part)

- TV/phone: a button next to Play (movies) and in the episode menu hands the stream (the original file, else HLS) to another app with an Android `ACTION_VIEW` intent: `video/*`, the title, and the provider User-Agent in the `headers` extra (read by MX Player and Just Player). A `<queries>` entry lets Android 11+ list players.
- Desktop: **Open in VLC**; the main process finds VLC in the usual folders and on PATH and starts it with the stream and the User-Agent, http(s) only. The player's error offers it too.
- Not in a browser, not on Kids profiles, not for downloads (encrypted, D-050).

- TV/phone progress (issue #234): the intent is started for a result with `return_result`; MX Player and Just Player send `position`/`duration` (ints, ms) and `end_by`, VLC `extra_position`/`extra_duration` (longs), and the stop point is saved like our player's. The saved progress goes in `position` (an int, what MX Player and Just Player read; VLC reads a long there, so it starts from the beginning). Through the app chooser the chosen app's result still comes back.

On the desktop, VLC starts at the saved progress and the app reads where it stops through its web interface (D-191).

## D-058

**Guide over the playing channel** — 2026-09-25, updated 2026-09-27 (merges D-081's web part)

- While a live channel plays, a see-through panel lists the category's channels (first 50, next 3 hours) with now and next; the video keeps playing. Players opened from Home or Search know their channel's category (`PlayTarget.categoryId`).
- TV: ↑ opens it on the playing channel; Select switches; Back closes; it closes after 6 s without input.
- Phone: swipe up in the middle of the video, or the Guide button; tap beside it to close.
- Web/desktop: the Guide button or G (↑/↓ are the volume); a click switches; Escape, a click beside it or the button close it; no auto-hide.

## D-059

**Bundled FFmpeg audio decoders** — 2026-09-26

- Jellyfin's prebuilt Media3 extension `org.jellyfin.media3:media3-ffmpeg-decoder` adds software decoders for Dolby Digital (Plus), DTS, TrueHD and more. No native build here.
- The device's decoders come first (so Dolby can reach a soundbar); account menu → Library & devices → Playback can put FFmpeg first for devices whose decoders claim a format and then fail. The choice is per device and in backups, not in pairing.
- When the device's audio decoder fails on a title, the player restarts it from the same point with FFmpeg first and saves that as the device's choice, since such a decoder fails again on the next title (issue #235). The setting can put the device's decoders back.
- `modules/tv-media/android/build.gradle` adds it unless `iptvFfmpegAudio=false` or `IPTV_FFMPEG_AUDIO=0`; `tv-apk.yml` has an `ffmpeg_audio` input. The log's start line says whether it is bundled.

## D-060

<a id="d-072"></a><a id="d-162"></a>

**Sign in and sync by QR code** — 2026-09-26, updated 2026-10-07 (merges D-162 and D-072's pairing part)

- The TV and the desktop app show a QR code on the sign-in page and under Sync with phone; the phone app scans it (Connect a TV or computer) with Google's code scanner (`play-services-code-scanner`: no camera permission).
- Scanning signs a signed-out device in with the phone's account, or syncs a device on the same account; another account is refused.
- Merge, both ways: profiles match by id, else by name (the phone's ids are kept); per title the newest progress wins; My List is the union (removals are not recorded). Each profile's preferences (`settings.profiles`: content languages, app language, playback choices, hidden and kids categories, watched series, recent channels) and the automatic-subtitles settings are merged too; the phone's value wins, watched series and recent channels are joined (per entry by date since D-229). The merged settings travel in their own `settings` field, so an older phone never overwrites its other accounts' preferences.
- Stay on each device: the audio decoder, the device's own app language, downloads, Play on TV keys, update choices. The parental PIN: the later set or removal wins since D-229 (before, a phone's PIN was copied only to a device without one).
- Transport, no server: while the code shows, the TV (`PairingServer.kt`) or the desktop main process listens on the home network on a random port. The code holds its address, port and a one-time 32-byte key; both directions are sealed with XChaCha20-Poly1305, so plain HTTP reveals nothing. The server stops after one pairing or when the code closes. The desktop picks the first private IPv4 address, skipping virtual adapters (WSL, Hyper-V, VirtualBox, Docker, VPNs).
- Code: `packages/shared/src/pairing/` (protocol, merge, `usePairingServer`), `apps/tv-app/src/pairing/`, `apps/web-player/src/features/pairing/`.

Every device shows the code and a signed-out scanner gets the other device's sign-in since D-178. Limits: same network; the phone needs Play services. No sync after pairing ([#227](https://github.com/brunoccst/iptv-player/issues/227)).

## D-061

**Play on TV from the phone** — 2026-09-26

- After pairing, the phone shows a TV button next to Play (movies, the series Play, each episode's menu); the TV starts the title on its active profile, movies at the same position.
- Pairing hands each phone its own random 32-byte key; the TV keeps the last 5 phones, the phone its TV. Keys stay in Keystore-backed storage, outside backups.
- While the TV app runs and is signed in, it listens on the first free port of 38127–38131 (`PairingServer.kt`, `/remote`); the phone tries the saved port, then the range.
- Each command is sealed with the phone's key and carries its send time; the TV refuses unknown phones, other keys, commands older than 5 minutes, titles of another account, and asks for a profile when none is active. The log command (D-039) uses the same channel.

Limits: the TV app must be open. A new TV address from the router is found again on the home network (D-239). Google Cast was not used: it needs a registered receiver app, and the Chromecast would still need this app for provider streams.

## D-062

**TV/phone self-update from the GitHub release** — 2026-09-26

- About 15 s after start the app reads this repository's `tv-apk` release from the GitHub API (no login). The version is `version N` in the release notes (the version code, D-052). A newer one offers "Update now" or "Later" (which silences that version); account menu → Check for updates always shows it.
- "Update now" downloads `tv.apk` with a progress bar, checks GitHub's SHA-256, then the APK itself (same package, newer version code, same signing key), and opens the Android installer from the app's own activity. A different key explains back up → uninstall → install → restore instead.
- The workflow uploads the APK before it writes the notes, so an app never sees a new number next to the old file. `APP_UPDATE_REPO` is only set by `tv-apk.yml`.
- Code: `AppUpdater.kt`, `apps/tv-app/src/update/`. Permission: `REQUEST_INSTALL_PACKAGES`.

## D-063

<a id="d-067"></a><a id="d-145"></a>

**Content language filter** — 2026-09-26, updated 2026-10-05 (merges D-067, D-145 and D-086's category hint)

- Per profile, on the device (`settings.profiles`): any number of languages; a title shows when a version has audio or subtitles in one of them. None ticked turns it off. Live TV is not filtered.
- Languages come from the names (D-017): providers list no tracks per title, and `get_vod_info` per title is impossible for 100,000+ titles.
- Category hint: a version whose name has no language takes its category's ("SRS | DEUTSCH" is German); a version in a category with no language either passes whatever the filter (`profiles/contentLanguages.ts`, sent as `languageCategoryIds`).
- The order the languages are ticked in is their priority, shown as a number; unticking moves later ones up. The order decides the starting version and "(best)" (D-087), not which titles show.
- A saved single `language` from older versions still counts until the profile's languages change.

## D-066

<a id="d-146"></a>

**One episode list per series, across its versions** — 2026-09-26, updated 2026-10-05 (merges D-146)

- Each version of a series is its own series at the provider, often incomplete differently. Details and the player load every version's episodes (three requests at a time; a failing version is left out) and merge them by season and episode number (`playback/seriesVersions.ts`).
- An episode plays in the version chosen at the top when it has it, else in the best version that does; an episode in several versions has its own version picker (by episode id).
- Another entry with the same number in one version is the same episode, one more choice in its picker ("ENG (3) #2"), when the titles are equal or both name the same SxxEyy; otherwise it keeps its own row. Episodes without a number stay apart.
- Next-up, previous/next and progress work across versions.

Limits: versions that number seasons differently do not line up; opening a series costs one request per version.

## D-069

<a id="d-075"></a><a id="d-076"></a><a id="d-149"></a><a id="d-152"></a><a id="d-171"></a>

**TV focus rules** — 2026-09-26, updated 2026-10-11 (merges D-075, D-076, D-149, D-152, D-171, D-073's search box, D-100's glow and D-112's menu trap)

The owner's rules for the TV app (phones and computers have no D-pad focus):
- **Left/Right never leave the current row** and stop at its ends; only Up/Down change rows. Every horizontal group is a `FocusRow` (a `TVFocusGuideView` that traps Left/Right): rows of cards, the Home banner, row titles, chips, details buttons, episode rows, player buttons, dialogs, the PIN pad, …. `leftOpen` / `rightOpen` let focus out where a column sits beside it: Live TV's guide to its categories, a series' details buttons to its episodes.
- **A modal keeps the focus.** The details panel and the account menu trap all four directions. While the panel is open, nothing on the page behind can take the focus: `usePageFocusable` (`pageFocus.ts`) holds each page view's `hasTVPreferredFocus` as it was.
- **Closing details returns the focus to its opener**, or, when it is gone, to the registered view highest up, then furthest left on screen. The opener is remembered even when its ref detaches: an animated card re-attaches its ref whenever its style changes (focus, blur), which used to forget it as the panel opened. The focus is asked a frame after the panel closes, and a request that brings no focus event within 250 ms moves on to the first view on screen.
- **Episodes:** Up/Down go to the same button of the episode above or below (`useFocusGrid`, `nextFocusUp`/`Down`); an episode without a version picker takes them from "…".
- **Focus styles change only drawing** (colour, border, shadow, transform, opacity), never `zIndex` or anything that changes which native views exist or their order: Fabric removes and re-adds a reordered view, it loses the focus and Android hands it to the first focusable view (held Right fell to the nav; the phone search box lost its text field). The glow is a `boxShadow` (`0 0 16px 2px`, white at 50 %); a transparent `elevation` keeps a focused card above its neighbours.

## D-070

**App versions MAJOR.MINOR.PATCH** — 2026-09-26

- MAJOR.MINOR are set by hand in `apps/tv-app/package.json` and `apps/desktop/package.json` (write `X.Y.0`): MAJOR for changes that need something from the user (a reinstall, a new sign-in), MINOR for new features. PATCH counts the builds on `main` since then (`scripts/app-version.mjs`, from git history), so pull requests never conflict on it.
- On Android the build number stays the version code, which the self-update compares. Release notes start with "TV app X.Y.Z" and keep "version N" for older apps. About shows "1.2.3 (build 57)".

## D-071

<a id="d-106"></a>

**Desktop app: the web player in Electron** — 2026-09-26, updated 2026-09-29 (merges D-106 and D-072's installer and size)

- `apps/desktop` shows the bundled web player in its own window, with installers for Windows (`.exe`, a setup wizard: this user or all users, any folder), macOS (`.dmg`, Intel and Apple silicon) and Linux (`.AppImage`, `.deb`). `desktop.yml` builds them after changes reach `main` and publishes them with fixed names to the `desktop` prerelease.
- The app serves the page from `http://127.0.0.1:47831` (a secure context, so the Service Worker and Web Crypto work; fixed so saved state keeps its origin) and adds the CORS permission (`*`, no credentials) to provider answers; provider requests get the player User-Agent and no page origin. The web player notices the app through `window.iptvDesktop` (`apps/web-player/src/desktop.ts`).
- Storage goes through the main process: secrets encrypted by the system (`safeStorage`), the library in SQLite (D-121).
- Only English Chromium texts and the strongest compression. Electron brings its own Chromium (~200 MB installed); Tauri would be far smaller but plays differently per system and needs a proxy for CORS and the User-Agent; not planned (issue #238 closed 2026-10-27: a Rust rewrite of the native code for one system).
- The web player is the desktop app's screens; in a plain browser it is for development and tests only (D-088). The folder stays `apps/web-player`.
- `ci.yml` → Desktop runs its unit tests and a smoke test against the fake panel.

Limits: plays what Chromium plays ([#236](https://github.com/brunoccst/iptv-player/issues/236)); installers are not code-signed, so SmartScreen and Gatekeeper ask once.

## D-073

<a id="d-166"></a>

**Desktop in-app updates** — 2026-09-26, updated 2026-10-08 (merges D-166)

- Windows and the Linux AppImage use `electron-updater` with a generic feed on the `desktop` release (`latest.yml`, `latest-linux.yml`; `desktop.yml` uploads installers first, feeds after). About 15 s after start, and from the account menu, the app offers a new version; "Install now" downloads it, checks its SHA-512 and asks "Restart now" or "When I close the app". The Windows installer then runs silently into the same folder.
- While it downloads, the main process sends progress (`iptv:update-progress`) and the page shows "Downloading version X… N%" at the top right; the taskbar shows it too.
- macOS (unsigned apps cannot replace themselves) and the `.deb` open the download page.

Why: SmartScreen only asks about files marked as downloaded from the internet; a file the app downloads itself carries no mark, so updates skip the question without paid signing.

## D-074

<a id="d-172"></a>

**Playback errors: ask the provider, say whose problem it is** — 2026-09-27, updated 2026-10-11 (merges D-172)

- When a stream is not a video, or answers with an HTTP error, the app asks the provider for the first bytes of the same address with the player's User-Agent (`playback/probe.ts`) and logs status, type, length, final host and the start of the answer (credentials masked). A recognised answer replaces the general message: all connections in use, not found, expired or blocked, refused, empty. Desktop reads 64 KB and names codecs it cannot decode (HEVC without a decoder, MPEG-4, MPEG-2).
- Every app falls back to the stream server named in the login reply (`server_info`) when the portal address fails.
- The provider's server stops mid-video (TV/phone): a network error after playback started keeps the position; the stream server and HLS are tried from there with "The provider stopped sending the video. Reconnecting…". When they fail, the message names the provider's host as the problem and offers Try again (focused) above Go back, which retries every source from where it stopped. Desktop: `MEDIA_ERR_NETWORK` after the file loaded gives the same message and Try again.
- No automatic retry of the same host: a CDN host that timed out usually stays down for a while.

## D-077

<a id="d-101"></a><a id="d-102"></a>

**Player buttons and remote keys** — 2026-09-27, updated 2026-10-07 (merges D-101, D-102, D-075's player buttons and D-089's episodes button)

- Bottom row (TV/phone): play/pause, from the beginning (not on live), previous episode, −10 s, +10 s, next episode, time; Audio, Subtitles and Episodes (series) on the right, each opening the drawer on its tab (the drawer: Audio, Subtitles, Versions, Episodes). Previous/next follow the merged episode order (D-066) and save progress. Web/desktop have the same buttons and one "Audio, subtitles and version" panel.
- TV: ↓ opens the buttons on Play/Pause, ↑ on Back; on live, ↑ opens the guide (D-058) and ↓ the recent channels strip (D-129). The D-pad walks the buttons; Back or 8 s without a key returns to the video, where ←/→ seek again.
- While Skip ahead's choices or next-up's Play Now / Cancel are up, ←/→ move between them instead of seeking.
- The remote's media keys (Play/Pause, Play, Pause, ⏪/⏩, Stop to close) work whatever is on screen.

## D-078

<a id="d-083"></a>

**Card and episode menus** — 2026-09-27, updated 2026-09-28 (merges D-083 and D-104's menu items)

- Hold OK (TV), a long touch (phone), or right-click / the menu key / Shift+F10 (web) opens a card's menu: Go to details, Mark as (not) watched, Add to / Remove from My List; Continue Watching cards add Remove. "Remove" deletes a movie's progress, or every unfinished episode's of a series (finished ones keep their tag).
- An episode row shows only Play, "…" and, with several versions, the version choice. "…" (or the same gestures on the episode) opens: Mark as (not) watched, Download (or its state), Play on <TV>, Open in another player, Cancel; the items show the row buttons' icons after their text.
- One place decides the items and labels (`cardMenuItems`, `episodeMenuItems` in `playback/watched.ts`); each app passes what the device can do and draws the menu. Web menus open at the pointer, stay on screen and close on Escape, a click elsewhere, the wheel or resize.

## D-079

<a id="d-041"></a><a id="d-080"></a><a id="d-124"></a>

**Parity: one look and one feature set in every app** — 2026-09-27, updated 2026-10-11 (merges D-041, D-080, D-124 and D-073's card size)

- Every app has every feature unless it does not apply to the device, reached the way that device is used (hold OK on TV, a long touch on a phone, right-click on a computer). Each section of [FEATURES.md](FEATURES.md) ends with an **Apps:** line marking TV, Phone and Desktop.
- One look: the native screens mirror the web design (no WebView, which would lose native playback and the remote). Colours, fluid sizes and icons live in `@iptv/shared` (`design/`), and a test checks the tokens against the web CSS. A focused or hovered card grows 8 % with a light ring and soft glow; rows leave room so it is not cut. Cards keep one size (`min-width: 0`).
- One logic: `createAppHooks` (`packages/shared/src/hooks.ts`) gives both apps the same hooks for state, loading and actions; each app keeps only its drawing. React Native Web (one set of screens) was set aside: a much larger change.
- Checks: the pull request template asks which apps a change covers; `npm run lint:features` fails when a feature's **Apps:** line does not mark every app ✅, ➖ or ⏳, or a ⏳ names no GitHub issue. It cannot see features missing from FEATURES.md.

## D-081

<a id="d-082"></a><a id="d-104"></a><a id="d-132"></a>

**Watched movies, episodes, seasons and series** — 2026-09-27, updated 2026-10-03 (merges D-082, D-104, D-132)

- A movie or episode is watched when any version's progress is finished: 95 % played, or 2 minutes or less left on titles over 10 minutes. The progress list keeps 1000 entries per profile so older titles keep their tag.
- The tag is an eye at the bottom right of the cover, next to the title in details and on episode stills (`eye` / `eyeOff`; a check was too close to My List's).
- Marking saves finished progress on the chosen version (1 of 1 s without a known length); not watched removes every version's progress. Details have a round Watched toggle (a movie, or every episode of a series); the season header has one for the shown season; episodes have it in their menu (D-078).
- A card cannot count a series' episodes, so the profile notes fully watched series (`ProfilePrefs.watchedSeries`): set when marked or when details find every episode finished, cleared when one is unwatched. The note is per device ([#227](https://github.com/brunoccst/iptv-player/issues/227)).
- Code: `playback/watched.ts` (`isWatched`, `setMovieWatched`, `setSeasonWatched`, `setSeriesWatched`, …).

## D-084

**The app in four languages** — 2026-09-27

- English is the source and default; Brazilian Portuguese (`pt-BR`), German (`de`) and Serbo-Croatian as written in Bosnia (`sh-BA`: Latin script, ijekavian; dates and numbers `bs-Latn-BA`). English dates use `en-GB`.
- One set of texts for every app (`packages/shared/src/i18n`): the English text is the key (`t('Mark as watched')`, `tn('{count} Season', '{count} Seasons', n)`), so a missing translation shows English. Plural rules are in the code, not `Intl.PluralRules`, which not every TV engine has.
- Chosen per profile (account menu → App → App language, also on the sign-in page and profile picker), saved as the device default too; until chosen, the device's language when supported. The item says "App language" in English as well. A change redraws the whole app.
- Not translated: provider data (titles, categories, channels, guide), the diagnostics log, Android's own choosers. Desktop main-process dialogs get their texts from the page (`setTexts`).
- `npm run lint:i18n` fails on missing, unused or mismatched texts, or `t` without a string literal or at module load; `npm run i18n:sync` adds new texts. Translations were written with the code, not by native speakers.

## D-087

<a id="d-136"></a><a id="d-144"></a><a id="d-148"></a>

**The version, audio and subtitles a title starts with** — 2026-09-27, updated 2026-10-06 (merges D-136, D-144, D-148)

- Per profile, the subtitles (or Off), audio track and version last picked are remembered (`ProfilePrefs.playback`, `playback/playbackChoices.ts`). Tracks are matched again per title: same language and name, then language, then name; without a match the player's default stays. Live channels keep what the stream sends.
- A title starts with (`startingVariant`): the version picked for that title; else one in the first of the profile's languages it has, in the quality last picked there, else its highest quality; else the last version choice (by language, then quality); else the best version; else the first.
- "(best)" (`bestVariant`) marks the single highest quality (quality, source, HDR). Among equal tops, the first in the profile's languages, then the app's language (English → ENG, Portuguese → POR, German → GER, Serbo-Croatian → EXYU); none of those, no tag.
- EAR versions (English audio, Arabic subtitles burned in) are labelled "ENG (EAR)" (`variantLabel`). In the profile's languages they are skipped while the title has a plain version in that language, whatever the quality, and the plain one wins a tie for "(best)".

## D-088

<a id="d-038"></a>

**No server: the apps talk to the provider directly** — 2026-09-24, updated 2026-09-28 (merges D-038; retires the server's decisions)

- TV, phone and desktop talk to the Xtream provider directly through `createDirectApiClient` (`packages/shared/src/direct/`); `createAppContext` always builds it. `ApiClient` and the types (`api/types.ts`, `api/apiClient.ts`) are written by hand.
- Everything stays on the device: credentials in secure storage, the library and user data in SQLite (D-121).
- Playback goes straight to the provider with `APP_PROVIDER_USER_AGENT`; the native player and downloads keep it so resumed downloads use it.
- Title rules exist once, in TypeScript (`direct/normalizer`, D-017, D-133).
- Tests describe the app's data as routes on a fake (`testing/fakeBackend.ts`: `createFakeApi`, `createTestAppContext`; apps plug it in with `appContext.replaceApi`). The web e2e tests and TV emulator flows run against the fake panel.
- The web player in a plain browser also talks to the provider directly, which only works against the fake panel: real providers send no CORS headers. It is the desktop app's screens (D-071).
- Removed with the server: `backend/` (.NET), `services/title-normalizer/` (Python; its JSON cases moved to `normalizer/cases/`), the OpenAPI types, "My server" sign-in, relay URLs, XMLTV in a server database, the cloud deployment plan and the Codespaces setup.

Why: the owner uses only the native and desktop apps; the server doubled every library rule (Python, C# and TypeScript) for the web player alone.

Consequences: no sync between devices other than pairing ([#227](https://github.com/brunoccst/iptv-player/issues/227)).

## D-090

<a id="d-089"></a>

**Track names** — 2026-09-28 (merges D-089's track names)

- A track with no name of its own shows its language's name in the app's language ("English", "Inglês"; `trackLabel`: the app's names first, then `Intl.DisplayNames`). Names the stream gives ("English 5.1", "Forced") stay.
- Updated 2026-10-27: Hermes (TV and phone) has no `Intl.DisplayNames`, so the app keeps its own translated names for about 60 track languages (`trackLanguages.ts`, ISO 639-1 and 639-2 codes); `Intl.DisplayNames` only names the rest, on desktop. A name that is only a code ("cs") is named too. In "hbs-hrv" or "ms-ind" the second part is the more precise language (Croatian, Indonesian). "und" (undetermined) reads "Unknown language": the file does not say, so the app does not guess.
- A stream with a single audio track without a name of its own (empty, only a code, or "Track 1") reads "Default" (`audioTrackLabels`): IPTV restreams often tag every track "en" whatever is spoken. With several tracks, each shows its language's name.

## D-092

**Pause when the headphones go away** — 2026-09-28 (issue #83)

- TV and phone: ExoPlayer handles "audio becoming noisy" (`setHandleAudioBecomingNoisy`) and reports `pausedByAudioOutput`, so the screen shows paused.
- Desktop: the player pauses when an audio output it could see disappears (`devicechange`, `features/player/audioOutput.ts`); adding one never pauses. A browser that hides device ids does nothing.

## D-093

<a id="d-116"></a><a id="d-118"></a>

**Large libraries on slow TVs** — 2026-09-28, updated 2026-09-29 (merges D-116, D-118)

Hermes has no JIT and a Chromecast is about 9× slower than a PC, so code that runs over every provider name follows these rules:
- Skip regexes with a cheap substring check first; numbered regex groups only (Babel wraps named groups in a slow helper); split tokens with a character loop; fold and look up each token once; plain ASCII skips `normalize`; no array destructuring in hot code.
- Read each distinct name once per update. Title ids (SHA-1) are hashed natively on TV and phone in batches (`Sha1Batch.kt`; non-ASCII text in JavaScript, since Kotlin gets modified UTF-8), with a lean JavaScript SHA-1 elsewhere. Ids never change: My List and progress refer to them.
- Long work yields to the screen every 250 ms (each yield costs at least a frame); the log records the time per step and when the JavaScript thread was busy for 2 s or more (`stallWatch.ts`, not counting time in the background) and which page was opened.
- The `tv-stress` workflow (`FAKE_PANEL_STRESS`, 160k titles) reproduces large providers on an emulator.

## D-094

<a id="d-095"></a><a id="d-096"></a><a id="d-098"></a><a id="d-099"></a>

**TV pages: the focus in the middle, light grids** — 2026-09-28 (merges D-095, D-096, D-098, D-099 and D-069's Home centering)

- Every TV page keeps the focused card or button in the middle of the screen. Home and details scroll to the focused row or part; `CenteringScrollView` (`components/CenterScroll.tsx`) does it for the grids, Search, My List and Downloads.
- Positions come from layout, not from measuring on screen (a scroll in progress made the target stale: two-step scrolls). `TvLines` puts each line at its block's start plus index × line height, and scrolls on the key press.
- On grids, search and My List (`onlyCentering`), the scroll view's own D-pad scrolling is off (`scrollEnabled={false}`): Android scrolled first by itself, then the centering, again two steps.
- The TV grid is a plain ScrollView, not a FlatList (the FlatList got a 2 px viewport on Android TV and froze), that loads 100 more titles when its end is within one and a half screens. Only lines within eight of the focused one are mounted; the rest are spacers of the same height, and every line has the same height (cards always keep the subtitle line). Lines are memoized; the mounted window moves in a `startTransition`. While the focus is below the first line, Up stays in the grid (`trapFocusUp`), so a held key waits for lines instead of jumping to the category bar; the first line always stays mounted.
- TV search shows 36 results per section and loads more as the focus nears the end.

## D-110

<a id="d-127"></a>

**Categories shown** — 2026-09-29 (issue #104; merges D-127)

- Avatar menu → Profiles → Categories shown: per section (Movies, Series, Live TV), all checked at first; "Select all" unchecks or checks the whole section. Saved per profile on the device, applied on Save.
- Hidden from browsing: category bars, Movies and Series lists (a title goes when every version is hidden), Home rows, Live TV lists and the guide. Not hidden: search, My List, Continue Watching.
- On top of the Kids filter; not offered to Kids profiles (`profiles/hiddenCategories.ts`).

## D-111

**Automatic subtitles from OpenSubtitles.com** — 2026-09-29 (issue #103)

- Avatar menu → App → Automatic subtitles: on/off, the user's own API key (none is built in), an optional account, and languages in order of preference, kept in secure storage.
- When a streamed movie or episode starts (not live, not downloads) without its own subtitles in a preferred language, the app searches by title and year, or series, season and episode. First language with a result wins; within it, human-made before machine translations, trusted uploaders, then most downloaded. The subtitle is added, turned on and named in a notice; the last 40 are kept.
- Quota: 5 downloads a day per IP without an account; the account's quota with one. The notice says when the quota is used, the key is refused or nothing is found.
- TV/phone set the item again with the SubRip file from the current position; desktop converts to WebVTT and adds a `<track>`.

## D-115

<a id="d-113"></a>

**Provider lists are streamed, natively on TV and phone** — 2026-09-29, updated 2026-10-04 (merges D-113's list reading and large heap)

- The movie, series and channel lists (100+ MB of JSON on large providers) are never one text: reading one as a Java string crashed TVs with `OutOfMemoryError` (issue #109).
- TV/phone: a native thread per list (`ListReader.kt`, `JsonArraySplitter.kt`) downloads it, follows redirects and hands JavaScript batches of whole entries (about 500k characters, at most two waiting). Characters outside the BMP are written as JSON escapes (Expo passes modified UTF-8). The movie and series lists are saved straight into the database natively (`ListItems.kt`, D-135) and never reach JavaScript.
- Desktop and the browser read the stream in JavaScript (`direct/jsonStream.ts`), batching at the last `},{` for `JSON.parse` and yielding every 50 ms.
- A reply that is not an array is read whole; a cut-off list or an HTML page gets the "not JSON" message.
- The TV app asks for Android's large heap (`plugins/withLargeHeap.js`) as headroom.

## D-119

<a id="d-117"></a><a id="d-142"></a>

**Library progress and feedback** — 2026-09-29, updated 2026-10-05 (merges D-142 and D-117's placeholder)

- While the library is built or updated, or the device is offline, a banner floats at the bottom of Home and Movies/Series over the content, with a progress line per kind (`describeLibraryProgress`). It covers every step, so it does not stop at 80 %.
- TV/phone Home shows a spinner and "Loading your library…" where the hero goes until the first list answers (Android's spinner turns on the UI thread, so it moves while JavaScript is busy).
- `library.sync()` answers once the update shows as "processing", and the store reads the status again before "syncing" ends, so the first "Refresh library" press shows the update.
- When a refresh the user started ends, a message shows for 8 s: up to date, "N new, N changed and N removed titles" (counted against the last library), or failed. The automatic daily update shows none.

## D-121

<a id="d-120"></a><a id="d-123"></a><a id="d-125"></a><a id="d-126"></a>

**Everything on the device in SQLite** — 2026-09-29, updated 2026-10-03 (merges D-120, D-123, D-125, D-126, D-113's saved parts and D-117's saved file)

- TV/phone use Android's own SQLite through two generic native calls (`LibraryDb.kt`: run statements in one transaction, answer a query); desktop uses Node's `node:sqlite` in the main process (`apps/desktop/lib/libraryDb.mjs`, `library.db` in the app's data folder). Nothing is added to the APK or the installer. All logic is shared TypeScript (`sqlLibrary.ts`), tested on Node's SQLite. The SQL uses only SQLite 3.9 features (Android 7).
- Library: per account and kind, a set of tables per build and a table of contents (`library`) pointing at the current set; a new build is written beside the old one and switched in one step, unfinished builds are dropped at start. Filtering, search and ordering use a narrow table (lower-case title, key, categories, languages, hints). A start reads only the table of contents; lists, search and details are queries.
- Live channels (20,000+ at some providers) are saved the same way (kind "live"): daily, with "Refresh library", or when first needed. Categories, search and guide pages read only what they show.
- Catalog answers asked for one at a time are cached as JSON rows (`catalog_cache`, `sqlCatalogCache.ts`): categories 1 day, a movie's info 7 days, a series' episodes 12 hours, a channel's programmes 30 minutes. Older copies answer offline; rows unused for 30 days are removed. A 15-minute memory cache sits in front.
- User data (profiles, progress, My List, `settings.*` and the PIN's hash) lives in a `user_data` table behind the existing storages (`stores/databaseStorage.ts`), so backup and pairing are unchanged. The sign-in stays in the system's encrypted storage.
- Without a database (a plain browser, or a database that fails to open): the library is a file, kept newest first, read a line of 2,000 titles at a time; a small snapshot of the first lists Home asks for answers while it loads (`listSnapshot.ts`). On TV, values over 4 million characters are saved as several files under a `#parts:` index (never a NUL: Expo hands text to Android as a C string).

## D-128

<a id="d-150"></a>

**Seeking: presses in a row skip further** — 2026-09-23, updated 2026-10-06 (merges D-150)

- The n-th press of a series skips 10 s, 30 s, 1 min, 2 min, then 5 min (`tapStep`, `SkipStreak` in `remoteSeek.ts`). A series is presses in one direction less than a second apart; the other way or a pause starts again at 10 s. The flash says how far ("+30").
- TV ←/→ and ⏪/⏩ (`RemoteSeekController`, pure and clock-injected): the first press seeks at once; further presses move a preview on the progress bar and the video jumps once a second after the last; a press the other way fine-tunes by 10 s. Holding scrubs with growing speed where the remote reports holds (many report arrows only on release); the seek happens once, on release, to avoid re-buffering.
- The ±10 s buttons, phone double taps and web/desktop ←/→ skip at once by the step. A held key on desktop repeats 10 s steps.

## D-129

**Channels watched last** — 2026-10-03 (issue #122)

- Each profile keeps its last 20 channels, newest first (`recentChannels.ts`), noted when the player starts one, on every app.
- Home's live row lists them; until there are any, it shows the first live category.
- TV, live channel: ↓ opens a see-through strip of the last 10, the previous channel focused, so one Select goes back. ←/→ move, Select switches, ↑ or Back closes, 6 s idle closes; ↓ again reaches the player's buttons. Phones and desktop have only the Home row.

## D-130

<a id="d-108"></a>

**Search** — 2026-10-03 (issue #119; merges D-108's search filter)

- Search finds movies, series, live channels and programmes of the provider's full guide (which also fills the TV guide where the short EPG runs out, D-032) that have not ended (next two days, as far as the guide pages ahead: issue #248), with the channel that shows them; on now first, then by start, at most 30. Hidden categories are still searched (D-110); Kids profiles see only their channels' programmes.
- The full guide (`xmltv.php`, hundreds of MB) is streamed and only the next two days kept (`xmltv.ts`; on TV and phone native `XmltvFilter` drops the rest first), saved in the database (kind "guide") after the channel list, daily and when older than 12 hours. A provider without one shows no programmes. A programme without `stop` ends where its channel's next one starts (`XmltvFilter` keeps that next one too); a channel's last one without `stop` is dropped (issue #241).
- A filter (All, Movies, Series, Live TV) and the "Results for …" title stay above the results on TV and phone.

## D-131

**A series' Play goes on to the next unwatched episode** — 2026-10-03 (issue #133)

`seriesStart`: an episode in progress → "Resume S1:E2"; the last episode with progress finished → the next unwatched episode in order ("Play S1:E5", so a new episode is one press away), else "Resume" on the last; no progress → "Play" the first. The episode list opens on that season.

## D-133

<a id="d-065"></a><a id="d-156"></a>

**Title grouping in the database** — 2026-10-03, updated 2026-10-07 (issue #134; merges D-065, D-156)

- The provider's items go into the database as they arrive and SQL queries group them; only names the database has not seen are parsed in code (D-017). The same rules run in memory (`groupTitles`, `normalizer/matching.ts`) for a plain browser.
- Rules: (1) same compact key (spaces and leading zeros dropped; prefixes are not part of it) and year; a year-less item takes its key's year when the key has exactly one. (2) An item with a TMDB id groups by its id and year, so translated titles join ("La Casa de Papel" and "Money Heist") only in the same year. An item without one takes its key's id when the key has exactly one, else stays its own title. Two works of one name and year with different TMDB ids stay apart.
- Similar spellings ("Redemption" / "Redemtion") do not join ([#217](https://github.com/brunoccst/iptv-player/issues/217)).
- A title shows its most common spelling and year, the best version's poster and quality, the highest rating and the newest date; its versions are read only when it opens.
- Ids: SHA-1 of account, kind, key and year, so My List and progress follow a title across updates. When one key and year hold several TMDB ids, the smallest keeps that id and the others add their TMDB id ("-" for the id-less one).
- A rename that changes the key or year gives the title a new id (issue #216). My List entries save their title's provider items (stream ids); progress has its movie or series item. Once per library change, reading either list looks up the ids the library no longer has and moves each to the title that now holds most of its items (`reattach.ts`), then saves the list; two entries that became one title keep the newest. Stream ids rather than TMDB ids: every item has one, and Xtream keeps it across renames. Entries saved before this carry no items until the list is read while their title still exists.
- `NORMALIZER_RULES` (`libraryCodec.ts`) versions the grouping: raising it rebuilds every library once. `NAME_RULES` (`sqlLibrary.ts`) versions what was read from each name; when it rises, names whose old reading cannot differ are kept (9 reads again only keys starting or ending with an article it added, issue #217), so a TV does not parse every name again (issue #228).

## D-135

<a id="d-109"></a><a id="d-137"></a><a id="d-138"></a>

**Library updates: only what changed** — 2026-10-04 (merges D-109, D-137, D-138 and D-093's series first)

- The provider has no "changes since", so an update (sign-in, the saved library over 24 h old, or "Refresh library") always downloads both whole lists.
- Fingerprint: while saving a list, native code makes a SHA-1 of every saved field (`n1:…`), desktop a 64-bit hash (`j1:…`); a list with the same fingerprint as the library's stops at once.
- Otherwise new items are paired with the last library's; only keys with an unpaired item are grouped again, and only titles whose groups changed are rebuilt. At most 20 % changed: swapped into the current library in one transaction (newest first then becomes an order table, `_on1`); more, an old library format or a first build: a new library beside it.
- Each order other than newest first is a table of row numbers made when first asked for.
- Both kinds build at once; their database steps take turns. Without a database, the smaller list goes first.
- Channel list and full guide wait for the library; "Refresh library" stops a guide download still running and fetches it again after.
- Leftovers (downloaded rows, comparison tables, replaced libraries) are dropped in the background, one table per call and never while a library is built. Names are marked as seen once a day per account and kind (`names_seen`).
- SQLite: `synchronous = NORMAL` with write-ahead logging, a 16 MB page cache, helper threads where available. Title ids are hashed over every core.

## D-141

**Cinema-copy tag on covers** — 2026-10-05 (issue #151)

A title whose versions all have a cinema source tag (`LOW_SOURCES`: SCR, TC, TS, CAM; HDTS reads as TS, HDCAM as CAM) shows the least bad of them where "4K" goes, before "4K" (a 4K CAM is still a CAM). One better or untagged version and there is no tag. `MasterCard.lowSource` carries it; the database works it out per page from the title's items, so no rebuild is needed.

## D-143

<a id="d-163"></a>

**Docs every change keeps current** — 2026-10-05, updated 2026-10-11 (merges D-163)

- [RELEASE-NOTES.md](RELEASE-NOTES.md): a part per app and a `### MAJOR.MINOR` section per version line with **Latest** (one line per change people notice, newest first, with date and decision or issue). PATCH builds share their line's section. `tv-apk.yml` and `desktop.yml` add the section under "What's new in X.Y" after the generated first line (which the apps read their version from) and stop without one; `npm run lint:release-notes` checks each app has a section for its `package.json` MAJOR.MINOR.
- [FEATURES.md](FEATURES.md) describes each feature and which apps have it (D-079).
- [FEATURES-TECHNICAL.md](FEATURES-TECHNICAL.md) is a code index: a row per feature, in FEATURES.md's order, with the files to read first; `npm run lint:features` checks the rows and that the paths exist. It replaced a longer document with a Mermaid graph per feature, which cost every change more than it helped (2026-10-11).
- A change people see or use updates all of them in the same pull request; tooling, tests and refactors need no note.

## D-147

**Continue watching on the TV home screen (Watch Next)** — 2026-10-06 (issue #165)

- The active profile's Continue Watching (movies and episodes, up to 10, with position, length, last watched and cover) is published through Android's Watch Next API (`TvContract.WatchNextPrograms`): no library, Play services or Google sign-up, and works with an APK from GitHub. The Android TV home shows it ("Play Next"); the Google TV home (Chromecast with Google TV) does not: its "Continue watching" row takes only apps Google onboards to its Engage SDK (issue #320).
- JavaScript plans the inserts, updates and removals (`tv/watchNext.ts`, `watchNextPlan`); native code reads and writes only the app's rows (`WatchNext.kt`), without a selection (the provider refuses one from apps without `ACCESS_ALL_EPG_DATA`).
- Synced 10 s after progress changes. The system row is not per profile: another profile replaces it; the profile picker and sign-out empty it. A row removed on the home screen stays away until the title is watched again.
- Choosing an entry opens the app with its id (profile, kind, item); once that profile is picked, the title plays over its details. Another profile's title, or one no longer resumable, opens Home.
- Google's "For you" and "Top picks" rows are filled from catalog partners and are not open to apps.

## D-151

<a id="d-068"></a>

**"Who's watching?" every time; no TV sleep mode** — 2026-10-06 (merges D-068)

- Opening the app asks "Who's watching?" (TV, phone, desktop, every page load in a browser), also after Android closed it in the background; an account with one profile opens it directly. A reload during a session (pairing, restore) keeps the profile (`restore({ keepProfile: true })`).
- No sleep mode: while browsing, the TV's screensaver and power settings apply, like Netflix; the player keeps the screen on while video plays. Don't re-add a sleep screen without asking the owner.

## D-154

**TV colour keys** — 2026-10-07 (issue #180)

react-native-tvos reports `red`, `green`, `yellow`, `blue`; many remotes have none, so each is only a shortcut (`tv/colourKeys.tsx`, mounted once; the player handles Red, Green and Blue itself).
- Red: My List on/off for the focused cover's title or the details page's; in the player, the movie or series playing, with a notice.
- Green: in the player, audio and subtitles; elsewhere the first Continue Watching title plays over its details.
- Yellow: the nav's search box, from anywhere.
- Blue: on a live channel the guide; elsewhere Live TV.
- A dot in the key's colour marks the button it also presses.

## D-158

<a id="d-164"></a><a id="d-165"></a><a id="d-168"></a><a id="d-169"></a>

**Details in columns on landscape screens** — 2026-10-07, updated 2026-10-08 (issue #186; merges D-164, D-165, D-168, D-169)

- A screen or window wider than tall and at least 700 dp/px wide (every TV, a phone on its side, a desktop window followed live with `useMediaQuery`) shows details over the whole screen instead of the 850-wide panel, with the backdrop shaded from the left. Narrower or portrait screens keep the panel that scrolls as a whole.
- A movie has one column, 2/3 of the screen: title, Watched tag, buttons right under the title, facts, description, version, then cast, genres, director and source.
- A series: the left column (42 %; desktop at most 720 px) has the title, buttons, facts, description, version, cast and genres; the right column has the episodes. Only the episode list scrolls; "Episodes", the season's Watched button and the season choice stay at its top. Episode rows use the phone's layout everywhere (no number column, a smaller still, the title on at most two lines, buttons under the text).
- TV focus: a series' buttons let → out to the episodes and episode rows let ← out (D-069). Each episode is a memoized `EpisodeRow` with stable callbacks and `useFocusGrid` keeps `ref`/`at` stable, so a focus move redraws only the two rows involved; keep new row props stable.
- Desktop: the close button sits over the right column; Escape closes. A right column under 520 px drops episode numbers.

## D-174

**Known issues and planned work are GitHub issues** — 2026-10-11 (requested by owner)

- A known limitation, risk, bug or piece of technical debt is an open GitHub issue labelled `known issue`, not a file. Code and docs cite it as `issue #N`.
- `documentation/KNOWN-ISSUES.md` is gone; its open entries became issues #213–#236 (each names its old `KI-…` ID), and the closed ones stay in git history.
- Planned work and feature ideas are GitHub issues labelled `enhancement`; `documentation/NEXT-STEPS.md` is gone (2026-10-11).

## D-175

**Connection limit: ask the provider before playing** — 2026-10-12 (issue #242, issue #218)

- Providers refuse a stream beyond the account's `max_connections`, often as a broken video. Before a player opens a stream (not a download), it asks the provider (`user_info.active_cons`, `playback.connections`) and, when every connection is in use, says so with Play anyway (focused) and Go back (`playback/connectionLimit.ts`).
- The question waits at most 3 s; no answer, an error or a missing count plays as before.
- While the app streams and for 60 s after, it does not ask: the provider still counts the app's own stream, so zapping and the next episode would warn about it.
- The desktop timeline preview (D-023) opens a second connection, so it runs only when the account allows two or more and the last check left room for both (an unknown limit keeps it on).

## D-176

**Better copies on My List** — 2026-10-12, series 2026-10-17 (requested by owner)

- A My List movie whose copies are all cinema copies (`lowSource`: CAM, TS, TC, SCR, the cover's tag, D-141) is remembered with that copy in its saved entry (`lowSourceSeen`). Once the library shows it without `lowSource` (any copy without a cinema tag, untagged ones included, as for the cover), it is an upgrade until the popup is closed; then `lowSourceSeen` is cleared. Stateless that way: an upgrade found while the app was closed, or before the popup could show, is still there on the next open.
- The quality is read on My List's load (app open, profile change) and again for every entry after a library update ends (`recheckQuality`, from the library watchers). Entries added already good, or saved before this, are never announced; a title gone from the library keeps its mark.
- Shown on Home only, with nothing over it (no details, player, account menu or update prompt), one popup for all upgrades. Play starts the profile's starting version among the non-cinema copies and selects it for the title, so details show it too.
- Series too, by their versions' tags like movies (issue #251). Their popup entry has More info only, which selects the better version first: a series has no one thing to play. Per-episode copies are not tracked: that would read every saved series' episode lists after each update, and episode names rarely carry cinema tags.

## D-177

**No navigation bar on phones and tablets** — 2026-10-12 (requested by owner)

- The phone app hides the Android navigation bar, and with it the taskbar of tablets (Samsung and other large screens), on every page, not just in the player: on a tablet the taskbar covered the bottom row of covers. A swipe from the bottom edge shows it for a moment (`BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`); it hides again on its own.
- `expo-navigation-bar`: the config plugin's `hidden` hides it from the first frame, `<NavigationBar hidden />` in `App.tsx` keeps it hidden and sets the swipe behaviour.
- The status bar (time, battery) stays on outside the player, with the app starting below it, so rounded corners and the camera cut-out do not cover the header.

## D-178

**Every device shows a sync code; camera devices scan** — 2026-10-12 (requested by owner)

- Phones and tablets run the same pairing server as the TV (`PairingServer.kt`), so every app shows a code: on the sign-in page (beside the form from 760 dp wide, below it otherwise) and in Sync with another device, one dialog and name on every app. Phone-to-phone needed nothing new in the protocol.
- Scanning is offered where `TvMedia.hasCamera()` (`FEATURE_CAMERA_ANY`), not by device type: phones and tablets, and a TV with a camera. The dialog opens on this device's code with Scan a code instead; a cancelled scan goes back to the code. Only the TV hands out a Play on TV key.
- The scanning device's data wins on conflict, as with the phone before (D-060).
- A signed-out device that scans a signed-in device's code gets its sign-in ('share' mode): it sends no session, and the device showing the code answers with its session (without its active profile), provider credentials, parental PIN, media, profile settings and automatic subtitles, and keeps its own state. So Scan a code on the sign-in page is useful. An older app showing the code answers "not signed in".
- The desktop app scans with the webcam (issue #254): `getUserMedia` in the page and jsQR (Chromium's BarcodeDetector is missing on Windows), four frames a second; the camera stops once a code is read. The request goes out through the main process (`iptv:pairing-send`), since device servers send no CORS headers, and only to a private IPv4 address of the home network (`pairingUrl`), so the page cannot use it to reach anything else.

## D-179

**TV: the progress bar takes the focus** — 2026-10-15 (requested by owner)

- With the player's buttons open (D-077), the progress bar above them is one more focusable row: ↑ from the buttons reaches it, ↑ again Back, ↓ the buttons. It is a `FocusRow` of its own, so ←/→ never leave it. Focused, it grows, turns white and shows the time over the thumb; Select plays or pauses.
- ←/→ on it move a preview (D-180) by `SkipStreak` (10 s, 30 s, 1 min, 2 min, 5 min for presses in a row, D-128), like the ±10 s buttons, not with `RemoteSeekController`'s preview: its scrub bar replaces the controls, which would unmount the focused bar. The bar itself shows the position.
- A held key (Android repeats key-down) skips again every 300 ms (`BAR_REPEAT_MS`), so holding speeds up through the same steps; remotes that report arrows only on release skip once per press.

## D-180

**TV and phone: preview frames on the progress bar** — 2026-10-15 (requested by owner)

- Providers ship no thumbnails, so, as on desktop (D-023), frames come from the stream itself: `FramePreview.kt` opens one `MediaMetadataRetriever` on the stream's address (with the app's User-Agent) and returns the key frame nearest the time, 320 px wide, as a JPEG data URI. Key frames only (`OPTION_CLOSEST_SYNC`): exact frames would decode up to several seconds of video per request.
- It holds a second provider connection, so it is asked for only where the account has one to spare (`spareConnection`, D-175), and released as soon as the preview ends (the jump, the drag's end, the player closing). Not for downloads (encrypted, D-050), HLS (the retriever cannot read playlists) or live.
- `useFramePreview` keeps one request decoding and only the latest waiting, so fast presses or a drag never queue up; a frame that arrives after the preview ended is dropped.
- TV bar: ←/→ move a preview position with the frame and the time over it; the video jumps there `TAP_CHAIN_MS` after the last press, on Select, or when the bar loses the focus, so the stream re-buffers once per series of presses, not once per press. Phone: the frame follows the finger while dragging the timeline.

## D-181

**TV rows keep the end cards clear of the screen sides** — 2026-10-15 (requested by owner)

- Android's horizontal scroll view scrolled a row on focus just enough to show the card, so the first and last cards on screen sat on the screen edge: the focused card's 8 % growth and glow were cut, and TVs that overscan cut the card itself.
- TV rows (`Row`) turn that off (`scrollsChildToFocus={false}`) and scroll themselves: a focused card (`PosterCard`, the See all card) calls `RowReveal`, which measures it in the row and scrolls (`revealOffset`, `components/rowReveal.ts`) so it keeps `tvRowInset` (the gutter + 24) from both sides, moving as little as possible. The target comes from the offset last asked for, not the one on screen, which is stale while a scroll animates (like D-094).
- The cards, and the row title above them, start at that inset, so at the row's ends the first and last cards sit there too. Phones keep the gutter and the scroll view's own scrolling.

## D-182

**Every card menu option has an icon** — 2026-10-16 (requested by owner)

- A card's menu (hold OK, long touch, right-click, D-078) shows an icon after each option's text, Cancel included, like the episode menu already did. The icon comes with the option from `cardMenuItems` in shared code, so it is the same on every app.
- The icons are the ones the apps use for the same thing elsewhere: Go to details `info` (More Info), Mark as watched `eye` and not watched `eyeOff` (the Watched tag, D-081), Add to My List `bookmark` (the cover's My List mark, issue #157) and Remove from My List `bookmarkOutline`, Remove from Continue Watching `trash`, Cancel `close`.

## D-183

**Details: the icon buttons wrap beside Play** — 2026-10-16 (requested by owner)

- In one wrapping row, a button that did not fit (a wider "Resume" or "Play S1:E5" on a phone) went to the start of the next line, under Play, where nobody looks for an icon. So Play/Resume stands alone and the icon buttons are a group of their own that takes the rest of the width and wraps inside it (`Actions` in the TV app's `DetailsScreen` and the web `DetailsLayout`, the `play` and `actions` parts of the details layout).
- The outer row does not wrap and aligns to the top, so Play lines up with the first line of icons; Play and the icons are both 40 px high.

## D-184

**Guide reminders** — 2026-10-17 (issue #239)

- A reminder is saved in the profile's preferences on the device (`reminders`, like recent channels, D-129): the channel, title and times, enough to show it and tune in without the guide. Pairing joins both devices' lists (D-060). Ended programmes are dropped whenever the list changes; at most 50 are kept.
- The running app checks when the next one starts (and every 30 s) and shows it from its start for 10 minutes, so an app opened shortly after still shows it. Dismiss or Watch takes it off the list.
- TV and phone: a popup over any page and the player (focus stays inside it). Desktop: the same dialog since D-214 (first a banner at the top right that did not take focus), over the player too, plus a system notification while the window is in the background (permission asked with the first reminder).
- TV sets one by holding OK on a programme that has not started: OK on it still tunes to the channel, and holding OK on the programme on now still starts it over (issue #226).
- With the app closed: the phone and tablet set a system alarm per reminder (D-222); the desktop, when it starts with the computer, waits in the tray (D-226); the TV shows them only while the app runs.

## D-185

**Split and merge titles by hand** — 2026-10-17 (issue #243)

- Rules in the library database (`title_rules`, per account and kind), applied by the grouping queries after the automatic rules (D-133): a `split` gives one provider item (stream id) a group of its own (`'s' || sid`, which also goes into its title id, so it never takes the id of the title it left); a `merge` sends every item of one group key (`gk`: cleaned name and year, or TMDB id and year) to another. Merging into a title whose key other merges point to moves those along, so rules never chain.
- Keyed by group, not by item, so a version the provider adds later to a merged title joins it too. When the provider changes a merged title's key (a new TMDB id or year), an update finds the key most of its items have now and the merge follows it (issue #311, `renamedKeys` in `sqlLibrary.ts`): on either side, and the titles merged into a title whose key changed are grouped again with it. A merge whose two titles now share a key is dropped. The device's rules change, so they are dated again and reach other devices (D-223).
- A change groups again only the compact keys of the titles involved (`changedKeys`, the D-135 update path) from the items the library holds, without downloading; the library records a fingerprint of its rules (`rsig`), and a library grouped with other rules is never a starting point otherwise. My List and progress follow through the item lookup of issue #216.
- Only where the library is in a database (TV, phone, desktop): the in-memory library of the plain web player is a demo against the fake panel. Since D-223 the rules sync between devices and go into backups.

## D-186

**Automatic sync through the paired TV** — 2026-10-17 (issue #227)

- A middle step short of a sync service (which would need hosting and accounts, against D-088): a device that scanned the TV's code keeps the TV's remote-play key (D-061) and sends a `sync` remote command with its media entries (profiles, progress, My List, removals) when the app opens, comes back to the front, and every 10 minutes (`createAutoSync`, at most once a minute). The TV merges (`applySyncedMedia`, the pairing merge) and answers with the merged entries; the sender merges the answer once more with what it saved meanwhile. The TV is the hub, since only it listens all the time; the desktop app now keeps the TV's key too and sends through the main process (`iptv:pairing-send`, path `/remote` only).
- Removals are recorded (`direct.removed.<account>`: deleted profiles, progress taken off Continue watching, titles taken off My List, with their time) and win over entries saved before them on either side, so a removed entry does not come back from the other device. Kept 180 days. Profiles keep the details edited last (`updatedAt`).
- Profile settings came along from D-225 on, once each carried a date: undated, the scanning device winning (D-060) would undo choices made on the TV every 10 minutes.
- A changed list refreshes the screens in place (`AppContext.refreshMedia`: profiles, then progress and My List without emptying them first), not through `reload()`, which closes the player.
- Limits (issue #268): devices that never scanned a TV don't sync on their own; the TV app must be open on the same network. A TV that got a new address is found again (D-239).

## D-187

**Desktop: downloads go on with the window closed** — 2026-10-17 (issue #219)

- Closing the window while a download runs or waits hides it instead (`iptv:downloads-active` from the page); the page keeps downloading as before, with background throttling off, and closes the player. A tray icon opens the window again or quits; starting the app again shows it too. When the downloads end, the app quits. Quitting leaves unfinished downloads paused, as before.
- Chosen over moving downloads into the main process (the ranking's idea): the page's downloader, its non-extractable key and the Service Worker that plays the chunks (D-024) stay as they are, with nothing to migrate, and the main process gets no second download and encryption path to keep in step.
- Several at once: an account with N provider streams runs N−1 downloads at the same time, at most three, so one stream stays free for watching (all apps that use the web downloader: desktop and the browser).
- Storage stays the page's (Cache API and IndexedDB). Chromium lets one origin use up to 60 % of the disk, so in the desktop app the quota is rarely the limit; a full disk still stops a download with an error.

## D-188

**TV and phone: names read in the system WebView** — 2026-10-17 (issue #228)

- Reading new names (`parseTitle` and the quality columns, `nameRow`) was most of a large library build and ran on the app's only JavaScript thread, under Hermes without a JIT, so the app stopped answering for minutes on 100k+ names. Profiling found no single hotspot to fix, so the work moves off that thread: a WebView that is never shown (`NameParser.kt`) runs the same code, bundled from `nameRow.ts` into `assets/name-parser.js`, in batches of 2000 names; V8's compiler reads them many times faster than Hermes (about 70k names a second on a desktop; a TV is slower).
- The system WebView over `androidx.javascriptengine` (not on Android 7 and 8 TVs, and a new dependency) and over porting the parser to Kotlin (two copies of the rules to keep in step). The bundle is checked in and `scripts/build-name-parser.test.mjs` fails when it is out of date or reads the shared parser cases differently, so it is rebuilt with `npm run build:name-parser --workspace=@iptv/tv-app` whenever `parseTitle` changes (with `NAME_RULES`, D-133).
- Any failure (no WebView, the renderer killed, 30 s without an answer, a wrong count) reads that batch on the JavaScript thread as before (`readNewNames`), with a warning in the log. The WebView goes after a minute without work.
- Desktop keeps reading names in its page: Chromium's V8 already reads them fast, and the window does not wait on it the way the TV remote does.

## D-189

**Desktop: FFmpeg converts what Chromium cannot decode** — 2026-10-17 (issue #236)

- The desktop app brings FFmpeg (`ffmpeg-static`, unpacked from the app archive) and converts what Chromium cannot play into HLS on the app's own server (`lib/transcoder.mjs`, `/transcode/<id>/`): fragmented MP4 segments of 4 s, H.264 (software, at most 1080 lines, HDR mapped to normal colours where the build has zscale) and stereo AAC. Video Chromium decodes (H.264, HEVC with a decoder) and sound it plays (AAC, MP3, Opus, FLAC) are copied, so a film with only Dolby sound costs almost nothing to convert.
- Chosen over libmpv (a native player per system, the player and its encrypted downloads rewritten) and over leaving it to VLC. The cost: about 80 MB more download, a GPL FFmpeg binary shipped next to the app (its licence goes with it), and CPU while HEVC is converted.
- When: the stream does not load at all (FFmpeg reads the provider's file before its HLS), or plays a few seconds with video but no decoded sound (`webkitAudioDecodedByteCount`), or fails with a media error later. FFmpeg reads the stream first (`probe`) and nothing is converted when it finds nothing Chromium lacks. What plays stops before FFmpeg opens the stream, so a one-stream account has its stream free; when conversion fails, the error is the one from before (D-074) with Open in VLC.
- A conversion starts at a position; the page's player counts from there (`PlaybackEngine.position`, `duration` from FFmpeg). Seeking inside the converted part moves the video; past it, FFmpeg starts again there. One conversion at a time; its files go when it ends and on quit.
- FFmpeg reads the provider through a relay in the main process (127.0.0.1, one random path per stream): the static Linux build crashes looking up host names itself, and the relay adds the player User-Agent.
- Every audio track, timeline pictures and downloads: D-192. Hardware encoders and 4K: D-224. The macOS app is one build for Intel and Apple silicon: `scripts/universal-ffmpeg.mjs` adds the other architecture's FFmpeg and joins both with lipo before the build.

## D-190

**Phones show no focus look** — 2026-10-19

- `FocusButton` and `IconButton` light up (white, glow, grow) only on TV. On a phone, Android still gives focus to the first focusable view when the focused one goes, and a touch never moves it on: opening the player's panel left its Audio tab lit like a focused TV button for as long as it was open.
- Phones show what is chosen with the button's own variant (the panel's open tab is the white one), never with focus.

## D-191

**Desktop: progress from VLC through its web interface** — 2026-10-20 (issue #265)

- VLC is a separate program (D-057) that reports nothing back to the app the way Android players do (issue #234). The app starts it with `--start-time` at the saved progress and with its web interface on 127.0.0.1, a free port and a random password per launch (`lib/vlc.mjs`), and asks `/requests/status.json` for `time` and `length` every 3 s.
- The page gets the latest time after the first answer, after each further minute of playback, and once when VLC closes; it saves it as the progress of the profile that opened VLC (none when another profile is active by then). The periodic saves keep progress when the app closes before VLC.
- Chosen over reading VLC's own recent-files history: its format and place differ per system and version, and it only holds the time when VLC closes cleanly. A VLC without its Lua web interface simply never answers, which leaves the progress as it was.

## D-192

**Desktop conversion: every audio track, timeline pictures, downloads** — 2026-10-20 (issue #270)

- Every audio track (at most 8) is converted, each its own HLS audio rendition (`-var_stream_map`, folders `video/` and `audioN/`); the app writes the main playlist itself, naming each track by its language, so hls.js and the audio menu list them like a provider's own HLS tracks. One track keeps the plain single playlist. The conversion starts with the profile's audio choice (D-087, `PlaybackEngine.choosesAudio`), and the track picked stays picked when a seek converts again. Chosen over converting one track and starting again on a switch: switching is instant, and AAC for a few more tracks costs little next to the video.
- Timeline pictures of a converted title: FFmpeg reads one frame at the time asked for and sends a JPEG (`transcoder.frame`, `ConvertedFrames`), one at a time with the latest request next. Like the preview of a stream (issue #218), it opens the provider a second time, so it needs a spare connection; downloads need none.
- Downloads: FFmpeg reads a download from the page, which fetches it from its Service Worker (decrypted, D-024) a stored chunk at a time (`offline/desktopReads.ts`, `iptv:offline-read`). The relay hands FFmpeg one answer per byte range, and points a download playlist's parts back at itself. Only `/__offline__/` addresses can be read this way. Decrypted bytes leave the page only to FFmpeg on 127.0.0.1, behind a random path, as the Service Worker already serves them to any script on the origin (issue #213). A download that does not load, or plays without sound, is converted like a stream.

## D-193

**Shared screens with React Native Web: the My List trial** — 2026-10-20 (issue #237)

- `packages/screens` holds screens written once in React Native. The TV and phone app render them natively; the web player maps `react-native` to `react-native-web` (Vite and Vitest config) and renders them as DOM. My List is the first: TV uses it for real, desktop only with `?screens=shared` (kept in the browser's storage, `?screens=web` goes back), loaded as its own chunk.
- What differs per app comes in as parts (`MyListParts`): the scrolling page, a row (a TV focus row, D-069) and a card (TV focus and hold-OK menu; desktop hover, right-click menu, details modal). Parts are defined once per app at module level, never inside render, or every render would mount new components and lose TV focus.
- Measured on the trial (fake panel, 1440×900, Chromium): the look matches the app's own page after small style changes; the app's main bundle is unchanged and the trial chunk is 95 kB (32 kB gzipped); a cold open of My List took 430 to 480 ms against 110 to 150 ms for the app's own page, most of it loading that chunk on a fresh page.
- Effort: the shared part of My List is the small part (texts, states, layout); the cards, focus, menus and the details modal stay per app. Each further screen means rewriting the desktop's CSS components as React Native styles. Whether to move more screens is the owner's call on issue #237. The owner chose to (D-194): parts became a host, and desktop My List is the shared screen.

## D-194

**Shared screens: one card for every app, the app brings a host** — 2026-10-23 (issue #237)

- The owner chose to share as much as possible (2026-10-23), so screens move to `packages/screens` one at a time. My List is the first: desktop shows the shared screen for everyone (no `?screens=` switch) and the app's own page is gone.
- The TV's building blocks (theme, icons, focus look, focus rows, the centring scroll view, the cover card) moved to `packages/screens/src/ui`; the TV keeps one-line re-exports at their old paths. The desktop draws the same cover card, so both apps look alike; the mouse lights it up like the focus.
- An app gives the shared screens a `ScreenHost` (`setScreenHost`, or `ScreenHostProvider` in tests) instead of per-screen parts: its stores (the shared hooks), how details open, the scrolling page, a title's menu (TV: hold OK, a panel; desktop: right-click, at the pointer) and the TV colour keys (D-154). `TitleCard` is the one title cover of every app.
- On the desktop, a file's `X.web.tsx` takes the place of `X.tsx` (Vite and Vitest `resolve.extensions`): `Icon.web.tsx` draws a plain SVG, so the desktop needs no react-native-svg. Vite defines `global` as `globalThis`, which React Native Web's animations use; without it, a card's animation threw when the card left the page.

## D-195

**Shared Movies and Series: one grid, three ways to scroll** — 2026-10-23 (issue #237)

- Movies and Series are the screen shared with the desktop (`BrowseScreen`, `TitleGrid`), with the TV's chips, "Sort by" select, buttons and error text moved to `packages/screens/src/ui`. The desktop now draws the TV's chips and select instead of its own.
- The grid scrolls three ways: TV keeps only the lines near the focus mounted (D-094), phone uses a list, and desktop puts every line in the page, which scrolls with the window, and loads the next page when the app's `EndSensor` at the end comes into view. A React Native Web list scrolls inside its own box, which would leave the window's scroll bar and the nav's page scrolling unused.
- The host also gives the screens the chosen category (`useCategory`, `setCategory`) and the catalog and library stores. Desktop Movies, Series and My List load as their own chunk with React Native Web; Search keeps the desktop's own grid until it moves too.

## D-196

**Shared Search** — 2026-10-23 (issue #237)

- Search is the screen shared with the desktop (`SearchScreen`). The host gives it the nav's search text (and on TV the Enter presses), the channel and programme search hooks, and `play`.
- On TV and phone the title and the filter stay above the scrolling results (D-130); on desktop the whole page scrolls with the window, so they scroll away with it. Each grid loads more on its own: TV as the focus nears its end (D-094), desktop through the host's `EndSensor`, phone on "More results".
- Desktop now says "Keep typing…" and "Searching…" before results, like the TV, and draws the TV's chips for the filter.

## D-197

**Shared Home** — 2026-10-23 (issue #237)

- Home is the screen shared with the desktop (`HomeScreen`): featured movie, Continue Watching, My List, Live TV, Top rated and category rows. The TV's row (`Row`, with `rowReveal`) and shade (`Gradient`) moved to `packages/screens/src/ui`; on the desktop `Gradient.web.tsx` draws a CSS gradient, and `Trailer.web.tsx` keeps the muted trailer over the featured movie (D-025), which TV and phone do without.
- Every app now has the TV's rows: the first titles, then a "See all" card that opens the full list. Desktop rows show 30 titles (TV and phone 10) instead of loading more as they scroll sideways. Desktop keeps its arrows over a row's sides while the pointer is on it, each hidden at that end (D-040).
- Rows are built a few at a time on TV and desktop: TV as the focus or the scroll nears the last one, desktop when the host's `EndSensor` at the end of the page comes into view; phone keeps its virtualized list. The host also opens a page from a row (`openSection`) and, on TV and phone, darkens the nav once Home scrolls (`setScrolled`).
- Desktop Home comes with the app rather than loading on its own: it is the first page after sign-in, so a separate chunk would only add a step.

## D-198

**Shared My Downloads** — 2026-10-23 (issue #237)

- My Downloads is the screen shared with the desktop (`DownloadsScreen`). Each app keeps its own downloader (the TV's native download service, the desktop's encrypted cache) and the host turns its records into `DownloadEntry` items: title, poster, state, progress, size, and play / pause / resume / delete. The desktop also hands over its notes (no offline support in this browser, storage used).
- The desktop shows the poster saved with the download first, so it shows offline, and the provider's when that one does not load.
- The round `IconButton` and the TV colour-key dot (`ColourDot`, D-154) moved to `packages/screens/src/ui`; the TV keeps re-exports at their old paths. The status texts go through `t()` now; the TV showed them in English only.

## D-199

**Shared sign-in** — 2026-10-23 (issue #237)

- The sign-in page is the screen shared with the desktop (`LoginScreen`), with the TV's text field (`Field`) moved to `packages/screens/src/ui`. The host's `signIn` gives the app's name, the note on how the password is kept, the app-language choice, the restore-from-backup dialog and, where the app can pair, the code a signed-in device scans and the camera scan (D-060, D-178).
- A plain browser gets no note and no device card: it keeps nothing it could encrypt and cannot pair. On the desktop the page is as tall as the window, so the form sits in its middle.
- The language choice is the TV's compact select on every app, and the button says "Restore from a backup" everywhere.

## D-200

**Shared profiles** — 2026-10-23 (issue #237)

- "Who's watching?" and its profile editor are the screen shared with the desktop (`ProfilesScreen`). The host's `profiles` gives the app's PIN prompt (D-054), its Kids categories and content language dialogs (D-053, D-063), and signing out (it asks first when there are downloads, D-050). The desktop now also has Sign out on this page, like the TV.
- The editor is a React Native `Modal`. On the desktop, Escape closes it through a window listener in the capture phase: React Native Web's text field keeps its key presses from bubbling, so the modal's own Escape handling never saw them.

## D-201

**Shared Live TV** — 2026-10-23 (issue #237)

- The Live TV guide is the screen shared with the desktop (`LiveScreen`), with the TV's focus grid (`focusGrid`) moved to `packages/screens/src/ui`. The host adds the guide's store (`stores.epg`), reminders and programme descriptions, and on the TV the remote's keys (`useRemote`: Channel +/− and the guide's hour paging, D-028) and the top nav link that Up goes to (`useNavFocusTarget`). The desktop's `allowReminders` asks once to show system notifications (issue #239).
- On the desktop the page is as tall as the window, like the TV: the categories and the guide scroll on their own and more channels load near the end of the list. A narrow window gets the phone's layout (category chips, the whole page scrolls). The channels keep the TV's focus guide only where React Native has one; React Native Web gets a plain view.

## D-202

**Shared details** — 2026-10-23 (issue #237)

- A title's details are the screen shared with the desktop (`DetailsScreen`), with the TV's Watched and My List buttons moved to `packages/screens/src/ui`. The host's `details` gives how they close, the library revision that reloads them, and the buttons only that app has: Download, Play on the paired TV (phones), another player (VLC on the desktop) and Split or merge (shared since D-203). `useEpisodeOptions` gives the same choices for an episode's "…" menu, which the host's `Menu` draws (desktop: under the button).
- On the desktop the details sit in the app's own dialog (`details.Frame`): Escape, a click beside it and its close button close it, and a dialog over it closes first. Wide landscape windows get the two columns (D-158) by the same rule as the TV: wider than tall and at least 700 wide.
- On the desktop the drop-downs (version, season, an episode's version, and also the sort and sign-in language) are the browser's own (`Select.web.tsx`), which the mouse and keyboard already know; TV and phone keep the option list.

## D-203

**Shared details buttons** — 2026-10-23 (issue #237)

- The details' Download (with its progress ring), Play on TV, another player (VLC on the desktop) and Split or merge buttons are drawn by the shared screen (`packages/screens/src/ui`). The host gives hooks, not buttons: `details.useDownload`, `usePlayOnTv` (phones), `useExternalPlayer` and `replace` (show the details a split or merge left). An episode's "…" menu takes its choices from the same hooks, so `useEpisodeOptions` is gone.
- Split or merge opens the host's `Menu` (desktop: under the button) and its picker is a React Native `Modal`. On the desktop, Escape closes the picker from a window listener in the capture phase and stops there, so the details' dialog under it stays open (the text field keeps its key presses, D-200).
- The progress ring has a `.web.tsx` twin drawn as a plain SVG element, like `Icon`, so the desktop needs no react-native-svg.

## D-204

**Shared dialogs** — 2026-10-23 (issue #237)

- "Better quality on My List" (D-176), Kids categories (D-053) and Categories shown (D-110) are dialogs shared with the desktop (`packages/screens`), drawn in one frame, `Dialog`: a React Native `Modal` with the panel and its title. The host adds their hooks (`useQualityUpgrades`, `useKidsCategories`, `useHiddenCategories`); the TV app keeps the quality dialog away while an update prompt shows by passing `visible`.
- On the desktop Escape closes a `Dialog` from a window listener in the capture phase (React Native Web's text fields keep their key presses, D-200) and stops the key there, so the dialog or details under it stay open. Only the top `Dialog` closes: they keep a stack of the open ones. The merge picker (D-203) uses the same frame.
- Category lists are rows with a check box (`CheckRow`). React Native Web reads `aria-checked`, not `accessibilityState`, so the row sets both.

## D-205

**Shared language and subtitle settings** — 2026-10-23 (issue #237)

- The Content language filter (D-063) and Automatic subtitles (D-111) are dialogs shared with the desktop (`packages/screens`), in the shared `Dialog` frame (D-204). The host adds `useLanguageSettings` and the app's OpenSubtitles service (`subtitles`); `profiles.LanguageSettings` is gone.
- Both keep the TV's look on every app: languages are buttons marked "✓ 1." in the order they were ticked, and automatic subtitles are switched with an On / Off button, not check boxes.
- The parental PIN stays per app for now: the TV asks with a number pad one step at a time, the desktop with a form, and sharing it would change one of them for the worse.

## D-206

**Shared About and app language** — 2026-10-23 (issue #237)

- About (D-070, D-079) and App language (D-084) are dialogs shared with the desktop (`packages/screens`). The host's `about` gives the rows each app knows about itself (TV: installed build, FFmpeg audio, Android; desktop: which app and its version) and `checkForUpdates` where it can; the language choice uses the host's `signIn.chooseLanguage`.
- About shows the app's name as its title but is called "About" for screen readers (`Dialog`'s `label`). App language lists the languages as buttons with a ✓ on the current one, like the TV.

## D-207

**Shared account menu** — 2026-10-24 (issue #237)

- The account menu under the avatar (D-079) is shared with the desktop (`packages/screens/src/AccountMenu.tsx`) and opens the shared dialogs itself. The app keeps whether it is open and which group shows (TV: in the nav store, so Back leaves a group first) and gives, in the host's `account`, only what differs: its PIN settings and backup dialogs, Sync with another device (none in a plain browser), Playback (TV builds with FFmpeg), Log (the TV's page, the desktop's dialog) and Close the app (TV and phone).
- The desktop's top bar stays its own HTML for now and hangs the menu under its avatar. A click beside the menu lands on a see-through layer over the window and closes it, so a click on the avatar closes it too instead of opening it again; Escape closes it from a window listener in the capture phase, like `Dialog` (D-204), and the focus goes back to the avatar.

## D-208

**Shared top nav** — 2026-10-24 (issue #237)

- The top nav (brand, page links, search box, account avatar) is shared with the desktop (`packages/screens/src/TopNav.tsx`). The app keeps the page, the search text, whether the bar is solid (TV: Home scrolled; desktop: the window scrolled past 10 px) and whether the account menu is open, and passes them in; the desktop hangs the account menu (D-207) under the avatar, the TV draws it over the whole screen.
- On the desktop the bar is `position: fixed`, a `banner` with the links in a `navigation` landmark named "Main", like the HTML it replaces; a `header` role would make the whole bar a heading. Links say `aria-current="page"`, the avatar `aria-expanded`. The focus goes back to the avatar whenever the menu closes.
- The desktop's `--nav-height` stays in its CSS for the pages under the bar; it matches the shared bar's heights (68, or 104 when the bar takes two rows at 720 px and below).

## D-209

**Shared guide over the playing channel** — 2026-10-24 (issue #237)

- The guide over a playing channel (D-058) is the first part of the player shared with the desktop (`packages/screens/src/GuideOverlay.tsx`); the desktop's player draws it over its HTML controls through React Native Web. The player stays per app for now: the video itself is the TV's ExoPlayer and the desktop's `<video>`, so the shared parts come in one at a time around it.
- TV and phones close it by themselves after 6 seconds without input; the desktop keeps it until Escape, a click beside it or the Guide button, since the mouse can rest on it without moving. There it is a `complementary` region named "Guide", and the playing channel has the focus first.

## D-210

**Shared player panel** — 2026-10-24 (issue #237)

- The TV's Audio, Subtitles, Versions and Episodes panel (D-077) replaces the desktop's tracks menu and episode drawer (`packages/screens/src/QuickDrawer.tsx`). The desktop's subtitles button opens it on Audio and its episodes button on Episodes, like the TV's buttons.
- The panel does not know a player: each app lists its tracks as options with a name, whether they are on and what picking does (`TrackOption`). The TV builds them from ExoPlayer's tracks, the desktop from hls.js and the video element (`tracks.ts` `trackOptions`); both keep a pick as the profile's choice (D-087).
- On the desktop it is a dialog named "Audio, subtitles and version" (or "Episodes"), with the phone's back arrow; a click beside it or Escape closes it.

## D-211

**Shared next-episode card** — 2026-10-24 (issue #237)

- The countdown card at the end of an episode (Next episode in …, Play Now, Cancel) is one component for every app (`packages/screens/src/NextUp.tsx`); the desktop's own card and its styles are gone.
- Each app keeps the countdown and what Play Now does (`nextUpCountdown`); the card only shows them. On the desktop it is a polite status, so screen readers announce it without taking the focus.

## D-212

**Shared Skip ahead button** — 2026-10-24 (issue #237)

- The player's "Skip ahead" button and its 30 s … 3 min options (D-042) are one component for every app (`packages/screens/src/SkipAhead.tsx`); the desktop's own buttons and styles are gone.
- Each app keeps when it shows (`isInSkipAheadWindow`), what a pick seeks to and how Back or Escape closes the options. `FocusButton` gained `expanded` so the desktop still says whether the options are open.

## D-213

**Shared player top bar** — 2026-10-24 (issue #237)

- The bar at the top of the player (back arrow, title, subtitle with "Downloaded", LIVE) is one component for every app (`packages/screens/src/PlayerHeader.tsx`); the desktop's own markup and styles are gone. A download with no subtitle now says "Downloaded" on the desktop too, as on the TV.
- Each app keeps what Back does and when the bar shows. On the TV the back arrow is focusable only while the player's buttons are open (D-077). On the desktop the title is a level-2 heading, and the e2e tests find the parts by test id (`player-title`, `player-subtitle`, `player-live`).

## D-214

**Shared guide reminder dialog** — 2026-10-24 (issue #237)

- The reminder shown when a programme starts (D-184) is the TV's dialog on every app (`packages/screens/src/ReminderDialog.tsx`), over any page and the player. The desktop's banner at the top right, which did not take focus, is gone: like the other dialogs, Escape dismisses it.
- Each app says what Watch does: the TV replaces an open player so Back returns to the page under it; the desktop plays over the page. The desktop keeps its system notification while the window is in the background (`apps/web-player/src/features/live/Reminder.tsx`).

## D-215

**Shared library banner and refresh notice** — 2026-10-24 (issue #237)

- The banner at the bottom of Home and Movies/Series (offline, "organizing your library" with per-kind progress, D-119) and the notice after "Refresh library" are one component each for every app (`packages/screens/src/LibraryBanner.tsx`). The notice's timer is shared too. The desktop's own markup and styles are gone.
- Each app keeps how it watches the library (TV `useLibraryWatcher`, desktop `LibraryBanner.tsx` polling) and passes `processing`. Only the desktop passes `onRefresh`, for its empty-library hint with Refresh library. On the desktop both float at the bottom of the window (`position: fixed`), and the notice keeps its Close button, which TV focus cannot reach.

## D-216

**Shared backup dialog** — 2026-10-24 (issue #237)

- Backing up to an encrypted file and restoring it (D-056) is one dialog for every app (`packages/screens/src/BackupDialog.tsx`): `backup` from the TV's account menu, `restore` from the sign-in page, `both` from the desktop's account menu, which can also restore while signed in.
- Each app says where the file goes and comes from (`ScreenHost.backup`): the TV asks for a folder and a file with the system pickers and reloads its data after a restore (`apps/tv-app/src/backupFiles.ts`); the desktop downloads the file, picks one with the browser's file chooser and reloads the page (`apps/web-player/src/features/backup/backupFiles.ts`). What a backup holds differs (the TV also keeps its playback settings), so each app writes that line.

## D-217

**Shared player buttons** — 2026-10-24 (issue #237)

- The row of buttons under the player's timeline (play/pause, from the beginning, previous/next episode, time, Guide, Audio, Subtitles, Episodes) is one component for every app (`packages/screens/src/PlayerControls.tsx`). The desktop's Audio and Subtitles buttons now open the panel on their own tab, as on the TV; before, one button opened it on Audio.
- Each app keeps what the buttons do and adds its own: the desktop passes its mute button and volume slider (`volume`) and fullscreen (`trailing`), which the TV and phone do not have. On the TV the row is focusable only while the buttons are open (D-077), and Play takes focus when they open.

## D-218

**Shared progress bar** — 2026-10-24 (issue #237)

- How the player's progress bar looks (rail, played and loaded parts, thumb, time and preview frame) is one component for every app (`packages/screens/src/TimelineRail.tsx`). The desktop's hover time now sits above the bar with the preview frame over it, kept inside the bar as on the TV, instead of under a frame that could run off the window's edge.
- What moves the video stays with each app, because the input differs: TV keys with the preview jump (D-179, D-180), the phone's drag, and the desktop's mouse hover, click and drag with its own frame grabber. The rail takes no input itself.

## D-219

**Shared parental PIN keypad** — 2026-10-24 (issue #237)

- The parental PIN (D-054) is asked for on the TV's keypad on every app (`packages/screens/src/PinPad.tsx`, with `usePinGate`), and set, changed or removed with the TV's steps (`packages/screens/src/PinSettings.tsx`): the current PIN first, then the new one typed twice. The desktop's form with three fields is gone.
- On the desktop the keyboard's digits and Backspace type on the keypad as well as clicks, and 4 digits submit at once, so no OK button is needed. The apps no longer pass a PIN prompt or PIN settings to the shared screens.

## D-220

**Shared log view** — 2026-10-24 (issue #237)

- The diagnostics log (D-079) shows the same on every app (`packages/screens/src/LogView.tsx`): the app's notes, its buttons for sending the log, Clear log, and the last 150 lines, coloured by level with WARN or ERROR in front. The TV shows it as its Log page, the desktop in the shared dialog.
- Each app keeps how the log leaves the device, because that is the device's: the TV and phone use the Android share sheet and the phone's "Get TV log" (D-039); the desktop saves a text file or copies it.

## D-221

**Shared card menu** — 2026-10-24 (issue #237)

- A title's or an episode's options (D-078) are the TV's panel in the middle of the screen on every app (`packages/screens/src/CardMenu.tsx`), Bruno's choice. The desktop's small menu at the pointer is gone: a right-click, the menu key, Shift+F10 or an episode's "…" open the same panel, and Escape closes it like the other dialogs.
- Each app only says how a card opens it (`ScreenHost.MenuTrigger`): holding OK or a long touch on TV and phone, a right-click on the desktop. The screens draw the menu themselves, so the hosts no longer pass `Menu` or draw `TitleMenu`.

## D-222

**Phone: guide reminders as system alarms** — 2026-10-24 (issue #263)

- The phone and tablet hand every reminder of the account's profiles to Android (`ReminderAlarms.kt`, from `apps/tv-app/src/tv/reminderAlarms.ts`) whenever the list changes: one alarm per programme, which posts a notification "Starting now: …" with the channel (and the profiles who set it, when the account has several). All profiles, not only the active one, since the app may be closed or on another profile when it starts. The words are translated by JS beforehand, since no JavaScript runs when the alarm goes off.
- Exact alarms when the system allows them, else within a minute (Android 14 does not grant exact alarms by default). The list is kept natively, so the alarms are set again after a restart or an app update. Taken-off reminders cancel their alarm and notification. Notifications need the person's yes on Android 13+: asked while there are reminders, once per run.
- While the app is in front its popup shows the reminder (D-184) and the alarm stays silent. Tapping the notification opens the app, whose popup still offers Watch (it shows for 10 minutes after the start).
- Not on the TV: Android TV shows notifications poorly, so a TV's alarm opens the app instead (D-238). Not on the desktop, which can start with the computer and wait in the tray instead (D-226).

## D-223

**Title splits and merges sync and back up** — 2026-10-24 (issue #267)

- The library database's `title_rules` (D-185) stay what the grouping reads. Beside them, a record in the device's data (`direct.titleRules.<account>`, `packages/shared/src/direct/titleRules.ts`) dates each rule when it is made or undone; an undone rule stays as removed for 180 days, like other removals (D-186). Pairing, automatic sync and backups carry the record like My List (keys are the provider's: group keys and stream ids are the same on every device of one account), and per rule the later change wins.
- A device applies a record that differs from what it last wrote or applied when a list is read (at most every 10 s, not while the library updates): the rules go into the database (`replaceRules`) and only the titles they touch are grouped again, without downloading. Merges are applied oldest first the way one device makes them, so two devices' merges never chain or loop.
- A device with rules from before the record starts the record with them on its first list. A merge that follows its title's new key (issue #311, D-185) is dated again like a change made by hand.

## D-224

**Desktop: hardware H.264 encoders for conversions** — 2026-10-24 (issue #274)

- A conversion (D-189) encodes with the computer's video hardware when it has some: NVIDIA (`h264_nvenc`), Intel (`h264_qsv`) and AMD (`h264_amf`) on Windows and Linux, Apple's (`h264_videotoolbox`) on macOS; then up to 2160 lines, so 4K stays 4K. Otherwise libx264 in software, at most 1080 lines as before.
- Found once per run, on the first conversion: the encoders the bundled FFmpeg lists, in that order, each converting a second of a 1080p test picture with the same arguments a video gets (a missing GPU, driver or option fails there, at most 10 s each). A hardware encoder that passed but fails a real video (FFmpeg ends before the first segment) is dropped for the rest of the run, and that video starts again in software. The player's Log says which encoder converted.
- Each encoder makes a key frame that starts a new picture group (IDR) at every 4 s segment, so every segment plays on its own. Pictures go to the encoder as 8-bit 4:2:0 (`nv12`), HDR mapped to normal colours first as before.
- FFmpeg prints its lists (`-filters`, `-encoders`) on stdout, which the app did not read until now: HDR was never mapped since D-189 and looked grey. Both outputs are read now.
- Tested here only with the fallback (the cloud has no GPU): each hardware encoder needs a check on a real computer.

## D-225

**Profile settings carry dates and sync automatically** — 2026-10-24 (issue #268)

- Each profile's preferences (content languages, app language, subtitle/audio/version choices, hidden and kids categories, …) keep the time each one was last changed (`changedAt`, set by `profilePrefsStore.update`). The automatic sync with the TV (D-186) carries them for the account's profiles, and per preference the later change wins on both sides; kids and hidden categories go per section, and the lists (watched series, recent channels, reminders) are joined as in pairing.
- Values from before have no date: there the sending device wins, as pairing always did (D-060), and a dated value wins over an undated one. Pairing uses the same merge, so a code scanned later no longer undoes a newer choice on the TV.
- A sync that changes a preference refreshes the app's preferences (`refreshMedia`). Device settings (the audio decoder, the device's own app language before a profile, downloads, update choices) still stay on each device.

## D-226

**Desktop: start with the computer, in the tray** — 2026-10-24 (issue #309)

- Account menu → App → Start with the computer (off by default). When on, the system starts the app at sign-in with `--hidden`: the window loads but stays hidden, with the tray icon of background downloads (D-187), so guide reminders (D-184) show as a system notification and the dialog. Closing the window then always goes to the tray, not only while downloads run, and the app no longer quits when downloads end; Quit in the tray menu ends it.
- Windows and macOS through Electron's login items (`setLoginItemSettings`; macOS reports `wasOpenedAtLogin`); Linux through an XDG autostart entry (`~/.config/autostart/<app>.desktop`, the AppImage when there is one). The choice is kept in `start-with-system.txt` in the app's data, read before the window opens.
- Chosen over a separate background process or a native scheduler: the hidden page already checks reminders and runs downloads, so nothing is added that must stay in step with it. The cost is the page's memory while hidden, as for background downloads. The page stops playing when hidden, so no provider connection is held.
- Clicking a reminder's notification brings the window back (`iptv:show`); `window.focus()` alone does not show a hidden window.
- Tested here only through its parts (the autostart entry, the menu and dialog): the login items need a check on a real Windows and macOS sign-in.

## D-227

**"Provider unavailable" apart from "offline"** — 2026-10-25

- A provider that is down often still answers: an error page in HTML with HTTP 200, or an HTTP error. The app has a network then, so the banner said "You're offline" wrongly. A provider that answers badly is now an `ApiError` with status 502, and one that does not answer at all (no network, refused connection, timeout, a reply cut off) has status 0 (`unreachable` in `xtream.ts`), as `ApiError` documents; the code stays `provider_unavailable` for both, so the error texts do not change.
- When opening the app fails to confirm the account, the session is offline either way (cached library, downloads, D-050) and `providerDown` says the provider answered. The banner then says "Your IPTV provider is unavailable right now", keeping the hint to My Downloads.
- The app does not ask the system whether the device has a network: no answer at all can also be the provider's server being off, and stays "offline".

## D-228

**Changing the provider sign-in keeps the account** — 2026-10-25

- Account menu → IPTV account changes the server, username or password without signing out (`auth.updateCredentials`). The new details are checked with the provider like a sign-in (`validate`), and nothing is saved when the check fails.
- The account keeps its id. A sign-in makes the id from the server and username, so signing in again at a new address used to start an empty account: no profiles, My List, progress or saved library. Here the user says it is the same account, so its data stays and the library syncs from the new address. Signing out and in remains the way to start another account.
- The password shows as dots until Show; the details are read from the device's encrypted storage (`auth.credentials`) only while the dialog is open. Kids profiles do not see the item, like the other settings.
- The change reaches the other devices of the account: the saved sign-in carries the time it was set (`changedAt`, by sign-in and by this dialog), and scanning a sync code (D-060) and the automatic sync with the TV (D-186) send it, sealed with the pairing's key like everything else they send. The later change wins on both sides; a sign-in saved before (no date) never replaces another. A device that takes a new sign-in from the automatic sync reloads it (`AppContext.reload`, as after pairing).

## D-229

**Joined lists and the parental PIN sync by date** — 2026-10-25

- Watched series, guide reminders and recent channels were joined on every sync with no dates, so marking a series not watched, cancelling or dismissing a reminder, or the order of recent channels was undone by the other device. Each profile now keeps `listChangedAt` beside D-225's `changedAt`: per watched-series mark and reminder, when it was last set or taken off; per recent channel, when it was last watched (`profilePrefsStore.update` stamps it from the before/after lists, `profiles/listDates.ts`).
- On merge, per entry, the side that changed it later decides whether it is there; a side that has the entry undated counts as earliest, and entries neither side dated are joined as before. Recent channels are joined, newest first by their dates (undated after, the sending device's first), at most 20; one pushed off the end of the list leaves no record. Dates of a watched-series removal last as long as other removals (180 days, `KEEP_REMOVALS_MS`); a reminder's until a day after its programme started; a recent channel's while it is on the list.
- The parental PIN (D-054) now carries when it was set (`changedAt` in its saved value), and removing it keeps only that date instead of deleting the value. The automatic sync (D-186) carries it, and pairing (D-060) uses the same rule (`newerPin`): the later set or removal wins on both devices. An undated PIN (set before) only goes to a device that never had one, as pairing did, so an older PIN never replaces another. This replaces D-060's "an existing PIN stays": a PIN changed or removed on one device now reaches the others, which is what a parent changing it expects. Only the salted hash travels, sealed like the rest.
- After a sync or pairing the app reads the PIN again (`pin.refresh`, from `refreshMedia` and `reload`).
- Still undated: the automatic-subtitles settings, which move only with a QR scan and are set once. Every date comes from the clock of the device that made the change.

## D-230

**Offline warning on every page, with the provider's own words** — 2026-10-25

- Offline or with the provider down (D-227), the app opens on My Downloads, which never had the library banner, so the reason was missing there. The warning is now its own banner (`ConnectionBanner`) at the bottom of every page but the player (and the TV's details panel), with a warning icon in the warning colour (an alert for the provider, the offline icon for no network). The library banner stays away while it shows, so the two never stack.
- A provider that is down often answers with a short HTML page ("Error. Page cannot be displayed. Please contact your service provider for more details."). Its words, without tags, scripts and styles and at most 300 characters (`pageText` in `xtream.ts`), travel on the `ApiError` (`reply`) to the session (`providerReply`) and show under the warning as "Your provider says: …", with a pointer to the account menu → IPTV account (D-228) for a provider that moved. The log shows the same words instead of the raw HTML.
- The app does not guess what the page means: panels word it differently (the same page is shown for a blocked address, a moved endpoint or a server off), so the provider's own words are shown as they are.

## D-231

**Long dialog lists take the room left, not a shrunk size** — 2026-10-26

- Categories shown and a Kids profile's categories put a scrolling list between fixed parts (title, sections, hint) and Save. The list was sized to its content and left to shrink inside the panel's `maxHeight: 92%`; on the Android TV it did not shrink, so the rows ran past the panel's bottom and Save was off screen.
- These dialogs now pass `tall` to `Dialog`: the panel gets a fixed height (92% of the window, less the scrim's padding) and the list `flex: 1`, so it takes exactly the room the fixed parts leave and scrolls there, on every app. The panel no longer changes height with the section or the number of categories. Save and the other buttons sit below the list at the right, always in view.
- Both lists are plain ScrollViews: Categories shown's FlatList, given `flex: 1`, got no height on the Android TV and its categories vanished (issue #330), as the TV grid's did (D-094).

## D-232

**One Save and Cancel footer for every dialog that changes something** — 2026-10-26

- The dialogs ended differently: Save then Cancel at the left, at the right (D-231), Done alone across the width (Content language filter), Close after a change already made (Start with the computer). Bruno asked for one standard.
- `DialogActions` (`packages/screens/src/ui/DialogActions.tsx`) draws it for every app: Save (primary) then Cancel (ghost), at the bottom right (in a column on the right since [D-233](#d-233)), after the dialog's content, so a `tall` dialog's list scrolls above it (D-231). Other buttons (Delete Profile, Automatic) go before Save. Save keeps the draft; Cancel, Back and Escape drop it.
- The Content language filter and Start with the computer now keep a draft until Save, like the other settings dialogs. A dialog that applies a pick at once (App language, the merge picker) has only Cancel there; dialogs that show something (About, the log) keep Close.

## D-233

**Save and Cancel in a column on the right of the dialog** — 2026-10-27

- With Save and Cancel under a long list (D-232), reaching them on TV meant pressing Down through every row. Bruno asked for them on the right, so Right gets there at once.
- `Dialog` takes the buttons as `actions` and, on windows at least 600 wide, draws them in a 180-wide column beside the content (the panel grows by that much); `DialogActions` stacks them there: Save, Cancel, then extra buttons. Narrower windows (phones held upright) keep the bottom row, where a column would squeeze the list. The profile editor and the backup box draw their own panels and keep the bottom row.
- TV: the column is a `TVFocusGuideView` with `autoFocus` that fills the dialog's height, so Right from any row lands in it, on Save the first time and on the last focused button after that; Up/Down stay in it. The content is one too, so Left returns to the row last focused. This is the one place Right leaves a row on purpose (CLAUDE.md focus rules).

## D-234

**New seasons of watched series** — 2026-10-27 (requested by owner)

- A series counts as watched by a profile when one of its episodes has progress there or it is marked watched (D-081). My List alone does not count: a series saved but never started is not one the profile follows yet.
- The newest season of each is kept in the profile's preferences (`seasonsSeen`, master id → season number). The first time a series is read only its newest season is noted, so nothing old is announced; a higher number later is an announcement until the popup closes, which notes it. A profile that already has progress in that season (on another device, say) is not told. A sync keeps the higher number of each series, so a season dismissed on one device is not shown on the other (`pairing/settings.ts`).
- The newest season is the highest season with episodes among the title's versions in the profile's content languages (D-063): audio or subtitles in one of them, or, for a version with no language of its own, a category that names none of the others. A season only in another language is not a new season for that profile.
- Read on profile open and after each library update, one series at a time (each with its versions three at a time, D-066), through the saved series details (12 hours, D-088): no extra requests while those are fresh, and at most one read per version every 12 hours after that. The provider's series list has a last-changed date, but any edit to the series changes it, so it cannot tell a new season apart on its own.
- Home shows it like D-176's popup, with nothing over Home, and only once that popup is closed, so the two never stack. More info only: the new season starts from the details, where the series opens on the next episode to watch.

## D-235

**Quality tags and upgrades in the profile's languages** — 2026-10-27 (requested by owner)

- With languages chosen for the profile (D-063), the cover's tags (4K, CAM/TS/TC/SCR, D-141) and the better-copy popup (D-176) look only at the versions in them: a version whose audio or subtitles are in one, or one without a language in a category of one (the filter's category hint). A French 4K says nothing to someone who watches in English and Portuguese.
- Covers: a title with no version in the languages (search can show one) is tagged from all its versions. Library lists compute the tags per list from the `language` and `languageCategoryIds` they are asked with (`coverQuality`; in SQLite, from the items' `langs` and `cat`), so the stored `best` column stays the all-versions one. Details keep every version's tags.
- My List: `quality.inLanguages` holds the tags of the versions in the languages; null when there are none, and then the title is neither marked nor announced, so a better copy in another language never counts. A changed language choice reads My List again (`recheckQuality`).
- Without languages, every version counts, as before.

## D-236

**Desktop conversions keep subtitles; MKV read first** — 2026-10-28 (requested by owner)

- A conversion (D-189) used to drop every subtitle track (`-sn`), so a "Multi Sub" episode listed only "Off". Each text track (SRT, ASS, WebVTT, MP4 text; at most 16) is now written by the same FFmpeg as one WebVTT file that grows as it reads. FFmpeg's own HLS writer cannot do it: it refuses an HLS output with only subtitles and crashes (FFmpeg 6) with subtitles beside fMP4 video. Picture subtitles (PGS, DVD) cannot become text and stay out.
- The app writes the main playlist whenever there are subtitles or several audio tracks; the video then has its own folder. Each subtitle track's playlist repeats the video's segments, one behind until the video ends so a segment's cues are written by the time it is asked for, and each part is cut from the WebVTT file by cue start (`subtitlePlaylist`, `subtitleSegment` in `apps/desktop/lib/transcoder.mjs`). Cues before the start point come out negative (`-avoid_negative_ts disabled`, else FFmpeg moves the first to 0) and are left out.
- A copied video (D-189) can only start at a key frame, up to a picture group before the second asked for; it used to keep the asked second as its start, so the clock and anything timed to it were off by that much. It now starts there with sound and subtitles (`-noaccurate_seek -copyts`), and a one-picture `framecrc` output says where, which becomes the conversion's start (`startTime`). The fMP4 segments cannot tell: FFmpeg zeroes their times and keeps the offset in an edit list hls.js ignores.
- Chromium plays an MKV's first audio track only and none of its subtitles, and finds sound it cannot decode only after a few silent seconds, then starts again converted. So the desktop app reads every MKV movie or episode with FFmpeg before it plays (about a second more): sound to convert, several audio tracks or text subtitles convert from the start, with the video copied when Chromium decodes it (`conversionNeeded` → `tracks`). Other MKVs play as before. A seek that converts again keeps the subtitles on screen.

## D-237

**An X closes every dialog, except on TV** — 2026-10-28 (requested by owner)

- The desktop log box had Save log, Copy log and Clear log but nothing that closed it: only Escape did, and nobody knows that. D-232 left boxes that show something with their own Close, and the log never had one. Bruno asked for an X on the log and a visible way to close every window.
- `Dialog` (`packages/screens/src/ui/Dialog.tsx`) draws an X (`DialogClose`) at the right of its title, calling the same `onClose` as Cancel, Back and Escape, so every shared box has it on the desktop and phone. The profile editor, which draws its own panel, uses `DialogClose` too; the desktop's own frames (details, Sync with another device) already had one (`Modal.tsx`). Cancel and Close stay: the X adds a way out, it does not replace the buttons.
- Not on TV: Back closes every box there, and an X would be one more stop for the D-pad above the content, where Up from the first row would land on it. The TV's log is a page, not a box.

## D-238

**TV: a reminder opens the app** — 2026-10-31 (issue #309, owner's choice)

- With the app closed, a TV reminder was lost: Android TV launchers hide notifications. Bruno chose for the TV to open the app at the start (over a notification only, or leaving it as it was), which shows its reminder popup with Watch (D-184).
- The TV sets the same alarms as the phone (D-222, `ReminderAlarms.kt`). When one goes off and the app is not in front, a TV (`FEATURE_LEANBACK`) starts the app's launch activity. Android 10+ lets an app start an activity from the background only with "Display over other apps" (`SYSTEM_ALERT_WINDOW`), so without it, or if the start is refused, the alarm posts the phone's notification instead.
- The TV asks for it on Live TV, where reminders are set: once per run while there are reminders and it is off, a box explains it and **Open settings** opens the system screen (`OpenOnReminderPrompt.tsx`). Some TVs have no such screen; the app logs it and keeps to its popup. Not on Home, where the quality and new-season popups show.
- Opening the app still asks "Who's watching?" first (D-151): the popup shows after a profile is picked, within 10 minutes of the start.

## D-239

**Finding a TV that got a new address** — 2026-10-31 (issue #268, owner's choice)

- A phone, tablet or computer keeps the address of the TV whose code it scanned (D-061). When the router gave the TV another one, sync and Play on TV stopped until the code was scanned again. Bruno chose this part of issue #268 for 3.1, over making the desktop a second hub that listens like the TV.
- When nothing answers on the saved address (its port, then the range), `sendRemoteCommand` (`packages/shared/src/pairing/remote.ts`) sends the same sealed command to the other addresses of the old one's /24 (`neighbourHosts`: private IPv4 only, nearest first), on the saved port and the range's first, 32 at a time with a second each. Only the paired TV can open the command, so the first one that answers it is the TV; another home's TV answers 403 and is skipped. The address that answered is saved for the next command.
- No mDNS or network discovery: it would need native code on the TV, phone and desktop and new permissions, and routers usually keep the /24. A search that finds nothing is not made again for 30 minutes, so a TV that is off costs one search, not one per 10-minute sync. A network with another /24 still needs the code scanned again.
