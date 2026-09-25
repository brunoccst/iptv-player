# profiles

| File | Purpose |
|------|---------|
| `ProfilePicker.tsx` | "Who's watching?" grid, add tile (max 5), manage mode, profile editor modal (name, colour, kids, delete). With a parental PIN, opening a regular profile and managing ask for it. |
| `PinDialog.tsx` | Parental PIN prompt (`PinDialog`, `PinInput`) and `usePinGate`, which runs an action directly or after the PIN (D-054). |
| `PinSettings.tsx` | Account menu → Parental PIN: set (optional), change or remove. |
| `avatar.ts` | Avatar colour palette; `avatarKey` stores the chosen colour. |
