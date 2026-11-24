# workflows

| Workflow | Runs |
|----------|------|
| `ci.yml` | Pull requests and pushes to `main` (not both for one PR), a `changes` job and three more: `checks` (JS typecheck + tests + builds), `lint` (ESLint + Prettier, the features check `npm run lint:features` (D-079, D-143), the release notes check `npm run lint:release-notes` (D-143), Ruff), `web-e2e` (Playwright against the fake stack; `web-e2e-results` artifact on failure). When only Markdown files or `LICENSE` changed, `checks` and `web-e2e` are skipped (they count as passed); `lint` still runs. |
| `tv-apk.yml` | After every push to `main` that changes the app (TV app, shared package, lockfile; not Markdown or emulator flows), and by hand (Actions → *TV APK for a real TV* → Run workflow): ARM release APK, published to the `tv-apk` prerelease with its version line's release notes (D-143). Prints an APK size breakdown; `publish: false` keeps a test build out of the release (workflow artifact only). |
| `tv-app.yml` | TV-related changes (Markdown and unit test files excluded; unit tests run in `ci.yml`): x86 release APK built once (artifact `tv-app-apk`), then three emulators side by side against the fake panel (D-250): Android TV API 33 with the main flow and offline (`tv-1`), Android TV with a fresh sign-in and holding Right (`tv-2`), a phone with the search box (`phone`). Artifacts `maestro-output-<name>`. |
