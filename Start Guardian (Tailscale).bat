@echo off
REM ============================================================
REM   Guardian - Tailscale mode launcher (Windows)
REM   Use this when you connect phones via Tailscale.
REM   Tailscale encrypts everything, so the hub runs in plain
REM   mode and phones need NO certificate trust.
REM ============================================================
title Guardian Hub (Tailscale)
pushd "%~dp0"

echo.
echo   Starting Guardian (Tailscale mode)...
echo.

REM Create config with strong random tokens if it doesn't exist yet
if not exist "hub_config.json" (
    py -m guardian.setup
    echo.
    echo   ^>^> Upar diye tokens note kar lo - phone setup me chahiye.
    echo.
    pause
)

REM Show this PC's Tailscale IP (100.x.x.x) if Tailscale is installed
where tailscale >nul 2>nul
if not errorlevel 1 (
    echo   Aapke phone me ye address daalna hai:
    for /f "delims=" %%i in ('tailscale ip -4 2^>nul') do echo      http://%%i:8080/report
    echo.
)

start "" "http://localhost:8080/"
echo   Guardian chal raha hai (Tailscale encryption). Window band mat karo.
echo   App: http://localhost:8080/    Rokna: Ctrl+C
echo.
py -m guardian.hub --config hub_config.json --port 8080

popd
pause
