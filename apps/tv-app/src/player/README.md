# player

| File | Purpose |
|------|---------|
| `PlayerScreen.tsx` | Source resolution (download → original file → HLS), remote handling via `RemoteSeekController` (live: ↑ guide overlay), phone touch (tap, double tap ±10 s, timeline drag, landscape lock), progress saving, Skip ahead (30 s / 1 / 2 / 3 min), next-up, overlay. |
| `SeekOverlay.tsx` | `TapFlash` (±10 circle animation) and `ScrubBar` (preview position + speed). |
| `GuideOverlay.tsx` | Live: see-through list of the category's channels with now/next over the playing video; Select switches channel; closes after 6 s idle or Back (D-058). |
| `QuickDrawer.tsx` | Audio, Subtitles, Versions, Episodes panel with trapped focus. |
