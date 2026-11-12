"""Overnight news: what happened in the world between the last NSE close (3:30 PM IST) and now.

Sources (free, no keys): Google News RSS searches, Economic Times Markets, Moneycontrol, Livemint, BBC Business,
CNBC World, and NSE corporate announcements. Every headline is tagged with topics (war, Fed, RBI, crude, tariffs ...),
a direction for Indian stocks, and the sectors/stocks it touches. The result is a briefing, plus flags used by
Daily Picks (negative company news overnight blocks a pick).

Honest limits: evidence (and our own tests) says overnight news is mostly priced in at the 9:15 AM open.
Headline sentiment is noisy. The app therefore logs each morning's news score next to the real opening and
day move, so its usefulness is measured live instead of assumed.
"""
from __future__ import annotations

import html
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from urllib.parse import quote_plus

import pandas as pd

from . import data as D

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
      "Accept": "application/rss+xml, application/xml, text/xml, */*"}

GN = "https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"
FEEDS = [
    ("Google News: India markets", GN.format(q=quote_plus("Sensex OR Nifty OR \"Indian stocks\" when:1d"))),
    ("Google News: world economy", GN.format(q=quote_plus("Federal Reserve OR \"Wall Street\" OR \"global markets\" when:1d"))),
    ("Google News: oil & commodities", GN.format(q=quote_plus("crude oil OR OPEC OR gold price OR copper price when:1d"))),
    ("Google News: geopolitics", GN.format(q=quote_plus("war OR sanctions OR tariffs OR ceasefire when:1d"))),
    ("Google News: RBI & India economy", GN.format(q=quote_plus("RBI OR \"Indian economy\" OR rupee OR inflation India when:1d"))),
    ("Economic Times Markets", "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"),
    ("Moneycontrol", "https://www.moneycontrol.com/rss/latestnews.xml"),
    ("Livemint Markets", "https://www.livemint.com/rss/markets"),
    ("BBC Business", "https://feeds.bbci.co.uk/news/business/rss.xml"),
    ("CNBC World", "https://www.cnbc.com/id/100727362/device/rss/rss.html"),
]

# topic: (label, keyword regex, base direction for Indian stocks if the headline itself has no clear tone,
#         sectors helped (+) / hurt (-) when the news is GOOD for the market)
TOPICS = {
    "war": ("War / geopolitics", r"\bwar\b|missile|airstrike|strike on|attack|invasion|troops|military|terror|border clash|escalat|ceasefire|truce|peace talk|sanction",
            -1, {"Defence": -1, "Oil upstream": -1, "Aviation": +1, "Paints": +1}),
    "fed": ("US Fed / US rates", r"\bfed\b|federal reserve|powell|fomc|treasury yield|us yields|us inflation|us cpi|nonfarm|payroll",
            0, {"Banks": +1, "IT": 0, "Realty": +1}),
    "rbi": ("RBI / India rates", r"\brbi\b|reserve bank|repo rate|monetary policy|mpc\b|crr\b|liquidity",
            0, {"Banks": +1, "NBFC": +1, "Realty": +1, "Auto": +1}),
    "inflation": ("Inflation", r"inflation|\bcpi\b|\bwpi\b|price rise|food prices", 0, {"FMCG": +1, "Banks": +1}),
    "crude": ("Crude oil / OPEC", r"crude|brent|\bwti\b|opec|\boil\b", 0,
              {"Oil marketing (OMC)": +1, "Paints": +1, "Aviation": +1, "Oil upstream": -1}),
    "trade": ("Tariffs / trade", r"tariff|trade war|trade deal|trade talks|export curb|import duty|anti-dumping", 0, {"IT": +1, "Pharma": +1, "Metals": +1}),
    "china": ("China", r"\bchina\b|chinese|beijing|yuan|hang seng", 0, {"Metals": +1}),
    "us_mkts": ("Wall Street / global markets", r"wall street|s&p 500|nasdaq|dow jones|global markets|asian markets|global stocks|risk-off|risk-on", 0, {}),
    "fii": ("FII / FPI flows", r"\bfii|\bfpi|foreign investors|foreign portfolio|outflow|inflow", 0, {"Banks": +1}),
    "rupee": ("Rupee / dollar", r"rupee|\binr\b|dollar index|greenback|forex", 0, {"IT": -1, "Pharma": -1}),
    "metals": ("Metals / commodities", r"copper|aluminium|aluminum|steel price|iron ore|zinc|metal prices|lme\b", 0, {"Metals": +1}),
    "gold": ("Gold / silver", r"\bgold\b|silver|bullion", 0, {"Jewellery": +1, "Gold finance": +1}),
    "earnings": ("Company results", r"\bq[1-4]\b|quarterly|results|earnings|profit|net income|revenue|guidance|beats estimates|misses estimates", 0, {}),
    "policy": ("Govt policy / Budget / tax", r"budget|\bgst\b|tax|government policy|cabinet|pli scheme|disinvestment|capex", 0, {"Infra / Capital goods": +1, "PSU": +1}),
    "elections": ("Elections / politics", r"election|poll result|exit poll|coalition|no-confidence", 0, {}),
    "sebi": ("SEBI / regulation", r"\bsebi\b|regulator|f&o rule|derivatives rule|margin rule|ban on", 0, {}),
    "monsoon": ("Monsoon / weather", r"monsoon|rainfall|\bimd\b|drought|flood|heatwave|cyclone", 0, {"FMCG": +1, "Tractors / Rural": +1, "Fertilisers": +1}),
    "crypto": ("Crypto", r"bitcoin|crypto|ethereum|\bbtc\b", 0, {}),
    "tech_ai": ("Tech / AI / IT services", r"\bai\b|artificial intelligence|nvidia|chip|semiconductor|it services|h-1b|outsourcing", 0, {"IT": +1}),
}

