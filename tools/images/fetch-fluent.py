#!/usr/bin/env python3
"""Download the Microsoft Fluent Emoji 3D renders listed in tools/images/fluent.json and save
them as small WebP pictures in web/img/real/<slug>.webp (256x256 by default: the full Fluent render, sharp on 2x screens).

Fluent Emoji (c) Microsoft Corporation, MIT License — https://github.com/microsoft/fluentui-emoji
The renders are fetched from raw.githubusercontent.com (the repository's `main` branch).

    pip install pillow
    python3 tools/images/fetch-fluent.py               # fetch what is missing, convert everything
    python3 tools/images/fetch-fluent.py --only mango  # just these slugs (comma separated)
    python3 tools/images/fetch-fluent.py --refetch     # ignore the download cache

Then run `node tools/images/build-images.mjs` to rewrite web/js/content/images.js and CREDITS.txt.

fluent.json is curated by hand: one entry per picture,
    {"slug": "mango", "src": "Mango/3D/mango_3d.png", "name": "Mango", "keys": ["🥭"]}
`src` is the path under assets/ in the Fluent repository; `keys` are the emoji (without U+FE0F)
that show this picture. An entry with "compose": [{"src", "scale", "x", "y"}, …] instead of "src"
is drawn from several Fluent renders (used for families, which Fluent does not have). People and hands use the "Medium" skin-tone render unless the app asks
for a specific skin tone (the yellow "Default" render is a cartoon, not a person).
"""
import argparse
import io
import json
import os
import re
import sys
import tempfile
import time
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LIST = os.path.join(ROOT, "tools", "images", "fluent.json")
OUT = os.path.join(ROOT, "web", "img", "real")
BASE = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/assets/"
UA = "NanhaSchoolImageBuilder/1.0 (+https://github.com/microsoft/fluentui-emoji)"


def fetch(url, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as e:  # network hiccup: retry a little later
            last = e
            time.sleep(1.5 * (i + 1))
    raise last


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "nanha-fluent-cache"),
                    help="where the original 256x256 PNGs are kept (outside the repo)")
    ap.add_argument("--size", type=int, default=256)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--only", default="", help="comma separated slugs")
    ap.add_argument("--refetch", action="store_true")
    ap.add_argument("--prune", action="store_true", help="delete web/img/real/*.webp files that are no longer listed")
    args = ap.parse_args()
    try:
        from PIL import Image
    except ImportError:
        sys.exit("Pillow is needed: pip install pillow")

    items = json.load(open(LIST, encoding="utf-8"))
    only = set(s for s in args.only.split(",") if s)
    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    total = 0
    failed = []

    def original(src):
        """The 256x256 Fluent PNG for `src`, from the cache or the network."""
        cached = os.path.join(args.cache, re.sub(r"[^A-Za-z0-9._-]+", "_", src))
        if args.refetch or not os.path.exists(cached):
            data = fetch(BASE + urllib.parse.quote(src))
            with open(cached, "wb") as f:
                f.write(data)
        return Image.open(cached).convert("RGBA")

    for it in items:
        if only and it["slug"] not in only:
            continue
        try:
            if "compose" in it:
                # A picture Fluent does not have (e.g. a family) made from several Fluent people:
                # each part is scaled (fraction of the canvas) and placed at x, y (fractions).
                im = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
                for part in it["compose"]:
                    p = original(part["src"])
                    side = round(256 * part["scale"])
                    p = p.resize((side, side), Image.LANCZOS)
                    im.alpha_composite(p, (round(256 * part["x"]), round(256 * part["y"])))
            else:
                im = original(it["src"])
        except Exception as e:
            failed.append((it["slug"], str(e)))
            continue
        if im.size != (args.size, args.size):
            im = im.resize((args.size, args.size), Image.LANCZOS)
        dest = os.path.join(OUT, it["slug"] + ".webp")
        buf = io.BytesIO()
        im.save(buf, "WEBP", quality=args.quality, alpha_quality=90, method=6)
        with open(dest, "wb") as f:
            f.write(buf.getvalue())
        total += len(buf.getvalue())
        print("%-40s %6d bytes" % (it["slug"], len(buf.getvalue())))
    print("written:", total, "bytes")
    if args.prune and not only:
        keep = set(it["slug"] + ".webp" for it in items)
        for f in sorted(os.listdir(OUT)):
            if f.endswith(".webp") and f not in keep:
                os.remove(os.path.join(OUT, f))
                print("pruned", f)
    if failed:
        print("FAILED:", file=sys.stderr)
        for s, e in failed:
            print("  ", s, e, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
