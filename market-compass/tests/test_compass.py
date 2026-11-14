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


def test_short_rule_exits_and_signal():
    from compass import picks as P

    e = 100.0
    # target (price falls 1.5%) on day 2
    r, j, how = P.simulate_short(np.array([e, 99.5, 99.0]), np.array([e, 100.5, 99.2]), np.array([e, 99.0, 98.0]), np.array([e, 99.4, 98.6]), 0)
    assert how == "target" and j == 2 and abs(r - (P.S_TARGET - P.S_COST)) < 1e-9
    # gap UP through the stop fills at the open (worse than -8%)
    r, j, how = P.simulate_short(np.array([e, 110.0]), np.array([e, 111.0]), np.array([e, 109.0]), np.array([e, 110.0]), 0)
    assert how == "stop (gap)" and abs(r - (1 - 110 / 100 - P.S_COST)) < 1e-9
    # signal: 5% gap down on 3x volume closing near the low
    n = 80
    df = pd.DataFrame({"Open": np.full(n, 100.0), "High": np.full(n, 101.0), "Low": np.full(n, 99.0),
                       "Close": np.full(n, 100.0), "Volume": np.full(n, 1000.0)})
    df.loc[n - 1] = [95.0, 95.5, 92.0, 92.3, 3000.0]
    assert P.short_signal(df).iloc[-1] and not P.short_signal(df).iloc[-2]


def test_sell_pick_track_resolves_short():
    from compass import picks as P

    idx = pd.bdate_range("2026-11-02", periods=6)
    df = pd.DataFrame({"Open": [100, 99.5, 99, 98, 97, 97], "High": [101, 100, 99.5, 98.5, 97.5, 97.5],
                       "Low": [99, 99, 98.2, 97.5, 96.5, 96.5], "Close": [100, 99.4, 98.6, 98, 97, 97],
                       "Volume": [1] * 6}, index=idx, dtype=float)
    track = {"picks": {"open": [{"sym": "X", "side": "SELL", "date": "2026-11-02", "entry": 100.0,
                                 "target": 98.5, "stop": 108.0, "p": 0.8}], "resolved": []}}
    out = P.update_pick_track(track, {"picks": [], "as_of": "2026-11-09"}, {"X": df},
                              pd.Timestamp("2026-11-10 18:00", tz="Asia/Kolkata").to_pydatetime(), False)
    res = out["picks"]["resolved"]
    assert len(res) == 1 and res[0]["how"] == "target" and res[0]["ret"] > 0
    assert out["picks"]["summary_sell"]["wins"] == 1


def test_intraday_resolve_long_short_and_squareoff():
    from compass import intraday as I

    t = pd.date_range("2026-11-13 09:15", periods=7, freq="h", tz="Asia/Kolkata")
    g = pd.DataFrame({"Open": [100, 97, 96.5, 97, 97.5, 97.6, 97.8], "High": [100.5, 97.2, 97.3, 97.6, 97.9, 98, 98],
                      "Low": [96.8, 96.4, 96.3, 96.8, 97.2, 97.4, 97.5], "Close": [97, 96.6, 97.1, 97.5, 97.7, 97.8, 97.9],
                      "Volume": [1] * 7}, index=t, dtype=float)
    # long entered at bar 1 close (96.6) with +0.5% target -> hits 97.08 on bar 2
    r, how = I._resolve("BUY", g, 1, 0.005, 0.03)
    assert how == "target" and abs(r - (0.005 - I.COST)) < 1e-12
    # short entered at bar 1 close, tiny target never hit, wide stop never hit -> squared off at 15:15 close
    r, how = I._resolve("SELL", g, 1, 0.05, 0.05)
    assert how.startswith("square-off") and abs(r - (1 - 97.9 / 96.6 - I.COST)) < 1e-12
    # a day still running (no 15:15 bar) is not resolved yet
    assert I._resolve("SELL", g.iloc[:4], 1, 0.05, 0.05) is None


def test_intraday_scan_waits_for_completed_entry_bar():
    from compass import intraday as I

    days = pd.bdate_range("2026-09-01", "2026-11-13")
    rows = []
    for d in days:
        for h in range(7):
            ts = pd.Timestamp(d).tz_localize("Asia/Kolkata") + pd.Timedelta(hours=9 + h, minutes=15)
            rows.append((ts, 100.0, 100.5, 99.5, 100.0, 1000.0))
    df = pd.DataFrame(rows, columns=["ts", "Open", "High", "Low", "Close", "Volume"]).set_index("ts")
    last = df.index.normalize() == df.index[-1].normalize()
    df.loc[last, ["Open", "High", "Low", "Close"]] = [97.0, 97.2, 96.0, 96.1]   # 3% gap down, weak first hour
    frames = {"X": df}
    early = pd.Timestamp("2026-11-13 10:40", tz="Asia/Kolkata").to_pydatetime()
    later = pd.Timestamp("2026-11-13 11:20", tz="Asia/Kolkata").to_pydatetime()
    assert not [v for v in I.scan(frames, early)[1] if v["setup"] == "S_GAPDN"]      # 10:15 bar not closed yet
    assert [v for v in I.scan(frames, later)[1] if v["setup"] == "S_GAPDN"]
