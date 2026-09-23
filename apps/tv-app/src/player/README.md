# player

| File | Purpose |
|------|---------|
| `PlayerScreen.tsx` | Source resolution (download → original file → HLS), remote handling via `RemoteSeekController`, progress saving, Skip Intro, next-up, overlay. |
| `SeekOverlay.tsx` | `TapFlash` (±10 circle animation) and `ScrubBar` (preview position + speed). |
| `QuickDrawer.tsx` | Audio, Subtitles, Versions, Episodes panel with trapped focus. |
