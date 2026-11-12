"""History Lab: "when the world looked like today, what happened next?"

1. Analogs: the 10 past days (since 2008) whose state was most similar to today: Nifty trend and drawdown,
   India VIX, USD/INR, gold, Brent, copper, dollar index, US 10y and 3m yields and the yield curve,
   S&P 500 and US VIX. Shows what Nifty did 5, 20 and 60 trading days after each. A walk-forward
   test (recomputed every build, using only data available at each date) measures whether these
   analogs beat simply assuming "the market usually goes up". In the Nov 2026 study they did NOT,
   and the page says so.
2. Event history: named cause -> effect events (rupee crash, crude spike/crash, VIX panic, gold surge,
   yield jumps, S&P crash...). For each: every past episode since 2007 and the Nifty outcome, split into
   2007-2016 and 2016-now. "Consistent" only when both halves point the same way vs normal.
3. Risk range: India VIX predicted next-month volatility best in tests (corr 0.59 vs 0.44 for analogs),
   so the expected 20-day Nifty range comes from India VIX, with its historical hit rate.
"""
from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd

TICKERS = {"nifty": "^NSEI", "ivix": "^INDIAVIX", "usdinr": "INR=X", "gold": "GC=F", "brent": "BZ=F",
           "dxy": "DX-Y.NYB", "us10y": "^TNX", "us3m": "^IRX", "spx": "^GSPC", "copper": "HG=F", "usvix": "^VIX"}
INDIAN = ("nifty", "ivix")
SPLIT = pd.Timestamp("2016-11-01")
DESCR = {
    "n_r20": ("Nifty 1-month return", "pct"), "n_r60": ("Nifty 3-month return", "pct"),
    "n_dd": ("Nifty below 1-year high", "pct"), "n_d200": ("Nifty vs 200-day avg", "pct"),
    "n_vol20": ("Nifty volatility (annual)", "pct"), "ivix": ("India VIX", "num"), "ivix_c20": ("India VIX 1-month change", "logpct"),
    "inr_r20": ("USD/INR 1-month change", "pct"), "inr_r60": ("USD/INR 3-month change", "pct"),
    "gold_r20": ("Gold 1-month change", "pct"), "gold_r60": ("Gold 3-month change", "pct"),
    "brent_r20": ("Brent 1-month change", "pct"), "brent_r60": ("Brent 3-month change", "pct"),
    "dxy_r20": ("Dollar index 1-month change", "pct"), "us10y": ("US 10y yield", "num"),
    "us10y_d60": ("US 10y 3-month change (pts)", "num"), "us3m": ("US 3m yield", "num"), "curve": ("US curve 10y−3m", "num"),
    "spx_r20": ("S&P 500 1-month return", "pct"), "spx_d200": ("S&P 500 vs 200-day avg", "pct"),
    "copper_r20": ("Copper 1-month change", "pct"), "usvix": ("US VIX", "num"),
}
EVENTS = [
    ("Nifty fell 10%+ from its 1-year high", lambda F: F.n_dd <= -0.10),
    ("Nifty fell 20%+ from its 1-year high", lambda F: F.n_dd <= -0.20),
    ("Nifty up 10%+ in 3 months (strong rally)", lambda F: F.n_r60 >= 0.10),
    ("India VIX above 25 (panic)", lambda F: F.ivix >= 25),
    ("India VIX jumped 30%+ in a month", lambda F: F.ivix_c20 >= np.log(1.3)),
    ("Rupee fell 3%+ vs dollar in a month", lambda F: F.inr_r20 >= 0.03),
    ("Rupee rose 2%+ vs dollar in a month", lambda F: F.inr_r20 <= -0.02),
    ("Crude oil up 20%+ in a month", lambda F: F.brent_r20 >= 0.20),
    ("Crude oil down 20%+ in a month", lambda F: F.brent_r20 <= -0.20),
    ("Gold up 8%+ in a month (fear trade)", lambda F: F.gold_r20 >= 0.08),
    ("Dollar index up 3%+ in a month", lambda F: F.dxy_r20 >= 0.03),
    ("US 10y yield up 0.75 pts in 3 months", lambda F: F.us10y_d60 >= 0.75),
    ("US 10y yield down 0.75 pts in 3 months", lambda F: F.us10y_d60 <= -0.75),
    ("US yield curve inverted (10y below 3m)", lambda F: F.curve < 0),
    ("S&P 500 fell 10%+ in a month", lambda F: F.spx_r20 <= -0.10),
    ("US VIX above 30", lambda F: F.usvix >= 30),
    ("Copper up 10%+ in a month", lambda F: F.copper_r20 >= 0.10),
    ("Copper down 10%+ in a month", lambda F: F.copper_r20 <= -0.10),
]


