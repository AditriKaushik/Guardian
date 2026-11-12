"""NSE F&O lot sizes + ban list helper (educational use).

fo_lot_sizes() -> {SYMBOL: lot_size} for the near-month contract of stock
(and index) derivatives. Tries the live NSE archive, then a local cache,
then a tiny hard-coded fallback so the dashboard never crashes.
"""
from __future__ import annotations

import csv
import io
import json
import os
import time
import urllib.request

LOTS_URL = "https://nsearchives.nseindia.com/content/fo/fo_mktlots.csv"
BAN_URL = "https://nsearchives.nseindia.com/content/fo/fo_secban.csv"
CACHE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "fo_mktlots_cache.csv")
INDEX_SYMBOLS = {"NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "NIFTYNXT50", "NIFTYFPI"}
# Last-resort fallback (verify before use; NSE revises lots periodically).
_FALLBACK = {"RELIANCE": 500, "TCS": 225, "INFY": 400, "HDFCBANK": 650,
             "ICICIBANK": 700, "SBIN": 750, "NIFTY": 65, "BANKNIFTY": 30}
_HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "text/csv,*/*",
            "Referer": "https://www.nseindia.com/"}


def _get(url: str, timeout: int = 20, retries: int = 2) -> str:
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=_HEADERS)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:  # network, 403, timeout
            last = e
            time.sleep(1 + i)
    raise RuntimeError(f"fetch failed: {url}: {last}")


def parse_lots(text: str, include_indices: bool = False) -> dict[str, int]:
    rows = list(csv.reader(io.StringIO(text)))
    out: dict[str, int] = {}
    in_stocks = False  # rows before "Derivatives on Individual Securities" are indices
    for row in rows[1:]:
        cells = [c.strip() for c in row]
        if len(cells) < 3:
            continue
        if cells[1].upper() == "SYMBOL":  # section header row
            in_stocks = in_stocks or "INDIVIDUAL" in cells[0].upper()
            continue
        sym = cells[1].upper()
        if not sym:
            continue
        is_index = (not in_stocks) or sym in INDEX_SYMBOLS
        if is_index and not include_indices:
            continue
        # first non-empty numeric month column = near-month lot size
        for c in cells[2:]:
            if c.isdigit() and int(c) > 0:
                out[sym] = int(c)
                break
    return out


def fo_lot_sizes(include_indices: bool = False) -> dict[str, int]:
    """Live NSE file -> cached copy of last good file -> small fallback dict."""
    try:
        text = _get(LOTS_URL)
        lots = parse_lots(text, include_indices)
        if len(lots) < 50:
            raise ValueError(f"suspiciously few rows: {len(lots)}")
        try:
            with open(CACHE, "w") as f:
                f.write(text)
        except OSError:
            pass
        return lots
    except Exception:
        try:
            with open(CACHE) as f:
                lots = parse_lots(f.read(), include_indices)
            if lots:
                return lots
        except Exception:
            pass
        return {k: v for k, v in _FALLBACK.items()
                if include_indices or k not in INDEX_SYMBOLS}


def fo_ban_list() -> set[str]:
    """Symbols in F&O ban period (MWPL > 95%): no fresh positions allowed,
    only reduction of existing ones. Empty set if unavailable."""
    try:
        text = _get(BAN_URL)
    except Exception:
        return set()
    out = set()
    for line in text.splitlines()[1:]:
        parts = [p.strip() for p in line.split(",")]
        if len(parts) >= 2 and parts[1]:
            out.add(parts[1].upper())
    return out


