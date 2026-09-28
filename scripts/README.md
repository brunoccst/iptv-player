# scripts

| Script | Purpose |
|--------|---------|
| `dev.mjs` | `npm run dev:all`: fake panel (`:8090`) and web dev server (`:5173`) with labelled output; `-- --no-web` skips the web server. Ctrl+C, or any process exiting, stops both. Needs Python 3. |
| `start-e2e-stack.sh` | Starts the fake panel (`:8091`, all interfaces) in the background (`FAKE_PANEL_STRESS` passes through). Needs generated panel media. |
| `stop-e2e-stack.sh` | Stops it. |
| `stress-web.mjs [url]` | Web grid stress test against a fake panel started with `FAKE_PANEL_STRESS` (D-048): scrolls the huge category and prints DOM size, long tasks and frame times. |
| `app-version.mjs` | `node scripts/app-version.mjs [package.json]`: prints an app version MAJOR.MINOR.PATCH (TV/phone by default, `apps/desktop/package.json` for the desktop app): MAJOR.MINOR from that `package.json`, PATCH from the builds on `main` since then (D-070). `tv-apk.yml` and `desktop.yml` use it; needs the full git history. |
| `create-signing-key.sh [--no-upload \| --replace \| --delete]` | Creates the APK release key once in `.signing/` (git-ignored; an existing key is reused) and saves the two repository secrets `tv-apk.yml` needs with the GitHub CLI, asking for a GitHub login the first time (D-052). Uses keytool, or openssl when Java is missing (e.g. in a Codespace). `--no-upload` only creates the key (emulator CI). `--replace` makes a new key (the old folder stays as `.signing.old-<time>`) and saves it; `--delete` removes both secrets from GitHub, so later APKs are debug-signed again. Both ask for "yes" first. |
| `check-parity.mjs` | `npm run lint:parity` (CI *Lint and format*): checks `documentation/PARITY.md` against the backlog: every app cell ✅, ➖ or ⏳, every ⏳ with an open `Parity: …` item in `NEXT-STEPS.md`, every such item named in the table (D-080). Tests: `check-parity.test.mjs`. |
| `check-i18n.mjs` | `npm run lint:i18n` (CI *Lint and format*): every `t('…')`/`tn` text in the apps and `packages/shared` is translated in each catalog (`packages/shared/src/i18n/catalogs`), placeholders match, plural forms are there, no unused texts; `t` only with string literals and never when a module loads (D-084). `npm run i18n:sync` (`--write`) adds new texts to the catalogs and drops unused ones. Tests: `check-i18n.test.mjs`. |
| `render-icons.mjs` | `node scripts/render-icons.mjs`: renders the app icon design to the APK (`apps/tv-app/assets`) and web (`apps/web-player/public`) images with Playwright Chromium. Output is committed. |

Used by `.github/workflows/tv-app.yml` and `apps/tv-app/e2e/run.sh`.