def load() -> dict:
    import yfinance as yf

    out = {}
    for k, t in TICKERS.items():
        df = yf.Ticker(t).history(period="max", interval="1d", auto_adjust=False)
        if df is None or df.empty:
            continue
        df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
        out[k] = df["Close"].dropna()
    return out


def features(raw: dict) -> tuple[pd.DataFrame, pd.Series]:
    N = raw["nifty"]
    idx = N.index

    def asof(k):
        s = raw[k]
        if k not in INDIAN:          # a US/global close on date D is only known at the Indian close of D+1
            s = s.copy()
            s.index = s.index + pd.Timedelta(days=1)
        return s.reindex(idx.union(s.index)).ffill().reindex(idx)

    s = {k: asof(k) for k in raw}
    F = pd.DataFrame(index=idx)
    F["n_r20"], F["n_r60"] = N.pct_change(20), N.pct_change(60)
    F["n_dd"] = N / N.rolling(252, min_periods=60).max() - 1
    F["n_d200"] = N / N.rolling(200).mean() - 1
    F["n_vol20"] = np.log(N).diff().rolling(20).std() * np.sqrt(252)
    F["ivix"], F["ivix_c20"] = s["ivix"], np.log(s["ivix"]).diff(20)
    F["inr_r20"], F["inr_r60"] = s["usdinr"].pct_change(20), s["usdinr"].pct_change(60)
    F["gold_r20"], F["gold_r60"] = s["gold"].pct_change(20), s["gold"].pct_change(60)
    F["brent_r20"], F["brent_r60"] = s["brent"].pct_change(20), s["brent"].pct_change(60)
    F["dxy_r20"] = s["dxy"].pct_change(20)
    F["us10y"], F["us10y_d60"], F["us3m"] = s["us10y"], s["us10y"].diff(60), s["us3m"]
    F["curve"] = s["us10y"] - s["us3m"]
    F["spx_r20"] = s["spx"].pct_change(20)
    F["spx_d200"] = s["spx"] / s["spx"].rolling(200).mean() - 1
    F["copper_r20"], F["usvix"] = s["copper"].pct_change(20), s["usvix"]
    return F.dropna(), N


def _nearest(F: pd.DataFrame, t_i: int, h: int, K: int, gap: int = 15) -> np.ndarray | None:
    hist = F.iloc[: t_i + 1]
    Z = ((F - hist.mean()) / hist.std().replace(0, 1)).values
    cand = np.arange(0, max(0, t_i - h))
    if len(cand) < 300:
        return None
    d = np.sqrt(((Z[cand] - Z[t_i]) ** 2).mean(axis=1))
    pick = []
    for j in cand[np.argsort(d)]:
        if all(abs(j - p) > gap for p in pick):
            pick.append(j)
        if len(pick) == K:
            break
    return np.array(pick), d


def _fmt_state(row: pd.Series) -> dict:
    return {k: (None if pd.isna(row[k]) else round(float(row[k]), 4)) for k in DESCR}


def walk_forward(F: pd.DataFrame, fwd: dict, h: int, step: int = 5, K: int = 25) -> dict:
    y = fwd[h].values
    rows = []
    for i in range(0, len(F), step):
        if F.index[i] < pd.Timestamp("2013-01-01") or np.isnan(y[i]):
            continue
        r = _nearest(F, i, h, K)
        if r is None:
            continue
        a = r[0]
        base = float(np.nanmean(y[: max(0, i - h)] > 0))
        rows.append((float(np.nanmean(y[a] > 0)), base, y[i] > 0))
    if not rows:
        return {}
    p, b, up = (np.array(x, dtype=float) for x in zip(*rows))
    return {"n": len(rows), "hit": round(float(((p > 0.5) == up).mean()), 3),
            "hit_always_up": round(float(((b > 0.5) == up).mean()), 3),
            "brier": round(float(((p - up) ** 2).mean()), 4), "brier_base": round(float(((b - up) ** 2).mean()), 4)}


