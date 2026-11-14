"""Build the installable web app's live data file from REAL market data.

    python -m compass.build_site OUTPUT_DIR [--previous-track URL_OR_PATH]

Writes OUTPUT_DIR/data.json (markets, scorecard, smart money, stock predictions, calendar) and
OUTPUT_DIR/track.json (the live track record: every prediction made, later checked against
what the price actually did). Run by GitHub Actions on a schedule, see .github/workflows/pages.yml.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd

from . import __version__
from . import data as D
from . import events as E
from . import scorecard as S
from . import stock_model as M
from .stocks import to_yahoo
from .universe import build_universe
from . import picks as PK
from . import crossasset as XA
from . import news as NW
from . import history as HL
from . import intraday as INT
from . import insiders as INS
from .universe import NAMES, fetch_index_list

HORIZONS = [1, 2, 3, "close"]
KEEP_DAYS = 20


def _num(x, nd=4):
    if x is None:
        return None
    try:
        f = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) or math.isinf(f) else round(f, nd)


def _history_retry(symbol, period, interval, tries=3):
    for i in range(tries):
        df = D.history(symbol, period=period, interval=interval)
        if not df.empty:
            return df
        time.sleep(2 * (i + 1))
    return df


def live_quotes(yahoo_symbols: list[str]) -> dict:
    """Latest 1-minute price and its time (IST) for each symbol, in one batch request. {} on failure."""
    import yfinance as yf

    out = {}
    try:
        px = yf.download(yahoo_symbols, period="5d", interval="1m", progress=False, threads=True,
                         auto_adjust=False, group_by="column")["Close"]
    except Exception:
        return out
    if isinstance(px, pd.Series):
        px = px.to_frame(yahoo_symbols[0])
    for col in px.columns:
        c = px[col].dropna()
        if len(c):
            ts = c.index[-1]
            ts = ts.tz_convert(D.IST) if ts.tzinfo else ts.tz_localize("UTC").tz_convert(D.IST)
            out[str(col)] = (float(c.iloc[-1]), ts.strftime("%Y-%m-%d %H:%M"))
    return out


def _pred_dict(p: M.Prediction) -> dict:
    return {
        "p_up": _num(p.p_up), "p_raw": _num(p.p_model_raw), "base": _num(p.base_rate),
        "rel": _num(p.reliability), "acc": _num(p.test_accuracy), "acc_base": _num(p.test_baseline),
        "auc": _num(p.test_auc), "conf_acc": _num(p.confident_acc), "conf_n": p.confident_n,
        "n_train": p.n_train, "n_test": p.n_test,
        "lo": _num(p.range_lo, 2), "mid": _num(p.range_mid, 2), "hi": _num(p.range_hi, 2),
        "drivers": [[n, _num(v, 3)] for n, v in p.drivers],
    }


def _bars_left_today(last_bar: pd.Timestamp, now: datetime, is_open: bool) -> int:
    """How many more full hourly bars fit today after the current (last) bar."""
    if not is_open or last_bar.date() != now.date():
        return 0
    close_bar = last_bar.replace(hour=15, minute=15)
    return int((close_bar - last_bar) / pd.Timedelta(hours=1))


def build_stocks(universe: dict, now: datetime, is_open: bool) -> tuple[dict, dict, list]:
    idx = _history_retry("^NSEI", "730d", "60m")
    out, frames, failed = {}, {}, []
    for sym, info in universe.items():
        ysym = to_yahoo(sym)
        df = _history_retry(ysym, "730d", "60m")
        if df.empty or len(df) < 300:
            failed.append(sym)
            continue
        frames[sym] = df
        last_bar = df.index[-1]
        left = _bars_left_today(last_bar, now, is_open)
        preds, p2 = {}, None
        for h in HORIZONS:
            p = M.predict(df, None if ysym == "^NSEI" else idx, h)
            if not p.ok:
                continue
            if h == 2:
                p2 = p
            d = _pred_dict(p)
            d["fits_today"] = (h == "close" and is_open) or (isinstance(h, int) and h <= left)
            preds[str(h)] = d
        if not preds:
            failed.append(sym)
            continue
        p2 = p2 or M.predict(df, None if ysym == "^NSEI" else idx, 1)
        earlier = df["Close"][df.index.date < last_bar.date()]
        prev_close = float(earlier.iloc[-1]) if len(earlier) else None
        last = float(df["Close"].iloc[-1])
        tail = df.tail(75)
        out[sym] = {
            "name": info.get("name", sym), "sector": info.get("sector", ""), "group": info.get("group", ""),
            "why": info.get("why", ""), "yahoo": ysym,
            "last": _num(last, 2), "last_time": str(last_bar)[:16],
            "prev_close": _num(prev_close, 2),
            "day_chg": _num(last / prev_close - 1, 5) if prev_close else None,
            "atr": _num(p2.atr, 2),
            "signals": [[t, s] for t, s in p2.signals],
            "preds": preds,
            "candles": {
                "t": [x.strftime("%d %b %H:%M") for x in tail.index],
                "o": [_num(v, 2) for v in tail["Open"]], "h": [_num(v, 2) for v in tail["High"]],
                "l": [_num(v, 2) for v in tail["Low"]], "c": [_num(v, 2) for v in tail["Close"]],
            },
        }
        time.sleep(0.2)
    quotes = live_quotes([v["yahoo"] for v in out.values()])
    for sym, rec in out.items():
        q = quotes.get(rec["yahoo"])
        if q and q[1] >= rec["last_time"]:
            rec["last"], rec["quote_time"] = _num(q[0], 2), q[1]
            if rec["prev_close"]:
                rec["day_chg"] = _num(q[0] / rec["prev_close"] - 1, 5)
        else:
            rec["quote_time"] = rec["last_time"]
    return out, frames, failed


# ------------------------------------------------------------------ live track record
def load_previous_track(src: str | None) -> dict:
    empty = {"open": [], "resolved": [], "totals": {}, "picks": {"open": [], "resolved": []}}
    if not src:
        return empty
    try:
        if src.startswith("http"):
            import requests

            r = requests.get(src, params={"t": int(time.time())}, timeout=20)
            if r.status_code != 200:
                return empty
            data = r.json()
        else:
            data = json.loads(Path(src).read_text())
        return {**empty, **data}
    except Exception:
        return empty


def update_track(track: dict, stocks: dict, frames: dict, now: datetime, is_open: bool) -> dict:
    """Resolve matured predictions against real prices, then log new ones (one per stock/horizon/bar)."""
    still_open = []
    for rec in track["open"]:
        df = frames.get(rec["sym"])
        if df is None:
            still_open.append(rec)
            continue
        target = pd.Timestamp(rec["target"])
        done_at = target + pd.Timedelta(hours=1) if target.hour < 15 else target.replace(hour=15, minute=30)
        if pd.Timestamp(now) < done_at:
            if pd.Timestamp(now) - pd.Timestamp(rec["made"]) < pd.Timedelta(days=4):
                still_open.append(rec)
            continue
        if target not in df.index:
            continue  # holiday / missing bar: drop it
        exit_price = float(df.loc[target, "Close"])
        rec["exit"] = round(exit_price, 2)
        rec["up"] = int(exit_price > rec["price"])
        rec["move"] = round(exit_price / rec["price"] - 1, 5)
        track["resolved"].append(rec)
    track["open"] = still_open

    if is_open:
        have = {(r["sym"], r["h"], r["bar"]) for r in track["open"]}
        for sym, s in stocks.items():
            bar = pd.Timestamp(s["last_time"]).tz_localize(D.IST) if pd.Timestamp(s["last_time"]).tzinfo is None else pd.Timestamp(s["last_time"])
            for h, p in s["preds"].items():
                if not p.get("fits_today") or (sym, h, str(bar)) in have:
                    continue
                target = bar.replace(hour=15, minute=15) if h == "close" else bar + pd.Timedelta(hours=int(h))
                track["open"].append({
                    "sym": sym, "h": h, "bar": str(bar), "made": now.isoformat(timespec="minutes"),
                    "target": str(target), "price": s["last"], "p": p["p_up"], "rel": p["rel"],
                })

    cutoff = (now - timedelta(days=KEEP_DAYS)).isoformat()
    track["resolved"] = [r for r in track["resolved"] if r["made"] >= cutoff]
    track["totals"] = summarize(track["resolved"])
    track["updated"] = now.isoformat(timespec="minutes")
    return track


def summarize(resolved: list) -> dict:
    """Live accuracy: all predictions, and 'actionable' calls (trusted model, p >= 60% or <= 40%)."""
    def stats(rows):
        if not rows:
            return {"n": 0}
        hits = [int((r["p"] >= 0.5) == bool(r["up"])) for r in rows]
        ups = sum(r["up"] for r in rows)
        brier = sum((r["p"] - r["up"]) ** 2 for r in rows) / len(rows)
        base = ups / len(rows)
        return {"n": len(rows), "hit": round(sum(hits) / len(rows), 4), "up_rate": round(base, 4),
                "always_guess": round(max(base, 1 - base), 4), "brier": round(brier, 4),
                "brier_coinflip": 0.25}
    act = [r for r in resolved if (r.get("rel") or 0) >= 0.35 and (r["p"] >= 0.6 or r["p"] <= 0.4)]
    by_h = {h: stats([r for r in resolved if r["h"] == h]) for h in ["1", "2", "3", "close"]}
    return {"all": stats(resolved), "actionable": stats(act), "by_horizon": by_h}


# ------------------------------------------------------------------ main
def build(out_dir: Path, previous_track: str | None) -> dict:
    now = D.now_ist()
    is_open, status = D.market_status(now)
    snap = D.macro_snapshot()
    if is_open:
        nifty_now = D.history("^NSEI", "5d", "60m")
        if nifty_now.empty or pd.Timestamp(now) - nifty_now.index[-1] > pd.Timedelta(minutes=80):
            is_open, status = False, "Market closed today (NSE holiday or no trading data yet)."
    uni = build_universe()
    fii = D.fii_dii()
    macro = {k: {kk: (_num(vv, 4) if isinstance(vv, float) else vv) for kk, vv in v.items() if kk != "series"}
             | ({"spark": [_num(x, 4) for x in v["series"].tail(30)]} if v.get("ok") else {})
             for k, v in snap.items()}
    mq = live_quotes([v["ticker"] for v in snap.values() if v.get("ok")])
    for k, v in macro.items():
        q = mq.get(v.get("ticker"))
        if v.get("ok") and q:
            v["asof"] = q[1]
    factors = []
    for f in S.FACTORS:
        a, reason = S.auto_score(f.key, snap, fii) if f.auto else (None, "")
        factors.append({"key": f.key, "name": f.name, "auto": f.auto, "good": f.good, "bad": f.bad,
                        "where": f.where, "sectors": f.sectors, "auto_score": a, "reason": reason})
    sectors = D.sector_performance()
    stocks, frames, failed = build_stocks(uni["stocks"], now, is_open)
    today = now.date()
    cal = E.upcoming(today, 90)
    cal["date"] = cal["date"].astype(str)

    track = update_track(load_previous_track(previous_track), stocks, frames, now, is_open)

    try:
        ibt, ilive = INT.scan(frames, now)
        track = INT.update_track(track, ilive, ibt, now)
        intraday_lab = {"setups": INT.stats(ibt, track, PK.MIN_WIN), "live": ilive, "cost": INT.COST,
                        "min_live": INT.MIN_LIVE_TRADES, "min_win": PK.MIN_WIN,
                        "recent": track.get("intraday", {}).get("resolved", [])[-25:],
                        "open": len(track.get("intraday", {}).get("open", []))}
    except Exception as exc:
        intraday_lab = {"error": f"Intraday lab unavailable this refresh: {exc}"}

    try:
        global_view = XA.build(now, snap)
    except Exception as exc:
        global_view = {"error": f"Global view unavailable this refresh: {exc}"}

    insiders = {"error": "Insider data not built this refresh"}
    try:
        news_uni = {}
        for lst in ("ind_nifty50list", "ind_niftynext50list", "ind_niftymidcap50list"):
            for sym, ind in fetch_index_list(lst).items():
                news_uni[sym] = {"name": NAMES.get(sym, sym), "industry": ind}
        news = NW.build(now, news_uni)
        try:
            insiders = INS.build(now, set(news_uni))
        except Exception as exc:
            insiders = {"error": f"Insider data unavailable this refresh: {exc}"}
        track = NW.update_news_log(track, news, D.history("^NSEI", "3mo", "1d"), now)
        news["live_check"] = track.get("news_summary", {})
    except Exception as exc:
        news = {"error": f"News unavailable this refresh: {exc}"}

    try:
        hist_lab = HL.build(now)
    except Exception as exc:
        hist_lab = {"error": f"History lab unavailable this refresh: {exc}"}

    auto = [f["auto_score"] for f in factors if f["auto"] and f["auto_score"] is not None]
    try:
        picks, daily_frames = PK.build_picks(snap, sum(auto) / len(auto) if auto else 0.0, fii, now, is_open,
                                             None if "error" in news else news.get("stocks", {}))
        track = PK.update_pick_track(track, picks, daily_frames, now, is_open)
        picks["track"] = track.get("picks", {}).get("summary", {})
        for p_ in picks.get("picks", []) + picks.get("sell", {}).get("picks", []):
            p_["insider_flags"] = INS.flags_for(p_["sym"], insiders if "error" not in insiders else {})
        picks["track_sell"] = track.get("picks", {}).get("summary_sell", {})
    except Exception as exc:  # never let the picks page break the rest of the app
        picks = {"error": f"Daily picks unavailable this refresh: {exc}"}

    payload = {
        "version": __version__,
        "generated_at": now.isoformat(timespec="minutes"),
        "market_open": is_open, "market_status": status,
        "macro": macro, "factors": factors, "fii": fii,
        "sectors": sectors.round(2).to_dict(orient="records") if not sectors.empty else [],
        "stocks": stocks, "failed": failed,
        "universe": {k: v for k, v in uni.items() if k != "stocks"},
        "calendar": cal.to_dict(orient="records"), "seasonal": E.SEASONAL[today.month],
        "track_summary": track["totals"],
        "daily_picks": picks,
        "global": global_view,
        "news": news,
        "insiders": insiders,
        "history": hist_lab,
        "intraday_lab": intraday_lab,
    }
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "data.json").write_text(json.dumps(payload, separators=(",", ":")))
    (out_dir / "track.json").write_text(json.dumps(track, separators=(",", ":")))
    return payload


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir")
    ap.add_argument("--previous-track", default=None)
    a = ap.parse_args(argv)
    p = build(Path(a.out_dir), a.previous_track)
    n = len(p["stocks"])
    print(f"Built {n} stocks ({len(p['failed'])} failed: {p['failed']}) at {p['generated_at']}; "
          f"market open={p['market_open']}; live track: {p['track_summary'].get('all', {})}")
    if n < 40:
        print("Too few stocks built: data source problem", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
