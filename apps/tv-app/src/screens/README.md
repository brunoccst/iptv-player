# screens

Each screen mirrors the web page with the same name ([D-041](../../../../documentation/DECISIONS.md#d-041)).

| File | Screen |
|------|--------|
| `LoginScreen.tsx` | Web sign-in panel plus the connection choice ("IPTV provider" = direct, "My server" + address), "Restore from backup" (D-056), and on TVs a QR code to sign in from the phone app (D-060). |
| `ProfilesScreen.tsx` | "Who's watching?"; Manage Profiles adds, edits (name, colour, Kids) and deletes profiles. |
| `HomeScreen.tsx` | Hero, Continue Watching, Live TV, Series and category rows. The library notice floats at the bottom, over the rows. |
| `titles.tsx` | `MasterCardItem`, `TitleRow` (Home rows: first 10 titles; the title and the "See all" arrow card open Movies/Series on that category, D-043) and `TitleGrid` (web grid, 100 per page, spinner while the next page loads; optional "Sort by" select, D-049). |
| `usePagedLibrary.ts` | Page-by-page library loading for rows and grids (`loadMore`, `loadingMore`). |
| `BrowseScreen.tsx` | Movies or Series: category chips, sort (default: recently added) + grid. `Chip` is the web `.chip`. |
| `SearchScreen.tsx` | "Results for …" from the nav search box: Movies and Series grids, matching live channels. Searches once typing pauses (`searchDelay.ts`: about twice the user's gap between keys, 0.4–1.2 s; at least 2 letters) or on Enter. |
| `DetailsScreen.tsx` | Web details panel over the current page: backdrop, Play/Resume, download, facts, cast, version select, episodes. |
| `LiveScreen.tsx` | Web guide: categories, Earlier / Now / Later, programme details, 3-hour channel × time grid. TV: focus describes, Select plays. Phone: tap selects, "Watch live" plays. [D-032](../../../../documentation/DECISIONS.md#d-032). |
| `MyListScreen.tsx` | My List: saved titles as a grid, newest first (D-055). Home also shows a My List row (first 10 + arrow card). |
| `DownloadsScreen.tsx` | My Downloads: progress bar, round Play / Pause / Resume / Delete buttons. |
| `LogScreen.tsx` | Diagnostics log preview, **Share log** (newest ~15,000 characters with repeated lines folded, because share targets cut long texts; credentials masked), **Clear log**. Opened from the account menu. [D-039](../../../../documentation/DECISIONS.md#d-039). |
| `*.test.tsx` | Search and log, guide (TV and phone), profile editor. |
