@echo off
REM Market Compass launcher for Windows. Double-click to start; your browser opens automatically.
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python is not installed. Install Python 3.10+ from https://www.python.org/downloads/
  echo IMPORTANT: tick "Add Python to PATH" during install, then double-click this file again.
  pause
  exit /b 1
)
if not exist .venv (
  echo First run: setting up, this takes 2-5 minutes...
  python -m venv .venv
)
call .venv\Scripts\activate.bat
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt
echo Starting Market Compass... (close this window to stop it)
python -m streamlit run app.py
pause
