/* Market Compass web app. Reads live data.json / track.json built by GitHub Actions from real market data. */
"use strict";

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (x, d = 2) => x == null || isNaN(x) ? "n/a" : Number(x).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (x, d = 2) => x == null || isNaN(x) ? "n/a" : (x >= 0 ? "+" : "") + (x * 100).toFixed(d) + "%";
const cls = x => x > 0 ? "pos" : x < 0 ? "neg" : "";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);

let DATA = null, TRACK = null, STANCE = { pct: 0 };

/* ---------------------------------------------------------------- loading */
async function load() {
  try {
    const r = await fetch("data.json?t=" + Date.now(), { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    DATA = await r.json();
  } catch (e) {
    $("#status").textContent = "Could not load live data (" + e.message + "). Check your internet and reopen.";
    return;
  }
  try { const r = await fetch("track.json?t=" + Date.now(), { cache: "no-store" }); TRACK = r.ok ? await r.json() : null; } catch { TRACK = null; }
  const age = Math.round((Date.now() - new Date(DATA.generated_at).getTime()) / 60000);
  const stale = isMarketHoursNow() && age > 15;
  $("#status").innerHTML = `${DATA.market_open ? "🟢" : "🔴"} ${esc(DATA.market_status)} · data updated ${age < 1 ? "just now" : age + " min ago"} (${esc(DATA.generated_at.slice(11, 16))} IST)` +
    (stale ? ` · <b style="color:#ffb4ab">⚠ refresh is running late, prices may be old</b>` : "");
  renderAll();
}

function timeOf(ts) {  // "2026-11-12 11:29" -> "11:29 IST" (adds the date if it isn't today)
  if (!ts) return "n/a";
  const d = String(ts).slice(0, 10), t = String(ts).slice(11, 16);
  return (d === todayIST() ? "" : d.slice(8, 10) + "/" + d.slice(5, 7) + " ") + t + " IST";
}

function isMarketHoursNow() {
  const t = new Date(Date.now() + 5.5 * 3600e3), d = t.getUTCDay(), m = t.getUTCHours() * 60 + t.getUTCMinutes();
  return d >= 1 && d <= 5 && m >= 9 * 60 + 15 && m <= 15 * 60 + 30;
}

function renderAll() { renderCompass(); renderPicks(); renderStocks(); renderMoney(); renderCalendar(); renderTrack(); renderGuide(); }

/* ---------------------------------------------------------------- compass */
const MACRO_ORDER = ["nifty", "banknifty", "vix", "usdinr", "dxy", "us10y", "brent", "gold", "sp500", "nikkei", "hangseng"];
const BAD_WHEN_UP = new Set(["vix", "usdinr", "dxy", "us10y", "brent"]);

function spark(arr) {
  const v = (arr || []).filter(x => x != null); if (v.length < 2) return "";
  const mn = Math.min(...v), mx = Math.max(...v), w = 140, h = 28;
  const pts = v.map((x, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(h - (x - mn) / ((mx - mn) || 1) * h).toFixed(1)}`).join(" ");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="28" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".6"/></svg>`;
}

function scoresState() { return store.get("mc_scores", {}); }

function currentScores() {
  const st = scoresState(), out = {};
  for (const f of DATA.factors) {
    const s = st[f.key];
    if (f.auto && f.auto_score != null && (!s || s.v === "auto")) out[f.key] = f.auto_score;
    else if (s && s.v !== "auto") out[f.key] = s.v;
    else out[f.key] = 0;
  }
  return out;
}

function stanceOf(scores) {
  const v = Object.values(scores), n = v.length, total = v.reduce((a, b) => a + b, 0), p = n ? total / n : 0;
  const S = [[0.40, "AGGRESSIVE BUY", "#1a7f37", "Tide strongly in favour. Buy quality cyclicals (banks, autos, capital goods) on dips; normal position size."],
    [0.13, "CAUTIOUS BUY", "#4c9a2a", "Mildly positive. Buy only strong stocks in favoured sectors, smaller size, strict stop-losses."],
    [-0.13, "NEUTRAL / WAIT", "#9a6700", "No clear tide. Trade very small or stay in cash; wait for factors and smart money to line up."],
    [-0.40, "DEFENSIVE", "#bc4c00", "Mildly negative. Prefer FMCG, pharma, IT; raise cash; avoid fresh aggressive buying."]];
  for (const [th, name, color, action] of S) if (th >= 0 ? p >= th : p > th) return { total, n, pct: p, name, color, action };
  return { total, n, pct: p, name: "PROTECT CAPITAL", color: "#cf222e", action: "Tide strongly against. Mostly cash. Watch for FII buying to return before re-entering." };
}

function sectorTilts(scores) {
  const agg = {};
  for (const f of DATA.factors) {
    const s = scores[f.key]; if (!s) continue;
    for (const [sec, sign] of Object.entries(f.sectors || {})) {
      const v = s * sign; (agg[sec] ??= { v: 0, why: [] }).v += v; agg[sec].why.push(`${f.name} (${v > 0 ? "+" : "−"})`);
    }
  }
  return Object.entries(agg).filter(([, a]) => a.v !== 0).sort((a, b) => b[1].v - a[1].v);
}

function renderCompass() {
  const el = $("#compass"), m = DATA.macro, st = scoresState(), today = todayIST();
  const tiles = MACRO_ORDER.map(k => {
    const r = m[k]; if (!r) return "";
    if (!r.ok) return `<div class="card tile"><div class="lbl">${esc(r.label)}</div><div class="val">n/a</div><div class="chg muted">no data</div></div>`;
    const sign = BAD_WHEN_UP.has(k) ? -1 : 1;
    return `<div class="card tile"><div class="lbl">${esc(r.label)}</div><div class="val">${fmt(r.last, k === "nifty" || k === "banknifty" ? 0 : 2)}</div>
      <div class="chg"><span class="${cls(sign * r.chg1)}">${pct(r.chg1)} today</span> · <span class="${cls(sign * r.chg5)}">${pct(r.chg5)} 5-day</span></div>
      <div class="chg muted">price at ${esc(timeOf(r.asof))}</div>
      <div class="${cls(sign * r.chg5)}">${spark(r.spark)}</div></div>`;
  }).join("");

  const factorCards = DATA.factors.map(f => {
    const s = st[f.key], cur = s ? s.v : (f.auto && f.auto_score != null ? "auto" : 0);
    const old = s && s.date && s.date !== today && !f.auto ? `<span class="pill">set on ${esc(s.date)}: re-check today</span>` : "";
    const opts = (f.auto && f.auto_score != null ? [["auto", "Auto", "a"]] : []).concat([[1, "+1 Good", "g"], [0, "0", "n"], [-1, "−1 Bad", "b"]]);
    const seg = opts.map(([v, l, c]) => `<button class="${c} ${String(cur) === String(v) ? "on" : ""}" data-f="${f.key}" data-v="${v}">${l}</button>`).join("");
    const info = f.auto ? (f.auto_score != null ? `🤖 auto ${f.auto_score > 0 ? "+" : ""}${f.auto_score} · ${esc(f.reason)}` : `✍️ ${esc(f.reason)}`)
      : `✍️ Good: ${esc(f.good)} · Bad: ${esc(f.bad)}`;
    return `<div class="card factor"><div class="head"><span class="name" title="Good: ${esc(f.good)}\nBad: ${esc(f.bad)}">${esc(f.name)}</span><span class="seg">${seg}</span></div>
      <div class="muted">${info} ${old}</div><div class="muted">Where to check: ${esc(f.where)}</div></div>`;
  }).join("");

  const scores = currentScores(), sn = stanceOf(scores); STANCE = sn;
  const tilts = sectorTilts(scores);
  const tiltRows = (arr) => arr.map(([s, a]) => `<tr><td>${esc(s)}</td><td class="num ${cls(a.v)}">${a.v > 0 ? "+" : ""}${a.v}</td><td class="muted">${esc(a.why.join(", "))}</td></tr>`).join("") || `<tr><td colspan=3 class="muted">None today</td></tr>`;

  el.innerHTML = `
    <h2>World &amp; India right now</h2><div class="grid">${tiles}</div>
    <p class="muted"><b>today</b> = change since the previous close · <b>5-day</b> = change over the last 5 trading days (आज का बदलाव · पिछले 5 दिन का बदलाव). Prices are refreshed about every 5 minutes in market hours; each tile shows the time of its latest price.
    Green/red show whether the move is good or bad for Indian stocks (a rising dollar, crude, yields or VIX is shown red).</p>
    <div class="stance" style="background:${sn.color}"><div class="sm">Today's stance · score ${sn.total > 0 ? "+" : ""}${sn.total} of ±${sn.n}</div>
      <div class="big">${sn.name}</div><div>${esc(sn.action)}</div></div>
    <div class="grid2"><div class="card"><h3>Favoured sectors</h3><table>${tiltRows(tilts.filter(t => t[1].v > 0))}</table></div>
      <div class="card"><h3>Avoid / underweight</h3><table>${tiltRows(tilts.filter(t => t[1].v < 0).reverse())}</table></div></div>
    <h2>Macro scorecard</h2>
    <p class="muted">Auto factors are scored from live data every refresh. The ✍️ factors are your judgement: set them each morning after reading the news (saved on this device).</p>
    <div class="grid2">${factorCards}</div>
    <div class="card" style="margin-top:12px"><h3>Daily log</h3>
      <div class="controls"><label style="flex:1">Today's note<input id="note" placeholder="e.g. RBI meeting Friday, crude spiking on Middle-East news"></label>
      <button class="btn primary" id="saveDay">Save today's scorecard</button><button class="btn" id="exportDay">Export log (CSV)</button></div>
      <div id="logTable" class="tablewrap"></div></div>`;
  el.querySelectorAll(".seg button").forEach(b => b.onclick = () => {
    const s = scoresState(), v = b.dataset.v; s[b.dataset.f] = { v: v === "auto" ? "auto" : Number(v), date: today };
    store.set("mc_scores", s); renderCompass(); renderStocks();
  });
  $("#saveDay").onclick = () => {
    const log = store.get("mc_log", []); const n = $("#note").value;
    log.push({ date: today, time: new Date().toTimeString().slice(0, 5), stance: sn.name, score: `${sn.total}/${sn.n}`, nifty: DATA.macro.nifty?.last, note: n });
    store.set("mc_log", log); renderLog(); $("#note").value = "";
  };
  $("#exportDay").onclick = () => download("compass_log.csv", toCSV(store.get("mc_log", [])));
  renderLog();
}

function renderLog() {
  const log = store.get("mc_log", []).slice(-10).reverse();
  $("#logTable").innerHTML = log.length ? `<table><tr><th>Date</th><th>Stance</th><th>Score</th><th class="num">Nifty</th><th>Note</th></tr>${log.map(r => `<tr><td>${esc(r.date)} ${esc(r.time)}</td><td>${esc(r.stance)}</td><td>${esc(r.score)}</td><td class="num">${fmt(r.nifty, 0)}</td><td>${esc(r.note)}</td></tr>`).join("")}</table>`
    : `<p class="muted">No saved days yet. Saving daily lets you check later whether your stance calls were right.</p>`;
}


/* ---------------------------------------------------------------- daily picks */
function renderPicks() {
  const el = $("#picks"), P = DATA.daily_picks;
  if (!P || P.error) { el.innerHTML = `<h2>Daily picks</h2><div class="note warnbox">${esc(P ? P.error : "Not available yet: appears after the next refresh.")}</div>`; return; }
  const R = P.rule, S = P.stats, cap = store.get("mc_pick_cap", 100000);
  const ok = v => v === true ? "✅" : v === false ? "❌" : "⚪";
  const pc = x => x == null ? "n/a" : (x * 100).toFixed(1) + "%";
  const size = p => {  // risk 1% of capital per trade, max 20% of capital in one stock
    const risk = cap * 0.01, perShare = p.price - p.stop;
    const q = Math.max(0, Math.min(Math.floor(risk / perShare), Math.floor(cap * 0.20 / p.price)));
    return { q, amt: q * p.price, maxLoss: q * perShare, gain: q * (p.target - p.price) };
  };
  const pickCard = p => {
    const z = size(p);
    return `<div class="card"><div class="factor head"><span class="name" style="font-size:18px">${esc(p.sym)}</span><span class="pill">${esc(p.group)} · ${esc(p.industry)}</span></div>
      <div class="grid" style="margin-top:8px">
        <div class="tile"><div class="lbl">Price now</div><div class="val">₹${fmt(p.price)}</div><div class="chg ${cls(p.day_chg)}">${pct(p.day_chg)} today</div></div>
        <div class="tile"><div class="lbl">Win chance (rule, last 5 yrs)</div><div class="val pos">${pc(p.p_rule)}</div><div class="chg muted">this stock: ${p.stock_hist.wins}/${p.stock_hist.n} past trades won</div></div>
        <div class="tile"><div class="lbl">Target (+${(R.target * 100).toFixed(0)}%)</div><div class="val pos">₹${fmt(p.target)}</div></div>
        <div class="tile"><div class="lbl">Stop-loss (−${(R.stop * 100).toFixed(0)}%)</div><div class="val neg">₹${fmt(p.stop)}</div><div class="chg muted">exit anyway by ${esc(p.exit_by)}</div></div>
      </div>
      <p><b>Why:</b> ${p.why.map(esc).join("; ")}. Strong uptrend (above 200-day average) with a short dip.</p>
      <p><b>For ₹${fmt(cap, 0)}:</b> buy <b>${z.q}</b> shares ≈ ₹${fmt(z.amt, 0)} (risking 1% of capital) → if target: +₹${fmt(z.gain, 0)}, if stop: −₹${fmt(z.maxLoss, 0)} (before charges).</p>
      <details><summary>All ${p.checks.length} stock checks ✅</summary><ul class="list">${p.checks.map(c => `<li>${ok(c.ok)} ${esc(c.name)}: <span class="muted">${esc(c.detail)}</span></li>`).join("")}</ul></details></div>`;
  };
  const yrs = S.years.map(y => `<tr><td>${y.year}</td><td class="num">${y.n}</td><td class="num ${y.win >= R.min_win ? "pos" : "neg"}">${pc(y.win)}</td><td class="num ${cls(y.avg)}">${y.avg == null ? "" : (y.avg >= 0 ? "+" : "") + (y.avg * 100).toFixed(2) + "%"}</td></tr>`).join("");
  const T = P.track || {};
  el.innerHTML = `<h2>⭐ Daily picks: stocks that pass every condition</h2>
    <div class="note">${P.provisional ? "🟡 <b>Provisional</b> (market open): the list can change until 3:30 PM. Final picks are fixed after the close. The rule enters near the close (3:15–3:25 PM)." : "🟢 <b>Final for " + esc(P.as_of) + "</b>: based on the closing price."}
      Checked ${P.universe_n} stocks (Nifty 50 + Next 50 + Midcap 50) against 9 conditions and SEBI/NSE rules.</div>
    <div class="grid2">
      <div class="card"><h3>Market conditions today</h3><ul class="list">${P.market.map(m => `<li>${ok(m.ok)} ${esc(m.name)}<br><span class="muted">${esc(m.detail)}${m.soft ? " (caution only)" : ""}</span></li>`).join("")}</ul></div>
      <div class="card"><h3>The rule (tested on real data)</h3><ul class="list">
        <li><b>Buy</b> a strong stock (above its 200-day average, 50-day above 200-day) on a short dip: below its lower Bollinger Band or RSI(2) under 5. Only while Nifty is above its 200-day average.</li>
        <li><b>Sell</b> at +${(R.target * 100).toFixed(0)}% target, or −${(R.stop * 100).toFixed(0)}% stop-loss, or after ${R.max_days} trading days.</li>
        <li>Delivery (CNC) only, no leverage, no F&amp;O. Max ${R.max_picks} picks a day, max ${R.max_per_industry} per industry. Risk 1% of capital per trade.</li></ul></div>
    </div>
    <h2>Today's picks (${P.picks.length})</h2>
    ${P.picks.length ? P.picks.map(pickCard).join("") : `<div class="card"><p><b>No stock qualifies today.</b> ${P.market_ok ? "No strong stock is in a qualifying dip right now (common when the market is rising steadily). In the last 12 months, signals appeared on about 3 of every 10 trading days." : "A market-level condition above is not met, so the rule stays out today."} Doing nothing is part of the strategy.</p></div>`}
    <div class="card" style="margin-top:12px"><label class="muted">Your capital for position sizing (₹) <input id="pickCap" type="number" min="1000" step="1000" value="${cap}" style="width:140px"></label></div>
    ${P.blocked.length ? `<h3>Signal, but blocked by a condition</h3><div class="card tablewrap"><table><tr><th>Stock</th><th>Industry</th><th>Blocked by</th></tr>${P.blocked.map(b => `<tr><td><b>${esc(b.sym)}</b></td><td class="muted">${esc(b.industry)}</td><td>${b.blocked_by.map(esc).join("; ")}</td></tr>`).join("")}</table></div>` : ""}
    <h2>How honest is "75%+"? The real numbers</h2>
    <div class="grid">
      <div class="card tile"><div class="lbl">Win rate, last 5 years</div><div class="val">${pc(S.recent5y.win)}</div><div class="chg muted">${S.recent5y.n.toLocaleString()} real trades, after costs</div></div>
      <div class="card tile"><div class="lbl">Win rate, last 12 months</div><div class="val ${S.last12m.win >= R.min_win ? "" : "neg"}">${pc(S.last12m.win)}</div><div class="chg muted">${S.last12m.n} trades</div></div>
      <div class="card tile"><div class="lbl">Average win / average loss</div><div class="val"><span class="pos">+${(S.recent5y.avg_win * 100).toFixed(1)}%</span> / <span class="neg">${(S.recent5y.avg_loss * 100).toFixed(1)}%</span></div><div class="chg muted">one loss ≈ ${Math.round(-S.recent5y.avg_loss / S.recent5y.avg_win)} wins</div></div>
      <div class="card tile"><div class="lbl">Average per trade (5 yrs)</div><div class="val ${cls(S.recent5y.avg)}">${(S.recent5y.avg >= 0 ? "+" : "") + (S.recent5y.avg * 100).toFixed(2)}%</div><div class="chg muted">last 12 months: ${(S.last12m.avg * 100).toFixed(2)}%</div></div>
    </div>
    <div class="note warnbox">The rule wins often, but only small amounts: <b>+2% wins, −8% losses</b>. In some years it won 75%+ of trades and still lost money overall. Never skip the stop-loss, and never put all your money in one pick. These numbers are recomputed from real prices on every refresh.</div>
    <div class="card tablewrap"><h3>Year by year (after costs)</h3><table><tr><th>Year</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Avg per trade</th></tr>${yrs}</table></div>
    <h3>🎯 Live record of these picks</h3>
    <div class="card"><p>${T.n ? `${T.wins} of ${T.n} closed picks won (${(T.wins / T.n * 100).toFixed(0)}%), average ${(T.avg * 100).toFixed(2)}% per pick after costs.` : "No closed picks yet. Final picks are logged after each close and checked against real prices until target, stop or 15 days."}</p></div>
    <h2>Rules, regulations &amp; law (India)</h2>
    <div class="card"><ul class="list">
      <li><b>Not investment advice.</b> Under the SEBI (Research Analysts) Regulations, 2014, personalised stock recommendations for a fee need SEBI registration. This tool is an educational screen of public data. Check that any adviser is SEBI-registered on sebi.gov.in.</li>
      <li><b>Surveillance (checked automatically):</b> stocks under NSE/SEBI ASM or GSM surveillance are excluded (today: ${P.regulatory_counts.asm} ASM, ${P.regulatory_counts.gsm} GSM). Stocks in the F&amp;O ban list are excluded (today: ${P.regulatory_counts.fo_ban.map(esc).join(", ") || "none"}).</li>
      <li><b>Results / board meetings</b> within 3 weeks are excluded (NSE event calendar: ${P.regulatory_counts.events} upcoming).</li>
      <li><b>Settlement:</b> T+1. Shares bought today reach your demat account the next trading day. Sell only after delivery (or the trade becomes BTST with its own risks).</li>
      <li><b>Costs:</b> delivery STT 0.1% on both buy and sell, plus brokerage, exchange fees, SEBI fee, GST and stamp duty (0.015% on buy). The tests deduct 0.25% per round trip.</li>
      <li><b>Tax:</b> listed shares held under 12 months give short-term capital gains (taxed at 20% after the July 2024 Budget). Losses can be set off. Keep your contract notes. Rates change, so check the current Budget.</li>
      <li><b>Avoid</b> tips on WhatsApp/Telegram, "guaranteed return" schemes and pump-and-dump stocks. SEBI warns against unregistered "finfluencers". Report fraud on SEBI SCORES.</li>
    </ul></div>`;
  $("#pickCap").onchange = e => { store.set("mc_pick_cap", Math.max(1000, Number(e.target.value) || 100000)); renderPicks(); };
}

/* ---------------------------------------------------------------- stocks */
function adjusted(p, blend) {
  const adj = blend ? 0.03 * Math.max(-1, Math.min(1, STANCE.pct)) : 0;
  const pu = Math.max(0.05, Math.min(0.95, p.p_up + adj));
  let verdict, color;
  if (p.rel < 0.35) { verdict = "NO PROVEN EDGE: the model showed little skill on this stock's unseen history. Don't trade on this number."; color = "#9a6700"; }
  else if (pu >= 0.60) { verdict = "LEANING UP"; color = "#1a7f37"; }
  else if (pu <= 0.40) { verdict = "LEANING DOWN: avoid buying now"; color = "#cf222e"; }
  else { verdict = "NO CLEAR EDGE: stay out or wait"; color = "#9a6700"; }
  return { pu, adj, verdict, color };
}

function stockChart(c) {
  const n = c.c.length, W = 900, H = 300, P = 8;
  const ma = [], up = [], lo = [];
  for (let i = 0; i < n; i++) {
    if (i < 19) { ma.push(null); up.push(null); lo.push(null); continue; }
    const w = c.c.slice(i - 19, i + 1), m = w.reduce((a, b) => a + b, 0) / 20, sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 19);
    ma.push(m); up.push(m + 2 * sd); lo.push(m - 2 * sd);
  }
  const all = c.h.concat(c.l, up.filter(x => x), lo.filter(x => x)), mx = Math.max(...all), mn = Math.min(...all);
  const x = i => P + (i + 0.5) * (W - 2 * P) / n, y = v => P + (mx - v) / ((mx - mn) || 1) * (H - 2 * P - 18), bw = Math.max(2, (W - 2 * P) / n * 0.6);
  const line = (arr, col, dash) => `<polyline fill="none" stroke="${col}" stroke-width="1.3" ${dash ? 'stroke-dasharray="4 3"' : ""} points="${arr.map((v, i) => v == null ? "" : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(" ")}"/>`;
  let candles = "";
  for (let i = 0; i < n; i++) {
    const g = c.c[i] >= c.o[i], col = g ? "var(--up)" : "var(--down)";
    candles += `<line x1="${x(i)}" x2="${x(i)}" y1="${y(c.h[i])}" y2="${y(c.l[i])}" stroke="${col}"/><rect x="${x(i) - bw / 2}" y="${y(Math.max(c.o[i], c.c[i]))}" width="${bw}" height="${Math.max(1, Math.abs(y(c.o[i]) - y(c.c[i])))}" fill="${col}"><title>${c.t[i]} O ${c.o[i]} H ${c.h[i]} L ${c.l[i]} C ${c.c[i]}</title></rect>`;
  }
  const labels = [0, Math.floor(n / 3), Math.floor(2 * n / 3), n - 1].map(i => `<text x="${x(i)}" y="${H - 4}" font-size="11" fill="var(--muted)" text-anchor="middle">${c.t[i]}</text>`).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${line(up, "var(--accent)", 1)}${line(ma, "var(--muted)")}${line(lo, "var(--accent)", 1)}${candles}${labels}
    <text x="${W - P}" y="14" font-size="11" fill="var(--muted)" text-anchor="end">max ${fmt(mx)} · min ${fmt(mn)}</text></svg>`;
}

function renderStocks() {
  const el = $("#stocks"), S = DATA.stocks, syms = Object.keys(S);
  const sel = store.get("mc_stock", { sym: syms.includes("RELIANCE") ? "RELIANCE" : syms[0], h: "2", amt: 10000, blend: true });
  if (!S[sel.sym]) sel.sym = syms[0];
  const H = { "1": "1 hour", "2": "2 hours", "3": "3 hours", "close": "Till today's close" };
  const s = S[sel.sym], p = s.preds[sel.h] || Object.values(s.preds)[0], a = adjusted(p, sel.blend);
  const qty = Math.floor(sel.amt / s.last), stop = s.last - s.atr, tgt = s.last + 1.5 * s.atr;
  const ev = qty * (a.pu * 1.5 * s.atr - (1 - a.pu) * s.atr);

  const ranked = syms.map(k => { const q = S[k].preds[sel.h]; return q ? { k, q, a: adjusted(q, sel.blend) } : null; })
    .filter(r => r && r.q.rel >= 0.35).sort((x, y) => y.a.pu - x.a.pu);
  const rankRow = r => `<tr class="clickrow" data-sym="${esc(r.k)}"><td><b>${esc(r.k)}</b> <span class="muted">${esc(S[r.k].sector)}</span></td><td class="num ${r.a.pu >= .6 ? "pos" : r.a.pu <= .4 ? "neg" : ""}">${(r.a.pu * 100).toFixed(0)}%</td><td class="num">${(r.q.rel * 100).toFixed(0)}%</td><td class="num">${pct(r.q.acc - r.q.acc_base, 1)}</td></tr>`;

  el.innerHTML = `
    <h2>Odds a stock is higher in the next few hours</h2>
    <div class="controls">
      <label>Stock<select id="symSel">${["Nifty 50", "Top performer", "Index"].map(g => {
        const ks = syms.filter(k => (S[k].group || "Nifty 50") === g).sort();
        return ks.length ? `<optgroup label="${g === "Top performer" ? "Top performers (Next 50 / Midcap)" : g === "Index" ? "Indices" : "Nifty 50 (all " + ks.length + ")"}">${ks.map(k =>
          `<option value="${esc(k)}" ${k === sel.sym ? "selected" : ""}>${esc(S[k].name !== k ? S[k].name : k)} · ${S[k].day_chg == null ? "" : pct(S[k].day_chg)} · ${esc(S[k].sector)}</option>`).join("")}</optgroup>` : "";
      }).join("")}</select></label>
      <label>Horizon<select id="hSel">${Object.entries(H).map(([k, v]) => `<option value="${k}" ${k === sel.h ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Amount (₹)<input id="amt" type="number" min="100" step="500" value="${sel.amt}" style="width:120px"></label>
      <label style="flex-direction:row;align-items:center;gap:6px"><input id="blend" type="checkbox" ${sel.blend ? "checked" : ""}> Blend in today's Compass stance (±3 pts max)</label>
    </div>
    <div class="stance" style="background:${a.color}">
      <div class="sm">${esc(sel.sym)} · ₹${fmt(s.last)} (${s.day_chg == null ? "n/a" : pct(s.day_chg)} today) · price at ${esc(timeOf(s.quote_time || s.last_time))} · ${H[sel.h]}${s.group === "Top performer" ? " · ⭐ top performer: " + esc(s.why) : ""}</div>
      <div class="big">${(a.pu * 100).toFixed(0)}% chance UP · ${(100 - a.pu * 100).toFixed(0)}% DOWN</div><div>${esc(a.verdict)}</div></div>
    ${!p.fits_today ? `<div class="note warnbox">${DATA.market_open ? "Not enough trading time left today for this horizon." : "Market is closed: this reads the last candle."} The overnight / next-morning gap is NOT predicted.</div>` : ""}
    <div class="grid">
      <div class="card tile"><div class="lbl">Model trust for this stock</div><div class="val">${(p.rel * 100).toFixed(0)}%</div><div class="chg muted">from a test on unseen history</div></div>
      <div class="card tile"><div class="lbl">Accuracy on unseen history</div><div class="val">${(p.acc * 100).toFixed(1)}%</div><div class="chg ${cls(p.acc - p.acc_base)}">${pct(p.acc - p.acc_base, 1)} vs always-guess (${(p.acc_base * 100).toFixed(1)}%)</div></div>
      <div class="card tile"><div class="lbl">When it was confident</div><div class="val">${p.conf_n ? (p.conf_acc * 100).toFixed(0) + "%" : "n/a"}</div><div class="chg muted">${p.conf_n} calls</div></div>
      <div class="card tile"><div class="lbl">Usually goes up (base rate)</div><div class="val">${(p.base * 100).toFixed(0)}%</div><div class="chg muted">${a.adj ? "Compass blend " + pct(a.adj, 1) : "no blend"}</div></div>
    </div>
    <h3>Likely price at the end of the horizon (8 in 10 past cases fell inside)</h3>
    <div class="grid">
      <div class="card tile"><div class="lbl">Low end</div><div class="val">₹${fmt(p.lo)}</div><div class="chg neg">${pct(p.lo / s.last - 1)}</div></div>
      <div class="card tile"><div class="lbl">Middle</div><div class="val">₹${fmt(p.mid)}</div><div class="chg">${pct(p.mid / s.last - 1)}</div></div>
      <div class="card tile"><div class="lbl">High end</div><div class="val">₹${fmt(p.hi)}</div><div class="chg pos">${pct(p.hi / s.last - 1)}</div></div>
    </div>
    <div class="grid2" style="margin-top:10px">
      <div class="card"><h3>If you buy now (a plan, not a recommendation)</h3>${qty < 1 ? `<p>₹${fmt(sel.amt, 0)} is less than one share (₹${fmt(s.last)}).</p>` :
      `<ul class="list"><li>Quantity: <b>${qty}</b> shares ≈ ₹${fmt(qty * s.last, 0)}</li>
       <li>Stop-loss (1× hourly ATR): <b>₹${fmt(stop)}</b> → max loss ≈ ₹${fmt(qty * (s.last - stop), 0)}</li>
       <li>Target (1.5× ATR): <b>₹${fmt(tgt)}</b> → profit ≈ ₹${fmt(qty * (tgt - s.last), 0)}</li>
       <li>Rough expected value: <b class="${cls(ev)}">₹${fmt(ev, 0)}</b> before charges (brokerage, STT, GST, stamp duty)</li></ul>`}</div>
      <div class="card"><h3>What the chart says now</h3><ul class="list">${s.signals.map(([t, g]) => `<li>${g === "+" ? "🟢" : g === "-" ? "🔴" : "⚪"} ${esc(t)}</li>`).join("")}</ul>
        <h3>Biggest drivers of the number</h3><ul class="list">${p.drivers.map(([n, v]) => `<li>${v > 0 ? "⬆️" : "⬇️"} ${esc(n)} (${v > 0 ? "+" : ""}${v})</li>`).join("")}</ul></div>
    </div>
    <div class="card" style="margin-top:10px"><h3>Last ~10 trading days, hourly, with Bollinger Bands</h3>${stockChart(s.candles)}</div>
    <h2>Today's movers (live)</h2>
    <div class="grid2">${[["Top gainers", 1], ["Top losers", -1]].map(([t, dir]) => {
      const list = syms.filter(k => S[k].group !== "Index" && S[k].day_chg != null).sort((a, b) => dir * (S[b].day_chg - S[a].day_chg)).slice(0, 8);
      return `<div class="card tablewrap"><h3>${t}</h3><table>${list.map(k => `<tr class="clickrow" data-sym="${esc(k)}"><td><b>${esc(k)}</b> <span class="muted">${S[k].group === "Top performer" ? "⭐ " : ""}${esc(S[k].sector)}</span></td><td class="num">₹${fmt(S[k].last)}</td><td class="num ${cls(S[k].day_chg)}">${pct(S[k].day_chg)}</td></tr>`).join("")}</table></div>`;
    }).join("")}</div>
    <p class="muted">Coverage: all ${DATA.universe ? DATA.universe.n_nifty : ""} Nifty 50 stocks (${DATA.universe ? esc(DATA.universe.nifty_source) : ""}) + ${DATA.universe ? DATA.universe.n_top : ""} ⭐ top performers picked fresh from Nifty Next 50 &amp; Midcap 50 by 3-month return.</p>
    <h2>Stocks where the model has proven some skill (${H[sel.h]})</h2>
    <p class="muted">Only stocks whose model beat chance on unseen history are listed, ranked by chance of going up. Tap a row to open it. Most stocks will not qualify on most days, and that is the honest result.</p>
    <div class="card tablewrap"><table><tr><th>Stock</th><th class="num">Chance up</th><th class="num">Trust</th><th class="num">Edge vs guess</th></tr>${ranked.map(rankRow).join("") || `<tr><td colspan=4 class="muted">No stock qualifies for this horizon right now.</td></tr>`}</table></div>
    <p class="muted">Model details: trained on ~${p.n_train.toLocaleString()} hourly samples, tested on ${p.n_test.toLocaleString()} unseen ones · AUC ${p.auc} (0.5 = coin flip) · raw model output ${(p.p_raw * 100).toFixed(1)}%.
    The list updates itself: Nifty 50 from NSE's official list, top performers re-ranked on every refresh.</p>`;
  const save = () => store.set("mc_stock", sel);
  $("#symSel").onchange = e => { sel.sym = e.target.value; save(); renderStocks(); };
  $("#hSel").onchange = e => { sel.h = e.target.value; save(); renderStocks(); };
  $("#amt").onchange = e => { sel.amt = Math.max(100, Number(e.target.value) || 100); save(); renderStocks(); };
  $("#blend").onchange = e => { sel.blend = e.target.checked; save(); renderStocks(); };
  el.querySelectorAll(".clickrow").forEach(r => r.onclick = () => { sel.sym = r.dataset.sym; save(); renderStocks(); window.scrollTo({ top: 0, behavior: "smooth" }); });
}

/* ---------------------------------------------------------------- smart money */
function renderMoney() {
  const f = DATA.fii, el = $("#money");
  const secRows = DATA.sectors.map(r => `<tr><td>${esc(r.Sector)}</td>${["1-day %", "5-day %", "1-month %"].map(k => `<td class="num ${cls(r[k])}">${r[k] > 0 ? "+" : ""}${fmt(r[k])}</td>`).join("")}</tr>`).join("");
  const L = [["FII / DII cash activity", "Who is buying or selling overall", "https://www.nseindia.com/reports/fii-dii"],
    ["Participant-wise open interest", "FII long vs short in index futures (FII longs < 25% = extreme fear, often near a bottom)", "https://www.nseindia.com/all-reports-derivatives"],
    ["Bulk & block deals", "Big investors buying specific stocks", "https://www.nseindia.com/report-detail/display-bulk-and-block-deals"],
    ["Nifty option chain", "Highest put OI ≈ support, highest call OI ≈ resistance; PCR > 1.3 oversold, < 0.7 overbought", "https://www.nseindia.com/option-chain"],
    ["Insider / promoter trades", "Promoters buying their own shares is a strong signal", "https://www.nseindia.com/companies-listing/corporate-filings-insider-trading"],
    ["Corporate announcements", "Results dates, orders, deals", "https://www.nseindia.com/companies-listing/corporate-filings-announcements"],
    ["Mutual fund flows (AMFI)", "Monthly SIP and equity inflows", "https://www.amfiindia.com/"]];
  el.innerHTML = `<h2>Follow the big fish</h2>
    ${f ? `<div class="grid"><div class="card tile"><div class="lbl">FII / FPI net (${esc(f.date)})</div><div class="val ${cls(f.FII)}">₹${fmt(f.FII, 0)} cr</div><div class="chg muted">negative = net selling</div></div>
      ${f.DII != null ? `<div class="card tile"><div class="lbl">DII net (${esc(f.date)})</div><div class="val ${cls(f.DII)}">₹${fmt(f.DII, 0)} cr</div><div class="chg muted">source: NSE</div></div>` : ""}</div>`
      : `<div class="note warnbox">NSE didn't return FII/DII data on the last refresh. Open the NSE link below and set the FII factor on the Compass tab by hand.</div>`}
    <div class="note"><b>How to read it:</b> 5+ days of FII selling above ₹3,000 cr/day = pressure. The first days FIIs turn buyers after a long selling streak often mark a bottom. Strong DII buying cushions falls. NSE publishes the day's figures after about 6 PM IST.</div>
    <h3>Sector rotation: where money is moving</h3>
    <div class="card tablewrap"><table><tr><th>Sector index</th><th class="num">1 day</th><th class="num">5 days</th><th class="num">1 month</th></tr>${secRows}</table></div>
    <h3>Daily checklist (official NSE pages)</h3>
    <div class="card tablewrap"><table>${L.map(([a, b, u]) => `<tr><td><a href="${u}" target="_blank" rel="noopener">${a}</a></td><td class="muted">${b}</td></tr>`).join("")}</table></div>
    <p class="muted">Delivery % (each stock's NSE page → Trade info): price up with delivery > 60% = genuine buying; price up with low delivery = speculation.</p>`;
}

/* ---------------------------------------------------------------- calendar */
function renderCalendar() {
  const el = $("#calendar"), today = todayIST(), mine = store.get("mc_events", []);
  const rows = DATA.calendar.map(r => ({ ...r, source: r.source })).concat(mine.map(r => ({ ...r, source: "On this device" })))
    .filter(r => r.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  el.innerHTML = `<h2>What's coming: plan BEFORE the event, not during it</h2>
    <div class="note"><b>This month's seasonal theme:</b> ${esc(DATA.seasonal)}</div>
    <div class="card tablewrap"><table><tr><th>Date</th><th>Event</th><th>Impact</th><th>Notes</th><th>Source</th></tr>
    ${rows.map((r, i) => `<tr><td>${esc(r.date)}</td><td>${esc(r.event)}</td><td>${esc(r.expected_impact)}</td><td class="muted">${esc(r.notes)}</td><td class="muted">${esc(r.source)}${r.source === "On this device" ? ` <a href="#" data-del="${esc(r.date + "|" + r.event)}">delete</a>` : ""}</td></tr>`).join("")}</table></div>
    <h3>Add your own event</h3>
    <p class="muted">RBI MPC dates: rbi.org.in · US Fed FOMC: federalreserve.gov · results dates: NSE announcements. Saved on this device. To share across devices, edit <code>market-compass/data/events.csv</code> on GitHub.</p>
    <div class="controls"><label>Date<input id="evDate" type="date"></label><label style="flex:1">Event<input id="evName" placeholder="e.g. RBI policy decision"></label>
      <label>Impact<input id="evImp" placeholder="High - banks"></label><button class="btn primary" id="evAdd">Add</button></div>`;
  $("#evAdd").onclick = () => {
    const d = $("#evDate").value, n = $("#evName").value.trim(); if (!d || !n) return;
    mine.push({ date: d, event: n, expected_impact: $("#evImp").value, notes: "" }); store.set("mc_events", mine); renderCalendar();
  };
  el.querySelectorAll("[data-del]").forEach(a => a.onclick = e => {
    e.preventDefault(); store.set("mc_events", mine.filter(r => r.date + "|" + r.event !== a.dataset.del)); renderCalendar();
  });
}

/* ---------------------------------------------------------------- live track record */
function renderTrack() {
  const el = $("#track"), T = TRACK || {}, t = T.totals || DATA.track_summary || {};
  const card = (title, s, sub) => `<div class="card tile"><div class="lbl">${title}</div>${s && s.n ? `<div class="val">${(s.hit * 100).toFixed(1)}%</div>
    <div class="chg">${s.n.toLocaleString()} checked · always-guess ${(s.always_guess * 100).toFixed(1)}% · <span class="${cls(s.hit - s.always_guess)}">${pct(s.hit - s.always_guess, 1)}</span></div>` : `<div class="val">n/a</div><div class="chg muted">${sub}</div>`}</div>`;
  const res = (T.resolved || []).slice(-40).reverse();
  el.innerHTML = `<h2>Live track record: real predictions vs what really happened</h2>
    <div class="note">Every refresh during market hours, the app records its prediction for each stock and horizon at the current price. When the horizon ends, it checks the <b>real</b> price and marks it right or wrong. This is forward testing on live data that no model has seen. It starts empty and fills as market hours pass.</div>
    <div class="grid">${card("All predictions: hit rate", t.all, "waiting for the first market hours")}
      ${card("Actionable calls (trusted, ≥60% or ≤40%)", t.actionable, "none checked yet")}
      ${["1", "2", "3", "close"].map(h => card(`Horizon ${h === "close" ? "till close" : h + "h"}`, (t.by_horizon || {})[h], "none yet")).join("")}</div>
    <p class="muted">"Always-guess" = the score you'd get by always predicting whatever happened most often. Real skill shows as a positive gap. ${T.open ? `${T.open.length.toLocaleString()} predictions are waiting for their horizon to end.` : ""} Records kept for the last 20 days.</p>
    <h3>Latest checked predictions</h3>
    <div class="card tablewrap"><table><tr><th>Made</th><th>Stock</th><th>Horizon</th><th class="num">Chance up</th><th class="num">Entry → exit</th><th>Result</th></tr>
      ${res.map(r => `<tr><td>${esc(r.made.slice(5, 16).replace("T", " "))}</td><td>${esc(r.sym)}</td><td>${r.h === "close" ? "close" : r.h + "h"}</td><td class="num">${(r.p * 100).toFixed(0)}%</td>
        <td class="num">₹${fmt(r.price)} → ₹${fmt(r.exit)} <span class="${cls(r.move)}">${pct(r.move)}</span></td><td>${(r.p >= 0.5) === !!r.up ? "✅ right" : "❌ wrong"}</td></tr>`).join("") || `<tr><td colspan=6 class="muted">Nothing checked yet. Come back after market hours.</td></tr>`}</table></div>`;
}

/* ---------------------------------------------------------------- guide */
function renderGuide() {
  $("#guide").innerHTML = `<h2>How to use Market Compass</h2>
  <div class="card"><h3>Install it as an app</h3><ul class="list">
    <li><b>Android (Chrome):</b> tap <b>⬇ Install app</b> at the top, or menu ⋮ → <b>Install app</b> / <b>Add to Home screen</b>.</li>
    <li><b>iPhone / iPad (Safari):</b> Share button → <b>Add to Home Screen</b>.</li>
    <li><b>Windows / Mac (Chrome or Edge):</b> click the install icon in the address bar, or menu → <b>Install Market Compass</b>.</li></ul>
    <p class="muted">The installed app opens like a normal app and always loads the newest live data.</p></div>
  <div class="card" style="margin-top:10px"><h3>Daily routine</h3><table>
    <tr><td><b>8:00–9:00 AM</b></td><td>Compass tab: check auto scores, then set the ✍️ factors after reading the morning news. Read the stance and favoured sectors. Save the day.</td></tr>
    <tr><td><b>Evening before</b></td><td>Smart money: FII/DII flows, bulk/block deals, FII futures positions. Calendar: what's coming this week.</td></tr>
    <tr><td><b>9:15–9:45 AM</b></td><td>Don't trade. Let the opening settle.</td></tr>
    <tr><td><b>9:45 AM–2:30 PM</b></td><td>Stocks tab: act only when all three agree: the stance is a Buy, the stock shows <b>LEANING UP</b> with <b>trust ≥ 50%</b>, and the chart signals are mostly green.</td></tr>
    <tr><td><b>By 3:10 PM</b></td><td>Exit intraday trades and note what happened.</td></tr></table></div>
  <div class="card" style="margin-top:10px"><h3>Reading the numbers honestly</h3><ul class="list">
    <li><b>"62% chance up"</b> = in situations like now, the price rose after your horizon about 62 times in 100. The other 38 times it didn't, so a stop-loss is mandatory.</li>
    <li><b>Model trust</b> comes from testing on the newest 30% of history that the model never saw. Low trust means "NO PROVEN EDGE": don't trade on it.</li>
    <li>For intraday moves, <b>52–58% accuracy is normal even for professionals</b>. Anyone promising 80% is mistaken or selling something.</li>
    <li>The <b>Live track record</b> tab is the real report card: predictions checked against what actually happened.</li>
    <li>Nobody can predict sudden shocks (a war announcement, a policy surprise). Stop-losses are your protection.</li></ul></div>
  <div class="card" style="margin-top:10px"><h3>Data &amp; updates</h3><p>Prices: Yahoo Finance (hourly candles, ~2 years per stock). FII/DII: NSE. A GitHub Actions job rebuilds everything from real data about every 5 minutes in market hours and hourly at other times (latest prices from 1-minute data). Full handover guide:
    <a href="https://github.com/AditriKaushik/Guardian/blob/main/market-compass/HANDOVER.md" target="_blank" rel="noopener">HANDOVER.md</a>.</p>
    <p class="muted">Educational tool, not investment advice. Version ${esc(DATA.version)}.</p></div>`;
}

/* ---------------------------------------------------------------- utils, tabs, install */
function toCSV(rows) { if (!rows.length) return ""; const k = Object.keys(rows[0]); return [k.join(",")].concat(rows.map(r => k.map(x => `"${String(r[x] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n"); }
function download(name, text) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" })); a.download = name; a.click(); }

$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("button[data-tab]"); if (!b) return;
  document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll(".tab").forEach(s => s.classList.toggle("on", s.id === b.dataset.tab));
  store.set("mc_tab", b.dataset.tab);
});
const lastTab = store.get("mc_tab", "compass"); const tb = document.querySelector(`.tabs button[data-tab="${lastTab}"]`); if (tb) tb.click();

let deferred = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; $("#installBtn").hidden = false; });
$("#installBtn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("#installBtn").hidden = true; };
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

load();
setInterval(load, 60 * 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });
