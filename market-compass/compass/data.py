"""Live data fetching: Yahoo Finance (prices) and NSE (FII/DII flows). No demo or sample data."""
from __future__ import annotations

from datetime import datetime

import numpy as np
import pandas as pd

IST = "Asia/Kolkata"

# Global / macro instruments tracked automatically (Yahoo Finance tickers).
MACRO_TICKERS = {
    "usdinr": ("INR=X", "USD / INR"),
    "dxy": ("DX-Y.NYB", "US Dollar Index"),
    "us10y": ("^TNX", "US 10-yr yield (%)"),
    "brent": ("BZ=F", "Brent crude ($)"),
    "vix": ("^INDIAVIX", "India VIX"),
    "nifty": ("^NSEI", "Nifty 50"),
    "banknifty": ("^NSEBANK", "Bank Nifty"),
    "sp500": ("^GSPC", "S&P 500 (US)"),
    "nikkei": ("^N225", "Nikkei (Japan)"),
    "hangseng": ("^HSI", "Hang Seng (HK)"),
    "gold": ("GC=F", "Gold ($)"),
}

SECTOR_INDICES = {
    "^NSEBANK": "Bank", "^CNXIT": "IT", "^CNXAUTO": "Auto", "^CNXFMCG": "FMCG",
    "^CNXPHARMA": "Pharma", "^CNXMETAL": "Metal", "^CNXREALTY": "Realty",
    "^CNXENERGY": "Energy", "^CNXPSUBANK": "PSU Bank", "^CNXINFRA": "Infra",
    "^CNXMEDIA": "Media", "^CNXFIN": "Financial Services",
}


# ---------------------------------------------------------------- price history
def history(symbol: str, period: str = "6mo", interval: str = "1d") -> pd.DataFrame:
    """Live OHLCV history from Yahoo Finance: Open, High, Low, Close, Volume. Empty frame on failure."""
    try:
        import yfinance as yf

        df = yf.Ticker(symbol).history(period=period, interval=interval, auto_adjust=False)
    except Exception:
        return pd.DataFrame()
    if df is None or df.empty:
        return pd.DataFrame()
    df = df[[c for c in ["Open", "High", "Low", "Close", "Volume"] if c in df.columns]].copy()
    df = df.dropna(subset=["Close"])
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    if symbol.endswith(".NS") or symbol.endswith(".BO") or symbol in ("^NSEI", "^NSEBANK", "^INDIAVIX") or symbol.startswith("^CNX"):
        df.index = df.index.tz_convert(IST)
    return df


# ---------------------------------------------------------------- macro snapshot
def macro_snapshot() -> dict:
    """For each macro instrument: last value, 1-day and 5-day change, plus moving averages for Nifty."""
    out = {}
    for key, (ticker, label) in MACRO_TICKERS.items():
        df = history(ticker, period="1y" if key == "nifty" else "3mo", interval="1d")
        if df.empty or len(df) < 6:
            out[key] = {"label": label, "ticker": ticker, "ok": False}
            continue
        c = df["Close"]
        rec = {
            "label": label, "ticker": ticker, "ok": True,
            "last": float(c.iloc[-1]),
            "chg1": float(c.iloc[-1] / c.iloc[-2] - 1),
            "chg5": float(c.iloc[-1] / c.iloc[-6] - 1),
            "diff5": float(c.iloc[-1] - c.iloc[-6]),
            "asof": str(df.index[-1])[:16],
            "series": c.tail(60),
        }
        if key == "nifty":
            rec["ma20"] = float(c.rolling(20).mean().iloc[-1])
            rec["ma50"] = float(c.rolling(50).mean().iloc[-1])
            rec["ma200"] = float(c.rolling(200).mean().iloc[-1]) if len(c) >= 200 else float("nan")
        out[key] = rec
    return out


def sector_performance() -> pd.DataFrame:
    rows = []
    for ticker, name in SECTOR_INDICES.items():
        df = history(ticker, period="1mo", interval="1d")
        if df.empty or len(df) < 6:
            continue
        c = df["Close"]
        rows.append({"Sector": name, "1-day %": 100 * (c.iloc[-1] / c.iloc[-2] - 1),
                     "5-day %": 100 * (c.iloc[-1] / c.iloc[-6] - 1),
                     "1-month %": 100 * (c.iloc[-1] / c.iloc[0] - 1)})
    return pd.DataFrame(rows).sort_values("5-day %", ascending=False) if rows else pd.DataFrame()


# ---------------------------------------------------------------- NSE FII / DII
def fii_dii() -> dict | None:
    """Latest FII and DII net cash-market flows in Rs crore, from NSE. None if unavailable.

    NSE often blocks requests from cloud servers or outside India; the app then asks for manual entry.
    """
    try:
        import requests

        s = requests.Session()
        s.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://www.nseindia.com/reports/fii-dii",
        })
        s.get("https://www.nseindia.com", timeout=10)
        r = s.get("https://www.nseindia.com/api/fiidiiTradeReact", timeout=10)
        rows = r.json()
    except Exception:
        return None
    res = {"source": "NSE"}
    for row in rows if isinstance(rows, list) else []:
        cat = str(row.get("category", "")).upper()
        try:
            net = float(str(row.get("netValue", "0")).replace(",", ""))
        except ValueError:
            continue
        if "FII" in cat or "FPI" in cat:
            res["FII"] = net
        elif "DII" in cat:
            res["DII"] = net
        res["date"] = row.get("date", "")
    return res if "FII" in res else None


def now_ist() -> datetime:
    return pd.Timestamp.now(tz=IST).to_pydatetime()


def market_status(ts: datetime | None = None) -> tuple[bool, str]:
    ts = ts or now_ist()
    if ts.weekday() >= 5:
        return False, "Weekend: market closed (NSE holidays are not checked)."
    start = ts.replace(hour=9, minute=15, second=0, microsecond=0)
    end = ts.replace(hour=15, minute=30, second=0, microsecond=0)
    if ts < start:
        return False, f"Pre-open: market opens in {int((start - ts).total_seconds() // 60)} min."
    if ts > end:
        return False, "Market closed for the day."
    return True, f"Market open: {int((end - ts).total_seconds() // 60)} min to close."


