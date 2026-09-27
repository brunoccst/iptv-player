# i18n

The app's own words in the user's language (D-084). English is the source and the default.

| Path | Purpose |
|------|---------|
| `i18n.ts` | `t('English text', { name })` and `tn('{count} episode', '{count} episodes', count)`; `UI_LANGUAGES` (English, Português (Brasil), Deutsch, Srpskohrvatski (BiH)); plural rules per language; `intlLocale()` for dates and numbers; `i18nStore` (the current language). |
| `uiLanguage.ts` | `createUiLanguage`: the language per profile (`ProfilePrefs.appLanguage`), the device's last choice before a profile is open. `AppContext.uiLanguage.choose(language)`. |
| `catalogs/*.json` | One catalog per language, keyed by the English text. `tn` entries hold plural forms: `one`, `other`, and `few` for Serbo-Croatian. |

Adding or changing a text:

1. Write it in English inside `t('…')` (or `tn`), in the code that draws it. The text must be a string literal, and `t` must run while drawing, not when a module loads (so a language change reaches it).
2. `npm run i18n:sync` adds the new text to every catalog (empty) and drops texts no code uses.
3. Fill in the translations. `npm run lint:i18n` (CI) fails while a text is missing, a `{placeholder}` is unknown or a plural form is missing.

Titles, categories, channel names and other provider data are never translated.
