# shell

| File | Purpose |
|------|---------|
| `Shell.tsx` | Renders the current view, details modal and (lazy-loaded) player. |
| `TopNav.tsx` | Links, search box, profile menu: other profiles, groups that open in place under their name with a back arrow (Profiles: manage, parental PIN, languages; Library & devices: refresh, sync with phone, back up & restore; App: check for updates, About, Log — the TV app's groups, D-079), sign out. Kids profiles only get the other profiles and Switch profile. |
| `AboutDialog.tsx` | App, version (desktop), build commit and date, connection (D-079). |
| `LogDialog.tsx` | Diagnostics log: newest lines, save as a text file, copy, clear (D-079). |
| `LibraryBanner.tsx` | Offline notice, "organizing library" progress, empty-library hint. Polls status; reloads rows when done. |
