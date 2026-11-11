"""Offline logic tests:  python -m pytest tests -q
They use a synthetic series so the maths can be checked without internet.
Live tests against real market data are in test_live.py."""
from datetime import date

import numpy as np
import pandas as pd

from compass import events as E, scorecard as S, stock_model as M
from compass.stocks import to_yahoo
from synthetic import synthetic_history as H


def test_symbol_mapping():
    assert to_yahoo("reliance") == "RELIANCE.NS"
    assert to_yahoo("^NSEI") == "^NSEI"
    assert to_yahoo("M&M") == "M&M.NS"


def test_stance_thresholds():
    assert S.stance({"a": 1, "b": 1, "c": 1})["name"] == "AGGRESSIVE BUY"
    assert S.stance({"a": -1, "b": -1, "c": 0})["name"] == "PROTECT CAPITAL"
    assert S.stance({"a": 0, "b": 0})["name"] == "NEUTRAL / WAIT"


def test_sector_tilt_crude_high_hurts_paints():
    tilts = {s: v for s, v, _ in S.sector_tilts({"brent": -1})}
    assert tilts["Paints"] == -1 and tilts["Oil upstream (ONGC, Oil India)"] == 1


def test_auto_score_rules():
    snap = {"brent": {"ok": True, "last": 95.0, "chg5": 0.0},
            "vix": {"ok": True, "last": 12.0, "chg5": 0.0},
            "usdinr": {"ok": True, "last": 90.0, "chg5": 0.01}}
    assert S.auto_score("brent", snap)[0] == -1
    assert S.auto_score("vix", snap)[0] == 1
    assert S.auto_score("usdinr", snap)[0] == -1
    assert S.auto_score("fii", snap, {"FII": -5000, "date": "x"})[0] == -1
    assert S.auto_score("dxy", snap)[0] is None


def test_labels_never_cross_days():
    df = H("TEST.NS", "60d", "60m")
    y, fwd = M.make_labels(df, 3)
    day = np.array(df.index.date)
    for i in np.where(fwd.notna().to_numpy())[0][:200]:
        assert day[i] == day[i + 3]


def test_features_have_no_lookahead():
    df = H("TEST.NS", "200d", "60m")
    full = M.build_features(df)
    part = M.build_features(df.iloc[:-50])
    common = part.index[-100:]
    np.testing.assert_allclose(full.loc[common, M.FEATURES].to_numpy(),
                               part.loc[common, M.FEATURES].to_numpy(), rtol=1e-9, atol=1e-12)


def test_prediction_is_sane():
    df = H("RELIANCE.NS", "730d", "60m")
    idx = H("^NSEI", "730d", "60m")
    for h in (1, 2, "close"):
        p = M.predict(df, idx, h)
        assert p.ok and 0.05 <= p.p_up <= 0.95 and 0 <= p.reliability <= 1
        assert p.range_lo <= p.range_mid <= p.range_hi


def test_short_history_is_refused():
    df = H("RELIANCE.NS", "20d", "60m")
    assert not M.predict(df, None, 2).ok


def test_calendar():
    up = E.upcoming(date(2026, 11, 11), 30)
    assert len(up) > 5 and up["date"].min() >= date(2026, 11, 11)


def test_track_record_resolves_against_prices():
    from compass import build_site as B

    df = H("TEST.NS", "60d", "60m")
    bar = df.index[-10]
    while bar.hour > 12:  # pick a bar with 2 hours left in its day
        bar = df.index[df.index.get_loc(bar) - 1]
    target = bar + pd.Timedelta(hours=2)
    rec = {"sym": "X", "h": "2", "bar": str(bar), "made": bar.isoformat(), "target": str(target),
           "price": float(df.loc[bar, "Close"]), "p": 0.7, "rel": 0.6}
    track = {"open": [rec], "resolved": [], "totals": {}}
    now = df.index[-1].to_pydatetime() + pd.Timedelta(days=1)
    out = B.update_track(track, {}, {"X": df}, now, is_open=False)
    assert not out["open"] and len(out["resolved"]) == 1
    r = out["resolved"][0]
    assert r["exit"] == round(float(df.loc[target, "Close"]), 2)
    assert r["up"] == int(df.loc[target, "Close"] > rec["price"])
    assert out["totals"]["all"]["n"] == 1
