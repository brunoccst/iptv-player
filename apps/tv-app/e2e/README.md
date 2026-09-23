# e2e

[Maestro](https://maestro.mobile.dev) flows for the Android TV app. They run in CI (`.github/workflows/tv-app.yml`) on an Android TV emulator; locally they need an emulator or TV device reachable by `adb`.

| File | Purpose |
|------|---------|
| `01-online.yaml` | Login, deduplicated library, details + version picker, playback, D-pad skip, quick drawer, download, Live TV guide (XMLTV + short-EPG channel) → play. |
| `02-offline.yaml` | With provider and backend stopped: cached session → My Downloads → offline playback. |
| `run.sh <out-dir>` | Runs both flows (stops the stack in between). On failure prints on-screen text/ids and filtered logcat. |

## Run locally

```bash
python tools/fake-xtream-server/generate_media.py --codec h264
scripts/start-e2e-stack.sh
APP_API_BASE_URL=http://10.0.2.2:5091 npm run prebuild --workspace=@iptv/tv-app   # emulator reaches the host at 10.0.2.2
(cd apps/tv-app/android && ./gradlew assembleRelease)
adb install -r apps/tv-app/android/app/build/outputs/apk/release/app-release.apk
apps/tv-app/e2e/run.sh maestro-output
```

Hold-to-scrub is not scripted (Maestro sends single key presses); it is covered by unit tests (`remoteSeek.test.ts`, `PlayerScreen.test.tsx`).
