# screens

| File | Screen |
|------|--------|
| `LoginScreen.tsx` | Connection choice ("IPTV provider" = direct, "My server" + server address), provider URL, username, password. |
| `ProfilesScreen.tsx` | "Who's watching?" (profiles are edited in the web app). |
| `HomeScreen.tsx` | Hero, Continue Watching, Live TV, Series and category rows. |
| `LibraryRow.tsx` | Row of deduplicated titles for a section/category. |
| `BrowseScreen.tsx` | Movies or Series: one row per category, virtualized (`FlatList`: only rows near the screen mount and load). |
| `LiveScreen.tsx` | TV guide: 2-hour channel × time grid (D-pad), info panel for the focused programme, Earlier / Now / Later, category filter, more channels on scroll. Select plays the channel. [D-032](../../../../documentation/DECISIONS.md#d-032). |
| `LiveScreen.test.tsx` | Guide layout widths, info panel, playback target, window shift, first-download notice. |
| `DetailsScreen.tsx` | Details, Play/Resume, Download, version picker, seasons + episodes. |
| `DownloadsScreen.tsx` | My Downloads: play, pause/resume, delete. |
