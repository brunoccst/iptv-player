# profiles

| File | Purpose |
|------|---------|
| `ProfilePicker.tsx` | "Who's watching?" grid, add tile (max 5), manage mode, profile editor modal (name, colour, kids, delete). With a parental PIN, opening a regular profile and managing ask for it. The editor also opens Choose languages. |
| `PinDialog.tsx` | Parental PIN prompt (`PinDialog`, `PinInput`) and `usePinGate`, which runs an action directly or after the PIN (D-054). |
| `KidsCategories.tsx` | Profile editor → Choose categories: what a Kids profile may see per section (D-064). |
| `LanguageSettings.tsx` | Account menu → Profiles → Content language filter: only titles with audio or subtitles in one of the chosen languages (from the title's name, else its category's name; titles in a category without a language always show), per profile (D-063, D-067, D-086). Also opened from the profile editor for a given profile. |
| `PinSettings.tsx` | Account menu → Parental PIN: set (optional), change or remove. |
| `avatar.ts` | Avatar colour palette; `avatarKey` stores the chosen colour. |
