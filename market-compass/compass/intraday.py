"""Intraday lab: same-day LONG (buy) and SHORT (sell) setups, forward-tested live.

Nov 2026 studies of 1,584 intraday variants (150 stocks, ~2 years of hourly bars) found NO intraday setup with a
75%+ win rate AND a positive average after costs: high win rates only came from tiny targets with wide stops,
which still lost money. So nothing is recommended up front. Instead, the four candidates that came closest are
run live every day. Each signal is logged at entry and checked against real prices at the close. A setup is
promoted to a suggestion only after >= 100 live trades with a win rate >= the minimum (75%) AND a positive
average after costs.

Bars: Yahoo hourly bars for NSE start at 09:15, 10:15 ... 15:15 (the last one ends 15:30). Entries happen at a
bar close; target/stop are checked on later bars (stop first if both are touched); otherwise squared off at the
15:15 bar close (brokers auto square-off around 15:20). Cost 0.06% per round trip.
"""
from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd

COST = 0.0006
MIN_LIVE_TRADES = 100

SETUPS = {
    "L_GAPUP": {"side": "BUY", "name": "Gap-up continuation (long)",
                "rule": "Opens 2%+ above yesterday's close, the first hour closes green in the upper half of its range on 3×+ normal first-hour volume. Buy at 10:15.",
                "entry_bar": 0, "target": 0.015, "stop": 0.015,
                "study": "2023–25: 51.6% wins, +0.08%/trade · 2025–26: 56.8%, +0.15% (win rate below 75%)"},
    "L_FLUSH": {"side": "BUY", "name": "Morning flush in a strong stock (long)",
                "rule": "Stock above its 50- and 200-day averages but down 3%+ from the open by the 10:15 bar close. Buy at 11:15.",
                "entry_bar": 1, "target": 0.005, "stop": 0.03,
                "study": "2023–25: lost money (−0.34%/trade) · 2025–26: 88.7% wins, +0.17% (not proven)"},
    "S_GAPDN": {"side": "SELL", "name": "Gap-down continuation (short)",
                "rule": "Opens 2%+ below yesterday's close and the first hour closes red in the bottom 25% of its range. Short at 11:15.",
                "entry_bar": 1, "target": 0.005, "stop": 0.03,
                "study": "2023–25: 64.8% wins, −0.18%/trade · 2025–26: 76.2%, +0.04% (not proven)"},
    "S_RELWEAK": {"side": "SELL", "name": "Weak stock while Nifty rises (short)",
                  "rule": "Stock below its 50-day average and down 5%+ over 20 days; in the first hour the stock is down 1%+ while Nifty is up. Short at 10:15.",
                  "entry_bar": 0, "target": 0.0075, "stop": 0.03,
                  "study": "2023–25: 70.1% wins, +0.02%/trade · 2025–26: 63.4%, −0.02%"},
}


def _days(df: pd.DataFrame) -> dict:
    """{date: DataFrame of that day's hourly bars} for complete-ish days."""
    out = {}
    for d, g in df.groupby(df.index.date):
        out[d] = g
    return out


def _signal(key: str, g: pd.DataFrame, prev_close: float, daily_hist: pd.Series, vol_first_avg: float,
            nifty_first: float | None) -> bool:
    """Evaluate setup `key` on day bars `g` using only data known at its entry bar's close."""
    if len(g) < 2 or not prev_close:
        return False
    o0, h0, l0, c0, v0 = (float(g[k].iloc[0]) for k in ("Open", "High", "Low", "Close", "Volume"))
    rng0 = (h0 - l0) or 1e-9
    gap = o0 / prev_close - 1
    if key == "L_GAPUP":
        return gap >= 0.02 and c0 > o0 and (c0 - l0) / rng0 >= 0.5 and vol_first_avg > 0 and v0 >= 3 * vol_first_avg
    if key == "L_FLUSH":
        if len(daily_hist) < 200:
            return False
        strong = daily_hist.iloc[-1] > daily_hist.tail(50).mean() and daily_hist.iloc[-1] > daily_hist.tail(200).mean()
        return bool(strong and float(g["Close"].iloc[1]) / o0 - 1 <= -0.03)
    if key == "S_GAPDN":
        return gap <= -0.02 and c0 < o0 and (c0 - l0) / rng0 <= 0.25
    if key == "S_RELWEAK":
        if len(daily_hist) < 50 or nifty_first is None:
            return False
        weak = daily_hist.iloc[-1] < daily_hist.tail(50).mean() and daily_hist.iloc[-1] / daily_hist.iloc[-21] - 1 <= -0.05
        return bool(weak and c0 / prev_close - 1 <= -0.01 and nifty_first > 0)
    return False


def _resolve(side: str, g: pd.DataFrame, entry_bar: int, target: float, stop: float) -> tuple[float, str] | None:
    """Return (net return, how) for a same-day trade entered at the close of bar `entry_bar`; None if not finished."""
    e = float(g["Close"].iloc[entry_bar])
    if side == "BUY":
        tp, sl = e * (1 + target), e * (1 - stop)
    else:
        tp, sl = e * (1 - target), e * (1 + stop)
    for k in range(entry_bar + 1, len(g)):
        hi, lo = float(g["High"].iloc[k]), float(g["Low"].iloc[k])
        if side == "BUY":
            if lo <= sl:
                return -stop - COST, "stop"
            if hi >= tp:
                return target - COST, "target"
        else:
            if hi >= sl:
                return -stop - COST, "stop"
            if lo <= tp:
                return target - COST, "target"
    if g.index[-1].hour == 15:      # the 15:15 bar exists -> squared off at the close
        x = float(g["Close"].iloc[-1])
        r = x / e - 1 if side == "BUY" else 1 - x / e
        return r - COST, "square-off 15:15"
    return None


