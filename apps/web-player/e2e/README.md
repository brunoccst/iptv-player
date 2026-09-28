# e2e

Playwright tests against a production build that talks to the fake panel directly (D-088). `global-setup.ts` starts,
on dedicated ports:

| Service | URL |
|---------|-----|
| Fake Xtream panel (`tools/fake-xtream-server`, allows web pages to read its answers) | `http://localhost:8091` |
| Web production build (`vite preview`, `dist-e2e/`) | `http://localhost:4174` |

## Requirements

- Python 3.11 (the fake panel).
- ffmpeg for first-run media generation (or run `tools/fake-xtream-server/generate_media.py` once).
- Chromium: `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH` to an existing binary.

## Run

```bash
npm run test:e2e --workspace=@iptv/web-player
```

| File | Purpose |
|------|---------|
| `stack.ts` | Ports and repo paths. |
| `global-setup.ts` | Starts/stops the fake panel and the web build. |
| `helpers.ts` | Login, library wait, video time helpers. |
| `app.spec.ts` | Scenarios: dedup + variants, HLS playback + preview + version switch, MKV hint, skip intro + next episode + continue watching, live, encrypted offline downloads, My List, parental PIN, backup + restore in a second browser. |
