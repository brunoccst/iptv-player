"""Generates test media into ./media with ffmpeg (PATH, $FFMPEG, or the imageio-ffmpeg package).

VP9 + Opus by default (plays in every Chromium build, incl. Playwright's). --codec h264 for H.264 + AAC.
"""

import argparse
import os
import shutil
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
MEDIA = HERE / "media"


def find_ffmpeg() -> str:
    if os.environ.get("FFMPEG"):
        return os.environ["FFMPEG"]
    if found := shutil.which("ffmpeg"):
        return found
    try:
        import imageio_ffmpeg  # type: ignore[import-not-found]

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError as error:
        raise SystemExit("ffmpeg not found. Install ffmpeg, set $FFMPEG, or `pip install imageio-ffmpeg`.") from error


def run(ffmpeg: str, seconds: int, size: str, codec: str, output_args: list[str], tone: int) -> None:
    if codec == "vp9":
        video = ["-c:v", "libvpx-vp9", "-deadline", "realtime", "-cpu-used", "8", "-b:v", "300k"]
        audio = ["-c:a", "libopus", "-b:a", "48k"]
    elif codec == "hevc":
        # What Chromium cannot decode without help (HEVC, AC-3): the desktop app converts it (issue #236).
        video = ["-c:v", "libx265", "-preset", "ultrafast", "-x265-params", "log-level=none", "-pix_fmt", "yuv420p"]
        audio = ["-c:a", "ac3", "-b:a", "96k"]
    else:
        video = ["-c:v", "libx264", "-preset", "veryfast", "-b:v", "400k", "-pix_fmt", "yuv420p"]
        audio = ["-c:a", "aac", "-b:a", "64k"]
    command = [
        ffmpeg,
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"testsrc2=size={size}:rate=25:duration={seconds}",
        "-f",
        "lavfi",
        "-i",
        f"sine=frequency={tone}:duration={seconds}",
        "-g",
        "50",
        *video,
        *audio,
        *output_args,
    ]
    subprocess.run(command, check=True)


def hls(ffmpeg: str, name: str, seconds: int, size: str, codec: str, tone: int) -> None:
    target = MEDIA / name
    target.mkdir(parents=True, exist_ok=True)
    run(
        ffmpeg,
        seconds,
        size,
        codec,
        [
            "-f",
            "hls",
            "-hls_time",
            "2",
            "-hls_playlist_type",
            "vod",
            "-hls_segment_type",
            "fmp4",
            "-hls_fmp4_init_filename",
            "init.mp4",
            "-hls_segment_filename",
            str(target / "seg_%03d.m4s"),
            str(target / "index.m3u8"),
        ],
        tone,
    )


def progressive(ffmpeg: str, name: str, seconds: int, size: str, codec: str, tone: int, extension: str = "mp4") -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    args = ["-movflags", "+faststart"] if extension == "mp4" else []
    run(ffmpeg, seconds, size, codec, [*args, str(MEDIA / f"{name}.{extension}")], tone)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--codec", choices=["vp9", "h264"], default="vp9")
    args = parser.parse_args()
    ffmpeg = find_ffmpeg()
    shutil.rmtree(MEDIA, ignore_errors=True)

    hls(ffmpeg, "movie-hls", 30, "640x360", args.codec, 440)
    progressive(ffmpeg, "movie-file", 30, "640x360", args.codec, 550)
    # HEVC + AC-3 MKV: browsers refuse it ("watch on TV"); the desktop app converts it with FFmpeg (issue #236).
    progressive(ffmpeg, "movie-mkv", 10, "320x180", "hevc", 330, extension="mkv")
    hls(ffmpeg, "episode-long", 660, "256x144", args.codec, 660)
    progressive(ffmpeg, "episode-short", 30, "640x360", args.codec, 770)
    hls(ffmpeg, "live", 20, "640x360", args.codec, 880)
    print(f"Media written to {MEDIA}")


if __name__ == "__main__":
    main()
