#!/usr/bin/env bash
# One-time Codespace setup: dependencies and H.264 test media for the fake panel (plays on phones).
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
python3 -m venv /tmp/media-venv
/tmp/media-venv/bin/pip install -q imageio-ffmpeg
FFMPEG="$(/tmp/media-venv/bin/python -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')" \
  python3 tools/fake-xtream-server/generate_media.py --codec h264