# Context-dependent phrases first (they override the generic word lists)
PHRASES = [
    (r"rate cut|cuts rates|cut rates|eases policy|dovish", +1), (r"rate hike|raises rates|hikes rates|hawkish|tightening", -1),
    (r"(crude|oil|brent)( oil)?( prices?)? (fall|falls|fell|drop|drops|slump|slumps|slide|slides|eases|declines|plunge|plunges|tumbles?)", +1),
    (r"(crude|oil|brent)( oil)?( prices?)? (rise|rises|rose|jump|jumps|surge|surges|spike|spikes|soar|soars|climb|climbs)", -1),
    (r"rupee (gains|rises|strengthens|recovers|firms)", +1), (r"rupee (falls|slumps|weakens|hits record low|record low|slides)", -1),
    (r"inflation (cools|eases|slows|falls)", +1), (r"inflation (rises|jumps|accelerates|hits|surges)", -1),
    (r"ceasefire|truce|peace deal|peace talks|de-escalat", +1), (r"escalat|airstrike|missile|invasion|declares war|attack", -1),
    (r"tariff (cut|relief|pause|exemption)|trade deal", +1), (r"(new|higher|hikes?|imposes?) tariffs?|trade war", -1),
    (r"fii (buy|inflow)|foreign investors (buy|pour)|inflows", +1), (r"fii (sell|outflow)|foreign investors (sell|pull)|outflows", -1),
    (r"beats? estimates|tops estimates|record profit|profit (jumps|rises|surges|soars)|guidance raised|raises guidance|target raised", +1),
    (r"guidance cut|cuts guidance|target cut|lower circuit|auditor resign|pledge invoked|warning letter|import alert", -1),
    (r"yields? (rise|rises|jump|jumps|surge|climb)|dollar (strengthens|jumps|surges)", -1),
    (r"yields? (fall|falls|ease|eases|drop)|dollar (weakens|falls|slides)", +1),
    (r"china (stimulus|eases|cuts rates)", +1),
    (r"\bno rate cut|fails to|despite gains", -1),
    (r"miss(es)? estimates|profit (falls|drops|slumps|declines|plunges)|loss widens", -1),
]
POS = r"surge|surges|rally|rallies|jumps?|soars?|gains?|climbs?|record high|upgrade|upgrades|boost|boosts|strong|robust|optimism|recovery|rebound|rebounds|beats?|outperform|order win|wins order|bags order|approval|approves|buyback|dividend"
NEG = r"plunges?|slumps?|crash|crashes|tumbles?|falls?|drops?|declines?|slides?|sinks?|downgrade|downgrades|weak|fears?|worries|concern|selloff|sell-off|recession|default|fraud|probe|raid|penalty|resigns?|resignation|ban|bans|lawsuit|layoffs?|warns?|warning|pledge|insolvency|bankruptcy|loss"

