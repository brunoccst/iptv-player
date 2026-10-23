# @iptv/screens

Screens written once in React Native for every app: the TV and phone app render them natively, the desktop app through React Native Web (issue #237, [D-193](../../documentation/DECISIONS.md#d-193), [D-194](../../documentation/DECISIONS.md#d-194)). Screens move here one at a time: My List, Movies and Series, Search, then Home.

- TypeScript source, no build step, like `@iptv/shared`. Imports `react`, `react-native` and `@iptv/shared` only, never an app.
- Each app calls `setScreenHost` once with what differs per app (`ScreenHost`): its hooks, how details open, the scrolling page, a title's menu, the TV colour keys.
- The desktop app maps `react-native` to `react-native-web` in `apps/web-player/vite.config.ts` and prefers `X.web.tsx` files; it loads shared screens on their own, except Home, the first page after sign-in.

| File | What |
|------|------|
| `src/host.tsx` | `ScreenHost`, `setScreenHost`, `ScreenHostProvider`, `useScreenHost` |
| `src/HomeScreen.tsx` | Home: featured movie, Continue Watching, My List, Live TV, Top rated and category rows, built a few at a time (D-197) |
| `src/BrowseScreen.tsx` | Movies or Series: title, category chips, "Sort by", the title grid |
| `src/TitleGrid.tsx` | Paged title grid: TV mounts only the lines near the focus (`TvLines`, D-094), phone a list, desktop every line with the app's `EndSensor` |
| `src/SearchScreen.tsx` | Search: "Results for …", the All / Movies / Series / Live TV filter, title grids, channels, guide programmes |
| `src/MyListScreen.tsx` | My List: title, loading, empty text, focus rows of cards; `useGridColumns` (the web grid's columns) |
| `src/TitleCard.tsx` | One title's cover: badge, "Watched", My List bookmark, opens details, menu on hold OK or right-click |
| `src/ui/` | Building blocks from the TV app, see its README |