def build(now: datetime) -> dict:
    raw = load()
    F, N = features(raw)
    fwd = {h: (N.shift(-h) / N - 1).reindex(F.index) for h in (5, 20, 60)}
    t_i = len(F) - 1

    # ---- analogs for today
    a, dist = _nearest(F, t_i, 20, 10)   # only past days whose next 20 days are already known
    analogs = []
    for j in a:
        analogs.append({"date": str(F.index[j].date()), "similarity": round(float(1 / (1 + dist[j])), 3),
                        "nifty": round(float(N.loc[F.index[j]]), 1),
                        "state": _fmt_state(F.iloc[j]),
                        "after": {str(h): (None if np.isnan(fwd[h].iloc[j]) else round(float(fwd[h].iloc[j]), 4)) for h in (5, 20, 60)}})
    a25 = _nearest(F, t_i, 60, 25)[0]
    summary = {}
    for h in (5, 20, 60):
        v = fwd[h].values[a25]
        v = v[~np.isnan(v)]
        base = fwd[h].dropna()
        summary[str(h)] = {"n": int(len(v)), "up": round(float((v > 0).mean()), 3), "median": round(float(np.median(v)), 4),
                           "p10": round(float(np.percentile(v, 10)), 4), "p90": round(float(np.percentile(v, 90)), 4),
                           "base_up": round(float((base > 0).mean()), 3), "base_median": round(float(base.median()), 4)}
    test = {str(h): walk_forward(F, fwd, h) for h in (20, 60)}

    # ---- event history
    events, today = [], F.index[-1]
    for name, fn in EVENTS:
        mask = fn(F).fillna(False).values
        eps, last = [], -10 ** 9
        for i, v in enumerate(mask):
            if v and i - last > 20:
                eps.append(i)
            if v:
                last = i
        active = bool(mask[-20:].any())
        rows = [{"date": str(F.index[i].date()), "after20": None if np.isnan(fwd[20].iloc[i]) else round(float(fwd[20].iloc[i]), 4),
                 "after60": None if np.isnan(fwd[60].iloc[i]) else round(float(fwd[60].iloc[i]), 4)} for i in eps]

        def stat(sel, h):
            v = np.array([r[f"after{h}"] for r in sel if r[f"after{h}"] is not None])
            return {"n": int(len(v)), "up": None if not len(v) else round(float((v > 0).mean()), 3),
                    "median": None if not len(v) else round(float(np.median(v)), 4)}
        old = [r for r in rows if pd.Timestamp(r["date"]) < SPLIT]
        new = [r for r in rows if pd.Timestamp(r["date"]) >= SPLIT]
        st = {}
        for h in (20, 60):
            so, sn = stat(old, h), stat(new, h)
            bo = float((fwd[h][F.index < SPLIT] > 0).mean())
            bn = float((fwd[h][F.index >= SPLIT] > 0).mean())
            verdict = "too few cases"
            if so["n"] >= 5 and sn["n"] >= 5:
                do, dn = so["up"] - bo, sn["up"] - bn
                verdict = ("consistently better than normal" if do >= 0.08 and dn >= 0.08 else
                           "consistently worse than normal" if do <= -0.08 and dn <= -0.08 else "inconsistent")
            st[str(h)] = {"old": so, "new": sn, "base_old": round(bo, 3), "base_new": round(bn, 3), "verdict": verdict}
        events.append({"name": name, "active": active, "episodes": rows[-12:], "n_episodes": len(rows), "stats": st})

    # ---- India VIX risk range (and its historical hit rate)
    v = F["ivix"]
    sigma20 = v / 100 * np.sqrt(20 / 252)
    inside = (fwd[20].abs() <= sigma20).dropna()
    last_n = float(N.iloc[-1])
    sig = float(sigma20.iloc[-1])
    return {
        "as_of": str(today.date()), "nifty": round(last_n, 1), "today_state": _fmt_state(F.iloc[-1]),
        "descr": {k: {"label": l, "kind": kd} for k, (l, kd) in DESCR.items()},
        "analogs": analogs, "analog_summary": summary, "analog_test": test,
        "events": events,
        "risk": {"ivix": round(float(v.iloc[-1]), 2), "sigma20": round(sig, 4),
                 "lo": round(last_n * (1 - sig), 1), "hi": round(last_n * (1 + sig), 1),
                 "lo2": round(last_n * (1 - 2 * sig), 1), "hi2": round(last_n * (1 + 2 * sig), 1),
                 "hit_1sigma": round(float(inside.mean()), 3), "n": int(len(inside))},
        "first_date": str(F.index[0].date()),
    }
