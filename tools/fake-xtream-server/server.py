"""Fake Xtream Codes panel for local development and end-to-end tests. Python stdlib only.

Serves player_api.php from catalog.json, redirects stream URLs to generated media (like real panels redirect to
load balancers), supports HTTP Range, a sliding-window live HLS playlist, and SVG posters.
"""

import argparse
import base64
import json
import math
import re
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from html import escape
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
MEDIA = HERE / "media"
CATALOG = json.loads((HERE / "catalog.json").read_text())
USER = CATALOG["credentials"]["username"]
PASSWORD = CATALOG["credentials"]["password"]
LIVE_SEGMENT_SECONDS = 2
LIVE_WINDOW = 5
CONTENT_TYPES = {
    ".m3u8": "application/vnd.apple.mpegurl", ".m4s": "video/iso.segment", ".mp4": "video/mp4",
    ".mkv": "video/x-matroska", ".ts": "video/mp2t", ".svg": "image/svg+xml",
}
EPG_SLOT_SECONDS = 30 * 60
EPG_SHOWS = {
    "301": ["Morning Briefing", "World Report", "Business Hour", "Headlines"],
    "302": ["Match Day Live", "Highlights", "Studio Talk"],
    "303": ["Forecast", "Storm Watch"],
    "304": ["Arena Live", "Warm-up"],
    "305": ["Cartoon Club", "Story Time", "Science Kids"],
}
COLORS = ["#b20710", "#1f6feb", "#8250df", "#1a7f37", "#bf8700", "#cf222e"]


def movie_by_id(movie_id: str) -> dict | None:
    return next((m for m in CATALOG["movies"] if m["id"] == movie_id), None)


def episode_by_id(episode_id: str) -> dict | None:
    for series in CATALOG["series"]:
        for season in series["seasons"]:
            for episode in season["episodes"]:
                if episode["id"] == episode_id:
                    return {**episode, "season": season["number"], "series": series}
    return None


def epg_programmes(channel: dict, start: int, end: int) -> list[dict]:
    """Deterministic schedule anchored at UTC midnight: 30/60/90-minute shows, so every caller sees the same guide."""
    shows = EPG_SHOWS.get(channel["id"], ["Programme"])
    cursor = start - start % 86400 - 86400
    result, count = [], 0
    while cursor < end:
        length = (1 + (count + int(channel["id"])) % 3) * EPG_SLOT_SECONDS
        title = shows[count % len(shows)]
        if cursor + length > start:
            result.append({"start": cursor, "stop": cursor + length, "title": title, "desc": f"{title} on {channel['name']}."})
        cursor += length
        count += 1
    return result


def xmltv_time(seconds: int) -> str:
    return time.strftime("%Y%m%d%H%M%S +0000", time.gmtime(seconds))


def image(kind: str, item_id: str) -> str:
    return f"/img/{kind}/{item_id}.svg"


