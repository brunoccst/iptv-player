# workflows

| Workflow | Runs |
|----------|------|
| `ci.yml` | Every push/PR, three jobs: `checks` (JS typecheck + tests + builds, backend tests, API contract check, Python tests), `lint` (ESLint + Prettier, `dotnet format`, Ruff), `web-e2e` (Playwright against the fake stack; `web-e2e-results` artifact on failure). |
| `tv-apk.yml` | Manual only (Actions → *TV APK for a real TV* → Run workflow): ARM release APK pointed at the `api_base_url` input, published to the `tv-apk` prerelease. |
| `tv-app.yml` | TV-related changes: TV unit tests, release APK build (artifact `tv-app-apk`), Maestro flows on an Android TV API 33 emulator (artifact `maestro-output`). |
