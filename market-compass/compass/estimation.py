"""Estimation Engine: weather-forecast-style probabilities for Nifty and for each stock, with their report cards.

Nifty (nifty_estimator.py): 40 factors (momentum, volatility, India/US VIX, global markets, FX, crude, gold,
copper, US rates, calendar). Regularised logistic/ridge model, walk-forward verified each year since 2014 and
scored like a weather forecast (Brier Skill Score vs climatology). Nov 2026 result: no factor survived the
multiple-testing correction and no horizon beat climatology, so the headline is climatology (the historical
up-rate) and the model's number is shown only as a small tilt.

Stocks (stock_estimator.py): 19 cross-sectional factors on 150 stocks. Verified on 2021+: AUC about 0.51, confident
calls almost never issued; what works is a ranking (top vs bottom 10% outperform about 53% of the time; the top-10
minus bottom-10 spread was about +0.33% a week after costs). Two factors held out of sample: 12-1 month
momentum and 5-day reversal.

Heavy models: recomputed at most once an hour; other refreshes reuse the previous result.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

from . import history as HL
from . import nifty_estimator as NE
from . import stock_estimator as SE

REPORT = Path(__file__).resolve().parent.parent / "data" / "stock_estimator_report.json"


def _r(x, n=4):
    try:
        f = float(x)
        return None if np.isnan(f) else round(f, n)
    except (TypeError, ValueError):
        return None


def nifty_part() -> dict:
    raw = {k: pd.DataFrame({"Close": v}) for k, v in HL.load().items()}
    F = NE.build_features(raw, None)
    today = NE.fit_predict_today(F)
    rep = NE.walk_forward_report(F, models=("full",))
    out = {"asof": today["asof"], "close": round(today["close"], 1), "horizons": {}}
    for h in NE.HORIZONS:
        t = today[h]
        card = {}
        for per, v in rep[h]["full"].items():
            card[per] = {"n": v["n"], "accuracy": _r(v["accuracy"]), "always_up": _r(v["acc_always_up"]),
                         "auc": _r(v["auc"]), "bss": _r(v["bss"]), "dm_p": _r(v["dm_p"]),
                         "selective": {k: {kk: _r(vv) if isinstance(vv, float) else vv for kk, vv in s.items()
                                           if kk in ("coverage", "n", "accuracy", "base", "binom_p_overlap_adj")}
                                       for k, s in v["selective"].items()}}
        out["horizons"][str(h)] = {
            "p_up": _r(t["p_up"]), "p_clim": _r(t["p_clim"]), "exp_return": _r(t["exp_return"]),
            "exp_return_clim": _r(t["exp_return_clim"]),
            "interval80": [_r(x) for x in t["interval80"]], "level80": [_r(x, 1) for x in t["level80"]],
            "drivers": [[k, _r(v, 3), _r(t["top_factor_values"].get(k), 4)] for k, v in t["top_contrib_logodds"].items()],
            "card": card, "period": rep[h]["period"]}
    return out


def stock_part(frames: dict, industries: dict) -> dict:
    nf = HL.load()
    panel = SE.build_panel(frames, nf["nifty"], nf["ivix"], industries)
    preds = SE.fit_predict_today(panel)
    ranked = sorted(preds, key=lambda r: -r["p_outperform_5d"])
    k = max(1, len(ranked) // 10)
    rep = json.loads(REPORT.read_text()) if REPORT.exists() else {}
    return {"asof": preds[0]["date"] if preds else None, "n": len(preds),
            "top": ranked[:10], "bottom": ranked[-10:][::-1], "top_decile": [r["symbol"] for r in ranked[:k]],
            "all": {r["symbol"]: {kk: r[kk] for kk in ("p_up_20d", "p_outperform_20d", "p_up_5d", "p_outperform_5d",
                                                        "expected_20d_return")} for r in preds},
            "report": rep}


def build(now: datetime, frames: dict, industries: dict, previous: dict | None) -> dict:
    """Reuse the previous result if it is under 55 minutes old (the models are heavy and use daily data)."""
    if previous and previous.get("computed_at"):
        try:
            age = pd.Timestamp(now) - pd.Timestamp(previous["computed_at"])
            if age < pd.Timedelta(minutes=55) and not previous.get("error"):
                return {**previous, "reused": True}
        except Exception:
            pass
    out = {"computed_at": pd.Timestamp(now).isoformat(timespec="minutes")}
    try:
        out["nifty"] = nifty_part()
    except Exception as exc:
        out["nifty"] = {"error": f"Nifty estimator failed: {exc}"}
    try:
        out["stocks"] = stock_part(frames, industries)
    except Exception as exc:
        out["stocks"] = {"error": f"Stock estimator failed: {exc}"}
    return out
