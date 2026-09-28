# src

| Path | Purpose |
|------|---------|
| `index.ts` | Public exports. Import only from `@iptv/shared`. |
| `appContext.ts` | `createAppContext()`: builds the direct client (`direct/`) and all stores, wires 401 → sign-out and cache resets (also when switching between a Kids and a regular profile). `replaceApi` lets tests answer from a fake. Drops the connection choice saved by versions with "My server" (D-088). |
| `react.ts` | React hooks: `useAppStore(store, selector)`, `useUiLanguage`, `useNow`, `useEpgGuide` (paged guide + polling). |
| `i18n/` | The app's texts in English, Brazilian Portuguese, German and Serbo-Croatian: `t`, `tn`, the catalogs and the language per profile (D-084). |
| `config/` | App config from env values. |
| `api/` | HTTP client, typed API client, generated + friendly types. |
| `stores/` | Zustand stores and storage abstraction. |
| `backup/` | `exportUserData` / `importUserData`: password-encrypted backup file of the saved sign-in, settings, PIN, profiles, progress and My List, plus app settings an app lists in `settingsKeys` (D-056). `AppContext.reload()` applies a restored backup. |
| `pairing/` | Phone-to-TV pairing (D-060): QR text, encrypted request/answer, `acceptPairing` (TV), `sendPairing` (phone), `mergeMedia` (profiles, progress, My List). `remote.ts`: remote play (D-061), `sendRemoteCommand` (phone), `openRemoteRequest` (TV). |
| `direct/` | The provider client (Xtream) and the title normalizer: the whole `ApiClient` on the device (D-038, D-088). |
| `epg/` | Pure guide-grid helpers: slots, row layout (clip, gaps), now line, current programme. |
| `playback/` | Pure playback rules shared by web and TV (resume, intro, next episode, source attempts). |
| `utils/` | Formatting helpers, diagnostics logger, byte/text helpers for backup and pairing (`bytes.ts`, internal). |
| `profiles/` | `contentLanguages.ts`: the content language filter's category hint (D-086). `kidsFilter.ts`: `isKidsCategory` and `withKidsFilter`, which wraps the API client so Kids profiles only get kids categories, channels, guide rows and titles (D-053). |
| `design/` | Design tokens (colours, fluid sizes like CSS `clamp()`), icon paths and avatar colours shared by the web and TV apps (D-041). |
| `testing/` | Test-only fakes (the app's data by route, a fake Xtream panel). Not exported. |
