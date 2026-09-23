# Known Issues

Bugs, external limitations, technical debt and risks.

| ID | Type | Area | Status |
|----|------|------|--------|
| [KI-001](#ki-001) | Risk | backend | Open |
| [KI-002](#ki-002) | Limitation | web-player | Open |
| [KI-003](#ki-003) | Limitation | tv-app | Open |
| [KI-004](#ki-004) | Risk | backend | Open |
| [KI-005](#ki-005) | Limitation | tv-app | Open |
| [KI-006](#ki-006) | Tech debt | tooling | Open |
| [KI-007](#ki-007) | Limitation | build env | Open |

---

## KI-001

**.NET 8 end of support: 2026-11-10** — logged 2026-09-23

.NET 8 and .NET 9 both leave support on 2026-11-10. After that: no security patches. Fix: retarget to .NET 10 LTS (`Directory.Build.props`, `global.json`, package versions). See D-006.

## KI-002

**Offline cache on web is not tamper-proof** — logged 2026-09-23

Cache API / IndexedDB content is inside the browser sandbox (no `.mp4` file in the user's Downloads), but DevTools can read cached responses. Obfuscation raises the bar; it does not stop a technical user. Real protection needs DRM (Widevine/PlayReady via EME), which Xtream Codes sources do not provide. Affects Step 5 scope.

## KI-003

**Android offline cache is not encrypted by default** — logged 2026-09-23

ExoPlayer/Media3 `SimpleCache` in app-private storage is unreadable without root. On rooted devices, cached segments are readable. Mitigation for Step 6: encrypt segments with a key held in Android Keystore, or accept the root-device risk.

## KI-004

**Upstream IPTV provider constraints** — logged 2026-09-23

- Many Xtream Codes servers are HTTP-only. An HTTPS web app cannot load HTTP streams (mixed content), so streams must pass through the backend or a TLS-terminating proxy. This adds Azure bandwidth cost.
- Providers often limit concurrent connections per account and may block datacenter (Azure) IP ranges.
- Provider uptime is outside our control.

## KI-005

**`expo-video` does not expose ExoPlayer `DownloadManager`** — logged 2026-09-23

Playback via `expo-video` uses Media3 ExoPlayer, but offline downloads need a custom Expo native module (Kotlin) wrapping `DownloadManager` + `DownloadService`, sharing the same cache with the player. Planned for Step 6.

## KI-006

**Transitive npm deprecation warnings** — logged 2026-09-23

`npm install` warns about `uuid@7` and `glob@11` pulled by Expo tooling and `@react-native-tvos/config-tv`. Build-time only; not shipped to users. Resolve by upgrading when upstream releases fixes.

## KI-007

**Agent sandbox network limits** — logged 2026-09-23

In the Claude Code cloud sandbox: .NET 9 SDK download is blocked (reason for .NET 8, see D-006), and two `expo-doctor` checks fail because Expo's schema API and React Native Directory are unreachable. Not a project defect; run `npx expo-doctor` locally for a full check.
