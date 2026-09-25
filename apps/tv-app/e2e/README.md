# e2e

[Maestro](https://maestro.mobile.dev) flows for the Android TV app. They run in CI (`.github/workflows/tv-app.yml`) on an Android TV emulator; locally they need an emulator or TV device reachable by `adb`.

| File | Purpose |
|------|---------|
| `01-online.yaml` | "My server" login (backend at `10.0.2.2:5091`), deduplicated library, details + version picker, playback, D-pad skip, quick drawer, download, Live TV guide (XMLTV + short-EPG channel) → play → ↑ guide overlay → Back. |
| `02-offline.yaml` | With provider and backend stopped: cached session → My Downloads → offline playback. |
| `03-direct.yaml` | Direct mode (no backend): login to the panel at `10.0.2.2:8091`, on-device library, playback from the provider, short-EPG guide. |
| `install.sh <apk>` | Waits for the emulator's package manager, then installs the APK (3 attempts). |
| `run.sh <out-dir>` | Runs the three flows (stops the stack before 02, starts only the panel before 03). On failure prints on-screen text/ids and filtered logcat. |

## Run locally

```bash
python tools/fake-xtream-server/generate_media.py --codec h264
scripts/start-e2e-stack.sh
npm run prebuild --workspace=@iptv/tv-app   # flows type the addresses; the emulator reaches the host at 10.0.2.2
(cd apps/tv-app/android && ./gradlew assembleRelease)
apps/tv-app/e2e/install.sh apps/tv-app/android/app/build/outputs/apk/release/app-release.apk
apps/tv-app/e2e/run.sh maestro-output
```

Hold-to-scrub is not scripted (Maestro sends single key presses); it is covered by unit tests (`remoteSeek.test.ts`, `PlayerScreen.test.tsx`).
