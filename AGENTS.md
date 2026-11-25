# AGENTS.md

Rules for every person and AI coding agent in this repository (Claude Code, Codex, Cursor, Copilot, any other tool). This file is the single source of truth: `CLAUDE.md`, `.github/copilot-instructions.md` and `.cursor/rules/agents.mdc` only point here.

Read this whole file before you change anything. Words in **MUST** / **NEVER** are hard rules. If this file and a task disagree, follow this file and say so in the pull request. To change a rule, change this file in its own pull request (DECISIONS.md#d-249).

## 1. Never do these

1. **NEVER merge a pull request.** Only humans, such as Bruno (`brunoccst`) and Ale (`aletiro`) merge.
2. **NEVER push to `main`** or to another person's branch.
3. **NEVER add a server, backend, cloud API or proxy** of our own (D-088). If a task needs one, stop and say so in the issue.
4. **NEVER rewrite** an app in another framework (no Tauri, issue #238; desktop stays Electron, TV and phone stay React Native).
5. **NEVER commit secrets.** `.env` is committed and public (`APP_*` values end up in the web bundle). Secrets go in `.env.local`, which is not committed.
6. **NEVER skip, delete or weaken a test or a lint check** to make CI pass. Fix the code instead.
7. **NEVER add a TV sleep mode** (removed on purpose, D-151).
8. **NEVER change files unrelated to your task**, and never reformat whole files you did not otherwise change.

## 2. The project

An IPTV player with three apps and **no server**: each app talks to the user's Xtream Codes provider directly and keeps all data on the device.

| Path | What it is |
|------|------------|
| `apps/tv-app` | Android TV and phone app (React Native tvOS fork + Expo). "TV" and "Phone" in the docs both mean this app. |
| `apps/web-player` | The desktop app's React screens. Also runs in a browser for development and e2e tests. |
| `apps/desktop` | Desktop app (Windows, macOS, Linux): Electron around `apps/web-player`. Not an npm workspace. |
| `packages/shared` | Shared TypeScript logic (provider client, stores, rules, translations). Source only, no build step. **MUST NOT** import DOM or React Native. |
| `packages/screens` | React Native screens shared by every app (desktop through React Native Web; D-193). |
| `tools/fake-xtream-server` | Fake Xtream panel with test media (Python, standard library only). |
| `documentation/` | `FEATURES.md`, `FEATURES-TECHNICAL.md`, `RELEASE-NOTES.md`, `DECISIONS.md`, `LEGAL-NOTES.md`. |

Before writing new code, search for an existing helper in `packages/shared` and `packages/screens`; shared code is preferred over app-specific copies.

## 3. Commands

Node 22+ (`.nvmrc`), npm 10+, Python 3 with `ruff` for the Python lint.

| Task | Command |
|------|---------|
| Install | `npm install` (`.npmrc` sets `legacy-peer-deps=true`; keep it) |
| **Before every push** | `npm run lint && npm run typecheck && npm run test` |
| Auto-fix formatting | `npx prettier --write <files you changed>` |
| One workspace's tests | `npm run test --workspace=@iptv/shared` (also `@iptv/web-player`, `@iptv/tv-app`) |
| Desktop tests | `cd apps/desktop && npm test` |
| Web e2e (Playwright, starts its own fake panel) | `npm run test:e2e`, or `cd apps/web-player && npx playwright test`. Set `PLAYWRIGHT_CHROMIUM_PATH` to use an installed Chromium. **MUST** run after any UI or navigation change. |
| Local stack | `npm run dev:all`, then sign in with `http://localhost:8090`, user `demo`, password `demo` |
| Translations | `npm run i18n:sync` |

The TV APK and the Android emulator tests run only in GitHub Actions. When a test fails, re-run only that test while you fix it, then the full command once before pushing.

## 4. How to do a task

1. Find or create the GitHub issue. Read it and any decision (`D-…`) it cites.
2. Create a branch from the latest `main`. One task per branch.
3. Make the smallest change that solves the task. Follow the style of the code around it.
4. Add or update tests (section 5, item 4).
5. Update the docs (section 5, items 1 to 3, 5 and 6).
6. Run the "before every push" command. Fix every failure.
7. Open a pull request using `.github/pull_request_template.md`. Link the issue (`Fixes #N` or `Part of #N`). Explain in a few plain sentences what people will see and why.
8. Drive CI green. If CI gets no runner, say so in the PR and paste your local results. Then stop: Bruno reviews and merges.

**When unsure**, do not guess about product behaviour. Write the question in the issue or PR and leave that part out of the change.

## 5. Every change MUST include

`npm run lint` checks items 1 to 3. Items 4 to 6 are on you.

1. **Release notes.** A change people see or use adds a line at the top of **Latest** in `documentation/RELEASE-NOTES.md`, under each app it reaches ("TV and phone app", "Desktop app"). Newest first, with the date and the decision or issue. Example:
   `- **Back goes to Home first** (2026-11-22, D-248): on the TV and on phones, Back on Live TV … now goes to Home, and only Back on Home closes the app.`
   Raising MAJOR.MINOR in an app's `package.json` needs a new `### MAJOR.MINOR` section.
2. **Features and parity.** Every app gets the feature unless it does not apply to that device. Describe it in `documentation/FEATURES.md`; its section ends with an Apps line, ✅ (has it), ➖ (does not apply) or ⏳ with the issue that adds it. Example:
   `**Apps:** TV ✅ · Phone ✅ · Desktop ⏳ (issue #123)`
   Add its row, with the files to read first, to `documentation/FEATURES-TECHNICAL.md` in the same group and order.
3. **Translations.** User-facing text goes through `t('…')`, never a bare string. Run `npm run i18n:sync`, then translate every new entry in every file in `packages/shared/src/i18n/catalogs` (no English left in other languages).
4. **Tests.** Unit tests for logic. A Playwright flow (`apps/web-player`) or TV emulator flow for UI behaviour you change.
5. **Issues.** A limitation, risk, bug or tech debt that remains after the change becomes an open GitHub issue labelled `known issue`. Planned work and ideas are issues labelled `enhancement`. Cite them as `issue #N` (D-174). Never keep lists of known issues or next steps in files.
6. **Decisions.** Decide where each new decision worth keeping goes:
   - A rule every change must follow: add it to this file, short.
   - Why the code is the way it is: add the next `## D-…` entry at the bottom of `documentation/DECISIONS.md` and a row in its index table, and cite it in the code as `DECISIONS.md#d-123`. Copy the shape of the last entry: a bold title with date and reason, then short bullets. Look up entries by ID; don't read the whole file.
   - Two branches can take the same number: renumber yours when you merge `main` in.

## 6. Product rules

These are settled. Do not propose or implement changes against them.

- **Platform and design limits** are closed as won't do, not kept open as documentation.
- **"Who's watching?"** shows every time an app opens; with a single profile it is skipped (D-151).
- **Back** on TV and phone: from any top-level page goes to Home; only Back on Home exits the app (D-248). Desktop Back follows the window history.
- **TV focus (D-pad) rules** (D-069). Check them on every TV UI change:
  - Left/Right never leave the current row; they stop at its ends. Only Up/Down change rows.
  - Where a column sits beside a row, focus may leave toward it: Live TV's guide Left to its categories, a series' details buttons to its episodes.
  - In a dialog, Right from its content (row ends and tab rows included) goes to the Save/Cancel column on its right (D-233). Left from that column returns to the last list row, or to the tab row if a tab was focused since (D-247).
  - While a modal is open, focus never leaves it.
  - Closing details returns focus to what opened them, or to the first visible card if that is gone.

## 7. Gotchas

- In a plain browser the web player only reaches the fake panel; real providers block web pages, so they work only in the desktop, TV and phone apps.
- `react-native` is aliased to `react-native-tvos` in the root `package.json`. Import from `react-native` as usual.

## 8. Before you say you are done

- [ ] `npm run lint && npm run typecheck && npm run test` pass locally.
- [ ] `npm run test:e2e` passes if UI or navigation changed.
- [ ] Release notes, FEATURES.md (with Apps line), FEATURES-TECHNICAL.md updated if people see the change.
- [ ] New texts in `t('…')` and translated in every catalog.
- [ ] Remaining problems filed as `known issue` issues; new decisions recorded.
- [ ] PR opened from your own branch, issue linked, short plain explanation. Not merged.
