"""Global cause -> effect: only relationships that were tested on 10 years of real data (Nov 2026 study,
design period before 2021-11-01, checked on 2021-11..2026-11).

1. Opening-gap forecast for Nifty from overnight S&P 500, US dollar index, Hang Seng opening gap and Bitcoin.
   Test period: direction right 72-75% of days (base rate 60%), ~34% of the gap explained.
   It does NOT predict the move after the open (that stayed a coin flip, 52-54%).
2. Metals intraday tilt: copper/aluminium overnight moves and a strong Hang Seng open carried into a small
   intraday drift in metal stocks (about +0.15-0.3%), roughly the size of trading costs, so a tilt, not a trade.
3. Plain cause -> effect list with the verdict from the study.
"""
from __future__ import annotations

import math
from datetime import datetime

import numpy as np
import pandas as pd

from . import data as D

# Design-period regression for log(Nifty open / previous close)
GAP_COEF = {"spx": 0.13, "dxy": -0.06, "hsi_gap": 0.42, "btc": 0.006}
SIGMA = {"HG=F": 0.0134, "ALI=F": 0.0104, "SI=F": 0.0181}   # design-period std of daily moves

EFFECTS = [
    # (driver key, driver label, effect text, verdict, note)
    ("sp500", "S&P 500 (US) overnight", "Nifty opening gap, same direction (S&P −1% → Nifty opens ≈ −0.4%)", "USE",
     "Only the opening gap: after 9:15 the day is a coin flip"),
    ("usvix", "US VIX (fear) overnight", "Rising US fear → Nifty opens lower", "USE", "Opening gap only"),
    ("hangseng", "Hang Seng opening (7 AM IST)", "±1% open → Nifty opens ≈ ±0.6% the same way; metals keep ≈ +0.3% intraday after a strong HK open",
     "USE", "Strongest single morning signal"),
    ("dxy", "US Dollar Index", "Dollar +0.5% → Nifty opens ≈ −0.2%", "WEAK", "Opening gap only"),
    ("copper", "Copper", "Up → Hindalco, NALCO, Vedanta, Tata Steel, Nifty Metal up, mostly at the open, plus a small intraday drift",
     "USE (tilt)", "Intraday drift ≈ +0.15–0.25% per 1σ move, about the size of costs"),
    ("aluminium", "Aluminium", "Up → NALCO, Hindalco, Vedanta up (small intraday drift)", "USE (tilt)",
     "Data has gaps; treat as a tilt"),
    ("silver", "Silver", "Up → Hindustan Zinc / Vedanta up", "WEAK", "Mostly same day"),
    ("gold", "Gold", "Up → Muthoot Finance slightly up; Titan / Manappuram: no reliable link", "WEAK",
     "No effect on Nifty"),
    ("brent", "Crude oil", "Up → ONGC, Oil India up (at the open); paints (Asian, Berger) down same day; OMCs/IndiGo not predictable",
     "WEAK", "Effect on Nifty flipped sign between periods, so not used for Nifty"),
    ("natgas", "Natural gas", "GAIL, IGL, MGL, Petronet: no measurable link", "REJECT", ""),
    ("btc", "Bitcoin / crypto", "Moves with US risk mood; adds almost nothing beyond the S&P 500", "WEAK",
     "Useful only as an overnight risk read"),
    ("usdinr", "USD / INR", "No reliable next-day link to Nifty", "REJECT", ""),
]


def _close(sym: str, period: str = "1mo") -> pd.DataFrame:
    df = D.history(sym, period, "1d")
    if not df.empty:
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize() if df.index.tz is not None else df.index
    return df


def _ret_before(df: pd.DataFrame, day: pd.Timestamp) -> float | None:
    """log return between the last two closes dated strictly before `day` (Indian session date)."""
    if df.empty:
        return None
    c = df["Close"][df.index < day].dropna()
    return float(math.log(c.iloc[-1] / c.iloc[-2])) if len(c) >= 2 else None


def build(now: datetime, snap: dict) -> dict:
    day = pd.Timestamp(now.date())
    spx, dxy, btc, hsi = _close("^GSPC"), _close("DX-Y.NYB"), _close("BTC-USD"), _close("^HSI")
    parts = {"spx": _ret_before(spx, day), "dxy": _ret_before(dxy, day), "btc": None, "hsi_gap": None}
    if not btc.empty:   # BTC trades 24/7: latest price vs its close before the previous Indian session
        c = btc["Close"].dropna()
        prev = c[c.index < day]
        if len(prev) >= 2:
            parts["btc"] = float(math.log(c.iloc[-1] / prev.iloc[-2]))
    hsi_open_today = False
    if not hsi.empty and hsi.index[-1] == day and now.hour * 60 + now.minute >= 7 * 60:
        prev_close = hsi["Close"][hsi.index < day].dropna()
        if len(prev_close):
            parts["hsi_gap"] = float(math.log(hsi["Open"].iloc[-1] / prev_close.iloc[-1]))
            hsi_open_today = True
    pred = sum(GAP_COEF[k] * (v or 0.0) for k, v in parts.items())

    # Actual Nifty gap today (if the market has opened)
    nif = _close("^NSEI")
    actual = None
    if not nif.empty and nif.index[-1] == day and now.hour * 60 + now.minute >= 9 * 60 + 15:
        pc = nif["Close"][nif.index < day].dropna()
        if len(pc):
            actual = float(nif["Open"].iloc[-1] / pc.iloc[-1] - 1)

    # Metals intraday tilt
    z = {}
    for key, tick in (("copper", "HG=F"), ("aluminium", "ALI=F"), ("silver", "SI=F")):
        r = _ret_before(_close(tick), day)
        z[key] = None if r is None else r / SIGMA[tick]
    metal_score = (z.get("copper") or 0) + (z.get("aluminium") or 0) + (2 if (parts["hsi_gap"] or 0) > 0.01 else 0)
    if (z.get("copper") or 0) < -1.5:
        metal_score -= 2
    tilt = "positive" if metal_score >= 1.5 else "negative" if metal_score <= -1.5 else "neutral"

    effects = []
    for key, label, text, verdict, note in EFFECTS:
        r = snap.get(key, {})
        effects.append({"key": key, "driver": label, "effect": text, "verdict": verdict, "note": note,
                        "chg1": r.get("chg1") if r.get("ok") else None, "last": r.get("last") if r.get("ok") else None})
    return {
        "gap_forecast": {"pred": round(pred, 5), "parts": {k: (None if v is None else round(v, 5)) for k, v in parts.items()},
                         "hsi_included": hsi_open_today, "actual": None if actual is None else round(actual, 5),
                         "accuracy_note": "Direction right on 72–75% of days in 2021–2026 tests (base rate 60%). Says nothing about the move after 9:15."},
        "metals": {"tilt": tilt, "copper_z": z.get("copper"), "aluminium_z": z.get("aluminium"), "silver_z": z.get("silver"),
                   "hsi_gap": parts["hsi_gap"],
                   "note": "Typical intraday drift in Hindalco / NALCO / Vedanta ≈ ±0.15–0.3% on such days, about the size of trading costs. Use as a tilt, not a standalone trade."},
        "effects": effects,
    }
