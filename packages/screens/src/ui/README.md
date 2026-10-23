# ui

Building blocks of the shared screens, from the TV app (which re-exports them at their old paths, [D-194](../../../../documentation/DECISIONS.md#d-194)). They also render on the desktop through React Native Web.

| File | What |
|------|------|
| `theme.ts` | Colours, spacing, TV-safe margins, font and card sizes, `useSizes`, `useNavHeight` |
| `Icon.tsx`, `Icon.web.tsx` | Shared 24×24 icon set (`iconPaths` from `@iptv/shared`): react-native-svg on TV and phone, a plain SVG on the desktop |
| `WatchedTag.tsx` | "Watched" tag (D-081) |
| `focus.tsx` | The D-pad focus look: `focus` tokens, `useFocusScale`, `AnimatedPressable` |
| `pageFocus.ts` | TV, D-069: `usePageFocusable` and `createPageFocus` (focus back to what opened the details) |
| `FocusRow.tsx` | `FocusRow`: Left/Right stay inside on TV (D-069); `RowFocus`, `RowReveal` |
| `CenterScroll.tsx` | `CenteringScrollView`: keeps the focused row in view |
| `PosterCard.tsx` | Web `.card`: art, badge, progress, title + subtitle; focus or hover scales it up |
