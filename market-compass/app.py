"""Market Compass: run with `streamlit run app.py`."""
from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st

from compass import __version__
from compass import data as D
from compass import events as E
from compass import scorecard as S
from compass import stock_model as M
from compass.stocks import STOCKS, to_yahoo

st.set_page_config(page_title="Market Compass", page_icon="🧭", layout="wide")
HISTORY_CSV = Path(__file__).resolve().parent / "data" / "scorecard_history.csv"

# ------------------------------------------------------------------ sidebar
with st.sidebar:
    st.title("🧭 Market Compass")
    st.caption(f"Version {__version__} · Indian markets")
    if st.button("🔄 Refresh all data"):
        st.cache_data.clear()
        st.rerun()
    is_open, msg = D.market_status()
    st.info(("🟢 " if is_open else "🔴 ") + msg)
    st.caption(f"IST now: {D.now_ist():%a %d %b %Y, %H:%M}")
    st.divider()
    st.caption("⚠️ Educational tool, not investment advice. Probabilities are estimates from data; "
               "markets can and will do the unexpected. Always use a stop-loss and never risk "
               "money you cannot afford to lose.")


@st.cache_data(ttl=600, show_spinner=False)
def cached_snapshot():
    return D.macro_snapshot()


@st.cache_data(ttl=1800, show_spinner=False)
def cached_fii():
    return D.fii_dii()


@st.cache_data(ttl=900, show_spinner=False)
def cached_sectors():
    return D.sector_performance()


@st.cache_data(ttl=300, show_spinner=False)
def cached_history(symbol: str, period: str, interval: str):
    return D.history(symbol, period=period, interval=interval)


tab_compass, tab_stock, tab_money, tab_cal, tab_help = st.tabs(
    ["🧭 Today's Compass", "📈 Stock Probability", "🐋 Smart Money", "📅 Event Calendar", "📖 How to use"])

# ================================================================== TAB 1: COMPASS
with tab_compass:
    with st.spinner("Fetching world markets…"):
        snap = cached_snapshot()
        fii = cached_fii()

    st.subheader("World & India right now")
    keys = ["nifty", "banknifty", "vix", "usdinr", "dxy", "us10y", "brent", "gold", "sp500", "nikkei", "hangseng"]
    cols = st.columns(4)
    for i, k in enumerate(keys):
        r = snap.get(k, {})
        with cols[i % 4]:
            if r.get("ok"):
                st.metric(r["label"], f"{r['last']:,.2f}", f"{r['chg1']*100:+.2f}% today · {r['chg5']*100:+.2f}% 5d",
                          delta_color="off" if k in ("usdinr", "dxy", "us10y", "brent", "vix") else "normal")
            else:
                st.metric(r.get("label", k), "n/a", "no data")
    st.caption("Rising USD/INR, DXY, US yields, crude or VIX is usually BAD for Indian stocks (shown without colour to avoid confusion).")

    st.subheader("Macro Scorecard")
    st.caption("+1 = good for Indian stocks, −1 = bad. Auto factors are scored from live data; you can override any of them. "
               "Judgement factors are yours to set after reading the news each morning.")
    choice_map = {"Auto": None, "+1 Good": 1, "0 Neutral": 0, "−1 Bad": -1}
    scores, rows = {}, []
    left, right = st.columns(2)
    for i, f in enumerate(S.FACTORS):
        box = left if i % 2 == 0 else right
        with box:
            with st.container(border=True):
                if f.auto:
                    a_score, reason = S.auto_score(f.key, snap, fii)
                    opts = list(choice_map) if a_score is not None else ["0 Neutral", "+1 Good", "−1 Bad"]
                    pick = st.radio(f"**{f.name}**", opts, horizontal=True, key=f"sc_{f.key}",
                                    help=f"Good: {f.good}\n\nBad: {f.bad}\n\nWhere: {f.where}")
                    val = a_score if choice_map[pick] is None else choice_map[pick]
                    st.caption(f"{'🤖 auto ' + format(a_score, '+d') + ' · ' if a_score is not None else '✍️ '}{reason}")
                else:
                    pick = st.radio(f"**{f.name}**", ["0 Neutral", "+1 Good", "−1 Bad"], horizontal=True, key=f"sc_{f.key}",
                                    help=f"Where to check: {f.where}")
                    val = choice_map[pick]
                    st.caption(f"✍️ Good: {f.good} · Bad: {f.bad}")
                scores[f.key] = val
                rows.append({"factor": f.name, "score": val})

    stn = S.stance(scores)
    st.session_state["macro_pct"] = stn["pct"]
    st.markdown(
        f"""<div style="border-radius:12px;padding:18px 22px;background:{stn['color']};color:white;margin:8px 0">
        <div style="font-size:14px;opacity:.85">Today's stance · score {stn['total']:+d} of ±{stn['n']}</div>
        <div style="font-size:30px;font-weight:700">{stn['name']}</div>
        <div style="font-size:16px">{stn['action']}</div></div>""", unsafe_allow_html=True)

    tilts = S.sector_tilts(scores)
    if tilts:
        st.subheader("Sector tilt from today's factors")
        tdf = pd.DataFrame([{"Sector": s, "Tilt": v, "Why": ", ".join(w)} for s, v, w in tilts if v != 0])
        if not tdf.empty:
            c1, c2 = st.columns(2)
            c1.markdown("**Favoured**")
            c1.dataframe(tdf[tdf.Tilt > 0], hide_index=True)
            c2.markdown("**Avoid / underweight**")
            c2.dataframe(tdf[tdf.Tilt < 0].sort_values("Tilt"), hide_index=True)
        else:
            st.caption("No sector leans either way today.")

    note = st.text_input("Today's note (what's in the news, what you expect)", key="note")
    if st.button("💾 Save today's scorecard to history"):
        rec = {"date": date.today().isoformat(), "time": datetime.now().strftime("%H:%M"), "stance": stn["name"],
               "total": stn["total"], "n": stn["n"], "note": note, **{f"s_{k}": v for k, v in scores.items()}}
        HISTORY_CSV.parent.mkdir(parents=True, exist_ok=True)
        pd.DataFrame([rec]).to_csv(HISTORY_CSV, mode="a", header=not HISTORY_CSV.exists(), index=False)
        st.success("Saved. Review the history after a few weeks to see if your stance calls were right.")
    if HISTORY_CSV.exists():
        with st.expander("Scorecard history"):
            hist = pd.read_csv(HISTORY_CSV)
            st.dataframe(hist.tail(30), hide_index=True)
            st.download_button("Download history (CSV)", HISTORY_CSV.read_bytes(), "scorecard_history.csv")

