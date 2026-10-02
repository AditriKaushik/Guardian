#!/usr/bin/env python3
"""Make one PNG grid of pictures with their names underneath, for a human to look over before
the pictures ship (are they realistic, friendly, right for small children, the right thing?).

    python3 tools/images/contact-sheet.py --out /tmp/sheet.png                  # web/img/real/*.webp
    python3 tools/images/contact-sheet.py --dir path/to/staging --out /tmp/photos.png
    python3 tools/images/contact-sheet.py --only mango,red-apple --cell 192 --out /tmp/two.png

Pages: with --per-page N, writes sheet-1.png, sheet-2.png, … next to --out.
"""
import argparse
import glob
import math
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", default=os.path.join(ROOT, "web", "img", "real"))
    ap.add_argument("--out", required=True)
    ap.add_argument("--cell", type=int, default=128)
    ap.add_argument("--cols", type=int, default=10)
    ap.add_argument("--per-page", type=int, default=0)
    ap.add_argument("--only", default="")
    ap.add_argument("--bg", default="#F4F1EA")
    args = ap.parse_args()
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        sys.exit("Pillow is needed: pip install pillow")

    files = sorted(f for ext in ("webp", "png", "jpg", "jpeg") for f in glob.glob(os.path.join(args.dir, "**", "*." + ext), recursive=True))
    only = [s for s in args.only.split(",") if s]
    if only:
        files = [f for f in files if os.path.splitext(os.path.basename(f))[0] in only]
    if not files:
        sys.exit("no pictures found")
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 11)
    except OSError:
        font = ImageFont.load_default()
    per = args.per_page or len(files)
    pages = [files[i:i + per] for i in range(0, len(files), per)]
    label_h = 16
    for p, chunk in enumerate(pages):
        rows = math.ceil(len(chunk) / args.cols)
        sheet = Image.new("RGB", (args.cols * args.cell, rows * (args.cell + label_h)), args.bg)
        draw = ImageDraw.Draw(sheet)
        for i, f in enumerate(chunk):
            x, y = (i % args.cols) * args.cell, (i // args.cols) * (args.cell + label_h)
            im = Image.open(f).convert("RGBA")
            im.thumbnail((args.cell - 8, args.cell - 8), Image.LANCZOS)
            sheet.paste(im, (x + (args.cell - im.width) // 2, y + (args.cell - im.height) // 2), im)
            name = os.path.splitext(os.path.basename(f))[0][:22]
            draw.text((x + 3, y + args.cell), name, fill="#333333", font=font)
        out = args.out if len(pages) == 1 else os.path.splitext(args.out)[0] + "-%d.png" % (p + 1)
        sheet.save(out)
        print(out, len(chunk), "pictures")


if __name__ == "__main__":
    main()
