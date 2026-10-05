# Rules for every change

Read [README.md](README.md) first; the decisions behind the code are in [documentation/DECISIONS.md](documentation/DECISIONS.md).

- **Release notes (D-143).** Every release must carry release notes with the latest features. A change people see or use adds a line under **Latest** of the current version line in [documentation/RELEASE-NOTES.md](documentation/RELEASE-NOTES.md), for each app it reaches (TV and phone app, Desktop app), newest first, with the date and its decision or issue. Raising MAJOR.MINOR in `apps/tv-app/package.json` or `apps/desktop/package.json` adds a new `### MAJOR.MINOR` section. `npm run lint:release-notes` checks it.
- **Features (D-143).** Describe a new or changed feature in [documentation/FEATURES.md](documentation/FEATURES.md).
- **Parity (D-080).** Every app gets the feature unless it does not apply to that device; update [documentation/PARITY.md](documentation/PARITY.md) and link the row to its FEATURES.md section. `npm run lint:parity` checks it.
- **Translations (D-084).** New texts go through `t('…')` and are translated in every catalog (`npm run i18n:sync`, then `npm run lint:i18n`).
- **Decisions.** A decision worth keeping gets the next `D-…` entry at the bottom of DECISIONS.md.
- Before pushing: `npm run lint`, `npm run typecheck`, `npm run test`.
