# player

| File | Purpose |
|------|---------|
| `PlayerOverlay.tsx` | Full-screen player UI: controls, keyboard shortcuts, progress saving (10 s), skip intro, next-up, menus. |
| `playbackEngine.ts` | Resolves URLs and attaches media: downloaded copy → HLS (hls.js) → original file → explanatory error. |
| `frameGrabber.ts` | Hidden low-quality video that renders timeline hover thumbnails. |
| `Timeline.tsx` | Seek bar: buffered/played, hover time + frame preview, click/drag seek. |
| `TracksMenu.tsx` | Audio, subtitles, version switch; a subtitle pick is kept for the series (D-087). |
| `subtitles.ts` | Subtitle tracks from hls.js or the video element: list, current, show; the kept choice is applied once per episode (D-087). |
| `EpisodesDrawer.tsx` | In-player episode list by season. |
| `GuidePanel.tsx` | Live: guide over the playing channel (Guide button or G): the category's channels with now and next; a click switches channel (D-081, the TV's D-058). |
| `NextUp.tsx` | Next-episode countdown card. |