# NSE filing types that usually carry information
FILING_NEG = (r"resignation of (the )?(statutory )?auditor|auditor.{0,20}resign|default|delay in (payment|servicing)|fraud|forensic|insolvency|nclt|"
              r"invocation of pledge|pledge invoked|creation of pledge|penalty|show cause|investigation|search|raid|enforcement directorate|"
              r"sebi order|downgrade|watch negative|warning letter|import alert|form 483|qualified opinion|plant shutdown|shutdown|fire at|"
              r"strike at|suspension|litigation|resignation of (the )?(cfo|ceo|chief|managing|independent)|cessation")
FILING_POS = (r"bagging|bags|receipt of order|order (win|received|worth)|award of|letter of award|l1 bidder|contract|buyback|bonus|"
              r"dividend|rating upgrade|upgrade|usfda approval|establishment inspection report|\beir\b|capacity expansion|commission(ed|ing) of")


ROUTINE = (r"analysts?/institutional|analyst.{0,10}meet|investor meet|con\. call|newspaper publication|investor presentation|"
           r"trading window|monitoring agency|shareholders meeting|certificate under|regulation 74|loss of share|duplicate share|"
           r"esop|esos|allotment of securities|record date|book closure|change in rta|registrar|intimation of")


def _get(url: str, timeout: int = 15) -> str | None:
    import requests

    try:
        r = requests.get(url, headers=UA, timeout=timeout)
        return r.text if r.status_code == 200 else None
    except Exception:
        return None


def _parse_rss(xml_text: str, source: str) -> list[dict]:
    out = []
    try:
        root = ET.fromstring(xml_text.encode("utf-8", "ignore"))
    except ET.ParseError:
        return out
    for item in root.iter("item"):
        title = html.unescape((item.findtext("title") or "").strip())
        link = (item.findtext("link") or "").strip()
        pub = item.findtext("pubDate") or ""
        src = item.find("source")
        try:
            ts = parsedate_to_datetime(pub)
            ts = pd.Timestamp(ts).tz_convert(D.IST) if ts.tzinfo else pd.Timestamp(ts).tz_localize("UTC").tz_convert(D.IST)
        except Exception:
            continue
        if title:
            out.append({"title": re.sub(r"\s+-\s+[^-]{2,40}$", "", title) if src is not None else title,
                        "link": link, "time": ts, "source": (src.text if src is not None and src.text else source)})
    return out


def last_close_time(now: datetime) -> pd.Timestamp:
    """The most recent NSE close (3:30 PM IST on a weekday) before `now`."""
    t = pd.Timestamp(now)
    close = t.normalize() + pd.Timedelta(hours=15, minutes=30)
    if t < close:
        close -= pd.Timedelta(days=1)
    while close.weekday() >= 5:
        close -= pd.Timedelta(days=1)
    return close


def score_headline(title: str) -> tuple[int, list[str]]:
    t = title.lower()
    topics = [k for k, (_, rx, _, _) in TOPICS.items() if re.search(rx, t)]
    s = 0
    for rx, v in PHRASES:
        if re.search(rx, t):
            s += v
    if s == 0:
        s = len(re.findall(rf"\b(?:{POS})\b", t)) - len(re.findall(rf"\b(?:{NEG})\b", t))
        if s == 0 and topics:
            s = TOPICS[topics[0]][2]
    return (1 if s > 0 else -1 if s < 0 else 0), topics


def _company_patterns(universe: dict) -> dict:
    """{symbol: compiled regex} from company names (without Ltd./Limited) and long symbols."""
    pats = {}
    for sym, info in universe.items():
        name = re.sub(r"\b(ltd|limited|corporation|corp|company|co|india|industries|enterprises)\b\.?", "", info.get("name", ""), flags=re.I)
        name = re.sub(r"[^A-Za-z0-9& ]", " ", name).strip()
        alts = [re.escape(name)] if len(name) >= 5 else []
        words = name.split()
        if len(words) >= 3 and len(" ".join(words[:2])) >= 8:   # "Tata Motors Passenger Vehicles" -> "Tata Motors"
            alts.append(re.escape(" ".join(words[:2])))
        if len(sym) >= 4 and sym.isalpha():
            alts.append(re.escape(sym))
        if alts:
            pats[sym] = re.compile(r"\b(?:" + "|".join(alts) + r")\b", re.I)
    return pats


