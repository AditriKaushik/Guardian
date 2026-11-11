"""LIVE tests against real market data (Yahoo Finance + NSE). Skipped automatically when offline.

    python -m pytest tests/test_live.py -q
"""
from datetime import timedelta

import pandas as pd
import pytest

from compass import data as D, scorecard as S, stock_model as M


def _online():
    return not D.history("^NSEI", "5d", "1d").empty


pytestmark = pytest.mark.skipif(not _online(), reason="no internet / Yahoo Finance unreachable")


def test_real_prices_are_recent():
    df = D.history("RELIANCE.NS", "1mo", "1d")
    assert len(df) >= 10
    assert df.index[-1] >= pd.Timestamp.now(tz=D.IST) - timedelta(days=7), "latest candle older than a week"
    assert (df["Close"] > 0).all()


def test_macro_snapshot_mostly_available():
    snap = D.macro_snapshot()
    ok = [k for k, v in snap.items() if v.get("ok")]
    assert len(ok) >= 8, f"only {ok} returned data"
    scored = [f.key for f in S.FACTORS if f.auto and S.auto_score(f.key, snap)[0] is not None]
    assert len(scored) >= 6


def test_real_stock_prediction():
    df = D.history("TCS.NS", "730d", "60m")
    idx = D.history("^NSEI", "730d", "60m")
    assert len(df) > 2000
    p = M.predict(df, idx, 2)
    assert p.ok and 0.05 <= p.p_up <= 0.95
    assert abs(p.last_price / float(df["Close"].iloc[-1]) - 1) < 1e-9
