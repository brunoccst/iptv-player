# src

| Path | Purpose |
|------|---------|
| `index.ts` | Public exports. Import only from `@iptv/shared`. |
| `appContext.ts` | `createAppContext()`: builds HTTP client, API client and all stores, wires 401 → sign-out and cache resets. |
| `react.ts` | `useAppStore(store, selector)` React hook. |
| `config/` | App config from env values. |
| `api/` | HTTP client, typed API client, generated + friendly types. |
| `stores/` | Zustand stores and storage abstraction. |
| `epg/` | Pure guide-grid helpers: slots, row layout (clip, gaps), now line, current programme. |
| `playback/` | Pure playback rules shared by web and TV (resume, intro, next episode, source attempts). |
| `utils/` | Formatting helpers. |
| `testing/` | Test-only fake backend. Not exported. |
