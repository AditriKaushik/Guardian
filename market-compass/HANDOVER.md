# 🧭 Market Compass: Handover Guide

Market Compass is a standalone web app for the Indian stock market. It runs without Claude, on
your computer or online, and opens in any browser, phone included.

It does four things:

1. **Today's Compass:** tracks the world factors that move Indian stocks (rupee, dollar, US yields,
   crude, India VIX, global markets, FII flows, RBI, inflation, war risk, monsoon, festival demand,
   earnings, government policy). It scores each one and gives a **stance for the day**
   (Aggressive Buy / Cautious Buy / Neutral / Defensive / Protect Capital), plus the sectors to
   favour or avoid.
2. **Stock Probability:** type any NSE stock (e.g. RELIANCE) and a horizon (1–3 hours or till
   close). You get the **probability it goes up**, a likely price range, a stop-loss/target plan for
   your amount, and a plain-language reading of the chart. The app also tells you **how far to
   trust that number**.
3. **Smart Money:** FII/DII flows, sector rotation, and one-click links to NSE's big-player data
   (bulk/block deals, option chain, FII positions, insider buying).
4. **Event Calendar:** upcoming data releases, expiries and your own events (RBI, Fed, Budget,
   results), so you prepare **before** an event, not during it.

> ⚠️ This is an educational tool, not investment advice. No tool can guarantee profits. Use
> stop-losses and never risk money you can't afford to lose.

---

## 1. Where the files are

Everything lives in the `market-compass/` folder of the GitHub repository
**AditriKaushik/Guardian** (branch `claude/ecstatic-bell-49379c`, or `main` once merged).

```
market-compass/
├── app.py                    ← the web app (all screens)
├── compass/
│   ├── data.py               ← fetches prices (Yahoo Finance) and FII/DII (NSE)
│   ├── scorecard.py          ← the 16 factors, scoring rules, stance, sector tilts
│   ├── stock_model.py        ← the stock probability engine
│   ├── events.py             ← event calendar and seasonal themes
│   └── stocks.py             ← stock list and sectors (any NSE symbol also works)
├── data/
│   ├── events.csv            ← YOUR events (edit in the app or in Excel)
│   └── scorecard_history.csv ← your saved daily scorecards (created when you save)
├── tests/test_compass.py     ← automatic checks
├── requirements.txt          ← Python packages needed
├── Start Market Compass.bat  ← Windows: double-click to run
├── start.sh                  ← Mac/Linux: run with `bash start.sh`
└── HANDOVER.md               ← this guide (also shown in the app's "How to use" tab)
```

To get the files on another device, open the repo on github.com, click **Code → Download ZIP**,
unzip it, and open the `market-compass` folder.

---

## 2. Run it on a computer (Windows)

1. Install **Python 3.10 or newer** from <https://www.python.org/downloads/>.
   **Tick "Add Python to PATH"** on the first install screen.
2. Open the `market-compass` folder and **double-click `Start Market Compass.bat`**.
3. The first run takes 2–5 minutes to install packages. Your browser then opens at
   `http://localhost:8501`.
4. To stop the app, close the black window. To start it again, double-click the file again.
   Later starts take seconds.

**Mac / Linux:** open Terminal in the folder and run:

```bash
bash start.sh
```

**Use it on your phone at home:** while the app runs on your computer, the black window shows a
**Network URL** like `http://192.168.1.5:8501`. Open that on your phone while it's on the same Wi‑Fi.

---

## 3. Put it online (open from anywhere, any device, free)

You can host the app free on **Streamlit Community Cloud**:

1. Go to <https://share.streamlit.io> and **sign in with GitHub** (the account that owns the repo).
2. Click **Create app → Deploy a public app from GitHub** and fill in:
   - Repository: `AditriKaushik/Guardian`
   - Branch: `main` (or `claude/ecstatic-bell-49379c` if not merged yet)
   - Main file path: `market-compass/app.py`
3. Click **Deploy**. A minute later you get a link like `https://something.streamlit.app`.
   Bookmark it on your phone and laptop.
4. To keep the app private, open the app's **Settings → Sharing** and allow only specific email
   addresses.

Notes for the online version:
- **NSE usually blocks cloud servers**, so FII/DII data may show "not available" online. Check
  the NSE link on the Smart Money tab and set the FII factor by hand. Yahoo prices work fine.
- **Saved files reset when the online app restarts.** Use the **Download** buttons to keep your
  events and scorecard history. To make events permanent, edit `data/events.csv` on GitHub.
- When you change code on GitHub, the online app updates itself.

---

## 4. How to use it every day

| Time (IST) | What to do in the app |
|---|---|
| **8:00–9:00 AM** | **Today's Compass:** check the auto scores, then set the judgement factors after reading the morning news (RBI, war or peace news, monsoon, results, policy). Read the **stance** and the **sector tilt**. Press **Save**. |
| **Evening before** | **Smart Money:** check FII/DII flows, bulk/block deals and FII futures positions. **Calendar:** see what's coming this week. |
| **9:15–9:45 AM** | Don't trade. Let the opening settle. |
| **9:45 AM–2:30 PM** | **Stock Probability:** analyse stocks from the *favoured* sectors only. Act only when all three agree: the stance is a Buy, the stock shows **LEANING UP** with **model trust ≥ 50%**, and the chart signals are mostly green. |
| **By 3:10 PM** | Exit intraday trades. Write a note on the Compass tab and Save. |

### Reading the Stock Probability screen

- **"62% chance UP"**: in situations like today's, the price was higher after your horizon
  about 62 times in 100. 38 times it was not, so a stop-loss is mandatory.
