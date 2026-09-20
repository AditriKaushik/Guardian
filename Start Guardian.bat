@echo off
REM ============================================================
REM   Guardian - one click launcher (Windows)
REM   Double-click this file to start the encrypted hub.
REM ============================================================
title Guardian Hub
pushd "%~dp0"

echo.
echo   Starting Guardian... (pehli baar thoda time lag sakta hai)
echo.

REM 1) Make sure the encryption library is available (first run only)
py -c "import cryptography" 1>nul 2>nul
if errorlevel 1 (
    echo   Installing encryption support...
    py -m pip install --quiet cryptography
)

REM 2) Create config with strong random tokens if it doesn't exist yet
if not exist "hub_config.json" (
    py -m guardian.setup
    echo.
    echo   ^>^> Upar diye gaye tokens note kar lo - phone setup me chahiye honge.
    echo.
    pause
)

REM 3) Create a TLS certificate for HTTPS encryption if not present
if not exist "cert.pem" (
    echo   Creating encryption certificate...
    py -m guardian.gencert
)

REM 4) Open the app in the browser and start the encrypted hub
start "" "https://localhost:8080/"
echo.
echo   Guardian chal raha hai. Is window ko band mat karo.
echo   App dekhne ke liye browser: https://localhost:8080/
echo   Rokne ke liye is window me Ctrl+C dabayein.
echo.
py -m guardian.hub --config hub_config.json --port 8080 --certfile cert.pem --keyfile key.pem

popd
pause
