# components

| File                  | Purpose                                                                                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Icon.tsx`            | Inline SVG icon set.                                                                                                                                                           |
| `Spinner.tsx`         | Loading indicator (`role="status"`).                                                                                                                                           |
| `ProgressRing.tsx`    | Circular progress (download buttons).                                                                                                                                          |
| `CardMenu.tsx`        | A card's options at the pointer (right-click, menu key, Shift+F10) or under a "…" button (`menuBelow`): actions (some greyed out), then Cancel; kept on screen (D-079, D-078). |
| `Modal.tsx`           | Dialog overlay (Esc, backdrop click, focus).                                                                                                                                   |
| `DownloadButton.tsx`  | "Download for Offline" toggle with progress circle; `useDownload` for menus (D-078).                                                                                           |
| `WatchedTag.tsx`      | "Watched" tag: bottom right of a watched cover in details, on episode stills (D-081).                                                                  |
| `VlcButton.tsx`       | Desktop app only: "Open in VLC" next to Play, the stream with the provider User-Agent; not on Kids profiles (D-057); `useVlc` for menus (D-078).                               |
| `WatchedButton.tsx`   | Round "Watched" toggle (open / closed eye) on the details panel; a whole series for series (D-081).                                                                            |
| `WatchlistButton.tsx` | Round "My List" toggle (plus / check) on the details panel (D-055).                                                                                                            |
