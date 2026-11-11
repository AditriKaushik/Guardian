#!/usr/bin/env bash
# Market Compass launcher for macOS / Linux:  bash start.sh
set -e
cd "$(dirname "$0")"
command -v python3 >/dev/null || { echo "Install Python 3.10+ from https://www.python.org/downloads/"; exit 1; }
[ -d .venv ] || { echo "First run: setting up (2-5 minutes)..."; python3 -m venv .venv; }
source .venv/bin/activate
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt
exec python -m streamlit run app.py
