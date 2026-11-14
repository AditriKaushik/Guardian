"""Insider & governance tracker, using ONLY public NSE disclosures (never non-public information).

- Insider trading disclosures (SEBI PIT regulations): promoters, directors and key managerial people buying or
  selling their own company's shares in the market over the last 30 days.
- Promoter pledge data.
- Today's bulk and block deals (large investors buying or selling).
Governance red flags from filings (auditor exit, KMP resignations, defaults, raids...) already come from news.py.

Bookie / "dabba" trading tips are deliberately NOT tracked: off-exchange dabba trading is illegal in India and its
"news" is often rumour or manipulation. Trading on non-public information is insider trading, also illegal.

NSE sometimes changes field names or moves its API (it began redirecting www.nseindia.com/api to
www.nseindia.in in Nov 2026), so parsing is defensive and the output carries a small diagnostic block.
"""
from __future__ import annotations

from datetime import datetime, timedelta


UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "application/json, text/plain, */*", "Accept-Language": "en-US,en;q=0.9",
      "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-insider-trading"}
INSIDER_CATS = ("promoter", "director", "key managerial", "kmp", "designated", "immediate relative")


def _session():
    import requests

    s = requests.Session()
    s.headers.update(UA)
    try:
        s.get("https://www.nseindia.com", timeout=12)
    except Exception:
        pass
    return s


def _get_json(s, path: str, params: dict | None = None):
    for base in ("https://www.nseindia.com", "https://www.nseindia.in"):
        try:
            r = s.get(base + path, params=params or {}, timeout=25)
            if r.status_code == 200 and r.text.strip()[:1] in "[{":
                return r.json()
        except Exception:
            continue
    return None


def _shape(obj) -> str:
    if obj is None:
        return "none"
    if isinstance(obj, list):
        return f"list[{len(obj)}]"
    if isinstance(obj, dict):
        return "dict{" + ", ".join(f"{k}:{type(v).__name__}{'['+str(len(v))+']' if isinstance(v, (list, dict)) else ''}" for k, v in list(obj.items())[:8]) + "}"
    return type(obj).__name__


def _rows(obj) -> list:
    """Find the list of records in an NSE response, whatever key it sits under."""
    if isinstance(obj, list):
        return [r for r in obj if isinstance(r, dict)]
    if isinstance(obj, dict):
        for k in ("data", "Data", "rows", "records"):
            if isinstance(obj.get(k), list):
                return [r for r in obj[k] if isinstance(r, dict)]
        lists = [v for v in obj.values() if isinstance(v, list) and v and isinstance(v[0], dict)]
        if lists:
            return max(lists, key=len)
    return []


def _num(x) -> float:
    try:
        return float(str(x).replace(",", "").strip() or 0)
    except ValueError:
        return 0.0


def _pick(row: dict, *names, default=""):
    low = {k.lower(): v for k, v in row.items()}
    for n in names:
        if n.lower() in low and low[n.lower()] not in (None, "", "-", "Nil"):
            return low[n.lower()]
    return default


