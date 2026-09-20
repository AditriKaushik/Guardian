# Using Guardian across your devices

Guardian works as a **hub + reporters** system:

- **Hub** — one always-on computer runs the server. It stores everyone's
  last-known location and shows a live page. Best choice: your **Windows
  desktop** (stays on).
- **Reporters** — every device sends *its own* location to the hub, with
  consent. This is the only way that respects privacy and platform rules:
  no device can silently pull another's location.

> **Consent & law:** every member must have `locate` consent in the hub config,
> and each device needs the member's secret `token`. Only set this up for people
> who agree to it. Covert tracking of another adult is illegal in most places.

---

## 1. Start the hub (on your Windows desktop)

```bash
git clone https://github.com/AditriKaushik/Guardian
cd Guardian
pip install -e .

# copy the example config and edit the tokens/names
copy examples\hub_config.example.json hub_config.json   # Windows
# cp examples/hub_config.example.json hub_config.json    # Mac/Linux

python -m guardian.hub --config hub_config.json --port 8080
```

Find the desktop's LAN IP (Windows: `ipconfig` -> IPv4 Address, e.g.
`192.168.1.10`). Open `http://192.168.1.10:8080/` in any browser on the same
Wi-Fi to see the live view.

**Give each member a unique random `token`** in `hub_config.json`. The token is
that device's password for posting location — keep it secret.

---

## 2. Report from each device

### Windows laptop / Mac laptop (Python)
```bash
pip install -e .
# approximate (city-level) from IP, repeats every 5 min:
python -m guardian.reporter --hub http://192.168.1.10:8080 \
    --member dad --token YOUR-TOKEN --interval 300

# or exact position:
python -m guardian.reporter --hub http://192.168.1.10:8080 \
    --member dad --token YOUR-TOKEN --lat 28.6139 --lon 77.2090
```
Note: IP location is only city-level. For precise GPS, use a phone.

### iPhone / iPad (no code — Apple Shortcuts)
1. Open the **Shortcuts** app -> **+** -> add these actions:
   - **Get Current Location**
   - **Get Contents of URL**
     - URL: `http://192.168.1.10:8080/report`
     - Method: **POST**
     - Request Body: **JSON**
     - Add fields:
       - `member` -> `sam`
       - `token` -> `YOUR-TOKEN`
       - `lat` -> (Shortcut variable) Current Location -> **Latitude**
       - `lon` -> Current Location -> **Longitude**
       - `source` -> `iphone`
2. Run it once and **Allow** location access.
3. To make it automatic: **Automation** tab -> create a time/arrival automation
   that runs this shortcut (e.g. every hour, or when leaving home).

### Android (no code — "HTTP Shortcuts" app)
1. Install **HTTP Shortcuts** (F-Droid / Play Store).
2. New shortcut -> Method **POST**, URL `http://192.168.1.10:8080/report`.
3. Body type **JSON**:
   ```json
   {"member":"mom","token":"YOUR-TOKEN","lat":"{{location_lat}}","lon":"{{location_lon}}","source":"android"}
   ```
   Use the app's built-in location variables for lat/lon.
4. Optional: schedule it or trigger on Wi-Fi/geofence with Tasker.

### Android (with code — Termux)
```bash
pkg install termux-api python
termux-location   # grant location permission once
```
Then a small loop that posts `termux-location` output to `/report` (same JSON
as above).

---

## 3. Viewing

- Live page: `http://<hub-ip>:8080/`
- JSON for your own tools: `http://<hub-ip>:8080/api/locations`
- Each row links to Google Maps for that member's last position.

---

## Listen / View modes

Guardian's `listen` and `view` modes exist in the library, but phones and
laptops **do not allow silent microphone/camera capture** — that's an OS
privacy rule, and doing it covertly is unlawful. The consent-respecting ways to
"listen" or "view" are a normal **video/audio call** the person accepts, or a
built-in family app. Guardian keeps these modes behind the same consent gate;
wire them to a call/app backend, never to hidden capture.

## Security notes

- The hub has no login on the view page — run it on your **home network only**,
  not exposed to the public internet. If you must reach it remotely, put it
  behind a VPN (e.g. Tailscale), not port-forwarding.
- Tokens are the only write credential; rotate them if a device is lost.
