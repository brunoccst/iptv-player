# @iptv/screens

Screens written once in React Native for every app: the TV and phone app render them natively, the desktop app through React Native Web (issue #237, [D-193](../../documentation/DECISIONS.md#d-193), [D-194](../../documentation/DECISIONS.md#d-194)). Screens move here one at a time; My List is the first.

- TypeScript source, no build step, like `@iptv/shared`. Imports `react`, `react-native` and `@iptv/shared` only, never an app.
- Each app calls `setScreenHost` once with what differs per app (`ScreenHost`): its hooks, how details open, the scrolling page, a title's menu, the TV colour keys.
- The desktop app maps `react-native` to `react-native-web` in `apps/web-player/vite.config.ts` and prefers `X.web.tsx` files; it loads shared screens on their own, so the rest of the app does not carry React Native Web.

| File | What |
|------|------|
| `src/host.tsx` | `ScreenHost`, `setScreenHost`, `ScreenHostProvider`, `useScreenHost` |
| `src/MyListScreen.tsx` | My List: title, loading, empty text, focus rows of cards; `useGridColumns` (the web grid's columns) |
| `src/TitleCard.tsx` | One title's cover: badge, "Watched", My List bookmark, opens details, menu on hold OK or right-click |
| `src/ui/` | Building blocks from the TV app, see its README |
