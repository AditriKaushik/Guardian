"""Guardian Hub: a tiny always-on server that collects consented location
reports from your devices and shows everyone's last-known position.

Run it (e.g. on your Windows desktop)::

    python -m guardian.hub --config hub_config.json

Each device then POSTs its location to ``/report`` (see guardian.reporter for
computers, and docs/USAGE_DEVICES.md for phones). Open ``http://<hub-ip>:8080/``
in a browser to see the map view.

Only the standard library is used, so it runs anywhere Python does with no
``pip install`` of dependencies.

Consent & auth
--------------
A report is accepted only when BOTH hold:
  * the member's per-device ``token`` in the config matches, and
  * that member has consented to the ``locate`` mode.
This is the same consent-first rule as :mod:`guardian.monitor`; the token stops
strangers from posting on someone's behalf.
"""

from __future__ import annotations

import argparse
import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Dict, Optional

from .monitor import Member, ConsentError


class HubState:
    """In-memory store of members, their consent/tokens, and last locations.

    Backed by a JSON config file for who-is-who, and (optionally) a JSON data
    file so last-known locations survive a restart.
    """

    def __init__(self, config: dict, data_path: Optional[Path] = None):
        self._lock = threading.Lock()
        self.members: Dict[str, Member] = {}
        self.tokens: Dict[str, str] = {}
        self.locations: Dict[str, dict] = {}
        self.data_path = data_path

        for m in config.get("members", []):
            member = Member(m["id"], m.get("name", ""), m.get("role", "member"))
            member.grant(*m.get("consents", []))
            self.members[member.id] = member
            self.tokens[member.id] = str(m.get("token", ""))

        if data_path and Path(data_path).exists():
            try:
                self.locations = json.loads(Path(data_path).read_text())
            except Exception:
                self.locations = {}

    # -- core --------------------------------------------------------------

    def record_location(self, member_id: str, token: str, lat: float,
                        lon: float, **extra) -> dict:
        """Validate token + consent, then store a location. Returns the entry."""
        with self._lock:
            member = self.members.get(member_id)
            if member is None:
                raise KeyError(f"unknown member {member_id!r}")
            if not token or token != self.tokens.get(member_id):
                raise PermissionError("bad or missing token")
            if not member.allows("locate"):
                raise ConsentError(f"{member.name or member_id!r} has not consented to 'locate'")

            entry = {
                "lat": float(lat),
                "lon": float(lon),
                "at": time.time(),
                "name": member.name,
                "role": member.role,
            }
            # keep only simple, JSON-safe extras (accuracy, source, ...)
            for k, v in extra.items():
                if isinstance(v, (str, int, float, bool)) or v is None:
                    entry[k] = v
            self.locations[member_id] = entry
            self._persist()
            return entry

    def snapshot(self) -> list:
        """Every known member with their last location (or None)."""
        with self._lock:
            out = []
            for mid, member in self.members.items():
                out.append({
                    "id": mid,
                    "name": member.name,
                    "role": member.role,
                    "consents": sorted(member.consents),
                    "location": self.locations.get(mid),
                })
            return out

    def _persist(self) -> None:
        if not self.data_path:
            return
        try:
            Path(self.data_path).write_text(json.dumps(self.locations, indent=2))
        except Exception:
            pass  # a persistence failure must not drop the live update


def _render_page(snapshot: list) -> bytes:
    rows = []
    for m in snapshot:
        loc = m["location"]
        if loc:
            when = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(loc["at"]))
            gmap = f'https://www.google.com/maps?q={loc["lat"]},{loc["lon"]}'
            where = (f'<a href="{gmap}" target="_blank">{loc["lat"]:.5f}, '
                     f'{loc["lon"]:.5f}</a>')
            extra = loc.get("source", "")
        else:
            when, where, extra = "—", "no report yet", ""
        rows.append(
            f"<tr><td>{m['name'] or m['id']}</td><td>{m['role']}</td>"
            f"<td>{where}</td><td>{when}</td><td>{extra}</td></tr>"
        )
    html = f"""<!doctype html>
<html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="15">
<title>Guardian</title>
<style>
 body{{font-family:system-ui,Arial,sans-serif;margin:2rem;background:#0f1115;color:#e6e6e6}}
 h1{{font-size:1.3rem}} table{{border-collapse:collapse;width:100%}}
 th,td{{text-align:left;padding:.5rem .8rem;border-bottom:1px solid #2a2f3a}}
 th{{color:#9aa4b2;font-weight:600}} a{{color:#6ea8fe}}
 .note{{color:#9aa4b2;font-size:.85rem;margin-top:1rem}}
</style></head><body>
<h1>Guardian &mdash; last known locations</h1>
<table><tr><th>Member</th><th>Role</th><th>Location</th><th>Last seen</th><th>Source</th></tr>
{''.join(rows)}
</table>
<p class="note">Auto-refreshes every 15s. Only members who consented to
'locate' and reported with a valid token appear with a location.</p>
</body></html>"""
    return html.encode("utf-8")


def make_handler(state: HubState):
    class Handler(BaseHTTPRequestHandler):
        def _json(self, code: int, payload: dict) -> None:
            body = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):  # noqa: N802 (http.server API)
            if self.path.split("?")[0] in ("/", "/index.html"):
                body = _render_page(state.snapshot())
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            elif self.path.split("?")[0] == "/api/locations":
                self._json(200, {"members": state.snapshot()})
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):  # noqa: N802
            if self.path.split("?")[0] != "/report":
                self._json(404, {"error": "not found"})
                return
            try:
                length = int(self.headers.get("Content-Length", 0))
                data = json.loads(self.rfile.read(length) or b"{}")
                token = data.get("token") or self.headers.get("X-Guardian-Token", "")
                entry = state.record_location(
                    member_id=data["member"],
                    token=token,
                    lat=data["lat"],
                    lon=data["lon"],
                    source=data.get("source", "report"),
                    accuracy=data.get("accuracy"),
                )
                self._json(200, {"ok": True, "stored": entry})
            except KeyError as exc:
                self._json(400, {"ok": False, "error": f"missing/unknown: {exc}"})
            except PermissionError as exc:
                self._json(401, {"ok": False, "error": str(exc)})
            except ConsentError as exc:
                self._json(403, {"ok": False, "error": str(exc)})
            except Exception as exc:
                self._json(400, {"ok": False, "error": repr(exc)})

        def log_message(self, *args):  # keep the console quiet
            pass

    return Handler


def run_hub(config_path: str, host: str = "0.0.0.0", port: int = 8080,
            data_path: str = "guardian_locations.json") -> None:
    config = json.loads(Path(config_path).read_text())
    state = HubState(config, Path(data_path) if data_path else None)
    server = ThreadingHTTPServer((host, port), make_handler(state))
    shown = host if host != "0.0.0.0" else "<this-machine-ip>"
    print(f"Guardian hub running: http://{shown}:{port}/  (Ctrl+C to stop)")
    print(f"Members loaded: {', '.join(state.members) or '(none)'}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopping.")
        server.shutdown()


def main(argv=None) -> None:
    p = argparse.ArgumentParser(description="Run the Guardian hub server.")
    p.add_argument("--config", required=True, help="path to hub config JSON")
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--data", default="guardian_locations.json",
                  help="where to persist last-known locations")
    args = p.parse_args(argv)
    run_hub(args.config, args.host, args.port, args.data)


if __name__ == "__main__":
    main()
