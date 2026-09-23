# fake-xtream-server

Fake Xtream Codes panel for local development and end-to-end tests. Python 3.11 stdlib only.

| Path | Purpose |
|------|---------|
| `server.py` | HTTP server: `player_api.php`, stream redirects, HTTP Range, live HLS window, SVG posters. |
| `generate_media.py` | Creates test videos in `media/` (git-ignored) with ffmpeg. |
| `catalog.json` | Movies (with duplicates/sequels/MKV-only), series (2 seasons + duplicate), live channels. |

## Run

```bash
cd tools/fake-xtream-server
python generate_media.py            # needs ffmpeg on PATH, $FFMPEG, or `pip install imageio-ffmpeg`
python server.py                    # http://localhost:8090
```

Log in to the app with server `http://localhost:8090`, username `demo`, password `demo`.

## Behaviour

| Request | Response |
|---------|----------|
| `/player_api.php` | Catalog JSON. Wrong credentials → `{"user_info":{"auth":0}}`. |
| `/movie|series/{u}/{p}/{id}.m3u8` | `302` → `/media/<name>/index.m3u8` (fMP4 HLS). `404` for items with `noHls`. |
| `/movie|series/{u}/{p}/{id}.{ext}` | `302` → progressive file. Supports `Range`. |
| `/live/{u}/{p}/{id}.m3u8` | `302` → sliding 5-segment live playlist (looping media). |
| `/img/{poster|backdrop|still|logo}/{id}.svg` | Generated artwork. |

Media codecs: VP9 + Opus by default (`--codec h264` for H.264 + AAC). `movie-mkv` is always H.264 in Matroska.
