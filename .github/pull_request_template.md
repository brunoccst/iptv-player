## What changes

<!-- What people will see or be able to do, in a few lines. -->

## Apps

Which apps does this change? Every app should get a feature unless it does not apply to that device ([PARITY.md](../documentation/PARITY.md), D-080).

- [ ] TV (remote)
- [ ] Phone (touch)
- [ ] Desktop app (the web player in `apps/web-player`; also check the desktop-only parts)
- [ ] Not user-facing (tooling, docs, CI only)

If this adds or changes something people see or use:

- [ ] `documentation/PARITY.md` is updated: ✅ where it is done, ➖ where it does not apply, ⏳ plus an open `Parity: …` item in `documentation/NEXT-STEPS.md` where it is still missing
- [ ] Each app reaches it the way that device is used (e.g. hold OK on TV, long touch on the phone, right-click on a computer)
- [ ] `documentation/FEATURES.md` describes it, `documentation/FEATURES-TECHNICAL.md` explains how it works (`npm run lint:features`), and `documentation/RELEASE-NOTES.md` has a line for it under **Latest** of each app it reaches (D-143)
- [ ] New or changed texts are in `t('…')` and translated in every language (`npm run i18n:sync`, then fill in `packages/shared/src/i18n/catalogs`; D-084)

## Tests

<!-- Unit tests, emulator (Maestro) and Playwright flows added or run. -->