- **Model trust:** the app hides the newest 30% of the stock's history from the model, then tests
  it there. If the model didn't beat a coin flip on that unseen data, trust is low and the app says
  **"NO PROVEN EDGE"**. Don't trade on it.
- **Accuracy on unseen history** vs **always-guess**: real skill shows as a positive gap. For
  intraday stock moves, **52–58% is normal even for professionals**. Be suspicious of anything
  claiming 80%.
- **Likely price range:** 8 out of 10 past cases ended inside this band.
- **If you buy now:** quantity for your amount, a stop-loss at 1× ATR (average true range, the
  stock's typical hourly move), a target at 1.5× ATR, and a rough expected value **before
  charges**. On small amounts, brokerage, STT, GST and stamp duty can wipe out the profit.
- **Blend in today's Macro Scorecard:** adds at most ±3 percentage points from your Compass stance.
  This is a judgement rule; the model did not test it.

### The macro rules the app uses (auto factors)

| Factor | Scores −1 (bad) when… | Scores +1 (good) when… |
|---|---|---|
| USD/INR | rupee falls > 0.5% in 5 days | rupee rises > 0.3% |
| Dollar Index | up > 1% in 5 days | down > 1% |
| US 10y yield | up > 0.15 pts in 5 days | down > 0.15 pts |
| Brent crude | > $90 or up > 5% in 5 days | < $75 and not rising |
| India VIX | > 18 or up > 20% in 5 days | < 13 |
| Global markets | US/Japan/HK average last day < −0.7% | > +0.5% |
| Nifty trend | below 200-day average | above 50-day average and 20-day above 50-day |
| FII flows | net selling > ₹3,000 cr | net buying > ₹1,000 cr |

Stance = average score: ≥ +0.40 Aggressive Buy · ≥ +0.13 Cautious Buy · between −0.13 and +0.13
Neutral · ≤ −0.13 Defensive · ≤ −0.40 Protect Capital. Change these numbers in
`compass/scorecard.py`.

---

## 5. Keeping it up to date

- **Events:** in the **Event Calendar** tab, add rows and press **Save**. Add these yourself:
  - RBI MPC meeting dates (rbi.org.in)
  - US Fed FOMC dates (federalreserve.gov)
  - Budget day
  - Results dates of your stocks (NSE announcements)
  - Festivals and elections

  The starter rows marked "verify" should be checked against the official source.
- **Nifty expiry day:** the app assumes **Tuesday** (NSE's expiry day at the time of writing).
  If NSE changes it, edit `recurring_events` in `compass/events.py`.
- **Stock list:** add names to `compass/stocks.py`. Any NSE symbol works in the text box anyway.
- **Review yourself:** after 4–6 weeks, download your scorecard history and compare each day's
  stance with what Nifty actually did. Adjust your judgement accordingly.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| "Python is not installed" | Install from python.org and tick **Add Python to PATH**, then restart the PC. |
| Everything shows "n/a" | No internet, or Yahoo is temporarily down. Press **Refresh all data** after a minute. Make sure **Demo mode** is OFF. |
| FII/DII "not available" | NSE blocked the request (common online or outside India). Use the NSE link and set the factor by hand. |
| "Not enough hourly history" | Check the symbol spelling (e.g. `HDFCBANK`, not `HDFC BANK`). Very new listings don't have enough history. |
| Numbers look odd or random | Check that **Demo mode** is OFF. Demo data is fake. |
| Prices look a bit late | Free Yahoo data can be delayed up to ~15 minutes. Confirm the price in your broker app before trading. |
| Want to check the code works | In the folder, run `python -m pytest tests -q`. It uses fake data and needs no internet. |

---

## 7. Honest limits

- The app **cannot predict surprises**: a sudden war, a policy shock, fraud news. Stop-losses are
  your protection.
- The probability engine learns from how the stock behaved in similar situations over about 2
  years. The macro scorecard is about **today and upcoming events**, and you combine the two.
  Neither one alone is enough.
- It does **not** predict overnight gaps. Its forecasts are for the same trading day only.
- Data sources are free and unofficial (Yahoo Finance, NSE website). They can change or break.
  If they do, the fix is usually in `compass/data.py`.

---

## 8. Brief for a developer or AI assistant (copy-paste this)

> I have a Streamlit app called **Market Compass** in the `market-compass/` folder of the GitHub
> repo AditriKaushik/Guardian. Entry point is `app.py` (5 tabs: Today's Compass, Stock
> Probability, Smart Money, Event Calendar, How to use).
>
> **Modules:**
> - `compass/data.py`: data via yfinance (`history()`, `macro_snapshot()`, `sector_performance()`)
>   and NSE's `api/fiidiiTradeReact` (`fii_dii()`). Demo/synthetic data when `COMPASS_DEMO=1`.
> - `compass/scorecard.py`: 16 `Factor`s (8 auto-scored, 8 manual). Each scores −1/0/+1, `stance()`
>   averages them, and `sector_tilts()` maps factors to sectors.
> - `compass/stock_model.py`: hourly OHLCV, 15 no-look-ahead features (momentum, VWAP distance,
>   RSI, Bollinger %B, EMA distance/slope, volume ratio, volatility, hour, Nifty move, relative
>   strength). Same-day labels for 1/2/3 hours or till close. Logistic regression is tested on the
>   newest 30% and refit on all data. P(up) is shrunk toward the base rate by a reliability score
>   (AUC-based), with an optional ±3 pt macro blend.
> - `compass/events.py`: recurring Indian and US data releases plus the user's `data/events.csv`.
>
> Tests: `python -m pytest tests -q` (synthetic data). Run locally with `streamlit run app.py`,
> deployed on Streamlit Community Cloud with main file `market-compass/app.py`.
>
> Please keep the honesty rules: always show model trust and out-of-sample accuracy, and never
> promise returns.
