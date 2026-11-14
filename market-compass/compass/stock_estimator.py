"""stock_estimator.py -- weather-style probability engine for NSE stocks.

P(up) and P(outperform Nifty) over 5 and 20 trading days from cross-sectionally
ranked price/volume factors; market context (Nifty trend, India VIX) enters as stock x market
interactions. Pooled ensemble of L2 logistic + strongly regularised HistGradientBoosting; yearly expanding walk-forward
with label-overlap purge.  numpy / pandas / scikit-learn only.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

HORIZONS = (5, 20)
COST_RT = 0.0025  # round trip, delivery

RAW_FACTORS = ["mom_12_1", "mom_6m", "mom_3m", "rev_1m", "rev_5d", "dist_sma50", "dist_sma200",
               "hi52", "rs_nifty", "rs_sector", "vol60", "beta", "vol_trend", "rsi14",
               "max_ret_1m", "gap_freq", "sector_mom", "beta_x_trend", "vol_x_vix"]
MARKET = ["mkt_trend", "mkt_mom20", "vix_z", "vix_log"]
# Raw market columns (shared by all stocks) were tested as model inputs and hurt out-of-sample BSS/AUC
# (2021+: AUC 0.47-0.49), so market context enters only through the stock x market interactions.
FEATURES = ["r_" + f for f in RAW_FACTORS]
TARGETS = {"up_5d": ("fwd_5", 5), "out_5d": ("rel_5", 5), "up_20d": ("fwd_20", 20), "out_20d": ("rel_20", 20)}


# ----------------------------------------------------------------------------- panel
def _wide(frames, field, idx):
    return pd.DataFrame({s: f[field] for s, f in frames.items()}).reindex(idx)


def build_panel(frames: dict, nifty: pd.Series, ivix: pd.Series, industries: dict) -> pd.DataFrame:
    """frames: {sym: DataFrame[Open,High,Low,Close,Volume]}; nifty/ivix: daily close.
    Returns long DataFrame indexed (date, sym) with raw factors, ranked features r_*,
    shared market columns and forward targets (NaN where unknown)."""
    nifty = nifty.dropna().astype(float)
    idx = nifty.index
    C, H, O, V = (_wide(frames, k, idx) for k in ("Close", "High", "Open", "Volume"))
    C = C.where(C > 0)
    ret = C.pct_change(fill_method=None)
    m = nifty.reindex(idx)
    mret = m.pct_change()
    f = {}
    f["mom_12_1"] = C.shift(21) / C.shift(252) - 1
    f["mom_6m"] = C / C.shift(126) - 1
    f["mom_3m"] = C / C.shift(63) - 1
    f["rev_1m"] = C / C.shift(21) - 1
    f["rev_5d"] = C / C.shift(5) - 1
    f["dist_sma50"] = C / C.rolling(50, min_periods=40).mean() - 1
    f["dist_sma200"] = C / C.rolling(200, min_periods=150).mean() - 1
    f["hi52"] = C / H.rolling(252, min_periods=200).max()
    # beta (120d) and residual relative strength vs Nifty (63d)
    mm = mret.rolling(120, min_periods=90)
    cov = ret.mul(mret, axis=0).rolling(120, min_periods=90).mean() - \
        ret.rolling(120, min_periods=90).mean().mul(mm.mean(), axis=0)
    beta = cov.div(mm.var(ddof=0), axis=0)
    f["beta"] = beta
    m63 = m / m.shift(63) - 1
    f["rs_nifty"] = f["mom_3m"] - beta.mul(m63, axis=0)
    # sector (leave-one-out industry average)
    ind = pd.Series({s: industries.get(s, "NA") for s in C.columns})

    def loo(x):
        out = pd.DataFrame(index=x.index, columns=x.columns, dtype=float)
        mkt = x.mean(axis=1)
        for g, cols in ind.groupby(ind).groups.items():
            sub = x[list(cols)]
            n = sub.notna().sum(axis=1)
            s = sub.sum(axis=1)
            for c in cols:
                k = n - sub[c].notna()
                v = (s - sub[c].fillna(0)) / k.where(k > 0)
                out[c] = v.fillna(mkt)
        return out

    f["rs_sector"] = f["mom_3m"] - loo(f["mom_3m"])
    f["sector_mom"] = loo(f["mom_6m"])
    f["vol60"] = ret.rolling(60, min_periods=45).std() * np.sqrt(252)
    f["vol_trend"] = np.log(V.rolling(20, min_periods=15).mean() / V.rolling(120, min_periods=90).mean())
    d = C.diff()
    up = d.clip(lower=0).ewm(alpha=1 / 14, min_periods=14).mean()
    dn = (-d).clip(lower=0).ewm(alpha=1 / 14, min_periods=14).mean()
    f["rsi14"] = 100 - 100 / (1 + up / dn)
    f["max_ret_1m"] = ret.rolling(21, min_periods=15).max()
    gap = (O / C.shift(1) - 1).abs()
    f["gap_freq"] = (gap > 0.02).astype(float).where(gap.notna()).rolling(60, min_periods=40).mean()
    # market context
    mk = pd.DataFrame(index=idx)
    mk["mkt_trend"] = m / m.rolling(200, min_periods=150).mean() - 1
    mk["mkt_mom20"] = m / m.shift(20) - 1
    iv = ivix.reindex(idx).ffill(limit=5)
    mk["vix_z"] = (iv - iv.rolling(252, min_periods=120).mean()) / iv.rolling(252, min_periods=120).std()
    mk["vix_log"] = np.log(iv)

    def xrank(x):
        return x.rank(axis=1, pct=True) - 0.5

    R = {k: xrank(v) for k, v in f.items()}
    f["beta_x_trend"] = R["beta"].mul(np.sign(mk["mkt_trend"]), axis=0)
    f["vol_x_vix"] = R["vol60"].mul(mk["vix_z"].clip(-3, 3), axis=0)
    R["beta_x_trend"] = xrank(f["beta_x_trend"])
    R["vol_x_vix"] = xrank(f["vol_x_vix"])
    # targets
    tg = {}
    for h in HORIZONS:
        fw = C.shift(-h) / C - 1
        mf = m.shift(-h) / m - 1
        tg[f"fwd_{h}"] = fw
        tg[f"rel_{h}"] = fw.sub(mf, axis=0)
    cols = {**f, **{"r_" + k: v for k, v in R.items()}, **tg}
    st = {k: v.stack(future_stack=True) for k, v in cols.items()}
    P = pd.DataFrame(st)
    P.index.names = ["date", "sym"]
    P = P[C.stack(future_stack=True).notna().values]
    P = P[P["r_mom_3m"].notna()]
    P = P.join(mk, on="date")
    P["industry"] = P.index.get_level_values("sym").map(ind)
    return P


# ----------------------------------------------------------------------------- model
class _Ensemble:
    """Average of an L2 logistic regression (C=0.01) and a shallow, heavily regularised HGB."""

    def __init__(self, seed=0):
        self.lr = make_pipeline(SimpleImputer(strategy="constant", fill_value=0.0), StandardScaler(),
                                LogisticRegression(C=0.01, max_iter=500))
        self.gb = HistGradientBoostingClassifier(max_iter=150, learning_rate=0.04, max_leaf_nodes=8, max_depth=3,
                                                 min_samples_leaf=1500, l2_regularization=20.0,
                                                 early_stopping=False, random_state=seed)

    def fit(self, X, y):
        self.lr.fit(X, y)
        self.gb.fit(X, y)
        return self

    def predict_proba(self, X):
        return 0.5 * (self.lr.predict_proba(X) + self.gb.predict_proba(X))


def _clf(seed=0):
    return _Ensemble(seed)


def _subsample(df, every=2):
    d = df.index.get_level_values("date")
    u = pd.Index(d.unique()).sort_values()
    keep = set(u[::every])
    return df[d.isin(keep)]


def walk_forward(panel: pd.DataFrame, first_test_year: int = 2019, every: int = 2) -> pd.DataFrame:
    """Yearly refit, expanding window, purged by horizon. Returns OOS p_* per stock-day."""
    dates = pd.Index(panel.index.get_level_values("date").unique()).sort_values()
    dcol = panel.index.get_level_values("date")
    last = dates[-1]
    out = []
    for yr in range(first_test_year, last.year + 1):
        t0 = pd.Timestamp(f"{yr}-01-01")
        test = panel[(dcol >= t0) & (dcol < pd.Timestamp(f"{yr + 1}-01-01"))]
        if test.empty:
            continue
        res = pd.DataFrame(index=test.index)
        pos0 = dates.searchsorted(t0)
        for name, (col, h) in TARGETS.items():
            cut = dates[max(pos0 - h - 1, 0)]  # purge: last training label ends before test start
            tr = panel[(dcol <= cut)].dropna(subset=[col])
            tr = _subsample(tr, every)
            y = (tr[col] > 0).astype(int)
            mdl = _clf().fit(tr[FEATURES].values, y.values)
            res["p_" + name] = mdl.predict_proba(test[FEATURES].values)[:, 1]
            if name.startswith("up"):  # climatology: stock's own historical up-rate (training data)
                cr = y.groupby(tr.index.get_level_values("sym")).mean()
                res["clim_" + name] = test.index.get_level_values("sym").map(cr).fillna(y.mean()).values
            else:
                res["clim_" + name] = 0.5
        out.append(res)
    oos = pd.concat(out)
    return oos.join(panel[[c for c, _ in TARGETS.values()]])


def _verify(p, y, clim):
    m = ~np.isnan(y)
    p, y, clim = p[m], y[m], clim[m]
    b = np.mean((p - y) ** 2)
    bc = np.mean((clim - y) ** 2)
    r = {"n": int(m.sum()), "base_rate": float(y.mean()), "accuracy": float(np.mean((p >= .5) == y)),
         "auc": float(roc_auc_score(y, p)), "brier": float(b), "bss": float(1 - b / bc), "selective": {}}
    for t in (0.65, 0.70, 0.75, 0.80):
        s = p >= t
        r["selective"][f">={t}"] = {"coverage": float(s.mean()), "accuracy": float(y[s].mean()) if s.any() else None,
                                    "n": int(s.sum())}
    for t in (0.35, 0.30, 0.25, 0.20):
        s = p <= t
        r["selective"][f"<={t}"] = {"coverage": float(s.mean()),
                                    "accuracy": float(1 - y[s].mean()) if s.any() else None, "n": int(s.sum())}
    bins = np.clip((p * 10).astype(int), 0, 9)
    r["reliability"] = [{"bin": f"{k / 10:.1f}-{(k + 1) / 10:.1f}", "n": int((bins == k).sum()),
                         "mean_p": float(p[bins == k].mean()), "obs": float(y[bins == k].mean())}
                        for k in range(10) if (bins == k).sum() > 0]
    return r


def top_bottom(oos, pcol="p_out_5d", rcol="fwd_5", step=5, k=10, cost=COST_RT):
    """Every `step` days: equal-weight top-k / bottom-k by pcol, realised rcol, net of turnover costs."""
    d = oos.index.get_level_values("date")
    dates = pd.Index(d.unique()).sort_values()[::step]
    rows, prev_t, prev_b = [], set(), set()
    for dt in dates:
        x = oos.xs(dt, level="date").dropna(subset=[rcol, pcol])
        if len(x) < 3 * k:
            continue
        x = x.sort_values(pcol)
        top, bot = set(x.index[-k:]), set(x.index[:k])
        to_t = 1.0 if not prev_t else len(top - prev_t) / k
        to_b = 1.0 if not prev_b else len(bot - prev_b) / k
        rows.append({"date": dt, "top": x.loc[list(top), rcol].mean() - cost * to_t,
                     "bottom": x.loc[list(bot), rcol].mean() - cost * to_b, "universe": x[rcol].mean()})
        prev_t, prev_b = top, bot
    return pd.DataFrame(rows).set_index("date")


def walk_forward_report(panel: pd.DataFrame, oos: pd.DataFrame | None = None, unseen_from="2021-01-01") -> dict:
    if oos is None:
        oos = walk_forward(panel)
    d = oos.index.get_level_values("date")
    last3 = d.max() - pd.DateOffset(years=3)
    rep = {"periods": {}, "top_bottom": {}}
    for per, mask in {"oos_2019+": d >= "2019-01-01", "unseen_2021+": d >= unseen_from, "last_3y": d >= last3}.items():
        o = oos[mask]
        rep["periods"][per] = {}
        for name, (col, h) in TARGETS.items():
            y = (o[col] > 0).astype(float).where(o[col].notna()).values
            rep["periods"][per][name] = _verify(o["p_" + name].values, y, o["clim_" + name].values)
        tb = top_bottom(o)
        sp = tb["top"] - tb["bottom"]
        rep["top_bottom"][per] = {"weeks": len(tb), "top_avg_5d_net": float(tb["top"].mean()),
                                  "bottom_avg_5d_net": float(tb["bottom"].mean()),
                                  "universe_avg_5d": float(tb["universe"].mean()),
                                  "spread_avg": float(sp.mean()), "spread_hit": float((sp > 0).mean())}
    return rep


# ----------------------------------------------------------------------------- today
def fit_predict_today(panel: pd.DataFrame, every: int = 2) -> list[dict]:
    dcol = panel.index.get_level_values("date")
    today = dcol.max()
    X = panel[dcol == today]
    probs, models = {}, {}
    for name, (col, h) in TARGETS.items():
        tr = _subsample(panel.dropna(subset=[col]), every)
        mdl = _clf().fit(tr[FEATURES].values, (tr[col] > 0).astype(int).values)
        models[name] = mdl
        probs[name] = mdl.predict_proba(X[FEATURES].values)[:, 1]
    tr = _subsample(panel.dropna(subset=["fwd_20"]), every)
    yr = tr["fwd_20"].clip(*tr["fwd_20"].quantile([.01, .99]))
    reg = HistGradientBoostingRegressor(max_iter=150, learning_rate=0.04, max_leaf_nodes=8, max_depth=3,
                                        min_samples_leaf=1500, l2_regularization=20.0,
                                        early_stopping=False).fit(tr[FEATURES].values, yr.values)
    exp20 = reg.predict(X[FEATURES].values)
    # drivers: change in p_outperform_20d when each stock-specific feature is set to neutral (0)
    base = probs["out_20d"]
    Xv = X[FEATURES].values
    contrib = np.zeros((len(X), len(RAW_FACTORS)))
    for j, fn in enumerate(RAW_FACTORS):
        Z = Xv.copy()
        Z[:, j] = 0.0
        contrib[:, j] = base - models["out_20d"].predict_proba(Z)[:, 1]
    out = []
    for i, sym in enumerate(X.index.get_level_values("sym")):
        order = np.argsort(-np.abs(contrib[i]))[:3]
        out.append({"symbol": sym, "date": str(today.date()),
                    "p_up_20d": round(float(probs["up_20d"][i]), 4),
                    "p_outperform_20d": round(float(probs["out_20d"][i]), 4),
                    "p_up_5d": round(float(probs["up_5d"][i]), 4),
                    "p_outperform_5d": round(float(probs["out_5d"][i]), 4),
                    "expected_20d_return": round(float(exp20[i]), 4),
                    "top_drivers": [{"factor": RAW_FACTORS[j], "value": float(X[RAW_FACTORS[j]].iloc[i]),
                                     "effect_on_p_out20": round(float(contrib[i, j]), 4)} for j in order]})
    return sorted(out, key=lambda r: -r["p_outperform_20d"])


def load_px_pickle(path):
    """Helper for the research pickle {'syms':{sym:industry}, 'px': MultiIndex (field, 'SYM.NS')}."""
    d = pd.read_pickle(path)
    px = d["px"]
    frames = {}
    for t in px.columns.get_level_values(1).unique():
        frames[t.replace(".NS", "")] = px.xs(t, axis=1, level=1)
    return frames, d["syms"]


if __name__ == "__main__":
    import sys, time, json
    t = time.time()
    frames, inds = load_px_pickle(sys.argv[1])
    raw = pd.read_pickle(sys.argv[2])
    P = build_panel(frames, raw["nifty"]["Close"], raw["ivix"]["Close"], inds)
    print("panel", P.shape, round(time.time() - t, 1), "s")
    rep = walk_forward_report(P)
    print(json.dumps({k: {t: {m: v[m] for m in ("auc", "bss", "accuracy")} for t, v in d.items()}
                      for k, d in rep["periods"].items()}, indent=1))
    print(json.dumps(fit_predict_today(P)[:3], indent=1))
    print("total", round(time.time() - t, 1), "s")