def _nse_rss_filings() -> list[dict]:
    """Fallback: NSE's public RSS of online announcements (title = company, description = text)."""
    txt = _get("https://nsearchives.nseindia.com/content/RSS/Online_announcements.xml", timeout=25)
    out = []
    if not txt:
        return out
    try:
        root = ET.fromstring(txt.encode("utf-8", "ignore"))
    except ET.ParseError:
        return out
    for it in root.iter("item"):
        link = it.findtext("link") or ""
        m = re.search(r"/corporate/([A-Z0-9&-]+)_", link)
        try:
            dt = datetime.strptime((it.findtext("pubDate") or "").strip(), "%d-%b-%Y %H:%M:%S").strftime("%d-%b-%Y %H:%M:%S")
        except ValueError:
            continue
        out.append({"symbol": m.group(1) if m else "", "an_dt": dt, "desc": it.findtext("title") or "",
                    "attchmntText": it.findtext("description") or "", "attchmntFile": link})
    return out


def nse_filings(since: pd.Timestamp, universe: dict) -> list[dict]:
    symbols = set(universe)
    by_name = {v.get("name", "").lower(): k for k, v in universe.items() if v.get("name")}
    import requests

    try:
        s = requests.Session()
        s.headers.update({**UA, "Accept": "application/json",
                          "Referer": "https://www.nseindia.com/companies-listing/corporate-filings-announcements"})
        s.get("https://www.nseindia.com", timeout=10)
        r = s.get("https://www.nseindia.com/api/corporate-announcements",
                  params={"index": "equities", "from_date": since.strftime("%d-%m-%Y"),
                          "to_date": pd.Timestamp.now(tz=D.IST).strftime("%d-%m-%Y")}, timeout=25)
        rows = r.json()
    except Exception:
        rows = _nse_rss_filings()
    if not rows:
        rows = _nse_rss_filings()
    out = []
    for x in rows if isinstance(rows, list) else []:
        sym = x.get("symbol") or by_name.get((x.get("desc") or "").strip().lower(), "")
        if sym not in symbols:
            continue
        try:
            ts = pd.Timestamp(datetime.strptime(x["an_dt"], "%d-%b-%Y %H:%M:%S")).tz_localize(D.IST)
        except Exception:
            continue
        if ts < since:
            continue
        text = f"{x.get('desc', '')}: {x.get('attchmntText', '')}"
        if not x.get("symbol"):   # RSS rows: the title is the company name, the subject is in the description
            x["desc"] = (x.get("attchmntText", "").split("SUBJECT:")[-1].strip() or "Announcement")[:80]
        low = text.lower()
        tone = -1 if re.search(FILING_NEG, low) else 1 if re.search(FILING_POS, low) else 0
        if tone == 0 and re.search(ROUTINE, low):
            continue   # routine paperwork carries no price information
        out.append({"sym": sym, "time": ts, "type": x.get("desc", ""), "text": x.get("attchmntText", "")[:220],
                    "link": x.get("attchmntFile", ""), "tone": tone})
    return out


