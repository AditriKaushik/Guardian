"""Event calendar: recurring data releases (generated) + your own events (data/events.csv)."""
from __future__ import annotations

import calendar
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

EVENTS_CSV = Path(__file__).resolve().parent.parent / "data" / "events.csv"
COLUMNS = ["date", "event", "category", "expected_impact", "notes"]

SEASONAL = {
    1: "Q3 results season starts mid-Jan; pre-Budget expectations build. Rabi crop growing.",
    2: "Union Budget on 1 Feb. Capex/infra/defence themes. Q3 results end.",
    3: "Financial-year end: tax-loss selling, fund rebalancing, advance tax data.",
    4: "IMD's first monsoon forecast (sets the rural/FMCG outlook). Q4 results start. Rabi harvest.",
    5: "Q4 results continue. Monsoon onset watch (Kerala ~1 June).",
    6: "Monsoon progress; kharif sowing begins. RBI policy usually early June.",
    7: "Q1 results season. Monsoon and sowing data weekly.",
    8: "Monsoon strength decides kharif output. Q1 results end.",
    9: "Pre-festive stocking by companies. Monsoon withdrawal.",
    10: "Navratri/Dussehra: festive sales. Q2 results season. Kharif harvest.",
    11: "Diwali effects: auto/jewellery/retail sales data. Wedding season starts. Rabi sowing.",
    12: "Wedding season; RBI policy and US Fed meeting usually in December. Year-end FII book-closing (thin volumes).",
}


def _last_weekday_of_month(y: int, m: int, weekday: int) -> date:
    d = date(y, m, calendar.monthrange(y, m)[1])
    while d.weekday() != weekday:
        d -= timedelta(days=1)
    return d


def _first_weekday_of_month(y: int, m: int, weekday: int) -> date:
    d = date(y, m, 1)
    while d.weekday() != weekday:
        d += timedelta(days=1)
    return d


def _next_workday(d: date) -> date:
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d


def recurring_events(start: date, days: int = 60) -> pd.DataFrame:
    end = start + timedelta(days=days)
    rows = []
    d = start
    while d <= end:
        if d.weekday() == 1:  # Tuesday
            rows.append((d, "Nifty weekly F&O expiry", "Expiry", "Volatile", "Expiry day was Tuesday at last check; verify on NSE"))
        d += timedelta(days=1)
    months = sorted({(x.year, x.month) for x in pd.date_range(start, end)})
    for y, m in months:
        rows += [
            (_next_workday(date(y, m, 1)), "Monthly auto sales + GST collections", "India data", "Sector-specific", "Autos react to sales numbers"),
            (_next_workday(date(y, m, 1)), "India Manufacturing PMI (around this date)", "India data", "Mild", ""),
            (_next_workday(date(y, m, 12)), "India CPI inflation + IIP (around this date)", "India data", "Rates/banks", "Lower CPI = more room for RBI cuts"),
            (_next_workday(date(y, m, 14)), "India WPI inflation (around this date)", "India data", "Mild", ""),
            (_first_weekday_of_month(y, m, 4), "US jobs report (Non-Farm Payrolls)", "Global data", "FII flows", "Strong jobs = fewer Fed cuts = dollar up"),
            (_next_workday(date(y, m, 12)), "US CPI inflation (around mid-month; check exact date)", "Global data", "FII flows", ""),
            (_last_weekday_of_month(y, m, 1), "Nifty monthly F&O expiry (last Tuesday)", "Expiry", "Volatile", "Verify on NSE"),
        ]
    df = pd.DataFrame(rows, columns=COLUMNS)
    df["date"] = pd.to_datetime(df["date"]).dt.date
    return df[(df["date"] >= start) & (df["date"] <= end)]


def load_user_events() -> pd.DataFrame:
    if EVENTS_CSV.exists():
        df = pd.read_csv(EVENTS_CSV, dtype=str).fillna("")
        for col in COLUMNS:
            if col not in df.columns:
                df[col] = ""
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
        return df[COLUMNS].dropna(subset=["date"])
    return pd.DataFrame(columns=COLUMNS)


def save_user_events(df: pd.DataFrame) -> None:
    out = df.copy()
    out["date"] = pd.to_datetime(out["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    out = out.dropna(subset=["date"]).sort_values("date")
    EVENTS_CSV.parent.mkdir(parents=True, exist_ok=True)
    out[COLUMNS].to_csv(EVENTS_CSV, index=False)


def upcoming(start: date, days: int = 60) -> pd.DataFrame:
    user = load_user_events()
    user = user[(user["date"] >= start) & (user["date"] <= start + timedelta(days=days))].copy()
    user["source"] = "Your calendar"
    rec = recurring_events(start, days)
    rec["source"] = "Auto (recurring)"
    return pd.concat([user, rec], ignore_index=True).sort_values(["date", "source"], ascending=[True, False])
