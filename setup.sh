#!/usr/bin/env bash
# One-time setup (Linux / macOS). Windows: run setup.ps1 instead.
set -e
cd "$(dirname "$0")"
python3 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python engine/make_video.py catalog
.venv/bin/python engine/make_video.py validate videos/lie-shrinks-you
echo "SETUP OK  ->  activate with: source .venv/bin/activate"
