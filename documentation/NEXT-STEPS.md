# Next Steps

## Human-Requested Backlog

Open items requested by the owner. Finished ones move to [Done](#done).

- [ ] **App parity, step 2 — share feature logic, not only rules** (requested 2026-09-27, D-080): move each feature's behaviour (what a menu offers, what an action does, player button order and state) into `packages/shared` as small view-models or hooks, so the TV/phone and web/desktop screens only draw it (about 50–100 lines per app and feature). One feature at a time, starting with the card menu and the player controls. About 1–2 weeks, low risk.
- [ ] **App parity, step 3 — one set of screens for all apps (React Native Web)** (requested 2026-09-27, D-080): render the TV/phone screens in the browser and the desktop app too, so a new screen appears everywhere at once. Stays per platform: the video player (ExoPlayer / hls.js), downloads, remote-control focus; mouse and keyboard need their own touches (right-click, hover). Try one screen first (e.g. My List) and compare look, speed and effort before migrating; the current web screens would be rewritten. Several weeks.
- [ ] **Small Windows desktop app with Tauri** (requested 2026-09-26, see D-072): a Windows-only build on the system's WebView2 (Chromium, installed with Windows 10/11) instead of Electron, about 10–20 MB instead of ~270 MB. WebView2 can be started without the CORS check and with the player User-Agent (browser arguments), so the web player works as in the Electron app; storage, phone pairing and the update check move to Rust. macOS and Linux stay on Electron.

## Agent Suggestions

- **Sync between devices without a server**: progress and My List follow the other devices on the home network (the pairing code already merges them once, D-060, D-072).
- **Catch-up playback** for channels with `tv_archive` (KI-032): play past programmes from the guide.
- **Guide reminders**: notify (web) / banner (TV) when a chosen programme starts.
- **TV guide: move the window with the D-pad** (→ on the last visible programme loads the next hour) instead of the Earlier/Later buttons only.
- **Infer missing XMLTV `stop` times** from the next programme (KI-030).

- **Refresh the playback URL of long-paused TV downloads** (KI-026): re-request it on resume.
- **URL routing** for deep links (KI-023).
- **mpegts.js** fallback for TS-only live panels (KI-022).
- **Connection-limit awareness**: warn before starting a stream that would exceed the account's `maxConnections` (KI-004).
- **Manual override**: split or merge titles by hand, kept as rules the grouping applies on the device.

## Done

Finished owner requests, newest first; details in the linked decisions. The original plan from the project brief:

```mermaid
flowchart LR
  S1[1. Scaffold ✅] --> S2[2. Backend providers ✅] --> S3[3. Python dedup ✅] --> S4[4. Shared clients + state ✅]
  S4 --> S5[5. Web player ✅] --> S6[6. TV app ✅] --> S7[7. Live TV EPG ✅] --> S8[8. Hybrid: direct mode ✅]
  S8 --> S9[9. Phone app ✅] --> S10[10. Server retired ✅]
```

- [x] **Out of memory on low-memory TVs** (issue #109, D-113): provider lists are read one entry at a time instead of as one 100+ MB text; the saved library is kept in 4 MB parts; the app asks Android for a larger heap; a native crash (like this one) and the device's memory now show in the Log. Lists are parsed in batches of about 500k characters, as fast as reading the whole text. A library saved in parts is read back again (its index file lost everything after a NUL on Android), and the app keeps reacting while lists download.
- [x] **TV: focus stays on "Show all" / "Show less"** (D-114): opening the category box no longer moves the focus to the chosen category.
- [x] **TV/phone: native list reading** (D-115): the provider's movie, series and channel lists are downloaded and cut into batches by native code on another thread; JavaScript only parses the batches.
- [x] **Grouping time per step** (D-116): the Log shows how long each grouping step took; work slices between screen updates are 250 ms instead of 50 ms.
- [x] **Faster start, "Loading your library…"** (D-117): a large saved library is kept newest first (no sort for the first list), unpacked in slices, and Home shows a spinner until the first list answers.
- [x] **Faster grouping** (D-118): title ids hashed by native code on TV/phone, a faster SHA-1 in JavaScript, lighter similarity keys, and each distinct name read once per update.
- [x] **"Refresh library" on the first press** (D-119): the update now shows (banner and progress) from the first press; before, only a second press showed it.
- [x] **Menu focus, Show all, "PL = …", "BL - …"** (requested 2026-09-29, D-112): the avatar menu keeps the D-pad until Back; "Show all" keeps the category box on screen; "PL = Title" is read as Polish; "BL - Title" (Bollywood) drops the prefix without a language.
- [x] **Automatic subtitles** (issue #103, D-111): with the user's OpenSubtitles API key, a movie or episode without subtitles in a preferred language gets one downloaded and turned on; set up under avatar → App → Automatic subtitles.
- [x] **Categories shown** (issue #104, D-110): avatar → Profiles → Categories shown hides categories from browsing (bars, lists, Home, Live TV, guide) per profile; search still finds them.
- [x] **Faster library updates** (requested 2026-09-29, D-109): an update still downloads the full lists (the provider offers nothing else), but only reads and builds the names and titles that changed; the rest is taken from the last library.
- [x] **TV category pager, Show all, search filter** (requested 2026-09-29, D-108): ‹ › keep the focus at the first and last categories (OK does nothing there); "Show all" no longer scrolls the page down; search has All / Movies / Series / Live TV, and "Results for …" stays on screen; "Close the app" is in the avatar menu itself.
- [x] **Greek, Ex-Yu, Punjabi, EAR** (requested 2026-09-29, D-107): "GR - …", "EXYU - …" / "EX-YU - …", "PUNJABI - …" and "EAR - …" (English, Arabic subtitles in the picture) titles join their other versions and can be chosen in the content language filter (Polish, "PL", already could); the library regroups once.
- [x] **Repository clean-up** (requested 2026-09-26): review the whole repository and remove unused or unnecessary files (dead code, stale scripts, leftover assets, outdated docs). Done 2026-09-29: dead code removed (`clearAsyncCache` in both apps, `usePlayer`, `focusRing`, `isFuzzyMatch`), ignore entries for the removed OpenAPI folders dropped, known issues and READMEs that still described the server updated (KI-026 resolved; KI-031, KI-034, KI-036, KI-041 reworded). A `knip` scan found no unused files, assets or dependencies beyond these; the Codespaces setup went with D-106.
- [x] **Web player: only the desktop app's screens** (requested 2026-09-28, after D-088): without a server the web player no longer works in a normal browser against real providers; it lives on as the desktop app's screens, and the browser stays for development and the end-to-end tests (fake panel). Remove the Codespaces setup (`.devcontainer`, its README section and the APK download through it; the README links cover the APK) and the "Web player (browser)" wording in About and the docs. Optional, only if the name keeps confusing: move `apps/web-player` under the desktop app (e.g. `apps/desktop/ui`), which touches CI, scripts and docs paths. Done (D-106): the Codespaces setup is gone, About says "Development build (browser)" in a browser; the folder stays `apps/web-player`.
- [x] **TV centering and search paging** (requested 2026-09-28, D-095, D-096, D-098): moving between rows scrolls once, straight to the middle, also when pressing or holding Up/Down; search results come in pages that load as you move down, so long result lists stay quick.
- [x] **TV browsing polish** (requested 2026-09-28, D-094): the Movies/Series grid stays fast after loading more titles and says when it is loading; the focused title is kept in the middle of the screen on every TV page; the category bar shows "All", three categories, ‹ › and "Show all"; the search "X" can be reached with the remote; "IPTV Player" in the header is no longer a link.
- [x] **Movies/Series freeze on TV, series first** (requested 2026-09-28, D-093): the TV Movies and Series pages no longer freeze with a large library (the grid is a plain scroll view on TV); series are grouped first even when the movie list arrives a moment earlier; the Log screen notes when the app was busy; a 160k-title emulator test (`tv-stress`) covers it.
- [x] **Large libraries on slow TVs** (requested 2026-09-28, D-093): grouping 100k+ titles about twice as fast on TVs (same result); series are grouped as soon as their list is in instead of after all movies; Movies and Series no longer freeze with thousands of categories (chips appear a page at a time).
- [x] **Pause when the headphones go away** (issue #83, D-092): unplugging headphones or losing a Bluetooth headset pauses playback instead of carrying on through the speaker; Play resumes.
- [x] **Live TV category, "Default" audio, category box** (requested 2026-09-28, D-090, D-091): the Live TV category stays selected after closing the player (TV, phone); a stream with a single unnamed audio track shows "Default" instead of a language its tag may get wrong; "Show all" lists the categories across the full width in a box that scrolls on its own, with "Show less" always in view.
- [x] **Albanian and Kurdish titles; episodes button** (requested 2026-09-28, D-089): "ALB - …" and "KU - …" join the title's other versions (also in the content language filter); the library regroups once. The player's episodes button (TV, phone) opens the drawer on Episodes; audio and subtitle tracks without a name show the language's name ("English" instead of "en").
- [x] **Retire the server** (requested 2026-09-28, D-088): the TV, phone and desktop apps only talk to the IPTV provider directly; the "My server" choice and address are gone from sign-in, About and the log. The .NET backend and the Python title normalizer are removed (the TypeScript normalizer and its test cases stay in `packages/shared`), with their CI jobs, OpenAPI types and scripts; the whole project is TypeScript, plus the Python fake panel for tests. A login saved through a server goes back to the sign-in screen once. The cloud deployment item is dropped (nothing left to host).
- [x] **Keep subtitles, audio and version choices** (requested 2026-09-27, D-087): the subtitles, audio track and version last picked are what every movie and series starts with, matched by language (versions: the same quality first), per profile, on every app.
- [x] **Content language filter fixes** (requested 2026-09-27, D-086): the filter takes a title's language from its category's name when the title's own name has none, and shows titles in categories without a language; renamed "Content language filter"; "TS"/"DE" inside names no longer cut them or count as tags; episodes like "EP197"/"EP196" stay apart; Sync with phone centred, select arrows with room, icons in the episode menu.
- [x] **Web/desktop: category chips on one line, row titles clickable** (requested 2026-09-27, D-085): Movies and Series show one line of category chips with Show all / Show less, like the TV and phone apps; Home row titles take the mouse over their whole text.
- [x] **App in four languages** (requested 2026-09-27, D-084): English (source and default), Brazilian Portuguese, German and Serbo-Croatian (Bosnia, Latin script); chosen per profile in the account menu → App → App language, or on the sign-in page; a first start follows the device's language; CI checks that every text is translated.
- [x] **Tidy episode rows** (requested 2026-09-27, D-083): each episode shows Play, "…" and its version; "…" (or hold OK, a long touch, a right-click) opens Mark as (not) watched, Download, Play on TV and Open in another player. No per-episode check button any more; the watchlist stays per title.
- [x] **Watched series and episodes** (requested 2026-09-27, D-082): mark each episode watched or not (check button, or the episode's menu); "Mark series as watched" on series cards marks every episode; the "Watched" tag shows on fully watched series covers and next to the series title.
- [x] **Watched tag, card menu options, the last two parity gaps** (requested 2026-09-27, D-081): a "Watched" tag at the bottom right of watched covers and in details; the card menu (hold OK, long touch, right-click) offers Go to details and Mark as (not) watched on every title card, plus Remove on Continue Watching; web/desktop get the guide over the playing channel (Guide button or G) and, in the desktop app, Open in VLC.
- [x] **Keep every app level** (requested 2026-09-27, D-080): pull requests ask which apps they cover; CI checks that `PARITY.md` marks every app and that each missing one has an open `Parity: …` backlog item. Steps 2 and 3 (shared feature logic, one set of screens) are in the backlog.
- [x] **Same look and features in every app** (requested 2026-09-27, D-079, [PARITY.md](PARITY.md)): web/desktop get the card menu by right-click, the player's from-the-beginning and previous/next episode buttons, the provider's answer on playback errors, About and Log in the account menu (TV groups), and the TV's focus look on cards.
- [x] **TV: holding Right in a row** (reported 2026-09-27, D-076): the focus stops on "See all" instead of jumping to the nav or Live TV, and rows scroll with the focus again (the first fix, D-075, had stopped that). Checked on the emulator with bursts of Right presses.
- [x] **Card menu, focus clipping** (requested 2026-09-27, D-078): hold OK on a Continue Watching card → "Remove from Continue Watching" / Cancel; the focused card's ring and glow are no longer cut at the top and bottom of TV rows.
- [x] **Player: previous / next episode, from the beginning** (requested 2026-09-27, D-077): episodes get previous/next buttons around −10 s / +10 s; movies and episodes get "from the beginning". TV/phone app.
- [x] **Skip ahead options on TV** (requested 2026-09-27, D-075): moving between 30 s … 3 min (and Play Now / Cancel) with ←/→ no longer skips ±10 s; the chosen option skips its full amount.
- [x] **TV focus fixes** (requested 2026-09-27, D-075): focus stays in the details panel; ↓ in the player walks the on-screen buttons (↑ opens audio/subtitles); the "See all" card is filled like other cards (holding Right: D-076).
- [x] **Provider answer in the log** (requested 2026-09-27, D-074): when a stream is not a video, the log shows what the provider sent (status, type, start of the text, credentials masked); "max connections", "not found", "expired" get a clear message.
- [x] **Desktop: in-app updates, TV-style login, even covers** (requested 2026-09-26, D-073): the app downloads and installs new versions itself (Windows, AppImage), so Windows no longer asks the SmartScreen question for updates; the login page matches the TV (IPTV provider / My server, QR code beside the form); cards keep one size whatever the image or title length. README shows the pipeline status badges. Phone: tapping the search box no longer moves focus to the first Live TV card (checked on a phone emulator in CI).
- [x] **Desktop app: phone sync, install folder, size** (requested 2026-09-26, D-072): Sign in / Sync with phone by QR code (phone: Connect a TV or computer); Windows setup asks for whom and where to install; smaller download.
- [x] **Desktop app** (requested 2026-09-26, D-071): installers for Windows, macOS and Linux from the `desktop` release; signs in to the provider directly, no server or commands needed.
- [x] **App versions and update installer** (requested 2026-09-26, D-070): the app has MAJOR.MINOR.PATCH versions (About, update dialog, release title); the installer now opens on the first try after the download, and the dialog can open it again.
- [x] **Close the app** (requested 2026-09-26): account menu → App → Close the app (TV/phone) asks, then ends the app like "Force stop" in the system settings.
- [x] **TV navigation and Home polish** (requested 2026-09-26, D-069): Left/Right never leave a row ("See all" included), Home centres the focused row, pages show a spinner at once, Movies/Series explain an empty page while the library is organized, smoother scrolling.
- [x] **TV sleep mode** (requested 2026-09-26, D-068): the app keeps the screen on and shows its own sleep screen after 10 idle minutes, so the system screensaver no longer sends it to the background (where it was closed and restarted); after 3 hours asleep the TV's own settings apply.
- [x] **Kids profiles: only what makes sense for kids** (requested 2026-09-26, D-053): their account menu only switches profile (no settings, backup, updates, log or sign-out) and they have no "Open in another player"; parents set languages and categories in the profile editor.
- [x] **Account menu groups** (requested 2026-09-26): the menu under the avatar shows other profiles, groups and Sign out; a group opens in place under its name with a back arrow (TV/phone: Profiles, Library & devices, App; web: Profiles, Library & data).
- [x] **About** (requested 2026-09-26): account menu → About on TV/phone shows the installed version (the `tv-apk` build number), the commit and date it was built from, and how the app connects.
- [x] **Several languages per profile** (requested 2026-09-26, D-067): the language filter takes any number of languages; titles with audio or subtitles in one of them show.
- [x] **One episode list per series** (requested 2026-09-26, D-066): the details page and the player show the episodes of all versions of a series in one list; each episode plays in the chosen version where it has it, and can switch version.
- [x] **Faster TV emulator CI step** (requested 2026-09-26, D-044): the emulator build keeps Gradle's cache between runs; the APK build went 7:19 → 4:17.
- [x] **Merge translated titles** (requested 2026-09-26, D-065): titles with the same TMDB id in the provider lists become one title, when their years agree.
- [x] **Kids profiles: parents choose the categories** (suggested, chosen 2026-09-26, D-064): per Kids profile and section, starting from the name rule.
- [x] **Language filter** (requested 2026-09-26, D-063): account menu → Language per profile; titles with that audio or subtitle language (from the names) only.
- [x] **Self-update** (requested 2026-09-26, D-062): the app checks the GitHub `tv-apk` release, offers newer versions, downloads and verifies the APK and opens the Android installer; account menu → Check for updates.
- [x] **Live TV: transparent guide overlay** (requested 2026-09-25, PR #18, D-058): see-through list of the category's channels with now/next over the playing video; ↑ on TV, swipe up or the Guide button on phones; Select switches channel; closes after 6 s or with Back.
- [x] **External player for movies and episodes** (requested 2026-09-25, PR #18, D-057): "Open in another player" on movie details and on each episode; hands the stream to VLC, MX Player, Just Player and others with the provider User-Agent; the app chooser when no default player is set.
- [x] **Export and import user data** (requested 2026-09-25, D-056): password-protected backup file with sign-in, server settings, profiles, PIN, progress and My List; restore from the login screen.
- [x] **Watchlist** (requested 2026-09-25, D-055): "My List" per profile, from the details panel, with a Home row and its own page.
- [x] **Parental PIN** (suggested, chosen 2026-09-25, D-054): optional; locks leaving a Kids profile and managing profiles.
- [x] **Kids profile filters content** (suggested, chosen 2026-09-25, D-053): Kids profiles only see kids categories.
- [x] **Signed APK** (suggested, chosen 2026-09-25, D-052): `tv-apk.yml` signs with a private release key from repository secrets instead of Expo's public debug key, so only your own APKs can replace the installed app.
- [x] **Periodic library sync** (suggested, chosen 2026-09-25, D-051): server libraries refresh in the background every 12 h for signed-in accounts (KI-016).
- [x] **Step 9 — Phone app** (requested 2026-09-24, closed 2026-09-25 by owner: nothing further planned): touch UI on the same shared code, direct mode by default.
  - [x] Player: full-screen landscape, double tap ±10 s, timeline drag, screen stays on; details panel sized for phones (PR #8, D-046).
  - [x] Home rows: 10 titles and a "See all" arrow card (D-043).
- [x] **Legal notes for Germany** (requested 2026-09-25): section in the root README.
- [x] **Offline anti-piracy hardening** (deferred 2026-09-23, done 2026-09-25, D-050): encrypted Android downloads, downloads tied to the account, 30-day online check. KI-002 stays open (web has no DRM).
- [x] **Library sort** (requested 2026-09-25, D-049): Movies/Series can be sorted by date added (default, newest first), name or release date, each ascending or descending, when the provider has that data.
- [x] **UI stress tests** (requested 2026-09-24, PR #10, D-048): fill the fake panel with very large categories (e.g. thousands of titles in one category, many categories and channels) and scroll to the end on phone, TV and web, to find the point where the UI slows down (frame drops, memory, load time), then fix what shows up.
- [x] **Expandable category chips** (requested 2026-09-24, PR #9, D-047): on Movies/Series (and the Live TV categories), the chips are one horizontal line today, so users must scroll sideways to find one. Add an expand button that shows all categories wrapped across the full width, plus a clearly visible button to collapse back to the single line.
- [x] **Evaluate a smaller APK** (requested 2026-09-24, PR #11, D-045: 42.5 MB → ~16 MB): the release APK is about 40 MB. Check per-ABI splits or an app bundle, R8/resource shrinking, and unused native libraries and assets.
- [x] **Evaluate faster pipelines** (requested 2026-09-24, PR #7, D-044): measure where CI time goes (APK build, Android TV emulator + Maestro, web e2e) and check what caching, parallel jobs or skipping unaffected workflows would save.
- [x] **Skip ahead instead of Skip Intro** (requested 2026-09-24, D-042): the button opens 30 s / 1 / 2 / 3 min; re-press or Back/Esc cancels.
- [x] **APK looks like the web app** (requested 2026-09-24, D-041): top nav, hero, rows, grid with category chips, details panel, guide, player controls, profiles; shared tokens and icons.
- [x] **Step 8 — Hybrid: native apps without a server** (requested 2026-09-24, D-038). The TV app talks to the provider directly by default; a backend is optional.
  - [x] 8a. Shared direct provider client (TypeScript): Xtream catalog, series details, live channels, short-EPG guide, direct playback URLs. Tests against fake-panel fixtures.
  - [x] 8b. TypeScript title normalizer (parser, tags, grouping) with JSON test cases shared with the Python tests, so both stay in step.
  - [x] 8c. `createDirectApiClient`: same interface as the backend client; profiles, progress and library kept on the device.
  - [x] 8d. TV app: sign-in chooses "IPTV provider" (default) or "My server"; provider User-Agent on playback and downloads.
  - [x] 8e. CI: Maestro flows in direct mode against the fake panel, plus one server-mode flow; `tv-apk.yml` no longer needs a backend address.
- [x] **Phone testing via Codespaces** (requested 2026-09-23): `.devcontainer` with the fake panel, mobile nav/player fixes (D-035).
- [x] **One-command dev start** (requested 2026-09-23): `npm run dev:all` (D-034).
- [x] **Linters/formatters + web e2e in CI** (requested 2026-09-23): ESLint + Prettier, `dotnet format`, Ruff, `lint` and `web-e2e` CI jobs (D-033).
- [x] **Step 7 — Live TV EPG grid**: XMLTV cache + short-EPG fallback, `/api/epg` paged grid, shared store + layout helpers, web and TV guides, fake panel EPG, tests (D-031, D-032).
- [x] **Step 6 — TV app**: native focus navigation, remote handling (tap ±10 s with circle, hold-to-scrub with acceleration), ↑/↓ quick drawer, `tv-media` Expo module (ExoPlayer + Media3 DownloadManager in private storage), My Downloads, Jest tests, Android TV emulator + Maestro CI (D-028 – D-030).
- [x] **Test environment for the TV app** (requested 2026-09-23): `.github/workflows/tv-app.yml` (D-030).
- [x] **Step 5 — Web player**: Netflix-style UI, hls.js engine (HLS first, MKV hint), timeline frame previews, keyboard controls, version selector, Skip Intro, next-episode countdown, episodes drawer, profiles, Continue Watching (backend progress), encrypted Service Worker downloads, My Downloads, fake Xtream panel + e2e tests (D-023 – D-027).
- [x] **Step 4 — Shared package**: OpenAPI-generated types, typed API client, Zustand stores (session/profiles, catalog, library, player), app context wired into web + TV (D-020 – D-022).
- [x] **Step 3 — Python dedup service** (SQLite queue, owner-approved 2026-09-23): regex tag parsing, clean titles, guarded fuzzy grouping, master media + variants, `/api/library` endpoints, tests (D-016 – D-019).
- [x] **Step 2 — Backend**: `IMediaProvider`, `XtreamCodesProvider`, authentication proxy, user profiles, catalog endpoints, playback + stream relay (D-011 – D-015).
- [x] **Upgrade backend to .NET 10** (requested 2026-09-23, D-009).
- [x] **Step 1 — Scaffold**: monorepo, workspaces, 3 documentation files, READMEs, central `APP_NAME` config.
