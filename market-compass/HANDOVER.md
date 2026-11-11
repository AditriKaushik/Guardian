# 🧭 Market Compass: Handover Guide

## 🔗 Your link

**https://aditrikaushik.github.io/Guardian/market-compass/**

It works on any phone, tablet or computer, and you can install it as an app:

- **Android (Chrome):** open the link → tap **⬇ Install app** at the top, or menu ⋮ → **Install app**.
- **iPhone / iPad (Safari):** open the link → Share button → **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** open the link → click the install icon in the address bar,
  or menu → **Install Market Compass**.

You don't need Claude, a computer that stays on, or any login. Everything runs on GitHub's free
service.

**All data is real and live:** Yahoo Finance for prices, NSE for FII/DII flows. There is no demo
or sample data. GitHub Actions rebuilds the data automatically:

| When (IST) | What updates |
|---|---|
| Every 15 min, ~8:30 AM–4:15 PM, Mon–Fri | Prices, stock probabilities, live track record |
| 7:30 AM, Mon–Fri | Pre-market refresh (overnight US and Asia moves) |
| 7:15 PM, Mon–Fri | The day's FII/DII figures from NSE |
| Saturday and Sunday mornings | Global markets and calendar |

GitHub's scheduler sometimes runs 5–30 minutes late. The top of the app always shows
"data updated … min ago".

> ⚠️ Educational tool, not investment advice. No tool can guarantee profits. Always use a
> stop-loss and never risk money you can't afford to lose.

---

## 1. What's in the app (6 tabs)

1. **🧭 Compass:** live tiles for Nifty, Bank Nifty, India VIX, USD/INR, the US Dollar Index,
   the US 10-year yield, Brent crude, gold, the S&P 500, Nikkei and Hang Seng.
   - A **16-factor scorecard**. 8 factors score themselves from live data (rupee, dollar, US
     yields, crude, VIX, global markets, Nifty trend, FII flows). You set 8 after reading the
     news (DII/SIP flows, RBI, inflation, war risk, monsoon, festival demand, earnings, government
     policy).
   - The result is a **stance for the day** (Aggressive Buy / Cautious Buy / Neutral / Defensive /
     Protect Capital) and the **sectors to favour or avoid**. Your choices and daily log are saved
     on your device.
2. **📈 Stocks:** about 50 popular NSE stocks plus Nifty and Bank Nifty. Pick a stock, a horizon
   (1, 2 or 3 hours, or till close) and your amount in ₹. You get:
   - the **% chance up or down**;
   - **model trust** (how much to believe that %) and its accuracy on unseen history;
   - a likely price range;
   - the quantity to buy, with a stop-loss, a target and the rough expected value;
   - a plain-language reading of the chart, and a chart with Bollinger Bands;
   - a ranked list of the stocks where the model has proven some skill today.
3. **🐋 Smart money:** FII and DII net buying/selling (NSE), sector rotation (1 day, 5 days,
   1 month), and links to NSE's big-player pages: bulk/block deals, option chain, FII positions,
   insider trades.
4. **📅 Calendar:** upcoming Indian and US data releases, F&O expiries, your events, and the
   month's seasonal theme (festivals, monsoon, Budget, results season).
5. **🎯 Live track record:** the real-world test. Every prediction made in market hours is logged
   at the live price, then marked ✅ or ❌ against the **actual** price when its horizon ends. It
   shows the live hit rate against simple guessing, overall and for each horizon. It covers the
   last 20 days.
6. **📖 Guide:** install steps, the daily routine, and how to read the numbers.

---

## 2. Daily routine

| Time (IST) | What to do |
|---|---|
| **Evening before** | 🐋 Smart money: FII/DII flows, bulk/block deals. 📅 Calendar: what's coming this week. |
| **8:00–9:00 AM** | 🧭 Compass: check the auto scores, then set the ✍️ factors from the morning news. Read the stance and the favoured sectors. Tap **Save today's scorecard**. |
| **9:15–9:45 AM** | Don't trade. Let the opening settle. |
| **9:45 AM–2:30 PM** | 📈 Stocks: look only at stocks in favoured sectors. Act only when **all three agree**: the stance is a Buy, the stock shows **LEANING UP** with **trust ≥ 50%**, and the chart signals are mostly 🟢. |
| **By 3:10 PM** | Exit intraday trades. Note what happened. |
| **Weekly** | 🎯 Live track record: is the model actually beating guessing on real prices? |

### Reading the numbers honestly

- **"62% chance UP"**: in situations like now, the price rose after your horizon about 62 times
  in 100. The other 38 times it didn't, so a stop-loss is mandatory.
- **Model trust:** each stock's model is tested on the newest 30% of its history, which it never
  saw during training. Trust stays low unless it beat both a coin flip and "always guess the most
  common outcome". Low trust shows as **NO PROVEN EDGE**: don't trade on that number.
