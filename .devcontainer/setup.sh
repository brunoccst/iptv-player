#!/usr/bin/env bash
# One-time Codespace setup: dependencies, worker venv, H.264 test media (plays on phones), backend build.
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
python3 -m venv services/title-normalizer/.venv
services/title-normalizer/.venv/bin/pip install -q -r services/title-normalizer/requirements-dev.txt imageio-ffmpeg
FFMPEG="$(services/title-normalizer/.venv/bin/python -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())')" \
  python3 tools/fake-xtream-server/generate_media.py --codec h264
dotnet build backend/Backend.sln -v q
