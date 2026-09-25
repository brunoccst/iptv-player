# player

| File                 | Purpose                                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `PlayerOverlay.tsx`  | Full-screen player UI: controls, keyboard shortcuts, progress saving (10 s), skip intro, next-up, menus. |
| `playbackEngine.ts`  | Resolves URLs and attaches media: downloaded copy → HLS (hls.js) → original file → explanatory error.    |
| `frameGrabber.ts`    | Hidden low-quality video that renders timeline hover thumbnails.                                         |
| `Timeline.tsx`       | Seek bar: buffered/played, hover time + frame preview, click/drag seek.                                  |
| `TracksMenu.tsx`     | Audio, subtitles, version switch.                                                                        |
| `EpisodesDrawer.tsx` | In-player episode list by season.                                                                        |
| `NextUp.tsx`         | Next-episode countdown card.                                                                             |
