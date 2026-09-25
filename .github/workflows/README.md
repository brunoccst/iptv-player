# workflows

| Workflow | Runs |
|----------|------|
| `ci.yml` | Every push/PR, three jobs: `checks` (JS typecheck + tests + builds, backend tests, API contract check, Python tests), `lint` (ESLint + Prettier, `dotnet format`, Ruff), `web-e2e` (Playwright against the fake stack; `web-e2e-results` artifact on failure). |
| `tv-apk.yml` | Manual only (Actions → *TV APK for a real TV* → Run workflow): ARM release APK, published to the `tv-apk` prerelease. Optional `api_base_url` prefills "My server". Prints an APK size breakdown; `publish: false` keeps a test build out of the release (workflow artifact only). |
| `tv-app.yml` | TV-related changes: TV unit tests, release APK build (artifact `tv-app-apk`), Maestro flows on an Android TV API 33 emulator: server mode, offline, direct mode (artifact `maestro-output`). |

| `ci.yml` | Pull requests and pushes to `main` (not both for one PR), three jobs: `checks` (JS typecheck + tests + builds, backend tests, API contract check, Python tests), `lint` (ESLint + Prettier, `dotnet format`, Ruff), `web-e2e` (Playwright against the fake stack; `web-e2e-results` artifact on failure). |
| `tv-apk.yml` | Manual only (Actions → *TV APK for a real TV* → Run workflow): ARM release APK, published to the `tv-apk` prerelease. Optional `api_base_url` prefills "My server". |
| `tv-app.yml` | TV-related changes: TV unit tests, x86 release APK build for the emulator (artifact `tv-app-apk`), Maestro flows on an Android TV API 33 emulator: server mode, offline, direct mode (artifact `maestro-output`). |
