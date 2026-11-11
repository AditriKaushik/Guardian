"""Synthetic price series used ONLY by the automated tests (never by the app)."""
from __future__ import annotations

import hashlib

import numpy as np
import pandas as pd

IST = "Asia/Kolkata"


def _period_days(period: str) -> int:
    n = int("".join(ch for ch in period if ch.isdigit()) or 1)
    if period.endswith("mo"):
        return n * 30
    if period.endswith("y"):
        return n * 365
    return n


def synthetic_history(symbol: str, period: str, interval: str) -> pd.DataFrame:
    """Deterministic random-walk data shaped like NSE sessions (demo only)."""
    seed = int(hashlib.md5(f"{symbol}{interval}".encode()).hexdigest()[:8], 16)
    rng = np.random.default_rng(seed)
    days = pd.bdate_range(end=pd.Timestamp.now(tz=IST).normalize(), periods=max(5, int(_period_days(period) * 5 / 7)))
    base = {"INR=X": 88.0, "DX-Y.NYB": 100.0, "^TNX": 4.2, "BZ=F": 72.0, "^INDIAVIX": 13.5,
            "^NSEI": 25500.0, "^NSEBANK": 57000.0, "^GSPC": 6500.0, "GC=F": 3900.0}.get(symbol, 1000 + seed % 2500)
    if interval in ("1d", "1wk"):
        idx = days + pd.Timedelta(hours=9, minutes=15)
        vol = 0.011 if not symbol.startswith(("INR", "DX", "^TNX")) else 0.003
    else:
        stamps = []
        for d in days:
            for h, m in [(9, 15), (10, 15), (11, 15), (12, 15), (13, 15), (14, 15), (15, 15)]:
                stamps.append(d + pd.Timedelta(hours=h, minutes=m))
        idx = pd.DatetimeIndex(stamps)
        vol = 0.0045
    rets = rng.normal(0.0002, vol, len(idx))
    # a little autocorrelation so the model has something faint to find
    for i in range(1, len(rets)):
        rets[i] += 0.08 * rets[i - 1]
    close = base * np.exp(np.cumsum(rets))
    openp = np.r_[close[0], close[:-1]] * (1 + rng.normal(0, vol / 4, len(idx)))
    high = np.maximum(openp, close) * (1 + np.abs(rng.normal(0, vol / 2, len(idx))))
    low = np.minimum(openp, close) * (1 - np.abs(rng.normal(0, vol / 2, len(idx))))
    volume = rng.integers(200_000, 2_000_000, len(idx)).astype(float)
    if symbol.startswith("^") or "=" in symbol:
        volume[:] = 0.0
    df = pd.DataFrame({"Open": openp, "High": high, "Low": low, "Close": close, "Volume": volume}, index=idx)
    if idx.tz is None:
        df.index = df.index.tz_localize(IST)
    return df


