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

function renderAll() { renderCompass(); renderPicks(); renderNews(); renderHistory(); renderStocks(); renderMoney(); renderCalendar(); renderTrack(); renderGuide(); }

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
    ${globalPanel()}
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



const GLOBAL_TILES = ["silver", "copper", "aluminium", "wti", "natgas", "btc", "eth", "usvix", "nasdaq"];
function globalPanel() {
  const G = DATA.global, m = DATA.macro;
  if (!G || G.error) return G && G.error ? `<div class="note warnbox">${esc(G.error)}</div>` : "";
  const tiles = GLOBAL_TILES.map(k => { const r = m[k]; if (!r || !r.ok) return "";
    return `<div class="card tile"><div class="lbl">${esc(r.label)}</div><div class="val">${fmt(r.last, r.last > 1000 ? 0 : 2)}</div>
      <div class="chg"><span class="${cls(r.chg1)}">${pct(r.chg1)} today</span> · <span class="${cls(r.chg5)}">${pct(r.chg5)} 5-day</span></div><div class="chg muted">price at ${esc(timeOf(r.asof))}</div></div>`; }).join("");
  const g = G.gap_forecast, mt = G.metals;
  const badge = v => v.startsWith("USE") ? `<span class="pill" style="background:#1a7f37;color:#fff">✅ ${esc(v)}</span>` : v === "WEAK" ? `<span class="pill" style="background:#9a6700;color:#fff">⚠️ weak</span>` : `<span class="pill" style="background:#cf222e;color:#fff">❌ no link</span>`;
  const rows = G.effects.map(e => `<tr><td><b>${esc(e.driver)}</b>${e.chg1 == null ? "" : ` <span class="${cls(e.chg1)}">${pct(e.chg1)}</span>`}</td><td>${esc(e.effect)}<div class="muted">${esc(e.note)}</div></td><td>${badge(e.verdict)}</td></tr>`).join("");
  return `<h2>🌍 Metals, energy &amp; crypto</h2><div class="grid">${tiles}</div>
    <div class="grid2" style="margin-top:10px">
      <div class="card"><h3>🔮 How Nifty should open today</h3>
        <div class="val ${cls(g.pred)}" style="font-size:26px;font-weight:800">${pct(g.pred)}</div>
        <p class="muted">From overnight S&amp;P 500 (${pct(g.parts.spx)}), US dollar (${pct(g.parts.dxy)}), Bitcoin (${pct(g.parts.btc)})${g.hsi_included ? ` and Hang Seng's open (${pct(g.parts.hsi_gap)})` : " (Hang Seng's open is added after 7 AM IST)"}.</p>
        ${g.actual != null ? `<p><b>Actual opening today: <span class="${cls(g.actual)}">${pct(g.actual)}</span></b> ${Math.sign(g.actual) === Math.sign(g.pred) ? "✅ direction matched" : "❌ direction missed"}</p>` : ""}
        <p class="muted">${esc(g.accuracy_note)}</p></div>
      <div class="card"><h3>⛏️ Metal stocks tilt today: ${mt.tilt === "positive" ? '<span class="pos">positive</span>' : mt.tilt === "negative" ? '<span class="neg">negative</span>' : "neutral"}</h3>
        <p>Overnight copper ${mt.copper_z == null ? "n/a" : (mt.copper_z >= 0 ? "+" : "") + mt.copper_z.toFixed(1) + "σ"}, aluminium ${mt.aluminium_z == null ? "n/a" : (mt.aluminium_z >= 0 ? "+" : "") + mt.aluminium_z.toFixed(1) + "σ"}${mt.hsi_gap == null ? "" : ", Hang Seng open " + pct(mt.hsi_gap)}.</p>
        <p class="muted">${esc(mt.note)} Applies to Hindalco, NALCO, Vedanta, Tata Steel, JSW Steel, Nifty Metal.</p></div>
    </div>
    <div class="card tablewrap" style="margin-top:10px"><h3>Cause → effect, tested on 10 years of real data</h3>
      <p class="muted">Each link was checked on 2021–2026 data that was not used to find it. ✅ = held up, ⚠️ = small or unstable, ❌ = no reliable link (shown so you don't rely on it).</p>
      <table><tr><th>Driver (today)</th><th>Effect on Indian stocks</th><th>Verdict</th></tr>${rows}</table></div>`;
}


/* ---------------------------------------------------------------- overnight news */
function renderNews() {
  const el = $("#news"), N = DATA.news;
  if (!N || N.error) { el.innerHTML = `<h2>📰 Overnight news</h2><div class="note warnbox">${esc(N ? N.error : "Not available yet.")}</div>`; return; }
  const tone = t => t > 0 ? "🟢" : t < 0 ? "🔴" : "⚪";
  const timeShort = t => esc(String(t).slice(5, 16).replace("T", " "));
  const moodColor = N.mood === "positive" ? "#1a7f37" : N.mood === "negative" ? "#cf222e" : "#9a6700";
  const topicCard = t => `<div class="card"><div class="factor head"><span class="name">${esc(t.label)}</span>
      <span class="pill" style="background:${t.direction === "positive" ? "#1a7f37" : t.direction === "negative" ? "#cf222e" : "#9a6700"};color:#fff">${t.direction} · ${t.n} stories</span></div>
      ${t.sectors.filter(x => x.effect).length ? `<p class="muted">Sectors: ${t.sectors.filter(x => x.effect).map(x => `<span class="${x.effect > 0 ? "pos" : "neg"}">${esc(x.sector)} ${x.effect > 0 ? "▲" : "▼"}</span>`).join(", ")}</p>` : ""}
      <ul class="list">${t.headlines.map(h => `<li>${tone(h.tone)} <a href="${esc(h.link)}" target="_blank" rel="noopener">${esc(h.title)}</a> <span class="muted">${esc(h.source)} · ${timeShort(h.time)}</span></li>`).join("")}</ul></div>`;
  const stocks = Object.entries(N.stocks || {}).sort((a, b) => a[1].tone - b[1].tone).slice(0, 30);
  const lc = N.live_check || {};
  const feedsOk = (N.feeds || []).filter(f => f.ok).length;
  el.innerHTML = `<h2>📰 What happened since the last close</h2>
    <div class="stance" style="background:${moodColor}"><div class="sm">News from ${esc(N.since)} to ${esc(N.until)} IST · ${N.n_headlines} headlines · ${N.n_filings} NSE filings (Nifty 50 / Next 50 / Midcap 50)</div>
      <div class="big">Overnight mood: ${N.mood.toUpperCase()}</div><div>Net tone ${N.score > 0 ? "+" : ""}${N.score} (−1 = all bad, +1 = all good for Indian stocks)</div></div>
    <div class="note warnbox"><b>How to use it:</b> research and our own tests agree that overnight news is mostly priced in at the 9:15 AM open, so use it to understand the opening gap (see 🔮 on the Compass tab), not to chase the open.
      The useful part is <b>company-specific news and filings</b>: a negative item (auditor resignation, default, downgrade, pledge, raid, FDA warning…) automatically blocks that stock from ⭐ Daily picks.</div>
    <div class="card"><h3>🎯 Live check: does the morning news mood call the day?</h3>
      <p>${lc.days >= 5 ? `Over ${lc.days} days, a positive or negative pre-open mood matched the direction of Nifty's <b>opening gap ${(lc.gap_hit * 100).toFixed(0)}%</b> of the time, and the <b>rest of the day ${(lc.day_hit * 100).toFixed(0)}%</b> (50% = coin flip).` : `Collecting data: ${lc.days || 0} of 5 days logged. The pre-open mood is saved every morning and compared with Nifty's real opening and close.`}</p></div>
    <h2>Topics moving markets</h2>
    ${(N.topics || []).length ? `<div class="grid2">${N.topics.map(topicCard).join("")}</div>` : `<div class="card"><p class="muted">No market headlines collected this refresh (${feedsOk} of ${(N.feeds || []).length} news feeds answered).</p></div>`}
    <h2>Stocks in the news (headlines + NSE filings)</h2>
    <div class="card tablewrap"><table><tr><th>Stock</th><th>Tone</th><th>Latest items</th></tr>${stocks.map(([s, v]) => `<tr><td><b>${esc(s)}</b>${v.negative ? ' <span class="pill" style="background:#cf222e;color:#fff">blocks picks</span>' : ""}</td><td>${tone(v.tone)}</td><td>${v.items.slice(0, 3).map(x => `<div>${tone(x.tone)} <a href="${esc(x.link)}" target="_blank" rel="noopener">${esc(x.title.slice(0, 140))}</a> <span class="muted">${timeShort(x.time)}</span></div>`).join("")}</td></tr>`).join("") || `<tr><td colspan=3 class="muted">No company news since the last close.</td></tr>`}</table></div>
    <h3>All latest headlines</h3>
    <div class="card"><ul class="list">${(N.latest || []).map(h => `<li>${tone(h.tone)} <a href="${esc(h.link)}" target="_blank" rel="noopener">${esc(h.title)}</a> <span class="muted">${esc(h.source)} · ${timeShort(h.time)}${h.topics.length ? " · " + h.topics.join(", ") : ""}</span></li>`).join("") || "<li class='muted'>None this refresh.</li>"}</ul>
      <p class="muted">Sources: Google News, Economic Times, Moneycontrol, Livemint, BBC, CNBC, NSE announcements (${feedsOk}/${(N.feeds || []).length} feeds answered on this refresh). Tone is a simple finance-phrase reading of each headline (e.g. "crude jumps" = bad for India, "rate cut" = good), so it can be wrong. Open the story before acting.</p></div>`;
}


/* ---------------------------------------------------------------- history lab */
function renderHistory() {
  const el = $("#history"), H = DATA.history;
  if (!H || H.error) { el.innerHTML = `<h2>📜 History lab</h2><div class="note warnbox">${esc(H ? H.error : "Not available yet.")}</div>`; return; }
  const D = H.descr, show = (k, v) => v == null ? "n/a" : D[k].kind === "pct" ? pct(v, 1) : D[k].kind === "logpct" ? pct(Math.exp(v) - 1, 0) : fmt(v, 2);
  const keys = ["n_dd", "n_r20", "ivix", "inr_r20", "gold_r20", "brent_r20", "dxy_r20", "us10y", "curve", "spx_r20", "usvix"];
  const out = v => v == null ? `<span class="muted">not yet</span>` : `<span class="${cls(v)}">${pct(v, 1)}</span>`;
  const S = H.analog_summary, T = H.analog_test, R = H.risk;
  const sumRow = h => { const x = S[h]; return `<tr><td>${h} trading days</td><td class="num">${(x.up * 100).toFixed(0)}% <span class="muted">(normal ${(x.base_up * 100).toFixed(0)}%)</span></td><td class="num ${cls(x.median)}">${pct(x.median, 1)} <span class="muted">(normal ${pct(x.base_median, 1)})</span></td><td class="num">${pct(x.p10, 1)} … ${pct(x.p90, 1)}</td></tr>`; };
  const verdictPill = v => v.startsWith("consistently better") ? `<span class="pill" style="background:#1a7f37;color:#fff">✅ ${esc(v)}</span>` : v.startsWith("consistently worse") ? `<span class="pill" style="background:#cf222e;color:#fff">⚠️ ${esc(v)}</span>` : `<span class="pill">${esc(v)}</span>`;
  const evStat = (st, part) => st[part].n ? `${st[part].n} cases: up ${(st[part].up * 100).toFixed(0)}%, median ${pct(st[part].median, 1)}` : "no cases";
  const evRow = e => `<details class="card" style="margin-top:8px" ${e.active ? "open" : ""}><summary><b>${e.active ? "🔔 ACTIVE NOW · " : ""}${esc(e.name)}</b> <span class="muted">(${e.n_episodes} times since 2008)</span> ${verdictPill(e.stats["20"].verdict)}</summary>
      <table><tr><th>After</th><th>2008–2016</th><th>2016–now</th><th>Verdict</th></tr>${["20", "60"].map(h => `<tr><td>${h} days</td><td>${evStat(e.stats[h], "old")} <span class="muted">(normal ${(e.stats[h].base_old * 100).toFixed(0)}%)</span></td><td>${evStat(e.stats[h], "new")} <span class="muted">(normal ${(e.stats[h].base_new * 100).toFixed(0)}%)</span></td><td>${esc(e.stats[h].verdict)}</td></tr>`).join("")}</table>
      <p class="muted">Latest episodes (Nifty after 20 / 60 days): ${e.episodes.slice().reverse().map(x => `${esc(x.date)}: ${out(x.after20)} / ${out(x.after60)}`).join(" · ") || "none"}</p></details>`;
  const active = H.events.filter(e => e.active), rest = H.events.filter(e => !e.active);
  el.innerHTML = `<h2>📜 History lab: when the world looked like today, what happened next?</h2>
    <div class="note">Compares today with every trading day since ${esc(H.first_date)}. It uses the Nifty trend and fall from its high, India VIX, rupee, gold, crude, copper, dollar index, US interest rates and yield curve, S&amp;P 500 and US VIX. A US close is used only from the next Indian day.</div>
    <h3>Today's situation (${esc(H.as_of)})</h3>
    <div class="card tablewrap"><table><tr>${keys.map(k => `<th>${esc(D[k].label)}</th>`).join("")}</tr><tr>${keys.map(k => `<td class="num">${show(k, H.today_state[k])}</td>`).join("")}</tr></table></div>
    <h3>🔁 The 10 most similar past days, and what Nifty did next</h3>
    <div class="card tablewrap"><table><tr><th>Date</th><th class="num">Similarity</th>${keys.slice(0, 6).map(k => `<th class="num">${esc(D[k].label)}</th>`).join("")}<th class="num">+5 days</th><th class="num">+20 days</th><th class="num">+60 days</th></tr>
      ${H.analogs.map(a => `<tr><td><b>${esc(a.date)}</b></td><td class="num">${(a.similarity * 100).toFixed(0)}%</td>${keys.slice(0, 6).map(k => `<td class="num">${show(k, a.state[k])}</td>`).join("")}<td class="num">${out(a.after["5"])}</td><td class="num">${out(a.after["20"])}</td><td class="num">${out(a.after["60"])}</td></tr>`).join("")}</table></div>
    <div class="card tablewrap" style="margin-top:10px"><h3>What the 25 closest past situations did next</h3>
      <table><tr><th>Horizon</th><th class="num">Nifty was higher</th><th class="num">Median move</th><th class="num">Range (10th…90th %)</th></tr>${["5", "20", "60"].map(sumRow).join("")}</table></div>
    <div class="note warnbox"><b>Honest scorecard:</b> this "similar days" forecast was tested on every week since 2013, using only the history available on each date.
      It called the 20-day direction right <b>${(T["20"].hit * 100).toFixed(0)}%</b> of the time, while simply assuming "Nifty goes up" was right <b>${(T["20"].hit_always_up * 100).toFixed(0)}%</b>. For 60 days: ${(T["60"].hit * 100).toFixed(0)}% vs ${(T["60"].hit_always_up * 100).toFixed(0)}%.
      History rhymes, but similar-looking days did <b>not</b> predict better than the market's normal upward drift. Treat this as context.</div>
    <h3>📏 Expected Nifty range for the next 20 trading days (from India VIX)</h3>
    <div class="grid"><div class="card tile"><div class="lbl">Likely range (about 2 in 3 chance)</div><div class="val">${fmt(R.lo, 0)} – ${fmt(R.hi, 0)}</div><div class="chg muted">±${pct(R.sigma20, 1).replace("+", "")} from ${fmt(H.nifty, 0)}</div></div>
      <div class="card tile"><div class="lbl">Wide range (about 19 in 20)</div><div class="val">${fmt(R.lo2, 0)} – ${fmt(R.hi2, 0)}</div><div class="chg muted">India VIX ${R.ivix}</div></div>
      <div class="card tile"><div class="lbl">How often it held</div><div class="val">${(R.hit_1sigma * 100).toFixed(0)}%</div><div class="chg muted">of ${R.n.toLocaleString()} past days stayed inside the likely range</div></div></div>
    <p class="muted">In tests India VIX predicted the next month's volatility better than similar-day matching (correlation 0.59 vs 0.44). Size your positions from this range: the wider it is, the smaller the position.</p>
    <h2>⚡ Cause → effect event history</h2>
    <p class="muted">Each event lists every past episode since 2008 and what Nifty did next, split into 2008–2016 and 2016–now. "Consistently better/worse" means both periods differed from normal by 8+ points and each had at least 5 cases. Few events pass that bar, so most are context only.</p>
    ${active.length ? `<h3>🔔 Active in the last 20 trading days</h3>${active.map(evRow).join("")}` : `<p>No tracked event is active right now.</p>`}
    <h3>All tracked events</h3>${rest.map(evRow).join("")}
    <div class="note">What the evidence supports so far: <b>India VIX above 25 (panic)</b> was followed by a higher Nifty 20 days later 82% / 75% of the time (normal 56% / 63%). <b>Crude oil crashing 20%+ in a month</b> (2008, 2014–15, 2020) was followed by a weaker Nifty: only 20% / 33% up after 20 days. ⭐ Daily picks now allow trades in high-VIX panics, because its own tests showed those dips bounced best (93% wins with India VIX above 20).</div>`;
}



function intradaySection(P) {
  const X = P.intraday;
  if (!X) return "";
  const tbl = (rows) => `<table><tr><th>Setup</th><th>Design period: win / avg</th><th>Test period: win / avg</th></tr>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td><td>${esc(r[2])}</td></tr>`).join("")}</table>`;
  return `<h2>⏱️ Intraday (same-day, MIS): BUY &amp; SELL</h2>
    <div class="note warnbox"><b>No intraday BUY or SELL setup passed the 75%+ test, so the app gives no intraday calls.</b> ${X.buy.variants + X.sell.variants} intraday variants were tested on 150 stocks (${esc(X.period)}; cost ${esc(X.cost)}).
      The only intraday "75%+" results came from a tiny target with a wide stop (e.g. +0.5% / −3%). Those win often but still <b>lose money</b> after costs. The few variants that crossed 75% in the test period had lost money in the design period, which is what chance would produce.<br>
      <b>हिंदी:</b> इंट्राडे (उसी दिन ख़रीद-बिक्री) में ख़रीद या बिक्री, किसी का भी 75%+ जीत वाला भरोसेमंद नियम नहीं मिला, इसलिए ऐप इंट्राडे सुझाव नहीं देता। छोटे टारगेट और बड़े स्टॉप से जीत ज़्यादा दिखती है, पर ख़र्च के बाद नुकसान होता है।</div>
    <div class="grid2"><div class="card tablewrap"><h3>Intraday BUY: ${X.buy.variants} variants, ${X.buy.qualified} qualified</h3>${tbl(X.buy.rows)}</div>
      <div class="card tablewrap"><h3>Intraday SELL: ${X.sell.variants} variants, ${X.sell.qualified} qualified</h3>${tbl(X.sell.rows)}</div></div>
    <div class="card" style="margin-top:10px"><h3>If you still trade intraday: the rules</h3><ul class="list">
      <li><b>Intraday short selling</b> is allowed in the cash market for <b>any</b> stock (not only F&amp;O), but it must be squared off the same day. Brokers auto square-off around 3:15–3:20 PM. A short that can't be covered goes to the exchange auction, which can cost up to 20% above the close.</li>
      <li><b>Leverage</b>: SEBI's peak-margin rules cap intraday leverage at about 5× (20% margin). Leverage multiplies losses as much as gains.</li>
      <li><b>Costs</b>: roughly 0.06% per round trip, plus slippage. In tests, these stocks on average drifted slightly <b>down</b> from open to close after costs, so blind intraday buying starts at a disadvantage.</li>
      <li>The <b>multi-day</b> SELL rule above does <b>not</b> work as a same-day trade: covered at the close, it lost money in the design period.</li>
      <li>Use ⭐ BUY picks (multi-day, delivery), the 🔴 SELL rule (multi-day, F&amp;O) and the 📈 Nifty signal. Those are the tested ones.</li></ul></div>`;
}

