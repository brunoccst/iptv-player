# workflows

| Workflow | Runs |
|----------|------|
| `ci.yml` | Pull requests and pushes to `main` (not both for one PR), a `changes` job and three more: `checks` (JS typecheck + tests + builds), `lint` (ESLint + Prettier, the app parity table check `npm run lint:parity` (D-080), the release notes check `npm run lint:release-notes` (D-143), Ruff), `web-e2e` (Playwright against the fake stack; `web-e2e-results` artifact on failure). When only Markdown files or `LICENSE` changed, `checks` and `web-e2e` are skipped (they count as passed); `lint` still runs. |
| `tv-apk.yml` | After every push to `main` that changes the app (TV app, shared package, lockfile; not Markdown or emulator flows), and by hand (Actions → *TV APK for a real TV* → Run workflow): ARM release APK, published to the `tv-apk` prerelease with its version line's release notes (D-143). Prints an APK size breakdown; `publish: false` keeps a test build out of the release (workflow artifact only). |
| `tv-app.yml` | TV-related changes (Markdown files excluded): TV unit tests, x86 release APK build for the emulator (artifact `tv-app-apk`), Maestro flows on an Android TV API 33 emulator against the fake panel: main flow, offline, fresh sign-in, holding Right (artifact `maestro-output`). |
