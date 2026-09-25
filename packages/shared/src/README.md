# src

| Path | Purpose |
|------|---------|
| `index.ts` | Public exports. Import only from `@iptv/shared`. |
| `appContext.ts` | `createAppContext()`: builds HTTP client, API client and all stores, wires 401 → sign-out and cache resets (also when switching between a Kids and a regular profile). With `direct` (native apps) the API client is hybrid: direct by default, server when chosen (D-038). |
| `react.ts` | React hooks: `useAppStore(store, selector)`, `useNow`, `useEpgGuide` (paged guide + polling). |
| `config/` | App config from env values. |
| `api/` | HTTP client, typed API client, generated + friendly types. |
| `stores/` | Zustand stores and storage abstraction. |
| `direct/` | Direct mode (no backend): Xtream client and the TypeScript title normalizer (D-038). |
| `epg/` | Pure guide-grid helpers: slots, row layout (clip, gaps), now line, current programme. |
| `playback/` | Pure playback rules shared by web and TV (resume, intro, next episode, source attempts). |
| `utils/` | Formatting helpers, diagnostics logger. |
| `profiles/` | `kidsFilter.ts`: `isKidsCategory` and `withKidsFilter`, which wraps the API client so Kids profiles only get kids categories, channels, guide rows and titles (D-053). |
| `design/` | Design tokens (colours, fluid sizes like CSS `clamp()`), icon paths and avatar colours shared by the web and TV apps (D-041). |
| `testing/` | Test-only fake backend. Not exported. |
