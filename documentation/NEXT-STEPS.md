# Next steps

Open work only. What is done is described in [FEATURES.md](FEATURES.md) and [DECISIONS.md](DECISIONS.md). A missing app in [PARITY.md](PARITY.md) needs an open `- [ ] **Parity: <title>**` item here (`npm run lint:parity`).

## Requested by the owner

- [ ] **One set of screens for all apps (React Native Web)** (requested 2026-09-27, D-079): render the TV/phone screens in the desktop app too, so a new screen appears everywhere at once. The video player, downloads and remote focus stay per platform; mouse and keyboard need their own touches. Try one screen first (e.g. My List) and compare look, speed and effort before migrating.
- [ ] **Small Windows desktop app with Tauri** (requested 2026-09-26, D-060): a Windows-only build on WebView2 instead of Electron, about 10–20 MB instead of ~270 MB. WebView2 can start without the CORS check and with the player User-Agent; storage, phone pairing and the update check move to Rust. macOS and Linux stay on Electron.

## Suggestions

- **Sync between devices** on the home network: progress and My List follow the other devices (KI-034).
- **Catch-up playback** for channels with `tv_archive` (KI-032).
- **Guide reminders** when a chosen programme starts.
- **TV guide: move the window with the D-pad** instead of the Earlier/Later buttons only.
- **Infer missing XMLTV `stop` times** from the next programme; programmes without one are dropped today.
- **Deep links** on the desktop app (KI-023).
- **mpegts.js** fallback for TS-only live panels (KI-022).
- **Connection-limit warning** before a stream that would exceed the account's `maxConnections` (KI-004).
- **Split or merge titles by hand**, kept as rules the grouping applies.
