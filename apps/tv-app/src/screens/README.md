# screens

| File | Screen |
|------|--------|
| `LoginScreen.tsx` | Connection choice ("IPTV provider" = direct, "My server" + server address), provider URL, username, password. |
| `ProfilesScreen.tsx` | "Who's watching?" (profiles are edited in the web app). |
| `HomeScreen.tsx` | Hero, Continue Watching, Live TV, Series and category rows. |
| `LibraryRow.tsx` | Row of deduplicated titles for a section/category; loads more while scrolling (spinner at the end). The title ("Drama ›") opens `CategoryScreen`. |
| `CategoryScreen.tsx` | One category (or All) as a poster grid; next page loads near the bottom with a spinner. |
| `CategoryScreen.test.tsx` | Row title opens the category; next page loads with a spinner. |
| `usePagedLibrary.ts` | Page-by-page library loading for rows and grids (`loadMore`, `loadingMore`). |
| `BrowseScreen.tsx` | Movies or Series: one row per category, virtualized (`FlatList`: only rows near the screen mount and load). |
| `SearchScreen.tsx` | Search box (debounced): movies and series rows from the library (`LibraryRow` with `search`), live channels by name. |
| `LogScreen.tsx` | Diagnostics log preview, **Share log** (Android share sheet, credentials masked), **Clear log**. [D-039](../../../../documentation/DECISIONS.md#d-039). |
| `SearchScreen.test.tsx` | Search results per kind; shared log is masked. |
| `LiveScreen.tsx` | TV guide: 2-hour channel × time grid (D-pad), info panel for the focused programme, Earlier / Now / Later, category filter, more channels on scroll. Select plays the channel. [D-032](../../../../documentation/DECISIONS.md#d-032). |
| `LiveScreen.test.tsx` | Guide layout widths, info panel, playback target, window shift, first-download notice. |
| `DetailsScreen.tsx` | Details, Play/Resume, Download, version picker, seasons + episodes. |
| `DownloadsScreen.tsx` | My Downloads: play, pause/resume, delete. |
