# Next Steps

## Human-Requested Backlog

Open items requested by the owner. Finished ones move to [Done](#done). Phase 1 runs locally only (D-010).

- [ ] **Later — Cloud deployment** (deferred 2026-09-23): Azure Static Web Apps, App Service, Functions, managed database.

## Agent Suggestions

- **Direct mode + server sync**: let a direct-mode device also push progress/profiles to a backend when one is configured (after Step 8).
- **Catch-up playback** for channels with `tv_archive` (KI-032): play past programmes from the guide.
- **Guide reminders**: notify (web) / banner (TV) when a chosen programme starts.
- **TV guide: move the window with the D-pad** (→ on the last visible programme loads the next hour) instead of the Earlier/Later buttons only.
- **Infer missing XMLTV `stop` times** from the next programme (KI-030).

- **Refresh relay URLs for long-paused TV downloads** (KI-026): re-request the playback URL on resume.
- **Trickplay sprites**: backend generates preview sprites on demand to replace the extra preview connection (KI-020).
- **URL routing** for deep links (KI-023).
- **mpegts.js** fallback for TS-only live panels (KI-022).
- **Series ranking by episode count** (KI-025).
- **Connection-limit awareness**: expose `maxConnections` to clients and warn before starting a stream that would exceed it (KI-004).
- **Local HTTPS** for LAN traffic (KI-009).
- **Before any cloud move**: SSRF guard + login rate limit (KI-008), hybrid relay/direct delivery (D-013), Bicep templates, Key Vault–backed Data Protection keys.
- **Series episode merge**: series variants each have their own episode lists; merge seasons/episodes across variants for a single episode picker.
- **Manual override**: admin endpoint to split/merge masters, stored as rules the worker applies.

## Done

Finished owner requests, newest first; details in the linked decisions. The original plan from the project brief:

```mermaid
flowchart LR
  S1[1. Scaffold ✅] --> S2[2. Backend providers ✅] --> S3[3. Python dedup ✅] --> S4[4. Shared clients + state ✅]
  S4 --> S5[5. Web player ✅] --> S6[6. TV app ✅] --> S7[7. Live TV EPG ✅] --> S8[8. Hybrid: direct mode ✅]
  S8 --> S9[9. Phone app ✅]
```

- [x] **Several languages per profile** (requested 2026-09-26, D-067): the language filter takes any number of languages; titles with audio or subtitles in one of them show.
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
