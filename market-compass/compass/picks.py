"""Daily Picks: swing-trade suggestions that pass every condition, with a 75%+ historical win rate.

THE RULE (tested on 10 years of real daily data for Nifty 50 + Next 50 + Midcap 50):
  Signal  : stock in an uptrend (close > 200-day avg, 50-day avg > 200-day avg) AND a short dip
            (close below the lower Bollinger Band, or RSI(2) < 5), while Nifty is above its 200-day avg,
            AND the whole market is under mild stress (Nifty down over 5 days, India VIX not falling)
            AND the dip came on normal volume (< 1.2x its 20-day average).
  Entry   : at the day's close (buy near 3:15-3:25 PM IST, delivery/CNC, no leverage).
  Exit    : target +2% OR stop-loss -8% OR after 15 trading days, whichever comes first.
  Costs   : 0.25% per round trip deducted (STT, brokerage, exchange fees, GST, stamp duty).
Small target + wide stop = high win rate but one loss wipes out ~4 wins, so the
statistics (recomputed on every build from real data) are shown with the picks.

CONDITIONS (every one must pass): market regime, India VIX, macro stance, no results/board meeting
within 21 days (NSE event calendar), not in the F&O ban list, not under ASM/GSM surveillance, liquidity,
no circuit-type move or corporate-action gap, and the rule's recent 5-year win rate must be >= 75%.
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

from . import data as D
from .universe import fetch_index_list

TARGET, STOP, MAX_DAYS, COST = 0.02, 0.08, 15, 0.0025
MIN_WIN = 0.75
# Stress filters (v2, added Nov 2026 after an out-of-sample study: win 79.7% -> 83.8%, avg +0.22% -> +0.55%
# per trade on 2021-11..2026-11 data that was not used to choose them; better in every year 2017-2026).
IVIX_REL, NIFTY_5D_MAX, VOL_MAX = -0.02, 0.0, 1.2
MAX_PICKS, MAX_PER_INDUSTRY = 5, 2
DEFENSIVE = ("FMCG", "Fast Moving Consumer Goods", "Healthcare", "Information Technology", "Pharma")
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9"}


# ------------------------------------------------------------------ regulatory & event data (NSE)
def regulatory_lists() -> dict:
    """F&O ban, ASM, GSM and upcoming board meetings/results from NSE. Each part reports if it was checked."""
    import requests

    out = {"fo_ban": set(), "asm": {}, "gsm": {}, "events": {}, "checked": {}}
    try:
        r = requests.get("https://nsearchives.nseindia.com/content/fo/fo_secban.csv", headers=UA, timeout=20)
        if r.status_code == 200 and "Ban" in r.text[:200]:
            for line in r.text.splitlines()[1:]:
                parts = line.split(",")
                if len(parts) >= 2 and parts[1].strip():
                    out["fo_ban"].add(parts[1].strip())
            out["checked"]["fo_ban"] = True
    except Exception:
        pass
    try:
        s = requests.Session()
        s.headers.update({**UA, "Referer": "https://www.nseindia.com/reports/asm"})
        s.get("https://www.nseindia.com", timeout=10)
        a = s.get("https://www.nseindia.com/api/reportASM", timeout=20).json()
        for part in ("longterm", "shortterm"):
            for row in (a.get(part) or {}).get("data", []):
                out["asm"][row.get("symbol")] = row.get("survDesc") or row.get("asmSurvIndicator") or "ASM"
        out["checked"]["asm"] = True
        g = s.get("https://www.nseindia.com/api/reportGSM", timeout=20).json()
        for row in g if isinstance(g, list) else []:
            out["gsm"][row.get("symbol")] = row.get("survDesc") or "GSM"
        out["checked"]["gsm"] = True
        ev = s.get("https://www.nseindia.com/api/event-calendar", timeout=20).json()
        for row in ev if isinstance(ev, list) else []:
            try:
                d = datetime.strptime(row["date"], "%d-%b-%Y").date()
            except Exception:
                continue
            out["events"].setdefault(row.get("symbol"), []).append((d.isoformat(), row.get("purpose", "")))
        out["checked"]["events"] = True
    except Exception:
        pass
    return out


# ------------------------------------------------------------------ rule
def _rsi(c: pd.Series, n: int) -> pd.Series:
    d = c.diff()
    u = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    v = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + u / v.replace(0, np.nan))


def signal_frame(c: pd.Series) -> pd.DataFrame:
    s200, s50, s20, sd20 = c.rolling(200).mean(), c.rolling(50).mean(), c.rolling(20).mean(), c.rolling(20).std()
    up = (c > s200) & (s50 > s200)
    bb = c < s20 - 2 * sd20
    rs = _rsi(c, 2) < 5
    return pd.DataFrame({"sig": up & (bb | rs), "bb": up & bb, "rsi": up & rs,
                         "rsi2": _rsi(c, 2), "lower_bb": s20 - 2 * sd20, "s200": s200})


def simulate(o, h, l, c, i) -> tuple[float | None, int, str]:
    """Outcome of a trade entered at close i. Returns (net return or None if still open, exit index, how)."""
    e = c[i]
    tgt, stp = e * (1 + TARGET), e * (1 - STOP)
    for j in range(i + 1, min(i + 1 + MAX_DAYS, len(c))):
        if o[j] <= stp:
            return o[j] / e - 1 - COST, j, "stop (gap)"
        if l[j] <= stp:
            return -STOP - COST, j, "stop"
        if o[j] >= tgt:
            return o[j] / e - 1 - COST, j, "target (gap)"
        if h[j] >= tgt:
            return TARGET - COST, j, "target"
    if i + MAX_DAYS < len(c):
        j = i + MAX_DAYS
        return c[j] / e - 1 - COST, j, "time exit"
    return None, len(c) - 1, "open"


def stress_masks(frames: dict, nifty: pd.Series, ivix: pd.Series) -> tuple[pd.Series, dict]:
    """Market under stress (India VIX not falling + Nifty down over 5 days) and, per stock, dip-day volume
    below 1.2x its previous 20-day average (no heavy news-driven selling)."""
    regime = ((ivix / ivix.rolling(20).mean() - 1) > IVIX_REL).reindex(nifty.index).ffill().fillna(False).astype(bool) \
        & (nifty.pct_change(5) < NIFTY_5D_MAX)
    vol = {}
    for sym, df in frames.items():
        v = df["Volume"]
        vol[sym] = (v / v.rolling(20).mean().shift(1)) < VOL_MAX
    return regime, vol


def backtest(frames: dict, nifty_up: pd.Series, regime: pd.Series | None = None, vol: dict | None = None) -> pd.DataFrame:
    rows = []
    for sym, df in frames.items():
        c = df["Close"]
        if len(c) < 400:
            continue
        sf = signal_frame(c)
        jump = (df["Open"] / c.shift() - 1).abs() > 0.20   # corporate actions (splits, demergers)
        m = sf["sig"] & nifty_up.reindex(c.index).fillna(False).astype(bool)
        if regime is not None:
            m = m & regime.reindex(c.index).ffill().fillna(False).astype(bool) & vol[sym].reindex(c.index).fillna(False)
        sig = m.to_numpy()
        o, h, l, cc = (df[k].to_numpy() for k in ("Open", "High", "Low", "Close"))
        jumpv = jump.to_numpy()
        i = 200
        while i < len(cc) - 1:
            if not sig[i]:
                i += 1
                continue
            r, j, how = simulate(o, h, l, cc, i)
            if r is None:
                break
            if not jumpv[i + 1: j + 1].any():
                rows.append((sym, c.index[i], r, j - i, how))
            i = j + 1
    return pd.DataFrame(rows, columns=["sym", "date", "ret", "days", "how"])


def rule_stats(tr: pd.DataFrame, today: pd.Timestamp) -> dict:
    def st(x):
        return {"n": int(len(x)), "win": float((x.ret > 0).mean()) if len(x) else None,
                "avg": float(x.ret.mean()) if len(x) else None,
                "avg_win": float(x.ret[x.ret > 0].mean()) if (x.ret > 0).any() else None,
                "avg_loss": float(x.ret[x.ret <= 0].mean()) if (x.ret <= 0).any() else None}
    yrs = [{"year": int(y), **st(g)} for y, g in tr.groupby(tr.date.dt.year)]
    return {"all": st(tr), "recent5y": st(tr[tr.date >= today - pd.DateOffset(years=5)]),
            "last12m": st(tr[tr.date >= today - pd.DateOffset(years=1)]), "years": yrs,
            "first": str(tr.date.min().date()) if len(tr) else None}


# ------------------------------------------------------------------ main
def load_frames(symbols: list[str]) -> dict:
    import yfinance as yf

    px = yf.download([s + ".NS" for s in symbols], period="10y", interval="1d", auto_adjust=True,
                     progress=False, threads=True, group_by="column")
    frames = {}
    for s in symbols:
        t = s + ".NS"
        try:
            df = pd.DataFrame({k: px[k][t] for k in ("Open", "High", "Low", "Close", "Volume")}).dropna(subset=["Close"])
        except KeyError:
            continue
        if len(df):
            df.index = pd.to_datetime(df.index).tz_localize(None).normalize()
            frames[s] = df
    return frames


def build_picks(snap: dict, macro_pct: float, fii: dict | None, now: datetime, is_open: bool) -> tuple[dict, dict]:
    """Returns (picks payload for data.json, frames used) using only real data."""
    uni = {}
    for name, grp in (("ind_nifty50list", "Nifty 50"), ("ind_niftynext50list", "Nifty Next 50"),
                      ("ind_niftymidcap50list", "Nifty Midcap 50")):
        for s, ind in fetch_index_list(name).items():
            uni.setdefault(s, {"industry": ind or "Other", "group": grp})
    frames = load_frames(sorted(uni))
    nif = D.history("^NSEI", "10y", "1d")["Close"]
    nif.index = pd.to_datetime(nif.index).tz_localize(None).normalize()
    nifty_up = nif > nif.rolling(200).mean()
    today = pd.Timestamp(now.date())
    iv = D.history("^INDIAVIX", "10y", "1d")["Close"]
    iv.index = pd.to_datetime(iv.index).tz_localize(None).normalize()
    regime, vol = stress_masks(frames, nif, iv)

    tr = backtest(frames, nifty_up, regime, vol)
    stats = rule_stats(tr, today)
    stats["baseline"] = {k: v for k, v in rule_stats(backtest(frames, nifty_up), today).items() if k in ("recent5y", "last12m", "all")}
    by_stock = tr.groupby("sym").ret.agg(n="count", wins=lambda x: int((x > 0).sum()))
    p_rule = stats["recent5y"]["win"] or 0.0
    reg = regulatory_lists()

    # ---- market-level conditions
    vix = snap.get("vix", {}).get("last") if snap.get("vix", {}).get("ok") else None
    regime_ok = bool(nifty_up.iloc[-1])
    fii_net = fii.get("FII") if fii else None
    stance_name = ("PROTECT CAPITAL" if macro_pct <= -0.40 else "DEFENSIVE" if macro_pct <= -0.13 else
                   "NEUTRAL" if macro_pct < 0.13 else "BUY")
    market = [
        {"name": "Market regime: Nifty above its 200-day average", "ok": regime_ok,
         "detail": f"Nifty {nif.iloc[-1]:,.0f} vs 200-day avg {nif.rolling(200).mean().iloc[-1]:,.0f}"},
        {"name": "Fear index: India VIX at or below 25", "ok": vix is not None and vix <= 25,
         "detail": f"India VIX {vix:.1f}" if vix is not None else "VIX not available"},
        {"name": "Macro stance (auto factors) is not PROTECT CAPITAL", "ok": stance_name != "PROTECT CAPITAL",
         "detail": f"auto stance: {stance_name}" + (" (only defensive sectors allowed)" if stance_name == "DEFENSIVE" else "")},
        {"name": f"Rule still works: win rate over the last 5 years at or above {MIN_WIN:.0%}", "ok": p_rule >= MIN_WIN,
         "detail": f"{p_rule:.1%} over {stats['recent5y']['n']:,} real trades"},
        {"name": "Market pullback: Nifty lower than 5 trading days ago", "ok": bool(nif.pct_change(5).iloc[-1] < NIFTY_5D_MAX),
         "detail": f"Nifty 5-day change {nif.pct_change(5).iloc[-1]:+.2%}"},
        {"name": "Fear not receding: India VIX at or above 98% of its 20-day average",
         "ok": bool((iv.iloc[-1] / iv.rolling(20).mean().iloc[-1] - 1) > IVIX_REL),
         "detail": f"India VIX {iv.iloc[-1]:.1f} vs 20-day avg {iv.rolling(20).mean().iloc[-1]:.1f}"},
        {"name": "Big money: no heavy FII selling (above Rs 5,000 cr)", "ok": fii_net is None or fii_net > -5000, "soft": True,
         "detail": (f"FII net Rs {fii_net:,.0f} cr" if fii_net is not None else "FII data not available")
         + ("; max 3 picks today" if fii_net is not None and fii_net <= -5000 else "")},
    ]
    market_ok = all(m["ok"] for m in market if not m.get("soft"))
    max_picks = 3 if (fii_net is not None and fii_net <= -5000) else MAX_PICKS

    # ---- stock-level conditions
    candidates, blocked = [], []
    horizon_end = (now + timedelta(days=21)).date().isoformat()
    for sym, df in frames.items():
        c = df["Close"]
        if len(c) < 260 or c.index[-1] < today - pd.Timedelta(days=5):
            continue
        sf = signal_frame(c)
        if not bool(sf["sig"].iloc[-1]):
            continue
        last = float(c.iloc[-1])
        reasons = []
        if sf["bb"].iloc[-1]:
            reasons.append(f"closed below the lower Bollinger Band (₹{sf['lower_bb'].iloc[-1]:,.2f})")
        if sf["rsi"].iloc[-1]:
            reasons.append(f"RSI(2) {sf['rsi2'].iloc[-1]:.1f}: short-term oversold")
        info = uni.get(sym, {})
        ind = info.get("industry", "Other")
        day_chg = float(last / c.iloc[-2] - 1)
        tv20 = float((df["Close"] * df["Volume"]).tail(20).mean() / 1e7)  # Rs crore
        jump = bool(((df["Open"] / c.shift() - 1).abs().tail(20) > 0.20).any())
        ev = [e for e in reg["events"].get(sym, []) if today.date().isoformat() <= e[0] <= horizon_end]
        n_s, w_s = (int(by_stock.at[sym, "n"]), int(by_stock.at[sym, "wins"])) if sym in by_stock.index else (0, 0)
        checks = [
            ("No results / board meeting in the next 3 weeks (NSE event calendar)",
             None if not reg["checked"].get("events") else not ev,
             "; ".join(f"{d}: {p}" for d, p in ev) if ev else ("none scheduled" if reg["checked"].get("events") else "not checked")),
            ("Not in NSE F&O ban list", None if not reg["checked"].get("fo_ban") else sym not in reg["fo_ban"],
             "in ban list today" if sym in reg["fo_ban"] else "clear"),
            ("Not under ASM surveillance (SEBI/NSE)", None if not reg["checked"].get("asm") else sym not in reg["asm"],
             reg["asm"].get(sym, "clear")),
            ("Not under GSM surveillance (SEBI/NSE)", None if not reg["checked"].get("gsm") else sym not in reg["gsm"],
             reg["gsm"].get(sym, "clear")),
            ("Liquid: average daily traded value at or above Rs 20 crore", tv20 >= 20, f"Rs {tv20:,.0f} cr/day"),
            ("Calm dip: volume below 1.2× its 20-day average (no heavy news-driven selling)", bool(vol[sym].iloc[-1]),
             f"{df['Volume'].iloc[-1] / df['Volume'].rolling(20).mean().shift(1).iloc[-1]:.2f}× average"),
            ("No circuit-type move today (within ±8%)", abs(day_chg) <= 0.08, f"{day_chg:+.1%} today"),
            ("No corporate-action price gap (above 20%) in the last 20 days", not jump, "gap found" if jump else "clear"),
            ("Sector allowed by today's macro stance", stance_name != "DEFENSIVE" or any(d in ind for d in DEFENSIVE),
             ind),
        ]
        fails = [n for n, ok, _ in checks if ok is False]
        p_stock = (w_s + 20 * p_rule) / (n_s + 20) if p_rule else None
        rec = {
            "sym": sym, "industry": ind, "group": info.get("group", ""), "price": round(last, 2),
            "day_chg": round(day_chg, 5), "why": reasons, "p_rule": round(p_rule, 4),
            "stock_hist": {"n": n_s, "wins": w_s}, "p_stock": round(p_stock, 4) if p_stock else None,
            "target": round(last * (1 + TARGET), 2), "stop": round(last * (1 - STOP), 2),
            "exit_by": (today + pd.tseries.offsets.BDay(MAX_DAYS)).date().isoformat(),
            "checks": [{"name": n, "ok": ok, "detail": d} for n, ok, d in checks],
        }
        if fails or not market_ok:
            rec["blocked_by"] = fails or ["market-level conditions not met"]
            blocked.append(rec)
        else:
            candidates.append(rec)

    candidates.sort(key=lambda r: (-(r["p_stock"] or 0), r["sym"]))
    picks, per_ind = [], {}
    for r in candidates:
        if len(picks) >= max_picks:
            r["blocked_by"] = [f"daily limit of {max_picks} picks reached (diversification)"]
            blocked.append(r)
            continue
        if per_ind.get(r["industry"], 0) >= MAX_PER_INDUSTRY:
            r["blocked_by"] = [f"already {MAX_PER_INDUSTRY} picks in {r['industry']} (diversification)"]
            blocked.append(r)
            continue
        per_ind[r["industry"]] = per_ind.get(r["industry"], 0) + 1
        picks.append(r)

    last_bar = max((f.index[-1] for f in frames.values()), default=today)
    payload = {
        "rule": {"target": TARGET, "stop": STOP, "max_days": MAX_DAYS, "cost": COST, "min_win": MIN_WIN,
                 "max_picks": max_picks, "max_per_industry": MAX_PER_INDUSTRY},
        "stats": stats, "market": market, "market_ok": market_ok,
        "picks": picks, "blocked": blocked[:25], "universe_n": len(frames),
        "regulatory_checked": reg["checked"],
        "regulatory_counts": {"fo_ban": sorted(reg["fo_ban"]), "asm": len(reg["asm"]), "gsm": len(reg["gsm"]),
                              "events": sum(len(v) for v in reg["events"].values())},
        "provisional": bool(is_open),
        "as_of": str(last_bar.date()),
    }
    return payload, frames


# ------------------------------------------------------------------ live track of picks
def update_pick_track(track: dict, payload: dict, frames: dict, now: datetime, is_open: bool) -> dict:
    """Log final picks once per day (after the close) and resolve them against real daily prices."""
    pt = track.setdefault("picks", {"open": [], "resolved": []})
    still = []
    for rec in pt["open"]:
        df = frames.get(rec["sym"])
        if df is None:
            still.append(rec)
            continue
        entry_day = pd.Timestamp(rec["date"])
        after = df[df.index > entry_day]
        e, done = rec["entry"], None
        for k, (d, row) in enumerate(after.iterrows(), start=1):
            if row.Open <= rec["stop"]:
                done = (row.Open / e - 1 - COST, d, "stop (gap)")
            elif row.Low <= rec["stop"]:
                done = (rec["stop"] / e - 1 - COST, d, "stop")
            elif row.Open >= rec["target"]:
                done = (row.Open / e - 1 - COST, d, "target (gap)")
            elif row.High >= rec["target"]:
                done = (rec["target"] / e - 1 - COST, d, "target")
            elif k >= MAX_DAYS:
                done = (row.Close / e - 1 - COST, d, "time exit")
            if done:
                break
        if done and not (is_open and done[1].date() == now.date()):
            rec.update({"ret": round(done[0], 5), "exit_date": str(done[1].date()), "how": done[2]})
            pt["resolved"].append(rec)
        else:
            if len(after):
                rec["last"] = round(float(after.Close.iloc[-1]), 2)
            still.append(rec)
    pt["open"] = still

    # Log today's final picks once the market has closed
    after_close = now.weekday() < 5 and (now.hour, now.minute) >= (15, 35)
    today = now.date().isoformat()
    if not is_open and after_close and payload.get("as_of") == today:
        have = {(r["sym"], r["date"]) for r in pt["open"] + pt["resolved"]}
        for p in payload["picks"]:
            if (p["sym"], today) not in have:
                pt["open"].append({"sym": p["sym"], "date": today, "entry": p["price"], "target": p["target"],
                                   "stop": p["stop"], "p": p["p_rule"]})
    res = pt["resolved"]
    pt["summary"] = {"n": len(res), "wins": sum(1 for r in res if r["ret"] > 0),
                     "avg": round(sum(r["ret"] for r in res) / len(res), 5) if res else None}
    return track