def build(now: datetime, universe: set) -> dict:
    s = _session()
    diag = {}
    to = now.strftime("%d-%m-%Y")
    frm = (now - timedelta(days=30)).strftime("%d-%m-%Y")

    # ---- insider trades (PIT)
    pit = _get_json(s, "/api/corporates-pit", {"index": "equities", "from_date": frm, "to_date": to})
    diag["pit_shape"] = _shape(pit)
    rows = _rows(pit)
    diag["pit_rows"] = len(rows)
    diag["pit_keys"] = sorted(rows[0].keys())[:25] if rows else []
    insider: dict[str, dict] = {}
    for r in rows:
        sym = str(_pick(r, "symbol")).strip().upper()
        if sym not in universe:
            continue
        cat = str(_pick(r, "personCategory", "acqCategory", "category")).lower()
        if not any(c in cat for c in INSIDER_CATS):
            continue
        mode = str(_pick(r, "acqMode", "modeOfAcq", "mode")).lower()
        ttype = str(_pick(r, "tdpTransactionType", "transactionType", "secType")).lower()
        if "market" not in mode:            # only open-market buys/sells say something about conviction
            continue
        val = _num(_pick(r, "secVal", "value", "valueOfSec", default=0))
        buy = "buy" in ttype or "purchase" in mode or "acqui" in ttype
        sell = "sell" in ttype or "sale" in mode or "dispos" in ttype
        if not (buy or sell):
            continue
        rec = insider.setdefault(sym, {"buy_cr": 0.0, "sell_cr": 0.0, "n": 0, "people": set(), "last": ""})
        rec["buy_cr" if buy else "sell_cr"] += val / 1e7
        rec["n"] += 1
        rec["people"].add(f"{_pick(r, 'acqName', 'name', default='?')} ({cat.title()})")
        rec["last"] = max(rec["last"], str(_pick(r, "date", "intimDt", "acqtoDt", default="")))
    for v in insider.values():
        v["people"] = sorted(v["people"])[:4]
        v["net_cr"] = round(v["buy_cr"] - v["sell_cr"], 2)
        v["buy_cr"], v["sell_cr"] = round(v["buy_cr"], 2), round(v["sell_cr"], 2)
        v["signal"] = "insider BUYING" if v["net_cr"] > 1 else "insider SELLING" if v["net_cr"] < -10 else "small / mixed"

    # ---- promoter pledges
    pl = _get_json(s, "/api/corporate-pledgedata", {"index": "equities"})
    diag["pledge_shape"] = _shape(pl)
    prow = _rows(pl)
    diag["pledge_rows"] = len(prow)
    diag["pledge_keys"] = sorted(prow[0].keys())[:25] if prow else []
    pledge = {}
    for r in prow:
        sym = str(_pick(r, "symbol", "comSymbol")).strip().upper()
        if sym not in universe:
            continue
        pct = _num(_pick(r, "percSharesPledged", "per3", "pledgePercent", "perPromoterSharesPledged", default=0))
        if pct > 0:
            pledge[sym] = {"pledged_pct_of_promoter": round(pct, 2),
                           "as_of": str(_pick(r, "shp", "date", "broadcastDt", default=""))}

    # ---- bulk / block deals (latest session)
    ld = _get_json(s, "/api/snapshot-capital-market-largedeal")
    deals = []
    if isinstance(ld, dict):
        for key, kind in (("BULK_DEALS_DATA", "bulk"), ("BLOCK_DEALS_DATA", "block")):
            for r in ld.get(key, []) or []:
                sym = str(_pick(r, "symbol")).strip().upper()
                if sym not in universe:
                    continue
                qty = _num(_pick(r, "qty", "quantity", default=0))
                px = _num(_pick(r, "watp", "price", "tradePrice", default=0))
                deals.append({"sym": sym, "kind": kind, "side": str(_pick(r, "buySell", "buy_sell", default="?")).upper(),
                              "client": str(_pick(r, "clientName", "client", default="?"))[:60],
                              "value_cr": round(qty * px / 1e7, 2), "date": str(_pick(r, "date", default=""))})
        diag["deal_keys"] = sorted(ld.keys())[:10]
        diag["deal_counts"] = {k: len(v) for k, v in ld.items() if isinstance(v, list)}
        first = next((v[0] for v in ld.values() if isinstance(v, list) and v), None)
        diag["deal_row_keys"] = sorted(first.keys())[:20] if isinstance(first, dict) else []
    diag["deals"] = len(deals)
    deals.sort(key=lambda d: -d["value_cr"])

    checked = {"insider": pit is not None, "pledge": pl is not None, "deals": ld is not None}
    return {"window": f"{frm} to {to}", "checked": checked, "insider": insider, "pledge": pledge,
            "deals": deals[:40], "diag": diag}


def flags_for(sym: str, ins: dict) -> list[str]:
    """Plain-language public-disclosure flags for one stock (context, not a trading rule)."""
    out = []
    if not ins or "insider" not in ins:
        return out
    i = ins["insider"].get(sym)
    if i:
        out.append(f"Insiders (30 days, open market): bought ₹{i['buy_cr']:.1f} cr, sold ₹{i['sell_cr']:.1f} cr → {i['signal']}")
    p = ins.get("pledge", {}).get(sym)
    if p and p["pledged_pct_of_promoter"] >= 10:
        out.append(f"Promoter pledge: {p['pledged_pct_of_promoter']:.1f}% of promoter shares pledged")
    d = [x for x in ins.get("deals", []) if x["sym"] == sym]
    if d:
        out.append("; ".join(f"{x['kind']} deal {x['side']} ₹{x['value_cr']:.1f} cr by {x['client']}" for x in d[:2]))
    return out