- **52–58% accuracy is normal** for intraday moves, even for professionals. Be suspicious of
  anyone promising 80%.
- **On the first real-data run, most stocks showed no proven edge.** Only about 7–16 of the 52
  qualified, depending on the horizon. The app shows this openly. The 🎯 tab is the ongoing proof.
- **Stop-loss / target** are 1× and 1.5× the stock's average hourly range (ATR). The expected value
  is **before** brokerage, STT, GST and stamp duty, which can wipe out profit on small amounts.
- **Compass blend:** the tick box on the Stocks tab adds at most ±3 points from your daily stance.
  This is a judgement rule; it hasn't been tested.
- The app **does not** predict overnight gaps or sudden shocks (war, policy surprises, fraud news).

### Auto-scoring rules (Compass)

| Factor | −1 (bad) when… | +1 (good) when… |
|---|---|---|
| USD/INR | rupee falls > 0.5% in 5 days | rupee rises > 0.3% |
| US Dollar Index | up > 1% in 5 days | down > 1% |
| US 10-year yield | up > 0.15 pts in 5 days | down > 0.15 pts |
| Brent crude | > $90, or up > 5% in 5 days | < $75 and not rising |
| India VIX | > 18, or up > 20% in 5 days | < 13 |
| Global markets | US/Japan/HK average last day < −0.7% | > +0.5% |
| Nifty trend | below its 200-day average | above 50-day average, and 20-day above 50-day |
| FII flows | net selling > ₹3,000 cr | net buying > ₹1,000 cr |

Stance = average of all 16 scores: ≥ +0.40 Aggressive Buy · ≥ +0.13 Cautious Buy · between −0.13
and +0.13 Neutral · ≤ −0.13 Defensive · ≤ −0.40 Protect Capital. You can override any auto score
in the app.

---

## 3. Where everything is

