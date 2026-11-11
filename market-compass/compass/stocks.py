"""Popular NSE stocks with their sectors (not an official index list; any NSE symbol works)."""
from __future__ import annotations

STOCKS = {
    "RELIANCE": "Energy / Conglomerate", "HDFCBANK": "Banks", "ICICIBANK": "Banks",
    "SBIN": "Banks (PSU)", "KOTAKBANK": "Banks", "AXISBANK": "Banks", "INDUSINDBK": "Banks",
    "BAJFINANCE": "NBFC", "BAJAJFINSV": "NBFC", "SHRIRAMFIN": "NBFC", "JIOFIN": "NBFC",
    "HDFCLIFE": "Insurance", "SBILIFE": "Insurance",
    "INFY": "IT", "TCS": "IT", "HCLTECH": "IT", "WIPRO": "IT", "TECHM": "IT",
    "BHARTIARTL": "Telecom",
    "ITC": "FMCG", "HINDUNILVR": "FMCG", "NESTLEIND": "FMCG", "BRITANNIA": "FMCG", "TATACONSUM": "FMCG",
    "MARUTI": "Auto", "M&M": "Auto / Tractors", "BAJAJ-AUTO": "Auto (2-wheeler)",
    "EICHERMOT": "Auto (2-wheeler)", "HEROMOTOCO": "Auto (2-wheeler)",
    "SUNPHARMA": "Pharma", "DRREDDY": "Pharma", "CIPLA": "Pharma", "APOLLOHOSP": "Healthcare",
    "LT": "Capital goods / Infra", "BEL": "Defence", "ADANIPORTS": "Infra / Ports", "ADANIENT": "Conglomerate",
    "NTPC": "Power (PSU)", "POWERGRID": "Power (PSU)", "COALINDIA": "Mining (PSU)", "ONGC": "Oil upstream (PSU)",
    "TATASTEEL": "Metals", "JSWSTEEL": "Metals", "HINDALCO": "Metals",
    "ULTRACEMCO": "Cement", "GRASIM": "Cement / Diversified", "ASIANPAINT": "Paints",
    "TITAN": "Jewellery / Consumer", "TRENT": "Retail", "ETERNAL": "Internet / Food delivery",
}

INDICES = {
    "^NSEI": "Nifty 50", "^NSEBANK": "Bank Nifty",
}


def to_yahoo(symbol: str) -> str:
    """'reliance' -> 'RELIANCE.NS'. Leaves index (^...) and already-suffixed symbols alone."""
    s = symbol.strip().upper()
    if not s:
        return s
    if s.startswith("^") or s.endswith(".NS") or s.endswith(".BO") or "=" in s:
        return s
    return s + ".NS"
