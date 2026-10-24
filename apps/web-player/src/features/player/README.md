# player

| File                 | Purpose                                                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlayerOverlay.tsx`  | Full-screen player UI: controls, keyboard shortcuts, progress saving (10 s), skip intro, next-up, menus.                                              |
| `playbackEngine.ts`  | Resolves URLs and attaches media: downloaded copy → HLS (hls.js) → original file or live MPEG-TS (mpegts.js) → error.                                 |
| `frameGrabber.ts`    | Hidden low-quality video that renders timeline hover thumbnails.                                                                                      |
| `Timeline.tsx`       | Seek bar: buffered/played, hover time + frame preview, click/drag seek.                                                                               |
| `TracksMenu.tsx`     | Audio, subtitles, version switch; each pick becomes the profile's choice for every title (D-087).                                                     |
| `tracks.ts`          | Subtitle tracks (hls.js or the video element) and hls.js audio tracks: list, current, show; the profile's choices are applied once per title (D-087). |
| `EpisodesDrawer.tsx` | In-player episode list by season.                                                                                                                     |
| `NextUp.tsx`         | Next-episode countdown card.                                                                                                                          |
