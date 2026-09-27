# components

| File | Purpose |
|------|---------|
| `Icon.tsx` | Inline SVG icon set. |
| `Spinner.tsx` | Loading indicator (`role="status"`). |
| `ProgressRing.tsx` | Circular progress (download buttons). |
| `PosterCard.tsx` | Poster/landscape card with badge, watch-progress bar, action slot; `onMenu` opens its options on right-click (D-079). |
| `ChipBar.tsx` | Category chips on one line; "Show all" wraps them, "Show less" returns; the chosen chip stays in view; the wheel scrolls the line (D-085). |
| `CardMenu.tsx` | A card's options at the pointer (right-click, menu key, Shift+F10) or under a "…" button (`menuBelow`): actions (some greyed out), then Cancel; kept on screen (D-079, D-083). |
| `Row.tsx` | Horizontal scrolling row with arrows; `onVisible` for lazy loading; optional title link (`onTitleClick`), `onNearEnd` + `loadingMore` spinner for paging. |
| `Modal.tsx` | Dialog overlay (Esc, backdrop click, focus). |
| `DownloadButton.tsx` | "Download for Offline" toggle with progress circle; `useDownload` for menus (D-083). |
| `WatchedTag.tsx` | "Watched" tag: bottom right of a watched cover (`PosterCard.watched`), in details, on episode stills (D-081). |
| `VlcButton.tsx` | Desktop app only: "Open in VLC" next to Play, the stream with the provider User-Agent; not on Kids profiles (D-081); `useVlc` for menus (D-083). |
| `WatchlistButton.tsx` | Round "My List" toggle (plus / check) on the details panel (D-055). |
