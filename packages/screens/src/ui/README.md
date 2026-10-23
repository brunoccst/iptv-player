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
| `ChipBar.tsx` | Category chips: one line with Show all, the expanded box, TV paging with ‹ › (D-047) |
| `Select.tsx` | Web `.select`: a box with the current value that opens an option list |
| `FocusButton.tsx` | Web `.button` (primary, secondary, accent, ghost) with an optional icon |
| `Feedback.tsx` | Loading indicator, error text, `errorText()` |
| `Row.tsx`, `rowReveal.ts` | Home row: title (optionally a link), horizontal cards, "See all" card; TV keeps the focused card off the screen edge (D-181), desktop has arrows (D-040) |
| `Gradient.tsx`, `Gradient.web.tsx` | CSS-like `linear-gradient`: react-native-svg on TV and phone, CSS on the desktop |
| `Trailer.tsx`, `Trailer.web.tsx` | Desktop: the featured movie's muted trailer (D-025); nothing on TV and phone |
| `IconButton.tsx` | Web `.icon-button`: round, or plain for player controls; optional TV colour-key dot |
| `ColourDot.tsx` | The TV remote's colour keys (D-154) and the dot on the button each key presses |
| `focusGrid.ts` | TV: Up/Down to the button straight above or below in lines of buttons (`useFocusGrid`, `moveFocus`) |
| `WatchedButton.tsx` | Round "Watched" toggle on the details panel (D-081) |
| `WatchlistButton.tsx` | Round "My List" toggle on the details panel (D-055); TV: the Red key too (D-154) |
| `Select.web.tsx` | Desktop: the browser's own drop-down in place of the TV's option list (D-202) |
| `Field.tsx` | Labelled text field; `onSubmit` + `inputRef` let Enter move to the next field |
| `DownloadButton.tsx` | Round download button: start / pause / resume / retry, from the host's `details.useDownload` (D-203) |
| `ProgressRing.tsx`, `ProgressRing.web.tsx` | Download progress circle: react-native-svg on TV and phone, a plain SVG on the desktop |
| `RegroupButton.tsx` | Split or merge titles by hand (issue #243): the host's `Menu`, then a picker that finds the title by name (D-203) |
