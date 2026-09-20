"""Guardian reporter for computers (Windows / macOS / Linux).

Sends this device's location to a Guardian hub. Uses only the standard library.

Usage::

    # Approximate location from your IP (city-level), auto-detected:
    python -m guardian.reporter --hub http://192.168.1.10:8080 \
        --member dad --token SECRET123

    # Or send an exact position you provide:
    python -m guardian.reporter --hub http://192.168.1.10:8080 \
        --member dad --token SECRET123 --lat 28.6139 --lon 77.2090

    # Keep reporting every 5 minutes:
    python -m guardian.reporter ... --interval 300

Note: IP-based location is only city-level accurate. For precise GPS use a
phone (see docs/USAGE_DEVICES.md) or pass --lat/--lon yourself.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.request
from typing import Optional, Tuple


def ip_location() -> Tuple[float, float, str]:
    """Best-effort city-level location from the public IP. Returns (lat, lon, src)."""
    with urllib.request.urlopen("https://ipapi.co/json/", timeout=10) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return float(data["latitude"]), float(data["longitude"]), "ip-approx"


def send_report(hub: str, member: str, token: str, lat: float, lon: float,
                source: str = "computer") -> dict:
    payload = json.dumps({
        "member": member, "token": token,
        "lat": lat, "lon": lon, "source": source,
    }).encode("utf-8")
    req = urllib.request.Request(
        hub.rstrip("/") + "/report", data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    # A hub on your own LAN uses a self-signed cert; skip verification for it
    # (traffic is still encrypted, just not verified against a public CA).
    context = None
    if hub.lower().startswith("https"):
        import ssl
        context = ssl._create_unverified_context()
    with urllib.request.urlopen(req, timeout=10, context=context) as resp:
        return json.loads(resp.read().decode("utf-8"))


def report_once(hub: str, member: str, token: str,
                lat: Optional[float], lon: Optional[float]) -> None:
    if lat is None or lon is None:
        lat, lon, source = ip_location()
    else:
        source = "manual"
    result = send_report(hub, member, token, lat, lon, source)
    ok = result.get("ok")
    when = time.strftime("%H:%M:%S")
    if ok:
        print(f"[{when}] reported {member}: {lat:.5f}, {lon:.5f} ({source}) -> OK")
    else:
        print(f"[{when}] reported {member}: FAILED -> {result.get('error')}")


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description="Report this computer's location to a Guardian hub.")
    p.add_argument("--hub", required=True, help="hub base URL, e.g. http://192.168.1.10:8080")
    p.add_argument("--member", required=True, help="member id as configured on the hub")
    p.add_argument("--token", required=True, help="this member's secret token")
    p.add_argument("--lat", type=float, help="exact latitude (skip IP lookup)")
    p.add_argument("--lon", type=float, help="exact longitude (skip IP lookup)")
    p.add_argument("--interval", type=int, default=0,
                  help="repeat every N seconds (0 = once and exit)")
    args = p.parse_args(argv)

    while True:
        try:
            report_once(args.hub, args.member, args.token, args.lat, args.lon)
        except Exception as exc:  # network hiccup shouldn't kill a long-running loop
            print(f"[{time.strftime('%H:%M:%S')}] error: {exc!r}")
        if args.interval <= 0:
            break
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
