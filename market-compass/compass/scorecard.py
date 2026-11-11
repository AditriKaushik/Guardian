"""The Macro Scorecard: score each world/India factor -1, 0 or +1 and turn the total into a stance.

+1 always means "good for the Indian stock market", -1 "bad". Auto factors are scored from
live prices; judgement factors are set by you in the app (you can also override any auto score).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class Factor:
    key: str
    name: str
    auto: bool
    good: str          # what +1 looks like
    bad: str           # what -1 looks like
    where: str         # where to check it
    # Sector tilts: sector -> +1 if the sector benefits when this factor is +1, -1 if it suffers.
    sectors: dict = field(default_factory=dict)


FACTORS = [
    Factor("usdinr", "Rupee vs US dollar", True,
           "Rupee stable or strengthening", "Rupee falling fast (>0.5% in 5 days)",
           "INR=X on any finance site; RBI reference rate",
           {"IT": -1, "Pharma": -1, "Oil marketing (OMC)": +1, "Banks": +1}),
    Factor("dxy", "US Dollar Index (DXY)", True,
           "Dollar weakening worldwide", "Dollar rising >1% in 5 days (FIIs pull money from India)",
           "DX-Y.NYB", {"Metals": +1, "Banks": +1}),
    Factor("us10y", "US 10-year bond yield", True,
           "Yield falling", "Yield up >0.15 percentage points in 5 days",
           "^TNX", {"Banks": +1, "Realty": +1}),
    Factor("brent", "Crude oil (Brent)", True,
           "Below ~$75 and not rising", "Above ~$90, or up >5% in 5 days",
           "BZ=F", {"Paints": +1, "Aviation": +1, "Oil marketing (OMC)": +1, "Tyres": +1,
                    "Oil upstream (ONGC, Oil India)": -1, "Chemicals": +1}),
    Factor("vix", "India VIX (fear index)", True,
           "Below 13 and calm", "Above 18, or up >20% in 5 days",
           "NSE: India VIX", {}),
    Factor("global", "Global markets (US + Asia)", True,
           "US & Asian markets up overnight", "Sharp fall overnight (avg < -0.7%)",
           "S&P 500, Nikkei, Hang Seng, GIFT Nifty at 8 AM", {"IT": +1}),
    Factor("trend", "Nifty trend (current movement)", True,
           "Nifty above its 50-day average, 20-day above 50-day", "Nifty below its 200-day average",
           "Nifty chart", {}),
    Factor("fii", "FII / FPI flows", True,
           "Net buyers (last few days)", "Heavy net sellers (> Rs 3,000 cr/day)",
           "NSE > Reports > FII/DII activity (after 6 PM)", {"Banks": +1, "IT": +1}),
    Factor("dii", "DII / SIP flows", False,
           "Strong domestic buying, SIP inflows rising", "Domestic buying weakening",
           "NSE FII/DII page; AMFI monthly SIP data", {}),
    Factor("rbi", "RBI policy & liquidity", False,
           "Rate cut / CRR cut / easy liquidity / dovish talk", "Rate hike / tight liquidity / hawkish talk",
           "rbi.org.in: MPC statements", {"Banks": +1, "NBFC": +1, "Realty": +1, "Auto": +1}),
    Factor("inflation", "Inflation (CPI)", False,
           "CPI near or below RBI's 4% target", "CPI rising above 6%",
           "MOSPI CPI release (~12th of each month)", {"FMCG": +1, "Banks": +1}),
    Factor("geopolitics", "Geopolitics / war risk", False,
           "Calm, peace talks, easing tensions", "War, sanctions, shipping routes disrupted",
           "Reuters, BBC, The Hindu, PIB", {"Defence": -1, "Aviation": +1, "Oil marketing (OMC)": +1}),
    Factor("monsoon", "Monsoon / weather / crops", False,
           "Normal or above-normal rain, good sowing", "Deficient rain, heatwave, floods",
           "IMD forecasts; agriculture ministry sowing data",
           {"FMCG": +1, "Tractors / Rural": +1, "Fertilisers": +1, "Auto (2-wheeler)": +1}),
    Factor("demand", "Festival / wedding / consumer demand", False,
           "Strong auto sales, GST collections, festive sales", "Weak sales numbers",
           "Auto sales (1st of month), GST data, retail news",
           {"Auto": +1, "Jewellery": +1, "Consumer durables": +1, "Retail": +1}),
    Factor("earnings", "Company earnings season", False,
           "Results beating estimates, upbeat guidance", "Results missing estimates",
           "Results calendar; results coverage", {}),
    Factor("policy", "Government policy / Budget / elections", False,
           "Capex push, reforms, tax relief, stable government", "Tax hikes, policy shocks, uncertainty",
           "PIB, Union Budget (1 Feb), election calendar",
           {"Infra / Capital goods": +1, "PSU": +1, "Defence": +1, "Railways": +1}),
]

FACTOR_BY_KEY = {f.key: f for f in FACTORS}


def _ok(snap: dict, key: str) -> bool:
    return bool(snap.get(key, {}).get("ok"))


def auto_score(key: str, snap: dict, fii: dict | None = None) -> tuple[int | None, str]:
    """Score an auto factor from the macro snapshot. Returns (score or None if no data, reason)."""
    if key == "usdinr" and _ok(snap, "usdinr"):
        c5 = snap["usdinr"]["chg5"]
        s = -1 if c5 > 0.005 else (+1 if c5 < -0.003 else 0)
        return s, f"USD/INR {snap['usdinr']['last']:.2f}, {c5*100:+.2f}% in 5 days (rising = rupee weaker)"
    if key == "dxy" and _ok(snap, "dxy"):
        c5 = snap["dxy"]["chg5"]
        s = -1 if c5 > 0.01 else (+1 if c5 < -0.01 else 0)
        return s, f"DXY {snap['dxy']['last']:.2f}, {c5*100:+.2f}% in 5 days"
    if key == "us10y" and _ok(snap, "us10y"):
        d5 = snap["us10y"]["diff5"]
        s = -1 if d5 > 0.15 else (+1 if d5 < -0.15 else 0)
        return s, f"US 10y {snap['us10y']['last']:.2f}%, {d5:+.2f} pts in 5 days"
    if key == "brent" and _ok(snap, "brent"):
        b = snap["brent"]
        s = -1 if (b["last"] > 90 or b["chg5"] > 0.05) else (+1 if (b["last"] < 75 and b["chg5"] <= 0.01) else 0)
        return s, f"Brent ${b['last']:.1f}, {b['chg5']*100:+.1f}% in 5 days"
    if key == "vix" and _ok(snap, "vix"):
        v = snap["vix"]
        s = -1 if (v["last"] > 18 or v["chg5"] > 0.20) else (+1 if v["last"] < 13 else 0)
        return s, f"India VIX {v['last']:.1f}, {v['chg5']*100:+.0f}% in 5 days"
    if key == "global":
        chgs = [snap[k]["chg1"] for k in ("sp500", "nikkei", "hangseng") if _ok(snap, k)]
        if chgs:
            avg = sum(chgs) / len(chgs)
            s = +1 if avg > 0.005 else (-1 if avg < -0.007 else 0)
            return s, f"Avg last-day move of US/Japan/HK: {avg*100:+.2f}%"
    if key == "trend" and _ok(snap, "nifty"):
        n = snap["nifty"]
        last, ma20, ma50, ma200 = n["last"], n.get("ma20"), n.get("ma50"), n.get("ma200")
        if ma200 is not None and not math.isnan(ma200) and last < ma200:
            return -1, f"Nifty {last:,.0f} is below its 200-day average {ma200:,.0f}"
        if ma50 and ma20 and last > ma50 and ma20 > ma50:
            return +1, f"Nifty {last:,.0f} above 50-day avg {ma50:,.0f}; 20-day avg above 50-day"
        return 0, f"Nifty {last:,.0f}; 20-day avg {ma20:,.0f}, 50-day avg {ma50:,.0f}"
    if key == "fii" and fii and "FII" in fii:
        net = fii["FII"]
        s = -1 if net < -3000 else (+1 if net > 1000 else 0)
        return s, f"FII net Rs {net:,.0f} cr on {fii.get('date', '?')} ({fii.get('source', '')})"
    return None, "No live data: set it by hand"


def stance(scores: dict) -> dict:
    """Turn factor scores into a stance. Scales thresholds by how many factors are scored."""
    vals = [v for v in scores.values() if v is not None]
    n = len(vals)
    total = sum(vals)
    pct = total / n if n else 0.0          # -1 .. +1
    if pct >= 0.40:
        name, color, action = "AGGRESSIVE BUY", "#1a7f37", "Tide strongly in favour. Buy quality cyclicals (banks, autos, capital goods) on dips; normal position size."
    elif pct >= 0.13:
        name, color, action = "CAUTIOUS BUY", "#4c9a2a", "Mildly positive. Buy only strong stocks in favoured sectors, smaller size, strict stop-losses."
    elif pct > -0.13:
        name, color, action = "NEUTRAL / WAIT", "#9a6700", "No clear tide. Trade very small or stay in cash; wait for factors and smart money to line up."
    elif pct > -0.40:
        name, color, action = "DEFENSIVE", "#bc4c00", "Mildly negative. Prefer FMCG, pharma, IT; raise cash; avoid fresh aggressive buying."
    else:
        name, color, action = "PROTECT CAPITAL", "#cf222e", "Tide strongly against. Mostly cash. Watch for FII buying to return before re-entering."
    return {"total": total, "n": n, "pct": pct, "name": name, "color": color, "action": action}


def sector_tilts(scores: dict) -> list[tuple[str, int, list[str]]]:
    """Sum of factor_score * sector_sign for each sector, with the reasons. Sorted best first."""
    agg: dict[str, list] = {}
    for key, s in scores.items():
        if not s:
            continue
        f = FACTOR_BY_KEY[key]
        for sector, sign in f.sectors.items():
            v = s * sign
            rec = agg.setdefault(sector, [0, []])
            rec[0] += v
            rec[1].append(f"{f.name} ({'+' if v > 0 else '-'})")
    return sorted(((k, v[0], v[1]) for k, v in agg.items()), key=lambda x: -x[1])