def build(now: datetime, universe: dict) -> dict:
    """universe: {symbol: {"name": ..., "industry": ...}}"""
    since = last_close_time(now)
    items, feed_status = [], []
    for name, url in FEEDS:
        txt = _get(url)
        got = _parse_rss(txt, name) if txt else []
        feed_status.append({"feed": name, "ok": txt is not None, "items": len(got)})
        items += got
    seen, news = set(), []
    for it in sorted(items, key=lambda x: x["time"], reverse=True):
        key = re.sub(r"\W+", " ", it["title"].lower()).strip()[:90]
        if it["time"] < since or key in seen:
            continue
        seen.add(key)
        news.append(it)

    pats = _company_patterns(universe)
    topic_agg, stock_news = {}, {}
    scored = []
    for it in news:
        tone, topics = score_headline(it["title"])
        stocks = [s for s, rx in pats.items() if rx.search(it["title"])]
        rec = {"title": it["title"], "link": it["link"], "source": it["source"],
               "time": it["time"].strftime("%Y-%m-%d %H:%M"), "tone": tone, "topics": topics, "stocks": stocks}
        scored.append(rec)
        for k in topics:
            a = topic_agg.setdefault(k, {"n": 0, "pos": 0, "neg": 0, "headlines": []})
            a["n"] += 1
            a["pos"] += tone > 0
            a["neg"] += tone < 0
            if len(a["headlines"]) < 4:
                a["headlines"].append(rec)
        for s in stocks:
            stock_news.setdefault(s, []).append({"title": it["title"], "tone": tone, "link": it["link"], "time": rec["time"]})

    filings = nse_filings(since, universe)
    for f in filings:
        stock_news.setdefault(f["sym"], []).append({"title": f"NSE filing: {f['type']}: {f['text']}", "tone": f["tone"],
                                                     "link": f["link"], "time": f["time"].strftime("%Y-%m-%d %H:%M"),
                                                     "filing": True})

    topics = []
    for k, a in sorted(topic_agg.items(), key=lambda kv: -kv[1]["n"]):
        label, _, _, sectors = TOPICS[k]
        net = (a["pos"] - a["neg"]) / a["n"]
        direction = "positive" if net > 0.15 else "negative" if net < -0.15 else "mixed"
        sign = 1 if direction == "positive" else -1 if direction == "negative" else 0
        topics.append({"key": k, "label": label, "n": a["n"], "pos": a["pos"], "neg": a["neg"], "direction": direction,
                       "sectors": [{"sector": s, "effect": (sign * v) if sign else 0} for s, v in sectors.items() if v],
                       "headlines": a["headlines"]})
    tones = [r["tone"] for r in scored if r["topics"]]
    score = sum(tones) / len(tones) if tones else 0.0
    stocks_flag = {}
    for s, lst in stock_news.items():
        t = sum(x["tone"] for x in lst)
        stocks_flag[s] = {"tone": t, "n": len(lst), "items": lst[:5],
                          "negative": any(x["tone"] < 0 for x in lst)}
    return {
        "since": since.strftime("%Y-%m-%d %H:%M"), "until": pd.Timestamp(now).strftime("%Y-%m-%d %H:%M"),
        "n_headlines": len(scored), "score": round(score, 3),
        "mood": "positive" if score > 0.1 else "negative" if score < -0.1 else "mixed",
        "topics": topics[:12], "latest": scored[:30], "stocks": stocks_flag,
        "n_filings": len(filings), "feeds": feed_status,
    }


def update_news_log(track: dict, news: dict, nifty_daily: pd.DataFrame, now: datetime) -> dict:
    """Live check of usefulness: store the pre-open news score each day, then add the real Nifty gap and day move."""
    log = track.setdefault("news_log", [])
    t = pd.Timestamp(now)
    today = t.strftime("%Y-%m-%d")
    pre_open = t.weekday() < 5 and (t.hour, t.minute) < (9, 15)
    if pre_open and news.get("n_headlines", 0) >= 5:
        row = next((r for r in log if r["date"] == today), None)
        if row is None:
            log.append({"date": today, "score": news["score"], "n": news["n_headlines"]})
        else:
            row.update({"score": news["score"], "n": news["n_headlines"]})
    if not nifty_daily.empty:
        nd = nifty_daily.copy()
        nd.index = pd.to_datetime(nd.index).tz_localize(None).normalize() if nd.index.tz is not None else nd.index
        for r in log:
            if "gap" in r:
                continue
            d = pd.Timestamp(r["date"])
            if d in nd.index and (d < t.tz_localize(None).normalize() or (t.hour, t.minute) >= (15, 35)):
                prev = nd["Close"][nd.index < d]
                if len(prev):
                    r["gap"] = round(float(nd.at[d, "Open"] / prev.iloc[-1] - 1), 5)
                    r["day"] = round(float(nd.at[d, "Close"] / nd.at[d, "Open"] - 1), 5)
    track["news_log"] = log[-120:]
    done = [r for r in track["news_log"] if "gap" in r and r["score"] != 0]
    summ = {"days": len(done)}
    if len(done) >= 5:
        summ["gap_hit"] = round(sum((r["score"] > 0) == (r["gap"] > 0) for r in done) / len(done), 3)
        summ["day_hit"] = round(sum((r["score"] > 0) == (r["day"] > 0) for r in done) / len(done), 3)
    track["news_summary"] = summ
    return track


