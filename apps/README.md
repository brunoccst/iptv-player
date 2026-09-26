# apps

End-user client applications (npm workspaces, except `desktop`, which has its own lock file).

| App | Platform | Stack |
|-----|----------|-------|
| [`web-player`](./web-player) | Desktop browsers | React + Vite |
| [`tv-app`](./tv-app) | Android TV (`.apk`) | React Native (tvOS fork) + Expo |
| [`desktop`](./desktop) | Windows, macOS, Linux (installers) | Electron around `web-player` |
