"""Run with:  python -m pytest tests -q   (uses synthetic data, no internet needed)."""
import os
from datetime import date

os.environ["COMPASS_DEMO"] = "1"

import numpy as np  # noqa: E402

from compass import data as D, events as E, scorecard as S, stock_model as M  # noqa: E402
from compass.stocks import to_yahoo  # noqa: E402


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


def test_auto_scores_from_snapshot():
    snap = D.macro_snapshot()
    for f in S.FACTORS:
        if f.auto:
            s, reason = S.auto_score(f.key, snap, D.fii_dii())
            assert s in (-1, 0, 1, None) and reason


def test_labels_never_cross_days():
    df = D.history("TEST.NS", "60d", "60m")
    y, fwd = M.make_labels(df, 3)
    day = np.array(df.index.date)
    for i in np.where(fwd.notna().to_numpy())[0][:200]:
        assert day[i] == day[i + 3]


def test_features_have_no_lookahead():
    df = D.history("TEST.NS", "200d", "60m")
    full = M.build_features(df)
    part = M.build_features(df.iloc[:-50])
    common = part.index[-100:]
    np.testing.assert_allclose(full.loc[common, M.FEATURES].to_numpy(),
                               part.loc[common, M.FEATURES].to_numpy(), rtol=1e-9, atol=1e-12)


def test_prediction_is_sane():
    df = D.history("RELIANCE.NS", "730d", "60m")
    idx = D.history("^NSEI", "730d", "60m")
    for h in (1, 2, "close"):
        p = M.predict(df, idx, h)
        assert p.ok and 0.05 <= p.p_up <= 0.95 and 0 <= p.reliability <= 1
        assert p.range_lo <= p.range_mid <= p.range_hi


def test_short_history_is_refused():
    df = D.history("RELIANCE.NS", "20d", "60m")
    assert not M.predict(df, None, 2).ok


def test_calendar():
    up = E.upcoming(date(2026, 11, 11), 30)
    assert len(up) > 5 and up["date"].min() >= date(2026, 11, 11)
