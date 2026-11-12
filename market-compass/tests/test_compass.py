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


def test_builtin_nifty50_fallback_has_50():
    from compass.universe import NIFTY50_FALLBACK

    assert len(NIFTY50_FALLBACK) == 50


def test_pick_rule_exits():
    from compass import picks as P

    e = 100.0
    # target hit on day 2
    o, h, l, c = [e, 100, 101], [e, 101, 102.5], [e, 99, 100], [e, 100.5, 102]
    r, j, how = P.simulate(np.array(o), np.array(h), np.array(l), np.array(c), 0)
    assert how == "target" and abs(r - (P.TARGET - P.COST)) < 1e-9 and j == 2
    # gap below stop -> filled at the open, worse than -8%
    r, j, how = P.simulate(np.array([e, 85.0]), np.array([e, 86.0]), np.array([e, 84.0]), np.array([e, 85.0]), 0)
    assert how == "stop (gap)" and abs(r - (85 / 100 - 1 - P.COST)) < 1e-9
    # neither hit within MAX_DAYS -> time exit at close
    n = P.MAX_DAYS + 2
    flat = np.full(n, 100.0)
    r, j, how = P.simulate(flat, flat + 0.5, flat - 0.5, flat, 0)
    assert how == "time exit" and j == P.MAX_DAYS


def test_pick_signal_needs_uptrend_and_dip():
    from compass import picks as P

    up = pd.Series(np.linspace(100, 200, 300))
    assert not P.signal_frame(up)["sig"].iloc[-1]            # steady rise, no dip
    dip = pd.concat([up, pd.Series([190.0, 180.0, 172.0])], ignore_index=True)
    assert P.signal_frame(dip)["sig"].iloc[-1]               # sharp dip in an uptrend


def test_news_headline_tone_and_topics():
    from compass import news as N

    cases = {
        "Crude oil prices jump after OPEC cuts output": (-1, "crude"),
        "Oil falls 3% on demand worries": (1, "crude"),
        "RBI signals rate cut ahead": (1, "rbi"),
        "Missile attack escalates conflict": (-1, "war"),
        "Ceasefire agreed, markets cheer": (1, "war"),
        "US imposes new tariffs on Indian goods": (-1, "trade"),
        # real headlines from 12 Nov 2026 that were scored wrongly at first
        "India's retail inflation crosses RBI's 6% limit as onion prices jump 116%": (-1, "inflation"),
        "Fed Forced to Confront Case for Bigger and Faster Rate Rises": (-1, "fed"),
        "G7 backs Quad efforts to end Sudan war": (1, "war"),
        "No rate cut from RBI, banks slide": (-1, "rbi"),
    }
    for title, (tone, topic) in cases.items():
        t, topics = N.score_headline(title)
        assert t == tone and topic in topics, title


def test_last_close_time_skips_weekend():
    from compass import news as N

    mon_morning = pd.Timestamp("2026-11-16 08:00", tz="Asia/Kolkata")
    assert N.last_close_time(mon_morning) == pd.Timestamp("2026-11-13 15:30", tz="Asia/Kolkata")
    wed_evening = pd.Timestamp("2026-11-11 18:00", tz="Asia/Kolkata")
    assert N.last_close_time(wed_evening) == pd.Timestamp("2026-11-11 15:30", tz="Asia/Kolkata")


def test_history_features_and_analogs_have_no_lookahead():
    from compass import history as Hh

    idx = pd.bdate_range("2010-01-01", periods=1500)
    rng = np.random.default_rng(1)
    raw = {k: pd.Series(100 * np.exp(np.cumsum(rng.normal(0, 0.01, len(idx)))), index=idx) for k in Hh.TICKERS}
    raw["ivix"] = pd.Series(15 + rng.normal(0, 1, len(idx)).cumsum() * 0.05, index=idx).abs() + 10
    F, N = Hh.features(raw)
    # a US series moved on day D must only show up from the next Indian day
    assert F.index.equals(F.index.sort_values())
    t = len(F) - 1
    picked, _ = Hh._nearest(F, t, 20, 10)
    assert (picked <= t - 20).all()                     # every analog's 20-day outcome is already known
    assert len(set(picked)) == len(picked)