# ================================================================== TAB 2: STOCK
with tab_stock:
    st.subheader("What are the odds this stock is higher in the next few hours?")
    c1, c2, c3 = st.columns([2, 1, 1])
    with c1:
        pick = st.selectbox("Pick a stock", ["(type your own below)"] + [f"{k} · {v}" for k, v in STOCKS.items()], index=1)
        custom = st.text_input("…or type any NSE symbol (e.g. IRCTC, TATAPOWER, ^NSEI for Nifty)", "")
    symbol = to_yahoo(custom) if custom.strip() else to_yahoo(pick.split(" · ")[0]) if "·" in pick else ""
    with c2:
        hz_label = st.selectbox("Time horizon", ["1 hour", "2 hours", "3 hours", "Till today's close"], index=1)
    horizon = {"1 hour": 1, "2 hours": 2, "3 hours": 3, "Till today's close": "close"}[hz_label]
    with c3:
        apply_macro = st.checkbox("Blend in today's Macro Scorecard", value=True,
                                  help="Adds at most ±3 percentage points based on the Compass tab. This blend is a judgement "
                                       "rule, not something the model tested.")
        capital = st.number_input("Amount to invest (₹)", min_value=100, value=10000, step=500)

    if symbol and st.button("🔍 Analyse", type="primary"):
        st.session_state["analyse"] = (symbol, horizon)
    if st.session_state.get("analyse") and st.session_state["analyse"][0] == symbol:
        with st.spinner(f"Downloading 2 years of hourly data for {symbol} and testing the model…"):
            df = cached_history(symbol, "730d", "60m")
            idx = cached_history("^NSEI", "730d", "60m") if symbol != "^NSEI" else None
            pr = M.predict(df, idx, horizon, st.session_state.get("macro_pct", 0.0), apply_macro)
        if not pr.ok:
            st.error(pr.message)
        else:
            st.markdown(
                f"""<div style="border-radius:12px;padding:16px 22px;background:{pr.verdict_color};color:white">
                <div style="font-size:14px;opacity:.85">{symbol} · last ₹{pr.last_price:,.2f} at {pr.last_time} IST · horizon: {hz_label}</div>
                <div style="font-size:34px;font-weight:700">{pr.p_up*100:.0f}% chance UP · {100-pr.p_up*100:.0f}% chance DOWN</div>
                <div style="font-size:16px">{pr.verdict}</div></div>""", unsafe_allow_html=True)
            if not is_open:
                st.info("Market is closed: this reads the last candle. The overnight/next-morning gap is NOT predicted.")

            m1, m2, m3, m4 = st.columns(4)
            m1.metric("Model trust for this stock", f"{pr.reliability*100:.0f}%",
                      help="From a test on the newest 30% of history the model never saw. 0% = no proven skill.")
            m2.metric("Accuracy on unseen history", f"{pr.test_accuracy*100:.1f}%",
                      f"{(pr.test_accuracy-pr.test_baseline)*100:+.1f} pts vs always-guess",
                      help=f"'Always guess the most common outcome' scored {pr.test_baseline*100:.1f}%.")
            m3.metric("When the model was confident", f"{pr.confident_acc*100:.0f}%" if pr.confident_n else "n/a",
                      f"{pr.confident_n} calls", delta_color="off")
            m4.metric("Usually goes up (base rate)", f"{pr.base_rate*100:.0f}%")

            st.markdown("#### Likely price range at the end of the horizon (80% of past cases fell inside)")
            r1, r2, r3 = st.columns(3)
            r1.metric("Low end (10%)", f"₹{pr.range_lo:,.2f}", f"{(pr.range_lo/pr.last_price-1)*100:+.2f}%")
            r2.metric("Middle", f"₹{pr.range_mid:,.2f}", f"{(pr.range_mid/pr.last_price-1)*100:+.2f}%")
            r3.metric("High end (90%)", f"₹{pr.range_hi:,.2f}", f"{(pr.range_hi/pr.last_price-1)*100:+.2f}%")

            qty = int(capital // pr.last_price)
            stop, target = pr.last_price - pr.atr, pr.last_price + 1.5 * pr.atr
            st.markdown("#### If you buy now (plan, not a recommendation)")
            if qty == 0:
                st.warning(f"₹{capital:,.0f} is less than one share (₹{pr.last_price:,.2f}).")
            else:
                st.write(f"- Quantity: **{qty}** shares ≈ ₹{qty*pr.last_price:,.0f}\n"
                         f"- Stop-loss (1× hourly ATR): **₹{stop:,.2f}** → max loss ≈ ₹{qty*(pr.last_price-stop):,.0f}\n"
                         f"- Target (1.5× ATR): **₹{target:,.2f}** → profit ≈ ₹{qty*(target-pr.last_price):,.0f}\n"
                         f"- Expected value at {pr.p_up*100:.0f}% (rough): "
                         f"₹{qty*(pr.p_up*1.5*pr.atr - (1-pr.p_up)*pr.atr):,.0f} before charges (brokerage, STT, GST, stamp duty).")

            a, b = st.columns(2)
            with a:
                st.markdown("#### What the chart is saying now")
                for text, sign in pr.signals:
                    st.write({"+": "🟢", "-": "🔴", "0": "⚪"}[sign] + " " + text)
            with b:
                st.markdown("#### Biggest drivers of this prediction")
                for name, v in pr.drivers:
                    st.write(("⬆️ " if v > 0 else "⬇️ ") + f"{name} ({v:+.2f})")
                if pr.macro_adj:
                    st.write(f"🧭 Macro Scorecard blend: {pr.macro_adj*100:+.1f} pts")

            tail = df.tail(7 * 15)
            ma, sd = tail["Close"].rolling(20).mean(), tail["Close"].rolling(20).std()
            fig = go.Figure([go.Candlestick(x=tail.index.strftime("%d %b %H:%M"), open=tail.Open, high=tail.High,
                                            low=tail.Low, close=tail.Close, name=symbol)])
            for y, nm, dash in [(ma + 2 * sd, "Upper band", "dot"), (ma, "Middle (20 avg)", "solid"), (ma - 2 * sd, "Lower band", "dot")]:
                fig.add_scatter(x=tail.index.strftime("%d %b %H:%M"), y=y, name=nm, line=dict(width=1, dash=dash))
            fig.update_layout(height=420, margin=dict(l=10, r=10, t=30, b=10), xaxis_rangeslider_visible=False,
                              title="Last ~15 trading days, hourly, with Bollinger Bands", xaxis=dict(type="category", nticks=10))
            st.plotly_chart(fig)
            with st.expander("How was this calculated?"):
                st.markdown(M.__doc__)
                st.write(f"Training samples: {pr.n_train:,} · Test samples (unseen): {pr.n_test:,} · "
                         f"Test AUC: {pr.test_auc:.3f} (0.5 = coin flip) · Raw model output: {pr.p_model_raw*100:.1f}%")

# ================================================================== TAB 3: SMART MONEY
with tab_money:
    st.subheader("🐋 Follow the big fish")
    fii = cached_fii()
    c1, c2 = st.columns(2)
    if fii:
        c1.metric(f"FII / FPI net ({fii.get('date', '')})", f"₹{fii['FII']:,.0f} cr")
        if "DII" in fii:
            c2.metric(f"DII net ({fii.get('date', '')})", f"₹{fii['DII']:,.0f} cr")
        st.caption(f"Source: {fii.get('source')}. Negative = net selling.")
    else:
        st.warning("NSE did not return FII/DII data (it often blocks cloud servers or non-Indian connections). "
                   "Open the NSE link below and set the 'FII / FPI flows' factor by hand on the Compass tab.")
    st.markdown("**How to read it:** 5+ days of FII selling above ₹3,000 cr/day = pressure. "
                "The first days FIIs turn buyers after a long selling streak often mark a bottom. "
                "Strong DII buying cushions falls.")

    st.markdown("#### Sector strength (which way money is rotating)")
    sec = cached_sectors()
    if sec.empty:
        st.caption("Sector data not available right now.")
    else:
        st.dataframe(sec.round(2), hide_index=True)

    st.markdown("#### Daily checklist links (NSE)")
    st.markdown("""
| What | Why | Link |
|---|---|---|
| FII / DII cash activity | Who is buying or selling overall | [nseindia.com/reports/fii-dii](https://www.nseindia.com/reports/fii-dii) |
| Participant-wise open interest | FII long vs short in index futures (FII longs < 25% = extreme fear, often near a bottom) | [NSE derivatives reports](https://www.nseindia.com/all-reports-derivatives) |
| Bulk & block deals | Big investors buying specific stocks | [NSE large deals](https://www.nseindia.com/report-detail/display-bulk-and-block-deals) |
| Option chain (Nifty) | Highest put OI = support, highest call OI = resistance; PCR > 1.3 oversold, < 0.7 overbought | [NSE option chain](https://www.nseindia.com/option-chain) |
| Insider / promoter trades | Promoters buying their own shares is a strong signal | [NSE insider trading](https://www.nseindia.com/companies-listing/corporate-filings-insider-trading) |
| Corporate announcements | Results dates, orders, deals | [NSE announcements](https://www.nseindia.com/companies-listing/corporate-filings-announcements) |
| Mutual fund flows | Monthly SIP and equity inflows | [amfiindia.com](https://www.amfiindia.com/) |
""")
    st.caption("Delivery % (in each stock's NSE page → 'Trade info'): price up with delivery > 60% = genuine buying; "
               "price up with low delivery = speculation.")

# ================================================================== TAB 4: CALENDAR
with tab_cal:
    st.subheader("📅 What's coming: plan BEFORE the event, not during it")
    today = D.now_ist().date()
    st.info(f"**This month's seasonal theme:** {E.SEASONAL[today.month]}")
    days = st.slider("Look ahead (days)", 7, 120, 45)
    up = E.upcoming(today, days)
    st.dataframe(up, hide_index=True, height=420)

    st.markdown("#### ✍️ Your events (RBI policy dates, Fed meetings, results of your stocks, festivals, elections…)")
    st.caption("Add rows, then press Save. Get RBI MPC dates from rbi.org.in, FOMC dates from federalreserve.gov, "
               "results dates from NSE announcements.")
    edited = st.data_editor(E.load_user_events(), num_rows="dynamic", hide_index=True, key="events_editor",
                            column_config={"date": st.column_config.DateColumn("date", format="YYYY-MM-DD")})
    c1, c2 = st.columns(2)
    if c1.button("💾 Save my events"):
        E.save_user_events(edited)
        st.success("Saved to data/events.csv")
    c2.download_button("Download my events (CSV)", E.EVENTS_CSV.read_bytes() if E.EVENTS_CSV.exists() else b"",
                       "events.csv")

# ================================================================== TAB 5: HELP
with tab_help:
    guide = Path(__file__).resolve().parent / "HANDOVER.md"
    st.markdown(guide.read_text(encoding="utf-8") if guide.exists() else "See HANDOVER.md")

if os.environ.get("COMPASS_FOOTER", "1") == "1":
    st.caption("Market Compass · data from Yahoo Finance and NSE (may be delayed ~15 min) · not investment advice")
