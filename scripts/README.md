# scripts

| Script | Purpose |
|--------|---------|
| `dev.mjs` | `npm run dev:all`: backend (`:5080`), normalizer worker and web dev server (`:5173`) with labelled output. `-- --fake` adds the fake panel (`:8090`), `-- --no-web` skips the web server. Ctrl+C, or any process exiting, stops all. Needs `services/title-normalizer/.venv`. |
| `start-e2e-stack.sh` | Starts fake panel (`:8091`), backend (`:5091`, all interfaces, temp `DATA_DIR`) and normalizer worker in the background. Needs `services/title-normalizer/.venv` and generated panel media. |
| `stop-e2e-stack.sh [panel] [backend] [worker]` | Stops them (default: all). |
| `stress-web.mjs [url]` | Web grid stress test against a fake panel started with `FAKE_PANEL_STRESS` (D-048): scrolls the huge category and prints DOM size, long tasks and frame times. |
| `create-signing-key.sh` | Creates the APK release key once in `.signing/` (git-ignored) and prints the two repository secrets `tv-apk.yml` needs (D-052). Uses keytool, or openssl when Java is missing (e.g. in a Codespace). Refuses to overwrite an existing key. |
| `render-icons.mjs` | `node scripts/render-icons.mjs`: renders the app icon design to the APK (`apps/tv-app/assets`) and web (`apps/web-player/public`) images with Playwright Chromium. Output is committed. |

Used by `.github/workflows/tv-app.yml` and `apps/tv-app/e2e/run.sh`.