function indexSection(P) {
  const I = P.index;
  if (!I || I.error) return "";
  const st = I.stats && I.stats.all ? I.stats.all : null;
  return `<h2>📈 Nifty index signal</h2>
    <div class="card"><div class="factor head"><span class="name">Nifty 50: ${I.signal ? '<span class="pill" style="background:#1a7f37;color:#fff">BUY signal today</span>' : '<span class="pill">no signal today</span>'}</span>
      <span class="muted">Nifty ${fmt(I.price, 1)} · India VIX ${I.vix} vs prior 20-day high ${I.vix_20d_high} · ${I.above_200dma ? "above" : "below"} 200-day average</span></div>
      <p><b>Rule:</b> when Nifty is above its 200-day average and India VIX closes above its previous 20-day high (a fear spike in an uptrend), buy Nifty at the close (index futures, or a Nifty ETF/fund for small amounts). Sell at <b>+1%</b>, stop <b>−6%</b>, or after <b>10 days</b>.${I.signal ? ` Today: target ${fmt(I.target, 1)}, stop ${fmt(I.stop, 1)}.` : ""}</p>
      <p class="muted">Tested: chosen on 2008–2016 data, then ${I.study.oos_n} trades in ${I.study.period} won <b>${(I.study.oos_win * 100).toFixed(1)}%</b>, average +${(I.study.oos_avg * 100).toFixed(2)}% per trade.${st ? ` On the last 10 years recomputed live: ${st.n} trades, ${(st.win * 100).toFixed(0)}% wins, ${(st.avg * 100).toFixed(2)}% avg.` : ""} Wins are small (+1%) and a loss is about −2.5% on average. <b>No index SELL rule passed</b>: all short rules on Nifty and Bank Nifty lost money on 2008–2016 data.</p></div>`;
}

