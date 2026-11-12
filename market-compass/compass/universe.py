"""Which stocks the app covers, decided fresh on every build from NSE's official lists.

1. ALL current Nifty 50 constituents (NSE's official list, so index changes are picked up
   automatically).
2. "Top performers": the strongest stocks from Nifty Next 50 + Nifty Midcap 50, ranked by
   3-month return (must also be up over 1 month).
3. Nifty 50 and Bank Nifty indices.

If NSE's lists can't be downloaded, a built-in copy of the Nifty 50 list is used instead.
"""
from __future__ import annotations

import csv
import io

import pandas as pd

LIST_URLS = [
    "https://nsearchives.nseindia.com/content/indices/{name}.csv",
    "https://archives.nseindia.com/content/indices/{name}.csv",
    "https://www.niftyindices.com/IndexConstituent/{name}.csv",
]

# Built-in fallback: Nifty 50 constituents per NSE's official list, checked 12 Nov 2026.
NIFTY50_FALLBACK = {
    "ADANIENT": "Metals & Mining", "ADANIPORTS": "Services", "APOLLOHOSP": "Healthcare",
    "ASIANPAINT": "Consumer Durables", "AXISBANK": "Financial Services", "BSE": "Capital Markets",
    "BAJAJ-AUTO": "Automobile", "BAJFINANCE": "Financial Services", "BAJAJFINSV": "Financial Services",
    "BEL": "Capital Goods", "BHARTIARTL": "Telecommunication", "CIPLA": "Healthcare",
    "COALINDIA": "Oil Gas & Fuels", "DRREDDY": "Healthcare", "EICHERMOT": "Automobile",
    "ETERNAL": "Consumer Services", "GRASIM": "Construction Materials", "HCLTECH": "Information Technology",
    "HDFCBANK": "Financial Services", "HDFCLIFE": "Financial Services", "HINDALCO": "Metals & Mining",
    "HINDUNILVR": "FMCG", "ICICIBANK": "Financial Services", "ITC": "FMCG", "INFY": "Information Technology",
    "INDIGO": "Services", "JSWSTEEL": "Metals & Mining", "JIOFIN": "Financial Services",
    "KOTAKBANK": "Financial Services", "LT": "Construction", "M&M": "Automobile", "MARUTI": "Automobile",
    "MAXHEALTH": "Healthcare", "NTPC": "Power", "NESTLEIND": "FMCG", "ONGC": "Oil Gas & Fuels",
    "POWERGRID": "Power", "RELIANCE": "Oil Gas & Fuels", "SBILIFE": "Financial Services",
    "SHRIRAMFIN": "Financial Services", "SBIN": "Financial Services", "SUNPHARMA": "Healthcare",
    "TCS": "Information Technology", "TATACONSUM": "FMCG", "TMPV": "Automobile",
    "TATASTEEL": "Metals & Mining", "TECHM": "Information Technology", "TITAN": "Consumer Durables",
    "TRENT": "Consumer Services", "ULTRACEMCO": "Construction Materials",
}


def fetch_index_list(name: str) -> dict[str, str]:
    """{symbol: industry} for an NSE index list such as 'ind_nifty50list'. Empty dict on failure."""
    import requests

    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36"}
    for url in LIST_URLS:
        try:
            r = requests.get(url.format(name=name), headers=headers, timeout=20)
            if r.status_code != 200 or "Symbol" not in r.text[:300]:
                continue
            rows = list(csv.DictReader(io.StringIO(r.text)))
            out = {row["Symbol"].strip(): (row.get("Industry") or "").strip() for row in rows if row.get("Symbol")}
            if len(out) >= 40:
                return out
        except Exception:
            continue
    return {}


def top_performers(candidates: dict[str, str], n: int = 20) -> list[dict]:
    """Rank candidates by 3-month return using real daily prices; keep the top n that are also up over 1 month."""
    import yfinance as yf

    if not candidates:
        return []
    tickers = [s + ".NS" for s in candidates]
    try:
        px = yf.download(tickers, period="6mo", interval="1d", auto_adjust=True, progress=False,
                         threads=True, group_by="column")["Close"]
    except Exception:
        return []
    if isinstance(px, pd.Series):
        px = px.to_frame()
    rows = []
    for t in px.columns:
        c = px[t].dropna()
        if len(c) < 70:
            continue
        r3 = c.iloc[-1] / c.iloc[-64] - 1
        r1 = c.iloc[-1] / c.iloc[-22] - 1
        sym = str(t).removesuffix(".NS")
        rows.append({"symbol": sym, "industry": candidates.get(sym, ""), "r3m": float(r3), "r1m": float(r1)})
    rows = [r for r in rows if r["r1m"] > 0]
    rows.sort(key=lambda r: -r["r3m"])
    return rows[:n]


def build_universe(n_top: int = 20) -> dict:
    """{symbol: {"sector": ..., "group": "Nifty 50" | "Top performer" | "Index", ...}} plus source info."""
    nifty = fetch_index_list("ind_nifty50list")
    source = "NSE official list"
    if not nifty:
        nifty, source = dict(NIFTY50_FALLBACK), "built-in list (NSE list unavailable)"
    others = {}
    for name in ("ind_niftynext50list", "ind_niftymidcap50list"):
        others.update(fetch_index_list(name))
    for s in nifty:
        others.pop(s, None)
    tops = top_performers(others, n_top)

    uni = {s: {"sector": ind or "Other", "group": "Nifty 50"} for s, ind in nifty.items()}
    for r in tops:
        uni[r["symbol"]] = {"sector": r["industry"] or "Other", "group": "Top performer",
                            "why": f"+{r['r3m']*100:.0f}% in 3 months, +{r['r1m']*100:.0f}% in 1 month"}
    uni["^NSEI"] = {"sector": "Index", "group": "Index", "name": "Nifty 50"}
    uni["^NSEBANK"] = {"sector": "Index", "group": "Index", "name": "Bank Nifty"}
    return {"stocks": uni, "nifty_source": source, "n_nifty": len(nifty), "n_top": len(tops),
            "top_pool": len(others)}