def scan(frames: dict, now: datetime | None = None) -> tuple[pd.DataFrame, list]:
    """Backtest every setup over the available hourly history, and return today's live signals."""
    nifty = frames.get("^NSEI")
    nifty_first = {}
    if nifty is not None:
        for d, g in _days(nifty).items():
            nifty_first[d] = float(g["Close"].iloc[0] / g["Open"].iloc[0] - 1)
    today = pd.Timestamp(now).date() if now else None
    rows, live = [], []
    for sym, df in frames.items():
        if sym.startswith("^") or df is None or df.empty:
            continue
        days = _days(df)
        dates = sorted(days)
        closes = pd.Series({d: float(days[d]["Close"].iloc[-1]) for d in dates})
        first_vol = pd.Series({d: float(days[d]["Volume"].iloc[0]) for d in dates})
        for i in range(21, len(dates)):
            d = dates[i]
            g = days[d]
            prev_close = float(closes.iloc[i - 1])
            hist = closes.iloc[:i]                      # daily closes up to yesterday
            vavg = float(first_vol.iloc[i - 20:i].mean())
            for key, st in SETUPS.items():
                if len(g) <= st["entry_bar"]:
                    continue
                if d == today and now is not None and pd.Timestamp(now) < g.index[st["entry_bar"]] + pd.Timedelta(hours=1):
                    continue          # entry bar still in progress: wait until it has closed
                if d == today and now is not None:
                    g = g[g.index + pd.Timedelta(hours=1) <= pd.Timestamp(now)] if len(g) else g   # completed bars only
                if not _signal(key, g, prev_close, hist, vavg, nifty_first.get(d)):
                    continue
                entry = float(g["Close"].iloc[st["entry_bar"]])
                res = _resolve(st["side"], g, st["entry_bar"], st["target"], st["stop"])
                if d == today:
                    t = st["target"]
                    s = st["stop"]
                    live.append({"setup": key, "sym": sym, "side": st["side"], "date": str(d),
                                 "entry_time": g.index[st["entry_bar"]].strftime("%H:%M"), "entry": round(entry, 2),
                                 "target": round(entry * (1 + t) if st["side"] == "BUY" else entry * (1 - t), 2),
                                 "stop": round(entry * (1 - s) if st["side"] == "BUY" else entry * (1 + s), 2),
                                 "result": None if res is None else round(res[0], 5)})
                elif res is not None:
                    rows.append((key, sym, pd.Timestamp(d), res[0]))
    return pd.DataFrame(rows, columns=["setup", "sym", "date", "ret"]), live


def stats(bt: pd.DataFrame, track: dict, min_win: float) -> list[dict]:
    out = []
    live_res = track.get("intraday", {}).get("resolved", [])
    for key, st in SETUPS.items():
        x = bt[bt.setup == key]
        last3 = x[x.date >= x.date.max() - pd.Timedelta(days=92)] if len(x) else x
        lv = [r for r in live_res if r["setup"] == key]
        lwin = (sum(r["ret"] > 0 for r in lv) / len(lv)) if lv else None
        lavg = (sum(r["ret"] for r in lv) / len(lv)) if lv else None
        promoted = bool(len(lv) >= MIN_LIVE_TRADES and lwin is not None and lwin >= min_win and lavg > 0)
        out.append({"key": key, **{k: st[k] for k in ("side", "name", "rule", "target", "stop", "study")},
                    "bt_n": int(len(x)), "bt_win": None if not len(x) else round(float((x.ret > 0).mean()), 4),
                    "bt_avg": None if not len(x) else round(float(x.ret.mean()), 5),
                    "l3m_n": int(len(last3)), "l3m_win": None if not len(last3) else round(float((last3.ret > 0).mean()), 4),
                    "live_n": len(lv), "live_win": None if lwin is None else round(lwin, 4),
                    "live_avg": None if lavg is None else round(lavg, 5),
                    "status": "PROMOTED" if promoted else ("TESTING" if len(lv) < MIN_LIVE_TRADES else "FAILED live test")})
    return out


def update_track(track: dict, live: list, bt: pd.DataFrame, now: datetime) -> dict:
    """Log each live signal once; record its real result once its day has finished (after 15:30 IST)."""
    it = track.setdefault("intraday", {"open": [], "resolved": []})
    have = {(r["setup"], r["sym"], r["date"]) for r in it["open"] + it["resolved"]}
    for s in live:
        k = (s["setup"], s["sym"], s["date"])
        if k not in have:
            it["open"].append({k2: s[k2] for k2 in ("setup", "sym", "side", "date", "entry", "target", "stop")})
            have.add(k)
    t = pd.Timestamp(now)
    today = str(t.date())
    done_today = (t.hour, t.minute) >= (15, 35)
    live_res = {(s["setup"], s["sym"], s["date"]): s["result"] for s in live}
    past = {(r.setup, r.sym, str(r.date.date())): r.ret for r in bt.itertuples()} if len(bt) else {}
    still = []
    for r in it["open"]:
        k = (r["setup"], r["sym"], r["date"])
        res = past.get(k) if r["date"] < today else (live_res.get(k) if done_today else None)
        if res is not None:
            r["ret"] = round(float(res), 5)
            it["resolved"].append(r)
        elif r["date"] < today and (t - pd.Timestamp(r["date"], tz=t.tz)).days > 5:
            continue        # data never arrived: drop
        else:
            still.append(r)
    it["open"] = still
    it["resolved"] = it["resolved"][-3000:]
    return track
