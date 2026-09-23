# @iptv/shared

Platform-agnostic TypeScript code used by `apps/web-player` and `apps/tv-app`.

## Contents

| Path | Purpose |
|------|---------|
| `src/config/` | `createAppConfig()` — validates root `.env` values into an `AppConfig` object. |
| `src/index.ts` | Public exports. Import only from `@iptv/shared`. |

Planned (Step 4): API clients, Zustand stores, domain types.

## Rules

- No DOM or React Native imports. Code must run on both platforms.
- Consumed as TypeScript source. No build step.

## Commands

```bash
npm run typecheck --workspace=@iptv/shared
npm run test --workspace=@iptv/shared
```
