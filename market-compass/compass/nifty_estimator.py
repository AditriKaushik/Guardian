"""
nifty_estimator.py -- weather-forecast-style estimation engine for the Nifty 50.

Gives, for horizons of 1, 5 and 20 trading days, a calibrated P(up), an expected
log return, an 80% interval and today's top factor contributions, plus
meteorological verification (Brier, BSS vs climatology, reliability, selective
accuracy) from an annual walk-forward with an embargo.

Dependencies: numpy, pandas, scipy, scikit-learn (statsmodels is NOT required;
Newey-West HAC is implemented here).

Alignment: every non-Indian series dated D is shifted to be usable only from
Indian date D+1 (as-of join after a +1 calendar-day shift). Nifty, India VIX
and the NSE stock panel are same-day (known at the Indian close).
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.metrics import roc_auc_score

HORIZONS = (1, 5, 20)
DESIGN = ("2008-07-01", "2016-12-31")
TEST_START = "2017-01-01"
WF_START_YEAR = 2014
LOGIT_C = 0.05        # strong L2 shrinkage on standardised features (fixed a priori)
RIDGE_ALPHA = 500.0
INDIAN = {"nifty", "ivix", "banknifty"}


# ----------------------------------------------------------------------------- features
def _rsi(c: pd.Series, n: int) -> pd.Series:
    d = c.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn.replace(0, np.nan))


def _expiry_dates(idx: pd.DatetimeIndex) -> pd.DatetimeIndex:
    """Monthly F&O expiry: last Thursday (to Aug-2025), last Tuesday (from Sep-2025)."""
    out = []
    for p in pd.period_range(idx.min() - pd.Timedelta(days=31), idx.max() + pd.Timedelta(days=62), freq="M"):
        last = p.to_timestamp(how="end").normalize()
        wd = 1 if last >= pd.Timestamp("2025-09-01") else 3
        out.append(last - pd.Timedelta(days=(last.weekday() - wd) % 7))
    return pd.DatetimeIndex(out)


def _asof_global(s: pd.Series, idx: pd.DatetimeIndex) -> pd.Series:
    """Value dated D usable from Indian date D+1."""
    s = s.dropna().copy()
    s.index = s.index + pd.Timedelta(days=1)
    s = s[~s.index.duplicated(keep="last")]
    return s.reindex(s.index.union(idx)).ffill().reindex(idx)


def _breadth(bpx: dict, idx: pd.DatetimeIndex) -> pd.DataFrame:
    px = bpx["px"] if isinstance(bpx, dict) else bpx
    c = px["Close"].sort_index()
    c = c[~c.index.duplicated()]
    c = c.reindex(c.index.union(idx)).loc[:idx.max()]
    c = c.loc[c.notna().sum(axis=1) > 20]
    valid = c.notna()
    n = valid.sum(axis=1)
    s50 = c.rolling(50, min_periods=50).mean()
    s200 = c.rolling(200, min_periods=200).mean()
    hi = c.rolling(252, min_periods=200).max()
    lo = c.rolling(252, min_periods=200).min()
    r = c.pct_change(fill_method=None)
    adv, dec = (r > 0).sum(axis=1), (r < 0).sum(axis=1)
    b = pd.DataFrame(index=c.index)
    b["br_above50"] = (c > s50).sum(axis=1) / s50.notna().sum(axis=1).replace(0, np.nan)
    b["br_above200"] = (c > s200).sum(axis=1) / s200.notna().sum(axis=1).replace(0, np.nan)
    b["br_ad1"] = (adv - dec) / n
    b["br_ad5"] = b["br_ad1"].rolling(5).mean()
    b["br_nhnl"] = ((c >= hi).sum(axis=1) - (c <= lo).sum(axis=1)) / hi.notna().sum(axis=1).replace(0, np.nan)
    return b.reindex(idx)


def build_features(raw: dict, breadth_px: dict | None = None) -> pd.DataFrame:
    """Return a DataFrame on Nifty trading dates: factor columns + 'close'
    + forward targets 'y{h}' (log return t->t+h, NaN where unknown)."""
    nf = raw["nifty"]["Close"].dropna()
    nf = nf[~nf.index.duplicated(keep="last")].sort_index()
    idx = nf.index
    lc = np.log(nf)
    r1 = lc.diff()
    F = pd.DataFrame(index=idx)
    # momentum / mean reversion
    for k in (1, 5, 20, 60, 120):
        F[f"mom_r{k}"] = lc.diff(k)
    for k in (20, 50, 200):
        F[f"dist_sma{k}"] = nf / nf.rolling(k).mean() - 1
    F["rsi2"] = _rsi(nf, 2)
    F["rsi14"] = _rsi(nf, 14)
    F["dd52w"] = nf / nf.rolling(252, min_periods=200).max() - 1
    # volatility
    F["rv10"] = r1.rolling(10).std() * np.sqrt(252)
    F["rv20"] = r1.rolling(20).std() * np.sqrt(252)
    if "ivix" in raw:
        iv = raw["ivix"]["Close"].dropna()
        iv = iv[~iv.index.duplicated(keep="last")].reindex(idx).ffill(limit=3)
        F["ivix"] = iv
        F["ivix_z252"] = (iv - iv.rolling(252, min_periods=200).mean()) / iv.rolling(252, min_periods=200).std()
        F["ivix_ch5"] = np.log(iv).diff(5)
        F["ivix_ch20"] = np.log(iv).diff(20)
        F["ivix_minus_rv20"] = iv / 100 - F["rv20"]
    g = {k: _asof_global(v["Close"], idx) for k, v in raw.items() if k not in INDIAN and "Close" in v}
    if "usvix" in g:
        F["usvix"] = g["usvix"]
    # global (all lagged one Indian day by construction)
    def glog(name, k):
        s = raw[name]["Close"].dropna()
        s = s[~s.index.duplicated(keep="last")]
        return _asof_global(np.log(s).diff(k), idx)
    if "spx" in raw:
        for k in (1, 5, 20):
            F[f"spx_r{k}"] = glog("spx", k)
    for name in ("dxy", "usdinr", "brent", "gold", "copper"):
        if name in raw:
            F[f"{name}_r20"] = glog(name, 20)
    if "usdinr" in raw:
        F["usdinr_r5"] = glog("usdinr", 5)
    if "us10y" in g:
        F["us10y"] = g["us10y"]
        s = raw["us10y"]["Close"].dropna()
        F["us10y_ch20"] = _asof_global(s.diff(20), idx)
        if "us3m" in g:
            F["curve_10y3m"] = g["us10y"] - g["us3m"]
    # breadth
    if breadth_px is not None:
        F = F.join(_breadth(breadth_px, idx))
    # calendar
    F["dow"] = idx.dayofweek.astype(float)
    F["month"] = idx.month.astype(float)
    exp = _expiry_dates(idx)
    nxt = exp[np.searchsorted(exp.values, idx.values, side="left")]
    F["days_to_expiry"] = np.busday_count(idx.values.astype("datetime64[D]"), nxt.values.astype("datetime64[D]")).astype(float)
    dom = pd.Series(1, index=idx).groupby([idx.year, idx.month]).cumcount()
    dom_rev = pd.Series(1, index=idx).iloc[::-1].groupby([idx[::-1].year, idx[::-1].month]).cumcount().iloc[::-1]
    F["turn_of_month"] = ((dom.values < 5) | (dom_rev.values < 5)).astype(float)
    F = F.replace([np.inf, -np.inf], np.nan)
    F["close"] = nf
    for h in HORIZONS:
        F[f"y{h}"] = lc.shift(-h) - lc
    return F


def factor_cols(F: pd.DataFrame) -> list:
    return [c for c in F.columns if c != "close" and not (c.startswith("y") and c[1:].isdigit())]


# ----------------------------------------------------------------------------- univariate stats
def nw_tstat(x: np.ndarray, y: np.ndarray, lags: int):
    """OLS slope of y on x with Newey-West (Bartlett) HAC standard error."""
    m = np.isfinite(x) & np.isfinite(y)
    x, y = x[m], y[m]
    n = len(x)
    if n < 50 or np.std(x) == 0:
        return np.nan, np.nan, n
    X = np.column_stack([np.ones(n), x])
    XtXi = np.linalg.inv(X.T @ X)
    b = XtXi @ X.T @ y
    u = y - X @ b
    Z = X * u[:, None]
    S = Z.T @ Z
    for L in range(1, lags + 1):
        w = 1 - L / (lags + 1)
        G = Z[L:].T @ Z[:-L]
        S += w * (G + G.T)
    V = XtXi @ S @ XtXi
    return b[1], b[1] / np.sqrt(V[1, 1]), n


def bh_fdr(p: np.ndarray, q: float = 0.10) -> np.ndarray:
    p = np.asarray(p, float)
    ok = np.isfinite(p)
    out = np.zeros(len(p), bool)
    ps = p[ok]
    m = len(ps)
    if m == 0:
        return out
    o = np.argsort(ps)
    thr = q * np.arange(1, m + 1) / m
    passed = ps[o] <= thr
    k = np.max(np.where(passed)[0]) + 1 if passed.any() else 0
    sel = np.zeros(m, bool)
    sel[o[:k]] = True
    out[np.where(ok)[0]] = sel
    return out


def _lags(h):
    return max(5, int(np.ceil(1.5 * h)))


def univariate_table(F: pd.DataFrame, start=DESIGN[0], end=DESIGN[1], test_start=TEST_START, q=0.10) -> pd.DataFrame:
    rows = []
    cols = factor_cols(F)
    for h in HORIZONS:
        for part, (a, b) in {"design": (start, end), "test": (test_start, None)}.items():
            D = F.loc[a:b]
            y = D[f"y{h}"].values
            for c in cols:
                x = D[c].values
                m = np.isfinite(x) & np.isfinite(y)
                if m.sum() < 100:
                    rows.append(dict(h=h, part=part, factor=c, n=int(m.sum())))
                    continue
                pr = stats.pearsonr(x[m], y[m])[0]
                sr = stats.spearmanr(x[m], y[m])[0]
                slope, t, n = nw_tstat(x, y, _lags(h))
                rows.append(dict(h=h, part=part, factor=c, n=n, pearson=pr, spearman=sr, slope=slope, t_nw=t,
                                 p=2 * stats.norm.sf(abs(t))))
    U = pd.DataFrame(rows)
    W = U.pivot_table(index=["h", "factor"], columns="part", values=["pearson", "spearman", "t_nw", "p", "n"])
    W.columns = [f"{a}_{b}" for a, b in W.columns]
    W = W.reset_index()
    W["fdr_design"] = False
    for h in HORIZONS:
        mh = W["h"] == h
        W.loc[mh, "fdr_design"] = bh_fdr(W.loc[mh, "p_design"].values, q)
    W["same_sign_test"] = np.sign(W["t_nw_design"]) == np.sign(W["t_nw_test"])
    W["holds_oos"] = W["fdr_design"] & W["same_sign_test"] & (W["p_test"] < 0.10)
    return W


def _select_fdr(D: pd.DataFrame, cols, h, q=0.10):
    p = []
    y = D[f"y{h}"].values
    for c in cols:
        _, t, n = nw_tstat(D[c].values, y, _lags(h))
        p.append(2 * stats.norm.sf(abs(t)) if np.isfinite(t) else np.nan)
    sel = [c for c, s in zip(cols, bh_fdr(np.array(p), q)) if s]
    return sel


# ----------------------------------------------------------------------------- model
class _Std:
    def fit(self, X: pd.DataFrame):
        self.med = X.median()
        Xf = X.fillna(self.med)
        self.mu, self.sd = Xf.mean(), Xf.std().replace(0, 1).fillna(1)
        return self

    def transform(self, X: pd.DataFrame):
        Z = ((X.fillna(self.med) - self.mu) / self.sd).clip(-5, 5)
        return Z.fillna(0.0).values


def _fit(D: pd.DataFrame, cols, h):
    st = _Std().fit(D[cols])
    Z = st.transform(D[cols])
    y = D[f"y{h}"].values
    lg = LogisticRegression(C=LOGIT_C, max_iter=500).fit(Z, (y > 0).astype(int))
    rg = Ridge(alpha=RIDGE_ALPHA).fit(Z, y)
    sig = np.sqrt(h) * D["rv20"].values / np.sqrt(252) if "rv20" in D else np.full(len(D), np.std(y))
    res = (y - rg.predict(Z)) / np.where(np.isfinite(sig) & (sig > 0), sig, np.nanmedian(sig))
    return dict(st=st, lg=lg, rg=rg, cols=cols, rq=np.nanquantile(res, [0.10, 0.90]))


def walk_forward(F: pd.DataFrame, h: int, sets=("full", "sig"), start_year=WF_START_YEAR,
                 train_start=DESIGN[0], q=0.10) -> pd.DataFrame:
    """Annual expanding-window walk-forward. Train on rows dated <= Dec Y-1 whose
    targets are fully realised before Jan 1 of Y (embargo of h rows), predict Y."""
    cols = factor_cols(F)
    F = F.loc[train_start:]
    yk = f"y{h}"
    out = []
    years = sorted(set(F.index.year))
    for Y in [y for y in years if y >= start_year]:
        tr = F.loc[:f"{Y-1}-12-31"]
        tr = tr.iloc[:-h] if h > 0 else tr          # embargo: drop rows whose target crosses into Y
        tr = tr[tr[yk].notna()]
        te = F.loc[f"{Y}-01-01":f"{Y}-12-31"]
        te = te[te[yk].notna()]
        if len(te) == 0:
            continue
        o = pd.DataFrame(index=te.index)
        o["y"] = te[yk]
        o["up"] = (te[yk] > 0).astype(int)
        # climatology: up-rate of all targets realised by date t (expanding, no look-ahead)
        allup = (F[yk] > 0).astype(float).where(F[yk].notna())
        clim = allup.shift(h).expanding(min_periods=250).mean()
        o["p_clim"] = clim.reindex(te.index).values
        o["r_clim"] = F[yk].shift(h).expanding(min_periods=250).mean().reindex(te.index).values
        for s in sets:
            use = cols if s == "full" else _select_fdr(tr, cols, h, q)
            if len(use) == 0:
                o[f"p_{s}"], o[f"r_{s}"] = o["p_clim"], o["r_clim"]
                continue
            m = _fit(tr, use, h)
            Z = m["st"].transform(te[use])
            o[f"p_{s}"] = m["lg"].predict_proba(Z)[:, 1]
            o[f"r_{s}"] = m["rg"].predict(Z)
            o[f"nfeat_{s}"] = len(use)
        out.append(o)
    return pd.concat(out)


# ----------------------------------------------------------------------------- verification
def _brier(p, o):
    return float(np.mean((p - o) ** 2))


def dm_test(p_a, p_b, o, h):
    """Diebold-Mariano on Brier loss difference (a - b), HAC lag h-1 (min 1)."""
    d = (p_a - o) ** 2 - (p_b - o) ** 2
    n = len(d)
    dc = d - d.mean()
    L = max(1, h - 1)
    v = np.dot(dc, dc) / n
    for k in range(1, L + 1):
        v += 2 * (1 - k / (L + 1)) * np.dot(dc[k:], dc[:-k]) / n
    if not np.isfinite(v) or v <= 1e-18:
        return 0.0, 1.0                        # forecasts identical (e.g. model == climatology)
    t = d.mean() / np.sqrt(v / n)
    return float(t), float(2 * stats.norm.sf(abs(t)))


def block_bootstrap_bss(p, pc, o, h, B=500, seed=0):
    rng = np.random.default_rng(seed)
    n = len(o)
    bl = max(h, 5)
    nb = int(np.ceil(n / bl))
    vals = []
    for _ in range(B):
        st = rng.integers(0, n - bl, nb)
        ix = (st[:, None] + np.arange(bl)).ravel()[:n]
        vals.append(1 - _brier(p[ix], o[ix]) / _brier(pc[ix], o[ix]))
    vals = np.array(vals)
    return float(np.mean(vals <= 0)), np.quantile(vals, [0.05, 0.95]).tolist()


def verify(P: pd.DataFrame, model: str, h: int, thresholds=(0.10, 0.15, 0.20)) -> dict:
    o = P["up"].values.astype(float)
    p = P[f"p_{model}"].values
    pc = P["p_clim"].values
    yr = P["y"].values
    r = P[f"r_{model}"].values
    out = dict(n=len(o), up_rate=float(o.mean()))
    out["accuracy"] = float(np.mean((p > 0.5) == (o == 1)))
    out["acc_always_up"] = float(max(o.mean(), 1 - o.mean()))
    out["auc"] = float(roc_auc_score(o, p)) if 0 < o.mean() < 1 else np.nan
    out["brier"] = _brier(p, o)
    out["brier_clim"] = _brier(pc, o)
    out["bss"] = 1 - out["brier"] / out["brier_clim"]
    out["dm_t"], out["dm_p"] = dm_test(p, pc, o, h)
    out["boot_p_bss_le0"], out["boot_bss_90ci"] = block_bootstrap_bss(p, pc, o, h)
    out["ret_corr"] = float(np.corrcoef(r, yr)[0, 1])
    out["ret_hit"] = float(np.mean(np.sign(r) == np.sign(yr)))
    sel = {}
    for t in thresholds:
        m = np.abs(p - 0.5) >= t
        k = int(m.sum())
        if k == 0:
            sel[f"{t:.2f}"] = dict(coverage=0.0, n=0)
            continue
        hit = (p[m] > 0.5) == (o[m] == 1)
        acc = float(hit.mean())
        u = o[m].mean()
        base = float(max(u, 1 - u))           # strict: majority class on those same days
        x = int(hit.sum())
        p_bin = float(stats.binomtest(x, k, base, alternative="greater").pvalue)
        k_eff = max(1, int(round(k / h)))      # overlap-adjusted (independent-ish) sample
        p_bin_eff = float(stats.binomtest(int(round(acc * k_eff)), k_eff, base, alternative="greater").pvalue)
        sel[f"{t:.2f}"] = dict(coverage=k / len(o), n=k, accuracy=acc, base=base,
                               frac_up_calls=float((p[m] > 0.5).mean()),
                               binom_p=p_bin, binom_p_overlap_adj=p_bin_eff)
    out["selective"] = sel
    q = pd.qcut(p, 10, labels=False, duplicates="drop")
    rel = pd.DataFrame({"bin": q, "p": p, "o": o}).groupby("bin").agg(p_mean=("p", "mean"), obs_freq=("o", "mean"), n=("o", "size"))
    out["reliability"] = rel.round(4).reset_index().to_dict("records")
    return out


def walk_forward_report(features: pd.DataFrame, models=("full", "sig"), last_years=3, P_cache: dict | None = None) -> dict:
    """Walk-forward verification for every horizon, whole period and last N calendar years."""
    rep = {}
    last_year = features.index.max().year
    for h in HORIZONS:
        P = P_cache[h] if P_cache else walk_forward(features, h, sets=models)
        d = {}
        for m in list(models) + ["clim"]:
            if m == "clim":
                continue
            d[m] = {"all": verify(P, m, h), f"last{last_years}y": verify(P.loc[f"{last_year-last_years+1}-01-01":], m, h)}
        d["period"] = (str(P.index.min().date()), str(P.index.max().date()))
        rep[h] = d
    return rep


# ----------------------------------------------------------------------------- today
def fit_predict_today(features: pd.DataFrame, nifty_close: float | None = None, model: str = "full",
                      train_start=DESIGN[0]) -> dict:
    """Fit on all realised targets and forecast from the last row.
    Walk-forward verification found NO skill over climatology at any horizon (BSS <= 0),
    so the app should show p_clim next to p_up and treat p_up as a tilt, not an edge."""
    cols = factor_cols(features)
    F = features.loc[train_start:]
    today = F.iloc[[-1]]
    close = float(nifty_close if nifty_close is not None else today["close"].iloc[0])
    out = {"asof": str(F.index[-1].date()), "close": close}
    for h in HORIZONS:
        tr = F[F[f"y{h}"].notna()]
        use = cols if model == "full" else (_select_fdr(tr, cols, h) or cols)
        m = _fit(tr, use, h)
        z = m["st"].transform(today[use])[0]
        p = float(m["lg"].predict_proba(z[None])[0, 1])
        r = float(m["rg"].predict(z[None])[0])
        sig = float(np.sqrt(h) * today["rv20"].iloc[0] / np.sqrt(252))
        lo, hi = r + m["rq"][0] * sig, r + m["rq"][1] * sig
        contrib = pd.Series(m["lg"].coef_[0] * z, index=use)
        top = contrib.reindex(contrib.abs().sort_values(ascending=False).index)[:5]
        out[h] = dict(p_up=p, p_clim=float((tr[f"y{h}"] > 0).mean()),
                      exp_return_clim=float(np.expm1(tr[f"y{h}"].mean())), exp_return=float(np.expm1(r)), interval80=(float(np.expm1(lo)), float(np.expm1(hi))),
                      level80=(close * float(np.exp(lo)), close * float(np.exp(hi))),
                      top_contrib_logodds={k: float(v) for k, v in top.items()},
                      top_factor_values={k: float(today[k].iloc[0]) for k in top.index})
    return out


if __name__ == "__main__":
    import sys, time, json
    t0 = time.time()
    raw = pd.read_pickle(sys.argv[1])
    bpx = pd.read_pickle(sys.argv[2]) if len(sys.argv) > 2 else None
    F = build_features(raw, bpx)
    print(json.dumps(fit_predict_today(F), indent=1, default=str))
    rep = walk_forward_report(F, models=("full",))
    for h, d in rep.items():
        a = d["full"]["all"]
        print(h, {k: round(a[k], 4) for k in ("accuracy", "auc", "bss", "dm_p")})
    print(f"{time.time()-t0:.1f}s")