function sellSection(P, cap) {
  const S = P.sell;
  if (!S) return "";
  const ok = v => v === true ? "✅" : v === false ? "❌" : "⚪";
  const pc = x => x == null ? "n/a" : (x * 100).toFixed(1) + "%";
  const st = S.stats || {}, r5 = st.recent5y || {}, r12 = st.last12m || {};
  const card = p => `<div class="card" style="border-left:4px solid #cf222e"><div class="factor head"><span class="name" style="font-size:18px">🔴 SELL ${esc(p.sym)}</span><span class="pill">${esc(p.group)} · ${esc(p.industry)}</span></div>
      <div class="grid" style="margin-top:8px">
        <div class="tile"><div class="lbl">Price now</div><div class="val">₹${fmt(p.price)}</div><div class="chg ${cls(p.day_chg)}">${pct(p.day_chg)} today</div></div>
        <div class="tile"><div class="lbl">Win chance (rule, last 5 yrs)</div><div class="val">${pc(p.p_rule)}</div><div class="chg muted">experimental rule</div></div>
        <div class="tile"><div class="lbl">Cover target (−${(S.rule.target * 100).toFixed(1)}%)</div><div class="val pos">₹${fmt(p.target)}</div></div>
        <div class="tile"><div class="lbl">Stop-loss (+${(S.rule.stop * 100).toFixed(0)}%)</div><div class="val neg">₹${fmt(p.stop)}</div><div class="chg muted">exit anyway by ${esc(p.exit_by)}</div></div>
      </div>
      <p><b>Why:</b> ${p.why.map(esc).join("; ")}.</p>
      <p>${p.lot ? `<b>F&amp;O:</b> 1 lot = ${p.lot} shares ≈ ₹${fmt(p.contract_value, 0)} exposure; margin roughly ₹${fmt(p.margin_est, 0)} (~20%). If target: +₹${fmt(p.lot * (p.price - p.target), 0)} per lot; if stop: −₹${fmt(p.lot * (p.stop - p.price), 0)} per lot (more on a gap up).${p.contract_value > cap ? ` <span class="neg">One lot is larger than your capital of ₹${fmt(cap, 0)}.</span>` : ""}` : "Not in F&amp;O: you cannot short it overnight. If you hold it, consider exiting."}</p>
      <details><summary>All ${p.checks.length} SELL checks</summary><ul class="list">${p.checks.map(c => `<li>${ok(c.ok)} ${esc(c.name)}: <span class="muted">${esc(c.detail)}</span></li>`).join("")}</ul></details></div>`;
  return `<h2>🔴 SELL picks today (${S.picks.length}) <span class="pill" style="background:#9a6700;color:#fff">experimental</span></h2>
    <div class="note warnbox"><b>SELL = bearish model signal.</b> If you hold this stock, consider reducing or exiting. Short selling overnight is only possible via F&amp;O (stock futures), carries <b>unlimited loss risk</b> (a stock can gap up through any stop), and over 91% of individual F&amp;O traders lost money (SEBI FY25 study). Educational only, not investment advice.<br>
      <b>हिंदी:</b> SELL का मतलब: अगर यह शेयर आपके पास है तो बेचने/घटाने पर विचार करें। F&amp;O में शॉर्ट सेलिंग में असीमित नुकसान का जोखिम है। SEBI के अनुसार 91% से ज़्यादा व्यक्तिगत F&amp;O ट्रेडर नुकसान में रहे। यह केवल शैक्षिक जानकारी है, निवेश सलाह नहीं।</div>
    <div class="grid2"><div class="card"><h3>SELL conditions today</h3><ul class="list">${S.market.map(m => `<li>${ok(m.ok)} ${esc(m.name)}<br><span class="muted">${esc(m.detail)}</span></li>`).join("")}</ul></div>
      <div class="card"><h3>The SELL rule (gap-down continuation)</h3><ul class="list">
        <li><b>Short</b> a stock that opened <b>${(S.rule.gap * -100).toFixed(0)}%+ below</b> yesterday's close on <b>${S.rule.vol}×+</b> its 50-day volume and closed in the <b>bottom ${(S.rule.close_pos * 100).toFixed(0)}%</b> of the day's range (heavy selling into the close, often after bad results or news).</li>
        <li><b>Cover</b> at −${(S.rule.target * 100).toFixed(1)}% (profit), +${(S.rule.stop * 100).toFixed(0)}% stop-loss, or after ${S.rule.max_days} trading days. F&amp;O stocks only (${S.fo_count} today), not in F&amp;O ban, not under ASM/GSM. Max ${S.rule.max_picks} a day, one per industry.</li></ul></div></div>
    ${S.picks.length ? S.picks.map(card).join("") : `<div class="card"><p><b>No stock qualifies for SELL today.</b> The pattern is rare: about 17 times a year across 150 stocks.</p></div>`}
    ${S.blocked.length ? `<h3>SELL signal, but blocked</h3><div class="card tablewrap"><table><tr><th>Stock</th><th>Gap</th><th>Blocked by</th></tr>${S.blocked.map(b => `<tr><td><b>${esc(b.sym)}</b></td><td class="neg">${pct(b.gap, 1)}</td><td>${b.blocked_by.map(esc).join("; ")}</td></tr>`).join("")}</table></div>` : ""}
    <div class="card tablewrap" style="margin-top:10px"><h3>SELL rule: real numbers (after 0.15% costs)</h3>
      <table><tr><th></th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Avg per trade</th><th class="num">Avg win / avg loss</th></tr>
      ${[["Last 5 years", r5], ["Last 12 months", r12]].map(([n, x]) => `<tr><td>${n}</td><td class="num">${x.n ?? 0}</td><td class="num">${pc(x.win)}</td><td class="num ${cls(x.avg)}">${x.avg == null ? "n/a" : (x.avg * 100).toFixed(2) + "%"}</td><td class="num">${x.avg_win == null ? "" : "+" + (x.avg_win * 100).toFixed(1) + "% / " + (x.avg_loss * 100).toFixed(1) + "%"}</td></tr>`).join("")}</table>
      <p class="muted">Why "experimental": 675 short setups were tested on 10 years of data. Only this one kept 75%+ wins with a positive average on 2021–2026 data. It trades rarely, and the result is not statistically proven (t ≈ 1.4). The plain mirror of the BUY rule (shorting rallies in weak stocks) won 73% of the time but <b>lost money</b> (−0.38% per trade), because short losses (−7% to −14% on gaps) are much bigger than the +2% wins.</p></div>`;
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
  el.innerHTML = `<h2>⭐ Daily picks: BUY &amp; SELL suggestions that pass every condition</h2>
    <div class="note">${P.provisional ? "🟡 <b>Provisional</b> (market open): the list can change until 3:30 PM. Final picks are fixed after the close. The rule enters near the close (3:15–3:25 PM)." : "🟢 <b>Final for " + esc(P.as_of) + "</b>: based on the closing price."}
      Checked ${P.universe_n} stocks (Nifty 50 + Next 50 + Midcap 50) against 13 conditions (including overnight company news) and SEBI/NSE rules.</div>
    <div class="grid2">
      <div class="card"><h3>Market conditions today</h3><ul class="list">${P.market.map(m => `<li>${ok(m.ok)} ${esc(m.name)}<br><span class="muted">${esc(m.detail)}${m.soft ? " (caution only)" : ""}</span></li>`).join("")}</ul></div>
      <div class="card"><h3>The rule (tested on real data)</h3><ul class="list">
        <li><b>Buy</b> a strong stock (above its 200-day average, 50-day above 200-day) on a short dip: below its lower Bollinger Band or RSI(2) under 5. Only while Nifty is above its 200-day average.</li>
        <li><b>Only when the market is under mild stress</b>: Nifty lower than 5 days ago and India VIX not falling. The stock's dip must come on normal volume (no heavy news-driven selling). <span class="muted">Added after testing: win rate on unseen 2021–26 data rose from ${S.baseline ? pc(S.baseline.recent5y.win) : "79.7%"} to ${pc(S.recent5y.win)}.</span></li>
        <li><b>Sell</b> at +${(R.target * 100).toFixed(0)}% target, or −${(R.stop * 100).toFixed(0)}% stop-loss, or after ${R.max_days} trading days.</li>
        <li>Delivery (CNC) only, no leverage, no F&amp;O. Max ${R.max_picks} picks a day, max ${R.max_per_industry} per industry. Risk 1% of capital per trade.</li></ul></div>
    </div>
    <h2>🟢 BUY picks today (${P.picks.length})</h2>
    ${P.picks.length ? P.picks.map(pickCard).join("") : `<div class="card"><p><b>No stock qualifies today.</b> ${P.market_ok ? "No strong stock is in a qualifying dip right now (common when the market is rising steadily). In the last 12 months, signals appeared on about 3 of every 10 trading days." : "A market-level condition above is not met, so the rule stays out today."} Doing nothing is part of the strategy.</p></div>`}
    <div class="card" style="margin-top:12px"><label class="muted">Your capital for position sizing (₹) <input id="pickCap" type="number" min="1000" step="1000" value="${cap}" style="width:140px"></label></div>
    ${P.blocked.length ? `<h3>Signal, but blocked by a condition</h3><div class="card tablewrap"><table><tr><th>Stock</th><th>Industry</th><th>Blocked by</th></tr>${P.blocked.map(b => `<tr><td><b>${esc(b.sym)}</b></td><td class="muted">${esc(b.industry)}</td><td>${b.blocked_by.map(esc).join("; ")}</td></tr>`).join("")}</table></div>` : ""}
    ${indexSection(P)}
    ${sellSection(P, cap)}
    ${intradaySection(P)}
    <h2>How honest is "75%+"? The real numbers (BUY rule)</h2>
    <div class="grid">
      <div class="card tile"><div class="lbl">Win rate, last 5 years</div><div class="val">${pc(S.recent5y.win)}</div><div class="chg muted">${S.recent5y.n.toLocaleString()} real trades, after costs</div></div>
      <div class="card tile"><div class="lbl">Win rate, last 12 months</div><div class="val ${S.last12m.win >= R.min_win ? "" : "neg"}">${pc(S.last12m.win)}</div><div class="chg muted">${S.last12m.n} trades</div></div>
      <div class="card tile"><div class="lbl">Average win / average loss</div><div class="val"><span class="pos">+${(S.recent5y.avg_win * 100).toFixed(1)}%</span> / <span class="neg">${(S.recent5y.avg_loss * 100).toFixed(1)}%</span></div><div class="chg muted">one loss ≈ ${Math.round(-S.recent5y.avg_loss / S.recent5y.avg_win)} wins</div></div>
      <div class="card tile"><div class="lbl">Average per trade (5 yrs)</div><div class="val ${cls(S.recent5y.avg)}">${(S.recent5y.avg >= 0 ? "+" : "") + (S.recent5y.avg * 100).toFixed(2)}%</div><div class="chg muted">last 12 months: ${(S.last12m.avg * 100).toFixed(2)}%</div></div>
    </div>
    ${S.baseline ? `<div class="card tablewrap"><h3>Effect of the stress filters (same data)</h3><table><tr><th></th><th class="num">Trades (5 yrs)</th><th class="num">Win rate (5 yrs)</th><th class="num">Avg/trade (5 yrs)</th><th class="num">Win rate (12 m)</th><th class="num">Avg/trade (12 m)</th></tr>
      ${[["Without filters", S.baseline], ["With filters (used now)", S]].map(([n, x]) => `<tr><td>${n}</td><td class="num">${x.recent5y.n.toLocaleString()}</td><td class="num">${pc(x.recent5y.win)}</td><td class="num ${cls(x.recent5y.avg)}">${(x.recent5y.avg * 100).toFixed(2)}%</td><td class="num">${pc(x.last12m.win)}</td><td class="num ${cls(x.last12m.avg)}">${(x.last12m.avg * 100).toFixed(2)}%</td></tr>`).join("")}</table>
      <p class="muted">The filters halve the number of trades. Picks appear less often, but each one has historically been better.</p></div>` : ""}
    <div class="note warnbox">The rule wins often, but only small amounts: <b>+2% wins, −8% losses</b>. In some years it won 75%+ of trades and still lost money overall. Never skip the stop-loss, and never put all your money in one pick. These numbers are recomputed from real prices on every refresh.</div>
    <div class="card tablewrap"><h3>Year by year (after costs)</h3><table><tr><th>Year</th><th class="num">Trades</th><th class="num">Win rate</th><th class="num">Avg per trade</th></tr>${yrs}</table></div>
    <h3>🎯 Live record of these picks</h3>
    <div class="card"><p>${(P.track_sell || {}).n ? `<b>SELL:</b> ${P.track_sell.wins} of ${P.track_sell.n} closed SELL picks won (${(P.track_sell.wins / P.track_sell.n * 100).toFixed(0)}%), average ${(P.track_sell.avg * 100).toFixed(2)}% after costs. ` : ""}<b>BUY:</b> ${T.n ? `${T.wins} of ${T.n} closed picks won (${(T.wins / T.n * 100).toFixed(0)}%), average ${(T.avg * 100).toFixed(2)}% per pick after costs.` : "No closed picks yet. Final picks are logged after each close and checked against real prices until target, stop or 15 days."}</p></div>
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
    <div class="note warnbox"><b>Honest status:</b> next-few-hours direction is close to a coin flip. A Nov 2026 study tested 13 model and feature sets (overnight US markets, crypto, crude, metals, USD/INR, sector strength, breadth, pooled and boosted models) on 29 Nifty stocks. None beat chance on unseen data, and the live track record agrees. For decisions, use <b>⭐ Daily picks</b> (multi-day, tested) and the opening forecast on the Compass tab. Treat this page as context.</div>
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
