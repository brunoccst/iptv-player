# @iptv/screens

Screens written once in React Native for every app: the TV and phone app render them natively, the desktop app through React Native Web (issue #237, [D-193](../../documentation/DECISIONS.md#d-193)). It starts with one screen, My List, to compare look, speed and effort before more screens move here.

- TypeScript source, no build step, like `@iptv/shared`. Imports `react-native` and `@iptv/shared` only, never an app.
- What differs per app comes in as parts (`MyListParts`): the scrolling page, a row (a TV focus row), a title card (TV focus, desktop hover and right-click).
- The desktop app maps `react-native` to `react-native-web` in `apps/web-player/vite.config.ts` and loads the trial page on its own, so the rest of the app does not carry React Native Web.

| File | What |
|------|------|
| `src/MyListScreen.tsx` | My List: title, loading, empty text, rows of cards |
| `src/PosterTile.tsx` | A cover, name and line under it, with a hover and focus look |
