# workflows

| Workflow | Runs |
|----------|------|
| `ci.yml` | Every push/PR: JS typecheck + tests + builds, backend tests, API contract check, Python tests. |
| `tv-app.yml` | TV-related changes: TV unit tests, release APK build (artifact `tv-app-apk`), Maestro flows on an Android TV API 33 emulator (artifact `maestro-output`). |
