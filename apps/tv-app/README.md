# @iptv/tv-app

Android TV client. Expo SDK 57 + `react-native-tvos` + TypeScript. Output: `.apk`.

## Config

`app.config.ts` loads the repo root `.env` (then `.env.local`) and sets:

| Expo field | Env key |
|------------|---------|
| `name` | `APP_NAME` |
| `slug` | `APP_SLUG` |
| `android.package` | `APP_ANDROID_PACKAGE` |
| `extra.*` | `APP_NAME`, `APP_SLUG`, `APP_API_BASE_URL` |

## Commands

```bash
npm run start --workspace=@iptv/tv-app       # Metro dev server
npm run prebuild --workspace=@iptv/tv-app    # generates android/ with TV manifest
npm run android --workspace=@iptv/tv-app     # build + install on emulator/device
npm run typecheck --workspace=@iptv/tv-app
```

Release `.apk`: `cd android && ./gradlew assembleRelease` after `prebuild`. Output: `android/app/build/outputs/apk/release/`.

## Requirements

- Android SDK + an Android TV emulator (API 31+) or device.
- JDK 17.

## Structure

| Path | Purpose |
|------|---------|
| `index.ts` | Registers the root component. |
| `app.config.ts` | Dynamic Expo config. |
| `src/` | Application source. |
