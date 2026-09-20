"""Create a hub_config.json with strong random tokens (no manual editing).

Run once::

    py -m guardian.setup

It writes hub_config.json (if missing) with three members and a unique random
token each, then prints the tokens you paste into each device.
"""

from __future__ import annotations

import json
import secrets
from pathlib import Path

DEFAULT_MEMBERS = [
    ("dad", "Dad", "parent", ["locate"]),
    ("mom", "Mom", "parent", ["locate"]),
    ("kid", "Kid", "child", ["locate", "view"]),
]


def build_config() -> dict:
    members = []
    for mid, name, role, consents in DEFAULT_MEMBERS:
        members.append({
            "id": mid, "name": name, "role": role,
            "token": secrets.token_urlsafe(16),
            "consents": consents,
        })
    return {"members": members}


def main(path: str = "hub_config.json") -> None:
    p = Path(path)
    if p.exists():
        print(f"{path} already exists — leaving it as is (delete it to regenerate).")
        config = json.loads(p.read_text())
    else:
        config = build_config()
        p.write_text(json.dumps(config, indent=2))
        print(f"Created {path} with strong random tokens.\n")

    print("Members and their device tokens (keep secret):")
    for m in config["members"]:
        print(f"  {m['id']:6} ({m.get('name','')}) -> token: {m['token']}")


if __name__ == "__main__":
    main()
