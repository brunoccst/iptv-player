# CLAUDE.md

IPTV player: an Android TV and phone app (`apps/tv-app`, React Native tvOS fork + Expo) and a desktop app (`apps/desktop`, Electron around the React web player in `apps/web-player`). Shared logic lives in `packages/shared` (TypeScript source, no build step; no DOM or React Native imports). There is no server: each app talks to the Xtream Codes provider directly and keeps all data on the device.

## Commands

- `npm install`, then `npm run lint`, `npm run typecheck`, `npm run test` before every push.
- One workspace: `npm run test --workspace=@iptv/shared` (also `@iptv/web-player`, `@iptv/tv-app`). Desktop is not a workspace: `cd apps/desktop && npm test`.
- Web e2e (Playwright, starts its own fake panel): `npm run test:e2e`. Run it after UI navigation changes.
- Local stack: `npm run dev:all` (fake panel on :8090, sign in with `http://localhost:8090`, `demo` / `demo`).
- The TV APK and Android emulator tests only run in GitHub Actions.

## Every change

- **Release notes:** a change people see or use adds a line under **Latest** of each app it reaches in `documentation/RELEASE-NOTES.md` (newest first, with date and decision or issue). Raising MAJOR.MINOR in an app's `package.json` needs a new `### MAJOR.MINOR` section.
- **Features:** describe it in `documentation/FEATURES.md` and its matching section of `documentation/FEATURES-TECHNICAL.md` (same headings and order, a short Mermaid graph, a `**Code:**` line).
- **Parity:** every app gets the feature unless it does not apply to that device; update `documentation/PARITY.md`.
- **Translations:** user-facing text goes through `t('…')`; run `npm run i18n:sync` and translate every catalog in `packages/shared/src/i18n/catalogs`.
- **Known issues:** a limitation, risk, bug or tech debt that stays after the change becomes an open GitHub issue labelled `known issue`; cite it as `issue #N` (D-174).
- **Decisions:** a decision worth keeping gets the next `D-…` entry at the bottom of `documentation/DECISIONS.md` and a row in its index. Parallel branches can take the same number: renumber yours when merging.

`npm run lint` checks all of the above except the decisions.

## Gotchas

- Code comments cite decisions as `DECISIONS.md#d-123`. Look up the one entry by ID; don't read the whole file.
- TV focus rules: Left/Right never leave the current row (they stop at its ends); only Up/Down change rows. While a modal is open, focus never leaves it. Closing details returns focus to what opened them, or to the first visible card if that is gone.
- In a plain browser the web player only reaches the fake panel; real providers block web pages, so they work only in the desktop, TV and phone apps.
- `.env` is committed and public (`APP_*` values end up in the web bundle). Secrets go in `.env.local`.
- `react-native` is aliased to `react-native-tvos` in the root `package.json`; `.npmrc` needs `legacy-peer-deps=true` for it.
