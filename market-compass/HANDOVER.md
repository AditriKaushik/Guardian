# 🧭 Market Compass: Handover Guide

## 🔗 Your link

**https://aditrikaushik.github.io/Guardian/market-compass/**

It works on any phone, tablet or computer, and you can install it as an app:

- **Android (Chrome):** open the link → tap **⬇ Install app** at the top, or menu ⋮ → **Install app**.
- **iPhone / iPad (Safari):** open the link → Share button → **Add to Home Screen**.
- **📱 Android app (APK):** download
  **https://github.com/AditriKaushik/Guardian/releases/download/market-compass-apk/MarketCompass.apk**
  on the phone, open the file, and allow "Install unknown apps" for your browser when Android asks.
  The app shows the live site, so its data is always current. News and NSE links open in your browser.
  GitHub rebuilds the APK automatically whenever `market-compass/android/` changes.
- **Windows / Mac (Chrome or Edge):** open the link → click the install icon in the address bar,
  or menu → **Install Market Compass**.

You don't need Claude, a computer that stays on, or any login. Everything runs on GitHub's free
service.

**All data is real and live:** Yahoo Finance for prices, NSE for FII/DII flows and the official
index lists. There is no demo or sample data. GitHub Actions rebuilds everything in a
**self-refreshing loop**: each run starts the next one itself.

| When (IST) | How often |
|---|---|
| Mon–Fri, 8:45 AM–3:45 PM (market hours) | About every 5 minutes (each price shows its exact time, e.g. "price at 11:30 IST") |
| Mon–Fri, other times | About every hour (catches the evening FII/DII data and the pre-market moves) |
| Saturday and Sunday | About every 3 hours |

GitHub's own timer (cron) is unreliable, so it is only a backup that restarts the loop if it ever
stops. The top of the app shows "data updated … min ago". During market hours it warns
**⚠ refresh is running late** if the data is more than 15 minutes old. An open app checks for new data every minute. Yahoo's free prices
themselves are close to real time (usually within a minute or two).

> ⚠️ Educational tool, not investment advice. No tool can guarantee profits. Always use a
> stop-loss and never risk money you can't afford to lose.

---

## 1. What's in the app (9 tabs)

1. **🧭 Compass:** live tiles for Nifty, Bank Nifty, India VIX, USD/INR, the US Dollar Index,
   the US 10-year yield, Brent crude, gold, the S&P 500, Nikkei and Hang Seng.
   - A **16-factor scorecard**. 8 factors score themselves from live data (rupee, dollar, US
     yields, crude, VIX, global markets, Nifty trend, FII flows). You set 8 after reading the
     news (DII/SIP flows, RBI, inflation, war risk, monsoon, festival demand, earnings, government
     policy).
   - The result is a **stance for the day** (Aggressive Buy / Cautious Buy / Neutral / Defensive /
     Protect Capital) and the **sectors to favour or avoid**. Your choices and daily log are saved
     on your device.
   - **🌍 Metals, energy & crypto** (also on the Compass tab):
     - Live silver, copper, aluminium, WTI, natural gas, Bitcoin, Ethereum, US VIX and Nasdaq.
     - **"How Nifty should open today"**: a forecast from the overnight S&P 500, the US dollar,
       Bitcoin and Hang Seng's 7 AM open. It got the direction right on 72–75% of days in
       2021–26 tests; the app shows the actual opening next to it.
     - A **metal stocks tilt** from copper, aluminium and Hang Seng.
     - A **cause → effect table** with ✅ / ⚠️ / ❌ verdicts from 10-year tests. Examples:
       - Copper → metal stocks ✅ (small effect)
       - Crude → ONGC ⚠️
       - Gold → Titan ❌
       - Natural gas → GAIL ❌
       - Crypto: adds almost nothing beyond the US market
