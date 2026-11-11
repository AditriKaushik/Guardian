"""Stock-wise probability for the next few hours.

How it works (short version):
1. Download ~2 years of hourly candles for the stock and for Nifty.
2. At every hour, compute what the market "looked like" at that moment: momentum, position vs VWAP,
   RSI, Bollinger position, volume surge, strength vs Nifty, etc.
3. Label each hour: did the price go UP over the next N hours (same trading day)?
4. Train a logistic-regression model on the older 70% of history and TEST it on the newest 30%
   that it has never seen. That test tells us how much to trust the model for THIS stock.
5. Retrain on everything, read today's situation, and output P(up). If the test showed little
   real skill, the probability is pulled toward the base rate, so the app never overstates certainty.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

FEATURES = ["r1", "r3", "r7", "r_day", "gap", "vwap_dist", "rsi", "bb_pctb", "ema50_dist",
            "ema_slope", "vol_ratio", "rv20", "hour", "idx_r_day", "rel_strength"]

FEATURE_LABELS = {
    "r1": "Last-hour move", "r3": "3-hour momentum", "r7": "1-day momentum", "r_day": "Move since today's open",
    "gap": "Opening gap", "vwap_dist": "Distance from VWAP", "rsi": "RSI (14)", "bb_pctb": "Bollinger position",
    "ema50_dist": "Distance from 50-hour average", "ema_slope": "Trend slope", "vol_ratio": "Volume surge",
    "rv20": "Recent volatility", "hour": "Time of day", "idx_r_day": "Nifty move today",
    "rel_strength": "Strength vs Nifty",
}


def _rsi(c: pd.Series, n: int = 14) -> pd.Series:
    d = c.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = up / dn.replace(0, np.nan)
    return (100 - 100 / (1 + rs)).fillna(50)


def build_features(df: pd.DataFrame, idx: pd.DataFrame | None = None) -> pd.DataFrame:
    """Features known at the close of each bar (no look-ahead)."""
    c, o, h, l, v = df["Close"], df["Open"], df["High"], df["Low"], df["Volume"].fillna(0)
    day = pd.Series(df.index.date, index=df.index)
    f = pd.DataFrame(index=df.index)
    f["r1"] = c.pct_change()
    f["r3"] = c.pct_change(3)
    f["r7"] = c.pct_change(7)
    day_open = o.groupby(day).transform("first")
    f["r_day"] = c / day_open - 1
    daily_close = c.groupby(day).last()
    prev_close = day.map(daily_close.shift(1))
    f["gap"] = (day_open / prev_close - 1).fillna(0)
    if v.sum() > 0:
        tp = (h + l + c) / 3
        vwap = (tp * v).groupby(day).cumsum() / v.groupby(day).cumsum().replace(0, np.nan)
        f["vwap_dist"] = (c / vwap - 1).fillna(0)
        f["vol_ratio"] = np.log((v / v.rolling(20).mean()).replace(0, np.nan)).fillna(0)
    else:
        f["vwap_dist"] = 0.0
        f["vol_ratio"] = 0.0
    f["rsi"] = _rsi(c)
    ma, sd = c.rolling(20).mean(), c.rolling(20).std()
    f["bb_pctb"] = ((c - (ma - 2 * sd)) / (4 * sd)).clip(-1, 2)
    ema50 = c.ewm(span=50, adjust=False).mean()
    f["ema50_dist"] = c / ema50 - 1
    f["ema_slope"] = c.ewm(span=20, adjust=False).mean().pct_change(5)
    f["rv20"] = f["r1"].rolling(20).std()
    f["hour"] = df.index.hour + df.index.minute / 60.0
    if idx is not None and not idx.empty:
        ic = idx["Close"].reindex(df.index, method="ffill")
        iday_open = idx["Open"].reindex(df.index, method="ffill").groupby(day).transform("first")
        f["idx_r_day"] = (ic / iday_open - 1).fillna(0)
    else:
        f["idx_r_day"] = 0.0
    f["rel_strength"] = f["r_day"] - f["idx_r_day"]
    return f.replace([np.inf, -np.inf], np.nan)


def make_labels(df: pd.DataFrame, horizon: int | str) -> tuple[pd.Series, pd.Series]:
    """Forward return over `horizon` bars (or 'close' = to the day's last bar), same day only.

    Returns (label 1/0 with NaN where unknown, forward return)."""
    c = df["Close"]
    day = pd.Series(df.index.date, index=df.index)
    if horizon == "close":
        fut = c.groupby(day).transform("last")
        is_last = day.ne(day.shift(-1))
        fwd = (fut / c - 1).where(~is_last)
    else:
        fut = c.shift(-horizon)
        same_day = day.shift(-horizon) == day
        fwd = (fut / c - 1).where(same_day)
    label = (fwd > 0).astype(float).where(fwd.notna())
    return label, fwd


@dataclass
class Prediction:
    ok: bool
    message: str = ""
    p_up: float = 0.5
    p_model_raw: float = 0.5
    base_rate: float = 0.5
    reliability: float = 0.0
    test_accuracy: float = float("nan")
    test_baseline: float = float("nan")
    test_auc: float = float("nan")
    confident_acc: float = float("nan")
    confident_n: int = 0
    n_train: int = 0
    n_test: int = 0
    last_price: float = float("nan")
    last_time: str = ""
    range_lo: float = float("nan")
    range_mid: float = float("nan")
    range_hi: float = float("nan")
    atr: float = float("nan")
    verdict: str = ""
    verdict_color: str = "#9a6700"
    signals: list = field(default_factory=list)
    drivers: list = field(default_factory=list)
    macro_adj: float = 0.0


def _auc(y: np.ndarray, p: np.ndarray) -> float:
    pos, neg = p[y == 1], p[y == 0]
    if len(pos) == 0 or len(neg) == 0:
        return float("nan")
    ranks = pd.Series(np.r_[pos, neg]).rank().to_numpy()
    return float((ranks[: len(pos)].sum() - len(pos) * (len(pos) + 1) / 2) / (len(pos) * len(neg)))


def _signals(row: pd.Series) -> list[tuple[str, str]]:
    """Plain-language reading of the current situation: (text, '+'/'-'/'0')."""
    s = []
    if row["vwap_dist"] > 0.002:
        s.append(("Price is above today's VWAP: buyers in control intraday", "+"))
    elif row["vwap_dist"] < -0.002:
        s.append(("Price is below today's VWAP: sellers in control intraday", "-"))
    if row["rsi"] > 70:
        s.append((f"RSI {row['rsi']:.0f}: overbought, pullback risk", "-"))
    elif row["rsi"] < 30:
        s.append((f"RSI {row['rsi']:.0f}: oversold, bounce possible", "+"))
    if row["bb_pctb"] > 1:
        s.append(("Above the upper Bollinger Band: stretched up", "-"))
    elif row["bb_pctb"] < 0:
        s.append(("Below the lower Bollinger Band: stretched down", "+"))
    if row["rel_strength"] > 0.005:
        s.append((f"Stronger than Nifty today by {row['rel_strength']*100:.1f}%", "+"))
    elif row["rel_strength"] < -0.005:
        s.append((f"Weaker than Nifty today by {abs(row['rel_strength'])*100:.1f}%", "-"))
    if row["vol_ratio"] > np.log(2):
        s.append(("Volume more than 2x normal: big players active", "+" if row["r1"] > 0 else "-"))
    if row["ema50_dist"] > 0 and row["ema_slope"] > 0:
        s.append(("Above a rising 50-hour average: short-term uptrend", "+"))
    elif row["ema50_dist"] < 0 and row["ema_slope"] < 0:
        s.append(("Below a falling 50-hour average: short-term downtrend", "-"))
    if abs(row["gap"]) > 0.01:
        s.append((f"Opened with a {row['gap']*100:+.1f}% gap today", "0"))
    return s or [("Nothing unusual right now: price is in a normal zone", "0")]


def predict(df: pd.DataFrame, idx: pd.DataFrame | None, horizon: int | str = 2,
            macro_pct: float = 0.0, apply_macro: bool = False) -> Prediction:
    """Probability that the stock is higher after `horizon` hours (or at today's close)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler

    if df is None or df.empty or len(df) < 300:
        return Prediction(ok=False, message="Not enough hourly history for this symbol (need ~300 hourly candles). "
                                            "Check the symbol, e.g. RELIANCE, TCS, HDFCBANK.")
    feats = build_features(df, idx)
    label, fwd = make_labels(df, horizon)
    data = feats.join(label.rename("y")).join(fwd.rename("fwd"))
    usable = data.dropna(subset=FEATURES)
    train_all = usable.dropna(subset=["y"])
    if len(train_all) < 250:
        return Prediction(ok=False, message="Too few complete samples after cleaning.")

    X, y = train_all[FEATURES].to_numpy(), train_all["y"].to_numpy().astype(int)
    split = int(len(X) * 0.7)
    gap = horizon if isinstance(horizon, int) else 7
    Xtr, ytr, Xte, yte = X[: split - gap], y[: split - gap], X[split:], y[split:]

    def model():
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=2000))

    m = model().fit(Xtr, ytr)
    pte = m.predict_proba(Xte)[:, 1]
    acc = float(((pte > 0.5) == yte).mean())
    base_te = float(max(yte.mean(), 1 - yte.mean()))
    auc = _auc(yte, pte)
    conf = np.abs(pte - 0.5) >= 0.08
    conf_acc = float(((pte[conf] > 0.5) == yte[conf]).mean()) if conf.any() else float("nan")

    # Trust in the model for THIS stock: 0 = no proven skill, 1 = solid (AUC >= 0.58 on unseen data).
    reliability = float(np.clip((auc - 0.5) / 0.08, 0, 1)) if not np.isnan(auc) else 0.0
    if len(yte) < 150:
        reliability *= 0.5
    if acc <= base_te:  # must also beat "always guess the most common outcome"
        reliability = min(reliability, 0.3)

    final = model().fit(X, y)
    cur = usable.iloc[[-1]]
    p_raw = float(final.predict_proba(cur[FEATURES].to_numpy())[:, 1][0])
    base = float(y.mean())
    p = base + (p_raw - base) * reliability
    macro_adj = 0.03 * float(np.clip(macro_pct, -1, 1)) if apply_macro else 0.0
    p = float(np.clip(p + macro_adj, 0.05, 0.95))

    # Which features push today's prediction up or down (coefficient x standardized value).
    scaler, lr = final.named_steps["standardscaler"], final.named_steps["logisticregression"]
    z = (cur[FEATURES].to_numpy()[0] - scaler.mean_) / scaler.scale_
    contrib = lr.coef_[0] * z
    order = np.argsort(-np.abs(contrib))[:5]
    drivers = [(FEATURE_LABELS[FEATURES[i]], float(contrib[i])) for i in order]

    # Expected range: historical forward returns, scaled to current volatility.
    hist = usable["fwd"].dropna()
    rv_now = float(cur["rv20"].iloc[0])
    rv_med = float(usable["rv20"].median())
    scale = float(np.clip(rv_now / rv_med, 0.5, 2.5)) if rv_med > 0 else 1.0
    q10, q50, q90 = (hist.quantile([0.1, 0.5, 0.9]) * scale).tolist()
    last = float(df["Close"].iloc[-1])
    tr = pd.concat([df["High"] - df["Low"], (df["High"] - df["Close"].shift()).abs(),
                    (df["Low"] - df["Close"].shift()).abs()], axis=1).max(axis=1)
    atr = float(tr.rolling(14).mean().iloc[-1])

    if reliability < 0.35:
        verdict, color = "NO PROVEN EDGE: the model showed little skill on this stock's unseen history. Don't trade on this number.", "#9a6700"
    elif p >= 0.60:
        verdict, color = "LEANING UP", "#1a7f37"
    elif p <= 0.40:
        verdict, color = "LEANING DOWN: avoid buying now", "#cf222e"
    else:
        verdict, color = "NO CLEAR EDGE: stay out or wait", "#9a6700"

    return Prediction(
        ok=True, p_up=p, p_model_raw=p_raw, base_rate=base, reliability=reliability,
        test_accuracy=acc, test_baseline=base_te, test_auc=auc, confident_acc=conf_acc,
        confident_n=int(conf.sum()), n_train=len(Xtr), n_test=len(Xte),
        last_price=last, last_time=str(df.index[-1])[:16],
        range_lo=last * (1 + q10), range_mid=last * (1 + q50), range_hi=last * (1 + q90),
        atr=atr, verdict=verdict, verdict_color=color, signals=_signals(cur.iloc[0]),
        drivers=drivers, macro_adj=macro_adj,
    )