class Handler(BaseHTTPRequestHandler):
    server_version = "FakeXtream/1.0"

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - signature from base class
        if self.server.verbose:  # type: ignore[attr-defined]
            super().log_message(format, *args)

    def do_GET(self) -> None:  # noqa: N802 - http.server naming
        url = urlparse(self.path)
        path = url.path
        if path == "/player_api.php":
            return self.player_api(parse_qs(url.query))
        if path == "/xmltv.php":
            return self.xmltv(parse_qs(url.query))
        if match := re.fullmatch(r"/(movie|series|live)/([^/]+)/([^/]+)/([^/.]+)\.(\w+)", path):
            return self.stream(*match.groups())
        if match := re.fullmatch(r"/live-media/(\w+)/index\.m3u8", path):
            return self.live_playlist(match.group(1))
        if match := re.fullmatch(r"/live-media/(\w+)/seg_(\d+)\.m4s", path):
            return self.live_segment(int(match.group(2)))
        if match := re.fullmatch(r"/img/(\w+)/([\w-]+)\.svg", path):
            return self.svg(match.group(1), match.group(2))
        if path.startswith("/media/"):
            return self.static(MEDIA / path.removeprefix("/media/"))
        self.send_error(HTTPStatus.NOT_FOUND)

    def player_api(self, query: dict[str, list[str]]) -> None:
        if query.get("username", [""])[0] != USER or query.get("password", [""])[0] != PASSWORD:
            return self.json({"user_info": {"auth": 0}})
        action = query.get("action", [None])[0]
        category = query.get("category_id", [None])[0]
        base = f"http://{self.headers.get('Host')}"

        def by_category(items: list[dict]) -> list[dict]:
            return [item for item in items if category is None or item["category"] == category]

        if action is None:
            return self.json({
                "user_info": {"username": USER, "auth": 1, "status": "Active", "exp_date": str(int(time.time()) + 86400 * 365),
                              "max_connections": "2", "active_cons": "0", "allowed_output_formats": ["m3u8", "ts"]},
                "server_info": {"url": self.headers.get("Host"), "timezone": "UTC"},
            })
        if action in ("get_vod_categories", "get_series_categories", "get_live_categories"):
            key = {"get_vod_categories": "vodCategories", "get_series_categories": "seriesCategories"}.get(action, "liveCategories")
            return self.json([{"category_id": c["id"], "category_name": c["name"], "parent_id": 0} for c in CATALOG[key]])
        if action == "get_vod_streams":
            return self.json([{
                "num": i + 1, "name": m["name"], "stream_type": "movie", "stream_id": int(m["id"]),
                "stream_icon": base + image("poster", m["id"]), "rating": str(m["rating"]), "added": "1700000000",
                "category_id": m["category"], "container_extension": m["container"],
            } for i, m in enumerate(by_category(CATALOG["movies"]))])
        if action == "get_vod_info":
            movie = movie_by_id(query.get("vod_id", [""])[0])
            if movie is None:
                return self.json({"info": [], "movie_data": []})
            return self.json({
                "info": {"movie_image": base + image("poster", movie["id"]), "backdrop_path": [base + image("backdrop", movie["id"])],
                         "plot": movie["plot"], "genre": movie["genre"], "rating": str(movie["rating"]), "releasedate": "2020-01-01",
                         "duration_secs": movie["duration"], "youtube_trailer": "", "cast": "Test Pattern, Sine Wave", "director": "ffmpeg"},
                "movie_data": {"stream_id": int(movie["id"]), "name": movie["name"], "category_id": movie["category"],
                               "container_extension": movie["container"]},
            })
        if action == "get_series":
            return self.json([{
                "num": i + 1, "name": s["name"], "series_id": int(s["id"]), "cover": base + image("poster", s["id"]),
                "plot": s["plot"], "genre": s["genre"], "rating": str(s["rating"]), "category_id": s["category"],
                "releaseDate": "2022-01-01", "last_modified": "1700000000", "backdrop_path": [base + image("backdrop", s["id"])],
            } for i, s in enumerate(by_category(CATALOG["series"]))])
        if action == "get_series_info":
            series = next((s for s in CATALOG["series"] if s["id"] == query.get("series_id", [""])[0]), None)
            if series is None:
                return self.json({"seasons": [], "info": [], "episodes": []})
            return self.json({
                "seasons": [{"season_number": s["number"], "name": f"Season {s['number']}"} for s in series["seasons"]],
                "info": {"name": series["name"], "cover": base + image("poster", series["id"]), "plot": series["plot"],
                         "genre": series["genre"], "rating": str(series["rating"]), "category_id": series["category"],
                         "backdrop_path": [base + image("backdrop", series["id"])]},
                "episodes": {str(s["number"]): [{
                    "id": e["id"], "episode_num": e["num"], "title": f"{series['name']} - S{s['number']:02d}E{e['num']:02d} - {e['title']}",
                    "container_extension": e["container"], "season": s["number"],
                    "info": {"duration_secs": e["duration"], "plot": f"Episode {e['num']} plot.", "movie_image": base + image("still", e["id"])},
                } for e in s["episodes"]] for s in series["seasons"]},
            })
        if action == "get_live_streams":
            return self.json([{
                "num": i + 1, "name": c["name"], "stream_type": "live", "stream_id": int(c["id"]),
                "stream_icon": base + image("logo", c["id"]), "epg_channel_id": c["epg"], "category_id": c["category"], "tv_archive": 0,
            } for i, c in enumerate(by_category(CATALOG["live"]))])
        if action == "get_short_epg":
            channel = next((c for c in CATALOG["live"] if c["id"] == query.get("stream_id", [""])[0]), None)
            limit = int(query.get("limit", ["4"])[0])
            now = int(time.time())
            listings = epg_programmes(channel, now, now + 24 * 3600)[:limit] if channel else []
            encode = lambda text: base64.b64encode(text.encode()).decode()  # noqa: E731 - real panels base64 these
            return self.json({"epg_listings": [{
                "title": encode(p["title"]), "description": encode(p["desc"]),
                "start_timestamp": str(p["start"]), "stop_timestamp": str(p["stop"]),
            } for p in listings]})
        return self.json([])

    def xmltv(self, query: dict[str, list[str]]) -> None:
        """Full guide for channels with an XMLTV id (ids lower-cased here to exercise case-insensitive matching)."""
        if query.get("username", [""])[0] != USER or query.get("password", [""])[0] != PASSWORD:
            return self.send_error(HTTPStatus.FORBIDDEN)
        now = int(time.time())
        channels = [c for c in CATALOG["live"] if c["epg"]]
        parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<tv generator-info-name="fake-xtream">']
        parts += [f'<channel id="{escape(c["epg"].lower())}"><display-name>{escape(c["name"])}</display-name></channel>' for c in channels]
        for c in channels:
            for p in epg_programmes(c, now - 3 * 3600, now + 24 * 3600):
                parts.append(
                    f'<programme start="{xmltv_time(p["start"])}" stop="{xmltv_time(p["stop"])}" channel="{escape(c["epg"].lower())}">'
                    f'<title lang="en">{escape(p["title"])}</title><desc lang="en">{escape(p["desc"])}</desc></programme>')
        parts.append("</tv>")
        self.body("\n".join(parts).encode(), "application/xml", cache=False)

    def stream(self, kind: str, user: str, password: str, item_id: str, extension: str) -> None:
        if user != USER or password != PASSWORD:
            return self.send_error(HTTPStatus.FORBIDDEN)
        if kind == "live":
            return self.redirect(f"/live-media/{item_id}/index.m3u8") if extension == "m3u8" else self.send_error(HTTPStatus.NOT_FOUND)
        item = movie_by_id(item_id) if kind == "movie" else episode_by_id(item_id)
        if item is None:
            return self.send_error(HTTPStatus.NOT_FOUND)
        media = item["media"]
        if extension == "m3u8":
            has_hls = (MEDIA / media / "index.m3u8").exists() and not item.get("noHls")
            return self.redirect(f"/media/{media}/index.m3u8") if has_hls else self.send_error(HTTPStatus.NOT_FOUND)
        for candidate in (f"{media}.{extension}", f"{media}.mp4", f"{media}.mkv"):
            if (MEDIA / candidate).exists():
                return self.redirect(f"/media/{candidate}")
        # HLS-only media requested as a file: serve the first rendition's playlist location instead.
        return self.send_error(HTTPStatus.NOT_FOUND)

    def live_playlist(self, channel_id: str) -> None:
        segments = sorted((MEDIA / "live").glob("seg_*.m4s"))
        if not segments:
            return self.send_error(HTTPStatus.NOT_FOUND)
        sequence = int(time.time() // LIVE_SEGMENT_SECONDS)
        lines = ["#EXTM3U", "#EXT-X-VERSION:7", f"#EXT-X-TARGETDURATION:{LIVE_SEGMENT_SECONDS}",
                 f"#EXT-X-MEDIA-SEQUENCE:{sequence}", '#EXT-X-MAP:URI="/media/live/init.mp4"']
        for number in range(sequence, sequence + LIVE_WINDOW):
            lines += [f"#EXTINF:{LIVE_SEGMENT_SECONDS}.0,", f"seg_{number}.m4s"]
        self.body(("\n".join(lines) + "\n").encode(), CONTENT_TYPES[".m3u8"], cache=False)

    def live_segment(self, number: int) -> None:
        segments = sorted((MEDIA / "live").glob("seg_*.m4s"))
        self.static(segments[number % len(segments)]) if segments else self.send_error(HTTPStatus.NOT_FOUND)

    def svg(self, kind: str, item_id: str) -> None:
        width, height = {"poster": (300, 450), "backdrop": (1280, 720), "still": (320, 180), "logo": (200, 200)}.get(kind, (300, 450))
        color = COLORS[sum(map(ord, item_id)) % len(COLORS)]
        title = next((x["name"] for x in CATALOG["movies"] + CATALOG["series"] + CATALOG["live"] if x["id"] == item_id), item_id)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">'
               f'<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{color}"/>'
               f'<stop offset="1" stop-color="#141414"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>'
               f'<text x="50%" y="50%" fill="#fff" fill-opacity="0.35" font-family="sans-serif" font-size="{max(12, min(width // 14, 36))}" text-anchor="middle">'
               f'{escape(title)}</text></svg>')
        self.body(svg.encode(), CONTENT_TYPES[".svg"])

    def static(self, file: Path) -> None:
        try:
            resolved = file.resolve()
            resolved.relative_to(MEDIA.resolve())
        except ValueError:
            return self.send_error(HTTPStatus.FORBIDDEN)
        if not resolved.is_file():
            return self.send_error(HTTPStatus.NOT_FOUND)
        data = resolved.read_bytes()
        content_type = CONTENT_TYPES.get(resolved.suffix, "application/octet-stream")
        if match := re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", "")):
            start = int(match.group(1) or 0)
            end = min(int(match.group(2)) if match.group(2) else len(data) - 1, len(data) - 1)
            if start >= len(data):
                self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                self.send_header("Content-Range", f"bytes */{len(data)}")
                self.end_headers()
                return
            self.send_response(HTTPStatus.PARTIAL_CONTENT)
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
            data = data[start:end + 1]
        else:
            self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self.wfile.write(data)

    def json(self, value: object) -> None:
        self.body(json.dumps(value).encode(), "application/json")

    def body(self, data: bytes, content_type: str, cache: bool = True) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if not cache:
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fake Xtream Codes panel.")
    parser.add_argument("--port", type=int, default=8090)
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()
    if not MEDIA.exists():
        print("Warning: ./media missing. Run `python generate_media.py` first.")
    server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    server.verbose = args.verbose  # type: ignore[attr-defined]
    print(f"Fake Xtream panel on http://localhost:{args.port}  (username: {USER}, password: {PASSWORD})")
    server.serve_forever()


if __name__ == "__main__":
    main()
