# @iptv/screens

Screens written once in React Native for every app: the TV and phone app render them natively, the desktop app through React Native Web (issue #237, [D-193](../../documentation/DECISIONS.md#d-193), [D-194](../../documentation/DECISIONS.md#d-194)). Screens move here one at a time: My List, Movies and Series, Search, Home, My Downloads, sign-in, then profiles.

- TypeScript source, no build step, like `@iptv/shared`. Imports `react`, `react-native` and `@iptv/shared` only, never an app.
- Each app calls `setScreenHost` once with what differs per app (`ScreenHost`): its hooks, how details open, the scrolling page, a title's menu, the TV colour keys.
- The desktop app maps `react-native` to `react-native-web` in `apps/web-player/vite.config.ts` and prefers `X.web.tsx` files; it loads shared screens on their own, except Home, the first page after sign-in.

| File | What |
|------|------|
| `src/host.tsx` | `ScreenHost`, `setScreenHost`, `ScreenHostProvider`, `useScreenHost` |
| `src/DetailsScreen.tsx` | A title's details: backdrop, Play/Resume and the app's buttons, facts, version, episodes with their menu; two columns on wide landscape screens (D-158, D-202) |
| `src/DownloadsScreen.tsx` | My Downloads: each download with progress and Play / Pause / Resume / Delete; the app's host gives the list (D-198) |
| `src/LiveScreen.tsx` | Live TV: categories, Earlier / Now / Later, programme details, 3-hour channel × time grid; TV focus describes and Select plays, elsewhere a click or tap selects (D-032, D-201) |
| `src/LoginScreen.tsx` | Sign-in: provider address, username, password, app language, restore from a backup, sign in from another device (D-199) |
| `src/ProfilesScreen.tsx` | "Who's watching?" and the profile editor (name, colour, Kids, categories, languages); the app's PIN prompt (D-200) |
| `src/HomeScreen.tsx` | Home: featured movie, Continue Watching, My List, Live TV, Top rated and category rows, built a few at a time (D-197) |
| `src/BrowseScreen.tsx` | Movies or Series: title, category chips, "Sort by", the title grid |
| `src/TitleGrid.tsx` | Paged title grid: TV mounts only the lines near the focus (`TvLines`, D-094), phone a list, desktop every line with the app's `EndSensor` |
| `src/SearchScreen.tsx` | Search: "Results for …", the All / Movies / Series / Live TV filter, title grids, channels, guide programmes |
| `src/MyListScreen.tsx` | My List: title, loading, empty text, focus rows of cards; `useGridColumns` (the web grid's columns) |
| `src/TitleCard.tsx` | One title's cover: badge, "Watched", My List bookmark, opens details, menu on hold OK or right-click |
| `src/QualityUpgradeDialog.tsx` | "Better quality on My List" over Home: Play or More info per title (D-176, D-204) |
| `src/KidsCategories.tsx` | Profile editor → Choose categories: what a Kids profile may see per section (D-053, D-204) |
| `src/HiddenCategories.tsx` | Account menu → Categories shown: what this profile browses (D-110, D-204) |
| `src/LanguageSettings.tsx` | Content language filter: the chosen languages in tick order (D-063, D-205) |
| `src/SubtitleSettings.tsx` | Automatic subtitles: OpenSubtitles key, account and languages (D-111, D-205) |
| `src/AboutDialog.tsx` | About: the host's rows (version, build) and Check for updates (D-070, D-206) |
| `src/AppLanguageDialog.tsx` | App language: the app's own words in one of its languages (D-084, D-206) |
| `src/GuideOverlay.tsx` | Live TV: the category's channels with now and next over the playing channel (D-058, D-209) |
| `src/NextUp.tsx` | The next-episode countdown card at the end of an episode (D-211) |
| `src/QuickDrawer.tsx` | The player's Audio, Subtitles, Versions and Episodes panel; the app lists its tracks as `TrackOption`s (D-077, D-210) |
| `src/TopNav.tsx` | The top nav: brand, page links, search box, account avatar; `useNavFocusTarget` (TV: Up from a page, D-079, D-208) |
| `src/AccountMenu.tsx` | The menu under the top nav's avatar: other profiles, the Profiles, Library & devices and App groups, Sign out (D-079, D-207) |
| `src/ui/` | Building blocks from the TV app, see its README |