GitHub repository **AditriKaushik/Guardian**, branch `main`, folder `market-compass/`
(added in pull request #13).

```
market-compass/
├── web/                      ← THE INSTALLABLE APP (what the link shows)
│   ├── index.html, app.js, style.css
│   ├── manifest.webmanifest  ← makes it installable
│   ├── sw.js                 ← offline support (live data is always fetched fresh)
│   └── icon.svg, icon-192.png, icon-512.png
├── compass/                  ← the engine (Python)
│   ├── build_site.py         ← builds the live data.json + track.json for the app
│   ├── data.py               ← fetches real prices (Yahoo Finance) and FII/DII (NSE)
│   ├── scorecard.py          ← the 16 factors, scoring rules, stance, sector tilts
│   ├── stock_model.py        ← the stock probability engine
│   ├── events.py             ← recurring events + seasonal themes
│   └── stocks.py             ← the stock list (add stocks here)
├── data/events.csv           ← shared events shown on everyone's calendar (edit on GitHub)
├── app.py                    ← optional desktop version (any NSE stock on demand)
├── Start Market Compass.bat  ← Windows launcher for the desktop version
├── start.sh                  ← Mac/Linux launcher for the desktop version
├── requirements.txt          ← Python packages
├── tests/                    ← automatic checks (logic tests + live tests on real data)
└── HANDOVER.md               ← this file

.github/workflows/pages.yml   ← the scheduled job that rebuilds and publishes the app
```

Published files: `…/market-compass/data.json` (all live data) and `…/market-compass/track.json`
(the live track record).

---

## 4. Making changes (all done on github.com, no software needed)

Open the file on github.com → click the ✏️ pencil → edit → **Commit changes** to `main`. The
app republishes itself within a few minutes.

- **Add a stock:** edit `market-compass/compass/stocks.py` and add a line such as
  `"IRCTC": "Railways / PSU",`. Use the NSE symbol exactly as NSE writes it.
- **Add events everyone sees:** edit `market-compass/data/events.csv`. One line per event:
  `2026-12-05,RBI policy decision,India policy,High - banks,`
  Add RBI MPC dates (rbi.org.in), US Fed FOMC dates (federalreserve.gov) and results dates (NSE
  announcements). The starter rows marked "verify" should be checked against the official source.
  Events you add inside the app are saved on that device only.
- **Change scoring thresholds:** `market-compass/compass/scorecard.py`.
- **Change the refresh schedule:** the `cron` lines in `.github/workflows/pages.yml` (times are
  UTC; IST = UTC + 5:30).
- **Force a refresh now:** github.com → repo → **Actions** → **Deploy web app** → **Run workflow**.
- **Nifty expiry day:** the calendar assumes **Tuesday** (NSE's expiry day at the time of
  writing). If NSE changes it, edit `recurring_events` in `compass/events.py`.

---

## 5. Using it on another device or account

- **Another phone or computer:** just open the link and install it. Nothing to copy.
- **Your saved settings** (✍️ factor choices, daily log, your own events) are stored in that
  device's browser. Use **Export log (CSV)** on the Compass tab to keep a copy.
- **Another GitHub account taking over:** fork or transfer the repo. In the new repo:
  1. Enable **Settings → Pages → Source: GitHub Actions**.
  2. Enable **Actions**.
  3. Run **Deploy web app** once from the Actions tab.

  The new link becomes `https://<new-owner>.github.io/<repo-name>/market-compass/`. Also update
  the HANDOVER link in `web/app.js`.

- **Note:** GitHub pauses scheduled jobs in a repo with no activity for 60 days. If the "data
  updated" time stops moving, open Actions and click **Enable workflow**, or make any small commit.

---

## 6. Optional: desktop version (any NSE stock on demand)

The link covers about 50 stocks. To analyse **any** NSE symbol live:

1. Download the repo: github.com → **Code → Download ZIP**, then unzip it.
2. Install **Python 3.10+** from <https://www.python.org/downloads/>. Tick **"Add Python to PATH"**.
3. Open `market-compass` and double-click **`Start Market Compass.bat`**. On Mac/Linux, run:

   ```bash
   bash start.sh
   ```

4. The first run installs packages (2–5 minutes). The browser then opens at
   `http://localhost:8501`. Phones on the same Wi‑Fi can open the "Network URL" shown in the
   window.

You can also host this version free on Streamlit Community Cloud (<https://share.streamlit.io>):
sign in with GitHub and choose repo `AditriKaushik/Guardian`, branch `main`, main file
`market-compass/app.py`. NSE often blocks cloud servers, so set the FII factor by hand there.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "Could not load live data" | Check your internet and reopen. If it continues, check github.com → Actions for a failed **Deploy web app** run. |
| "Data updated" is hours old in market hours | GitHub may be delayed, or scheduled jobs were paused (see section 5). Run the workflow by hand from Actions. |
| FII/DII missing | NSE sometimes blocks the request. Use the NSE link on the Smart money tab and set the FII factor by hand. |
| A stock is missing | Add it to `compass/stocks.py` (section 4), or use the desktop version. |
| Install button not shown | Use the browser menu → **Install app** / **Add to Home Screen**. iPhone needs Safari. |
| Prices look a bit late | Free Yahoo data can lag ~15 minutes. Confirm in your broker app before trading. |
| Check the code works | In `market-compass/`, run `python -m pytest tests -q` (needs internet for the live tests). |

---

## 8. Brief for a developer or AI assistant (copy-paste this)

> I have **Market Compass**, an Indian stock-market dashboard, in the `market-compass/` folder
> of the public GitHub repo **AditriKaushik/Guardian** (branch `main`). It's published as an
> installable PWA at https://aditrikaushik.github.io/Guardian/market-compass/.
>
> **How it works:**
> - `.github/workflows/pages.yml` runs on a schedule (every 15 min in IST market hours, plus
>   pre-open, after NSE FII data, and weekends).
> - It runs `python -m compass.build_site ../_mc_data --previous-track <live track.json URL>`,
>   then publishes `web/` (the repo's other app) at `/` and `market-compass/web/` plus the built
>   `data.json` and `track.json` at `/market-compass/`. If the build fails, the previous JSON is
>   kept.
>
> **Modules (Python, real data only, no demo mode):**
> - `compass/data.py`: yfinance `history()`, `macro_snapshot()`, `sector_performance()`;
>   NSE `api/fiidiiTradeReact` via `fii_dii()`.
> - `compass/scorecard.py`: 16 `Factor`s (8 auto-scored, 8 manual), scored −1/0/+1. `stance()`
>   averages them; `sector_tilts()` maps factors to sectors.
> - `compass/stock_model.py`: hourly bars over 730 days, 15 no-look-ahead features (momentum, VWAP
>   distance, RSI, Bollinger %B, EMA distance/slope, volume ratio, volatility, hour, Nifty move,
>   relative strength) and same-day labels for 1/2/3 hours or till close.
>   - Logistic regression is tested on the newest 30% (chronological, with a gap), then refit on
>     all data.
>   - P(up) is shrunk toward the base rate by a reliability score: AUC-based, and capped at 0.3
>     unless test accuracy beats always-guess.
> - `compass/build_site.py`: about 52 symbols × 4 horizons, plus the live forward-test log
>   (`update_track`). Predictions are logged once per stock/horizon/bar in market hours and
>   resolved against the target bar's real close. Records are kept for 20 days.
> - `web/app.js`: vanilla JS front end. User judgement scores, the daily log and personal events
>   live in localStorage. The ±3 pt Compass blend and the verdicts are computed client side.
> - `app.py`: optional Streamlit desktop version for any NSE symbol.
>
> **Tests:** `cd market-compass && python -m pytest tests -q` (logic tests use a synthetic series
> in `tests/synthetic.py`; `tests/test_live.py` hits real Yahoo data).
>
> **Please keep the honesty rules:** always show model trust, out-of-sample accuracy and the live
> track record, and never promise returns.