2. **⭐ Daily picks:** opens with a **market-direction banner** (⬆️ UP / ↔️ SIDEWAYS / ⬇️ DOWN, from
   Nifty vs its 200-day average and its 1-month change). Below it is **"🎯 Today's suggestions"**:
   one list of 🟢 BUY and one of 🔴 SELL, covering stocks and the Nifty signal. Every item has a
   past win rate of at least your chosen **minimum win chance** (setting: 70 / 75 / 80 / 85%,
   default **75%**, saved on the device). The same 75% bar applies to BUY and SELL. When nothing
   qualifies, a **Watch** list shows stocks close to a BUY trigger (RSI(2) under 20 in an uptrend)
   or a SELL trigger (F&O stock that gapped down 2.5%+), with no win claim.
   When the market is rising, suggestions come mainly from the BUY-the-dip rule. When it is
   falling, only the tested gap-down SELL rule applies, because no "short the falling market"
   rule passed testing.
   Details of each rule follow: stocks that pass **every** condition, with a **75%+ historical win rate**.
   Checks 150 stocks (Nifty 50 + Next 50 + Midcap 50) every refresh.
   - **Rule:** buy a strong stock (above its 200-day average, 50-day above 200-day) on a short dip
     (below its lower Bollinger Band or RSI(2) under 5), only while Nifty is above its 200-day
     average. Sell at **+2% target, −8% stop-loss, or after 15 trading days**. Delivery only.
   - **Conditions:**
     - Market-level: market regime, India VIX ≤ 40 (crash guard), macro stance, the rule's own recent win rate
       ≥ 75%, and FII selling (caution only).
     - Stock-level: no results or board meeting within 3 weeks (NSE event calendar), not in the
       F&O ban list, not under ASM/GSM surveillance, liquidity ≥ ₹20 cr a day, no circuit-type
       move, no corporate-action gap, and a sector allowed by the stance.
     - Limits: max 5 picks a day and 2 per industry. Position size risks 1% of your capital.
   - **Real numbers** (recomputed from 10 years of real prices on every refresh, after 0.25%
     costs): about **81% wins overall and ~80% in the last 5 years**. But wins are small (+2%) and
     losses big (−6 to −8%). In 2018, 2019 and 2022 it won 75%+ of trades yet lost money overall,
     and in 2026 so far it is at 69%. The page shows all of this, plus a live record of every
     final pick.
   - **Stress filters (added after testing):** a pick also needs Nifty lower than 5 trading days
     ago, India VIX at or above 98% of its 20-day average, and the dip on normal volume (< 1.2× its
     20-day average). On unseen 2021–26 data this raised the win rate from 79.7% to **83.8%** and
     the average per trade from +0.22% to **+0.55%**, better in every year 2017–2026. Picks are
     now rarer.
   - **🔴 SELL picks (experimental, F&O only):**
     - **Rule:** "gap-down continuation". The stock opens 4%+ below yesterday's close, on 2×+ its
       50-day volume, and closes in the bottom 25% of the day's range. Short at the close via
       stock futures. Cover at −1.5% (profit), +8% stop, or after 15 days.
     - **Real numbers:** 2021–26, 86 trades: **83.7% wins, +0.61% per trade** after 0.15% costs.
       It is rare (about 17 a year) and not statistically proven (t ≈ 1.4).
     - **What was rejected:** 675 short setups were tested. The plain mirror of the BUY rule won
       73% but lost money, because a short's losses (−7% to −14% on gap-ups) dwarf its +2% wins.
     - **SELL checks:** the stock is in NSE F&O (NSE's lot-size list, 218 stocks), not in the
       F&O ban, not under ASM/GSM, liquid, and not a corporate-action gap. Max 3 a day, one per
       industry.
     - **Each SELL card shows:** lot size, contract value, ~20% margin, and profit/loss per lot.
     - **Warnings:** English and Hindi warnings appear on every card: unlimited loss risk, and
       91%+ of individual F&O traders lose money (SEBI FY25). For non-F&O users, SELL means
       "consider exiting if you hold it".
   - **📈 Nifty index signal:**
     - **Rule:** Nifty is above its 200-day average and India VIX closes above its prior 20-day
       high → buy Nifty at the close. Target +1%, stop −6%, 10 days.
     - **Real numbers:** chosen on 2008–16 data; 2017–26: 75 trades, **77.3% wins, +0.24%**.
     - **No index SELL rule passed:** all lost money on 2008–16 data.
   - **⏱️ Intraday (MIS):** 1,584 intraday variants were tested: 800 BUY (opening-range
     breakout, morning flush, gap-up, VWAP, relative strength) and 784 SELL (gap-down, gap-up
     fade, opening-range breakdown, relative weakness, VWAP rejection, over-extension). They used
     150 stocks and 2 years of hourly bars, at 0.06–0.10% costs. **None qualified**, so the app
     gives no intraday calls and shows the evidence instead. The tab also lists the intraday rules:
     shorting is allowed for any stock but must be squared off the same day, leverage is about 5×,
     and auto square-off is around 3:15–3:20.
   - **Live record:** BUY and SELL picks are logged and checked against real prices separately.
   - **Timing:** the list is provisional while the market is open and final after 3:30 PM. The
     rule enters near the close (3:15–3:25 PM). On many days **no stock qualifies**; that is part
     of the strategy.
   - Also on the page: Indian rules and regulations (SEBI RA rules, surveillance, T+1 settlement,
     STT and costs, tax, fraud warnings).
3. **📰 Overnight news:** everything published between the last NSE close (3:30 PM) and now.
   - **Sources:** Google News searches (India markets, world economy, oil and commodities,
     geopolitics, RBI), Economic Times, Moneycontrol, Livemint, BBC, CNBC, and NSE corporate
     announcements for the 150 stocks.
   - **Analysis:**
     - Each headline gets topics (war, Fed, RBI, crude/OPEC, tariffs, China, inflation, rupee,
       FII, metals, gold, results, Budget, elections, SEBI, monsoon, crypto, tech/AI).
     - Each headline gets a tone for Indian stocks from finance phrases, e.g. "crude jumps" = bad,
       "rate cut" = good, "ceasefire" = good.
     - Each topic lists the sectors it helps (▲) or hurts (▼). The page also gives an overnight
       mood.
   - **Company news:**
     - Negative company items block that stock from ⭐ Daily picks. Examples: auditor resignation,
       default, rating downgrade, pledge invoked, raid or investigation, FDA warning letter,
       plant shutdown, CFO/CEO resignation.
     - Routine paperwork is filtered out.
   - **Honest note:** research and our own tests agree that overnight news is mostly priced in at
     the open. So the app saves each morning's mood and compares it with Nifty's real opening and
     day move. The 🎯 live check shows the hit rate once 5 days are logged.
4. **📜 History lab:** "when the world looked like today, what happened next?"
   - **Today's state:** Nifty trend and fall from its high, India VIX, rupee, gold, crude,
     copper, dollar index, US 10-year and 3-month rates and the yield curve, S&P 500 and US VIX.
     It is compared with every trading day since 2008.
   - **The 10 most similar past days**, with what Nifty did 5, 20 and 60 days later, plus a
     summary of the 25 closest.
   - **Honest scorecard (recomputed every refresh):** in weekly tests since 2013 this
     "similar days" forecast was right on the 20-day direction 56% of the time vs 62% for
     simply assuming "Nifty goes up". It is shown as context, not as a forecast.
   - **Expected 20-day Nifty range from India VIX:** this predicted volatility best in tests.
     The actual move stayed inside the likely range 74% of the time.
   - **Cause → effect event history** for 18 events (rupee crash, crude spike or crash, VIX
     panic, gold surge, yield jumps, curve inversion, S&P crash, copper moves…). Each shows
     every episode since 2008 and the outcome in 2008–16 vs 2016–now. 🔔 marks events active in
     the last 20 days. Only two passed the consistency bar:
     - **India VIX above 25 →** Nifty higher 20 days later 82% / 75% of the time.
     - **Crude down 20%+ in a month →** weaker Nifty.
   - **Change it caused:** ⭐ Daily picks dropped the old "India VIX ≤ 25" gate, which had never
     been tested; it is now a crash guard at 40. Picks taken with India VIX above 20 won 93%
     vs 85% below it.
5. **📈 Stocks:** **all 50 Nifty 50 stocks** (NSE's official list, downloaded fresh on every
   refresh, so index changes appear automatically) plus **20 ⭐ top performers** picked fresh
   from Nifty Next 50 and Nifty Midcap 50 by 3-month return (each must also be up over 1 month).
   Nifty and Bank Nifty are included too. A **Today's movers** table shows the live top gainers
   and losers. Pick a stock, a horizon
   (1, 2 or 3 hours, or till close) and your amount in ₹. You get:
   - the **% chance up or down**;
   - **model trust** (how much to believe that %) and its accuracy on unseen history;
   - a likely price range;
   - the quantity to buy, with a stop-loss, a target and the rough expected value;
   - a plain-language reading of the chart, and a chart with Bollinger Bands;
   - a ranked list of the stocks where the model has proven some skill today.
6. **🐋 Smart money:** FII and DII net buying/selling (NSE), sector rotation (1 day, 5 days,
   1 month), and links to NSE's big-player pages: bulk/block deals, option chain, FII positions,
   insider trades.
7. **📅 Calendar:** upcoming Indian and US data releases, F&O expiries, your events, and the
   month's seasonal theme (festivals, monsoon, Budget, results season).
8. **🎯 Live track record:** the real-world test. Every prediction made in market hours is logged
   at the live price, then marked ✅ or ❌ against the **actual** price when its horizon ends. It
   shows the live hit rate against simple guessing, overall and for each horizon. It covers the
   last 20 days.
9. **📖 Guide:** install steps, the daily routine, and how to read the numbers.

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
│   ├── history.py            ← History lab: similar past days, event history, VIX range
│   ├── news.py               ← overnight news: feeds, topics, tone, sectors, NSE filings, live check
│   ├── crossasset.py         ← opening-gap forecast, metals tilt, tested cause → effect table
│   ├── picks.py              ← Daily picks: BUY rule, SELL rule, Nifty index rule, backtests, checks
│   ├── fo.py                 ← NSE F&O lot sizes + F&O ban list (for SELL suggestions)
│   ├── universe.py           ← which stocks: all Nifty 50 + top performers (auto)
│   └── stocks.py             ← stock list for the desktop version
├── data/events.csv           ← shared events shown on everyone's calendar (edit on GitHub)
├── android/                  ← Android app (WebView shell) → built by .github/workflows/market-compass-apk.yml
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

- **Stock list:** updates itself (see `market-compass/compass/universe.py`). To change how many
  top performers are added, edit `build_universe(n_top=20)`. If NSE's list ever can't be
  downloaded, a built-in Nifty 50 list (`NIFTY50_FALLBACK`) is used; update it when NSE changes
  the index (usually March and September).
- **Add events everyone sees:** edit `market-compass/data/events.csv`. One line per event:
  `2026-12-05,RBI policy decision,India policy,High - banks,`
  Add RBI MPC dates (rbi.org.in), US Fed FOMC dates (federalreserve.gov) and results dates (NSE
  announcements). The starter rows marked "verify" should be checked against the official source.
  Events you add inside the app are saved on that device only.
- **Change scoring thresholds:** `market-compass/compass/scorecard.py`.
- **Change the refresh speed:** the `pause=` values (in seconds) in the `keep-refreshing` job of
  `.github/workflows/pages.yml`.
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

- **If the refresh ever stops** (for example after a GitHub outage), go to github.com → Actions →
  **Deploy web app** → **Run workflow**. One click restarts the loop.

---

## 6. Optional: desktop version (any NSE stock on demand)

The link covers Nifty 50 plus 20 top performers. To analyse **any** NSE symbol live:

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
| "⚠ refresh is running late" | Open github.com → Actions → **Deploy web app** → **Run workflow**. This restarts the refresh loop. |
| FII/DII missing | NSE sometimes blocks the request. Use the NSE link on the Smart money tab and set the FII factor by hand. |
| A stock is missing | The web app covers Nifty 50 + 20 top performers. For any other NSE stock, use the desktop version (section 6). |
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
> - `.github/workflows/pages.yml` keeps itself running: its `keep-refreshing` job sleeps, then
>   dispatches the next run (~5 min in market hours, hourly off-hours, 3-hourly at weekends;
>   older loops stop if a newer run exists). Cron entries are only a backup.
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
> - `compass/picks.py`: Daily picks. 150 stocks × 10y daily data; rule = uptrend + (close < lower BB or RSI2 < 5)
>   with Nifty > 200DMA; exit +2% / −8% / 15 days; 0.25% costs. Stats recomputed every build.
>   Gates: India VIX ≤ 40 crash guard, Nifty 5-day down, India VIX ≥ 0.98×SMA20, dip volume < 1.2×, auto-stance, rule's 5y win ≥ 75%, NSE event calendar (21 days), F&O ban CSV, NSE ASM/GSM
>   APIs, liquidity, ±8% move, corporate-action gaps, max 5 picks / 2 per industry. Final picks are logged
>   after the close and resolved in track.json → picks.
> - `compass/history.py`: History lab. Daily state since 2008 → 10 nearest past days (z-scored with history to date,
>   de-clustered), walk-forward scorecard, 18 event studies split 2008–16 / 2016–now, India VIX 20-day range.
> - `compass/news.py`: overnight headlines (RSS) + NSE filings → topics, tone, sectors; negative company news blocks picks.
> - `compass/universe.py`: all Nifty 50 (NSE's official CSV, with a built-in fallback) + top 20
>   by 3-month return from Nifty Next 50 / Midcap 50, plus the two indices.
> - `compass/build_site.py`: about 72 symbols × 4 horizons, plus the live forward-test log
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

---

## 9. What was tested (Nov 2026 studies) and what was adopted

Four studies on 10 years of real data. Rules were chosen on data before Nov 2021 and judged only
on Nov 2021–Nov 2026.

| Study | Adopted | Rejected |
|---|---|---|
| Commodities → Indian stocks | Copper/aluminium → metal stocks (small intraday tilt) | Next-day or 5-day prediction from any commodity; gold → Titan; gas → GAIL/IGL; crude → OMCs/IndiGo |
| Global, crypto, FX → Nifty | Opening-gap forecast (S&P 500, dollar, Hang Seng open, Bitcoin): 72–75% direction | Anything after the open (coin flip); crude, gold, USD/INR for Nifty |
| Daily Picks filters | Nifty 5-day down + India VIX not falling + calm-dip volume: 83.8% win, +0.55%/trade | US VIX, DXY, USD/INR, crude, copper, BTC, S&P trend, breadth, sector trend, ATR caps |
| Hourly model + global features | Nothing (no gain over chance) | 13 model/feature sets, including pooled and gradient-boosted |

### Overnight news study (Nov 2026, research summary)
- **Supported by evidence:** macro and world news is absorbed at the open. Company-specific
  negative news, especially in mid-caps, can drift for days. Examples: auditor resignation,
  default, downgrade, pledge, FDA warning.
- **Not supported:** headline sentiment predicting Nifty after 9:15, Budget-day direction, or big
  lasting moves from India–Pakistan tensions, which historically moved the market about 1–2%.
- **What the app does with this:** it uses company news to block risky picks, and it tracks the
  morning mood against the real open, so its value is measured, not assumed.
