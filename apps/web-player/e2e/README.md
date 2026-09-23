# e2e

Playwright tests against a real local stack. `global-setup.ts` starts, on dedicated ports:

| Service | URL |
|---------|-----|
| Fake Xtream panel (`tools/fake-xtream-server`) | `http://localhost:8091` |
| Backend (temp `DATA_DIR`) | `http://localhost:5091` |
| Title normalizer worker | – |
| Web production build (`vite preview`, `dist-e2e/`) | `http://localhost:4174` |

## Requirements

- .NET 10 SDK, Python 3.11 with `services/title-normalizer/.venv` installed.
- ffmpeg for first-run media generation (or run `tools/fake-xtream-server/generate_media.py` once).
- Chromium: `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH` to an existing binary.

## Run

```bash
npm run test:e2e --workspace=@iptv/web-player
```

| File | Purpose |
|------|---------|
| `stack.ts` | Ports and repo paths. |
| `global-setup.ts` | Starts/stops the stack. |
| `helpers.ts` | Login, library wait, video time helpers. |
| `app.spec.ts` | Scenarios: dedup + variants, HLS playback + preview + version switch, MKV hint, skip intro + next episode + continue watching, live, encrypted offline downloads. |
