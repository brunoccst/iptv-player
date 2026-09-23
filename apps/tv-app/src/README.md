# src

| File | Purpose |
|------|---------|
| `App.tsx` | Root component. Focusable D-pad demo element. |
| `config.ts` | Builds `appConfig` from `Constants.expoConfig.extra` via `@iptv/shared`. |
| `appContext.ts` | Creates the shared app context. Session persisted with `expo-secure-store` (Android Keystore). |
