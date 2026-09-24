# scripts

| Script | Purpose |
|--------|---------|
| `dev.mjs` | `npm run dev:all`: backend (`:5080`), normalizer worker and web dev server (`:5173`) with labelled output. `-- --fake` adds the fake panel (`:8090`), `-- --no-web` skips the web server. Ctrl+C, or any process exiting, stops all. Needs `services/title-normalizer/.venv`. |
| `start-e2e-stack.sh` | Starts fake panel (`:8091`), backend (`:5091`, all interfaces, temp `DATA_DIR`) and normalizer worker in the background. Needs `services/title-normalizer/.venv` and generated panel media. |
| `stop-e2e-stack.sh [panel] [backend] [worker]` | Stops them (default: all). |
| `render-icons.mjs` | `node scripts/render-icons.mjs`: renders the app icon design to the APK (`apps/tv-app/assets`) and web (`apps/web-player/public`) images with Playwright Chromium. Output is committed. |

Used by `.github/workflows/tv-app.yml` and `apps/tv-app/e2e/run.sh`.
