/* नन्हा स्कूल — "मेरा दिन" (My Day). The child's day as pictures with picture clocks.
   Three playful ways in: "अभी क्या?" (what is it time for now?), "सही क्रम" (put the day in
   order) and "सुबह या रात?" (sort). Time is never taught as a lesson — the clock faces, the sky
   colours and the order of the day carry it. Real habits the child reports emit habit:done. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.grow = NS.grow || {};

  /* ---------- pure logic (unit-tested in tools/test/grow.test.mjs) ---------- */
  const pad = (n) => (n < 10 ? "0" : "") + n;
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function keyToUTC(k) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }
  /* whole days from key a to key b (b - a) */
  function dayDiff(a, b) { return Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000); }
  /* keep only the last `keep` days (today included); drops junk and future keys */
  function pruneDays(days, today, keep) {
    keep = keep || 14;
    const out = {};
    if (!days || typeof days !== "object") return out;
    Object.keys(days).forEach((k) => {
      const diff = dayDiff(k, today);
      if (diff >= 0 && diff < keep) out[k] = days[k];
    });
    return out;
  }
  /* index of the item whose time it is at `hour` (0–23). Before the first item of the
     morning it is still sleep time (the last item). Among items sharing the hour, the first
     one not yet done today wins. */
  function nowIndex(items, hour, doneIds) {
    doneIds = doneIds || [];
    let best = -1;
    items.forEach((it, i) => { if (it.hour <= hour && (best < 0 || it.hour >= items[best].hour)) best = i; });
    if (best < 0) return items.length - 1;
    const h = items[best].hour;
    const same = items.map((it, i) => i).filter((i) => items[i].hour === h);
    const open = same.filter((i) => doneIds.indexOf(items[i].id) < 0);
    return open.length ? open[0] : same[same.length - 1];
  }
  function hourGap(a, b) { const d = Math.abs(a - b) % 24; return Math.min(d, 24 - d); }
  /* n item indices, distinct hours, at least minGap hours apart where possible; sorted by day order */
  function pickSequence(items, n, rand, minGap) {
    rand = rand || Math.random;
    for (let gap = minGap || 1; gap >= 0; gap--) {
      for (let tries = 0; tries < 60; tries++) {
        const pool = items.map((_, i) => i);
        const chosen = [];
        while (pool.length && chosen.length < n) {
          const i = pool.splice(Math.floor(rand() * pool.length), 1)[0];
          if (chosen.every((c) => items[c].hour !== items[i].hour && Math.abs(items[c].hour - items[i].hour) >= gap)) chosen.push(i);
        }
        if (chosen.length === n) return chosen.sort((a, b) => a - b);
      }
    }
    return items.map((_, i) => i).slice(0, n);
  }
  /* placed: item indices in the order the child put them → per-position correctness */
  function checkOrder(placed) {
    const sorted = placed.slice().sort((a, b) => a - b);
    return placed.map((v, i) => v === sorted[i]);
  }
  function partOf(h) {
    if (h >= 5 && h < 12) return "morning";
    if (h >= 12 && h < 16) return "noon";
    if (h >= 16 && h < 20) return "evening";
    return "night";
  }
  function hourLabel(h) {
    const h12 = ((h + 11) % 12) + 1;
    const p = partOf(h);
    const hi = { morning: "सुबह", noon: "दोपहर", evening: "शाम", night: "रात" }[p];
    const en = { morning: "in the morning", noon: "in the afternoon", evening: "in the evening", night: "at night" }[p];
    return { hi: hi + " " + h12 + " बजे", en: h12 + " o'clock " + en, hinglish: hi.replace("सुबह", "Subah").replace("दोपहर", "Dopahar").replace("शाम", "Shaam").replace("रात", "Raat") + " " + h12 + " baje",
      h12: h12, part: p, hiPart: hi };
  }
  NS.grow.routine = { dateKey, dayDiff, pruneDays, nowIndex, pickSequence, checkOrder, hourLabel, partOf, hourGap };

  /* ---------- shared little UI kit (same in every grow module) ---------- */
  function kit(ctx, P) {
    const timers = new Set();
    let last = "";
    const T = (o) => (o == null ? "" : typeof o === "string" ? o : (ctx.t(o) || o.hi || o.en || ""));
    const cls = (c) => (c ? c.split(" ").map((x) => P + "-" + x).join(" ") : "");
    const el = (tag, c, text, style) => {
      const e = ctx.el(tag, cls(c), text == null ? "" : String(text));
      if (style) Object.assign(e.style, style);
      return e;
    };
    const tap = (c, onTap, style, label) => {
      const b = el("button", c, null, Object.assign({
        border: "none", cursor: "pointer", font: "inherit", color: "inherit", background: "#fff",
        borderRadius: "20px", padding: "10px", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "4px", touchAction: "manipulation",
        boxShadow: "0 3px 0 rgba(0,0,0,.10)", minHeight: "56px", minWidth: "0"
      }, style || {}));
      b.type = "button";
      if (label) b.setAttribute("aria-label", label);
      b.addEventListener("click", onTap);
      return b;
    };
    const btn = (label, c, onTap, style) => {
      const b = ctx.button(label, cls(c), onTap);
      Object.assign(b.style, Object.assign({
        border: "none", borderRadius: "18px", padding: "14px 18px", fontSize: "clamp(17px, 4.6vw, 22px)",
        fontWeight: "700", fontFamily: "inherit", cursor: "pointer", background: "#2EAD6B", color: "#fff",
        minHeight: "56px", touchAction: "manipulation"
      }, style || {}));
      return b;
    };
    const say = (o) => {
      const s = T(o);
      last = s;
      try { ctx.stopVoice(); } catch (e) { /* ignore */ }
      return Promise.resolve().then(() => ctx.say(s)).catch(() => {});
    };
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const pop = (e, big) => {
      if (reduced || !e.animate) return;
      e.animate([{ transform: "scale(1)" }, { transform: "scale(" + (big ? 1.25 : 1.12) + ")" }, { transform: "scale(1)" }], { duration: 450, easing: "ease-out" });
    };
    const wiggle = (e) => {
      if (reduced || !e.animate) return;
      e.animate([{ transform: "rotate(0)" }, { transform: "rotate(-4deg)" }, { transform: "rotate(4deg)" }, { transform: "rotate(0)" }], { duration: 350 });
    };
    const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const age = () => ((ctx.profile && ctx.profile.ageBand) || "4-5");
    /* page scaffold: a centred column; sub-screens get a small bar with back + repeat */
    const page = (title, onBack) => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      const root = ctx.screen;
      while (root.firstChild) root.removeChild(root.firstChild);
      const wrap = el("div", "wrap", null, {
        display: "flex", flexDirection: "column", gap: "12px", padding: "12px", width: "100%",
        maxWidth: "760px", margin: "0 auto", boxSizing: "border-box", flex: "1 0 auto"
      });
      if (title) {
        const bar = el("div", "bar", null, { display: "flex", alignItems: "center", gap: "8px" });
        bar.appendChild(tap("back", onBack, { width: "52px", minHeight: "52px", borderRadius: "50%", fontSize: "24px", padding: "0" }, T({ hi: "वापस", en: "Back" }))).appendChild(el("span", "", "⬅️"));
        bar.appendChild(el("div", "bartitle", title, { flex: "1", fontSize: "clamp(18px, 5vw, 24px)", fontWeight: "800", textAlign: "center", minWidth: "0" }));
        bar.appendChild(tap("again", () => say(last), { width: "52px", minHeight: "52px", borderRadius: "50%", fontSize: "24px", padding: "0" }, T({ hi: "फिर से सुनो", en: "Hear again" }))).appendChild(el("span", "", "🔊"));
        wrap.appendChild(bar);
      }
      root.appendChild(wrap);
      return wrap;
    };
    const caption = (o, style) => el("p", "say", T(o), Object.assign({
      margin: "0", textAlign: "center", fontSize: "clamp(18px, 5vw, 26px)", fontWeight: "700",
      lineHeight: "1.4", color: "#5D4037", textWrap: "balance"
    }, style || {}));
    /* stickers after the spoken praise ends, so the core's "शाबाश!" doesn't cut it off */
    const award = (r, after) => { const go = () => { if (ctx.reward) ctx.reward(r); }; if (after && after.then) after.then(go); else go(); };
    const now = () => new Date(typeof NS.now === "function" ? NS.now() : Date.now());
    const cleanup = () => { for (const id of timers) clearTimeout(id); timers.clear(); try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    return { T, el, tap, btn, say, later, pop, wiggle, shuffle, age, page, caption, cleanup, reduced, award, now };
  }

  /* ---------- the picture clock ---------- */
  const SVGNS = "http://www.w3.org/2000/svg";
  function svg(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    Object.keys(attrs).forEach((k) => e.setAttribute(k, attrs[k]));
    return e;
  }
  function clockFace(h, m, size, label) {
    const night = partOf(h) === "night";
    const s = svg("svg", { viewBox: "0 0 100 100", width: size, height: size, role: "img" });
    if (label) s.setAttribute("aria-label", label);
    s.style.display = "block";
    s.style.flexShrink = "0";
    s.appendChild(svg("circle", { cx: 50, cy: 50, r: 45, fill: night ? "#283A6B" : "#FFFFFF", stroke: night ? "#9FA8DA" : "#FF8A3D", "stroke-width": 6 }));
    for (let i = 0; i < 12; i++) {
      const a = (i * 30 * Math.PI) / 180, big = i % 3 === 0;
      s.appendChild(svg("line", {
        x1: 50 + Math.sin(a) * (big ? 31 : 34), y1: 50 - Math.cos(a) * (big ? 31 : 34),
        x2: 50 + Math.sin(a) * 39, y2: 50 - Math.cos(a) * 39,
        stroke: night ? "#E8EAF6" : "#8D6E63", "stroke-width": big ? 4 : 2, "stroke-linecap": "round"
      }));
    }
    const hand = (deg, len, w, col) => {
      const a = (deg * Math.PI) / 180;
      s.appendChild(svg("line", { x1: 50, y1: 50, x2: 50 + Math.sin(a) * len, y2: 50 - Math.cos(a) * len, stroke: col, "stroke-width": w, "stroke-linecap": "round" }));
    };
    hand(((h % 12) + m / 60) * 30, 21, 7, night ? "#FFD54F" : "#E65100");
    hand(m * 6, 30, 4, night ? "#FFFFFF" : "#455A64");
    s.appendChild(svg("circle", { cx: 50, cy: 50, r: 5, fill: night ? "#FFD54F" : "#E65100" }));
    const tiny = svg("text", { x: 50, y: 78, "text-anchor": "middle", "font-size": 13 });
    tiny.textContent = night ? "🌙" : "☀️";
    s.appendChild(tiny);
    return s;
  }
  NS.grow.clockFace = clockFace;

  const SKY = { morning: "linear-gradient(#FFF3C4, #FFE0B2)", noon: "linear-gradient(#B3E5FC, #E1F5FE)", evening: "linear-gradient(#FFCC80, #F8BBD0)", night: "linear-gradient(#1A237E, #3949AB)" };

  /* ---------- the activity ---------- */
  NS.registerActivity({
    id: "routine",
    icon: "🌞",
    title: { hi: "मेरा दिन", en: "My Day", hinglish: "Mera Din" },
    color: "#FFB300",
    section: "grow",
    free: true,
    order: 10,
    open(ctx) {
      const C = (NS.content && NS.content.routine) || { items: [], extras: [], sort: [] };
      const items = C.items;
      const k = kit(ctx, "routine");
      const { T, el, tap, btn, say, later, pop, wiggle, shuffle, age, page, caption, award } = k;
      const clockNow = k.now;
      const today = () => dateKey(clockNow());

      /* date-keyed record of what the child reported (last 14 days only) */
      function loadDays() { return pruneDays(ctx.data.get("days", {}), today(), 14); }
      function doneToday() { return loadDays()[today()] || []; }
      function report(entry) {
        const days = loadDays(), t = today();
        const list = days[t] || [];
        const first = list.indexOf(entry.id) < 0;
        if (first) list.push(entry.id);
        days[t] = list;
        ctx.data.set("days", days);
        if (first && entry.habit && NS.emit) NS.emit("habit:done", { habit: entry.habit });
        return first;
      }

      const big = (emoji, size) => el("div", "emoji", emoji, { fontSize: size || "clamp(40px, 12vw, 64px)", lineHeight: "1.1" });
      const label = (o, style) => el("div", "label", T(o), Object.assign({ fontSize: "clamp(15px, 4.2vw, 19px)", fontWeight: "700", textAlign: "center", lineHeight: "1.2" }, style || {}));

      /* ---- menu ---- */
      function menu() {
        const w = page(null);
        const part = ctx.daypart ? ctx.daypart() : partOf(clockNow().getHours());
        const hero = el("div", "hero", null, { background: SKY[part] || SKY.morning, borderRadius: "24px", padding: "14px", display: "flex", alignItems: "center", gap: "14px", justifyContent: "center" });
        const now = clockNow();
        const hl = hourLabel(now.getHours());
        hero.appendChild(clockFace(now.getHours(), now.getMinutes(), 92, T(hl)));
        hero.appendChild(el("div", "herotext", T({ hi: "मेरा दिन", en: "My Day" }), { fontSize: "clamp(26px, 8vw, 38px)", fontWeight: "800", color: part === "night" ? "#FFF" : "#E65100" }));
        w.appendChild(hero);
        const intro = { hi: "चलो, अपने दिन से खेलें! क्या खेलना है?", en: "Let's play with your day! What shall we play?" };
        w.appendChild(caption(intro));
        const grid = el("div", "menu", null, { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" });
        const opts = [
          { e: "⏰", t: { hi: "अभी क्या?", en: "What now?" }, c: "#FFE082", go: nowGame },
          { e: "🌈", t: { hi: "मेरा पूरा दिन", en: "My whole day" }, c: "#C5E1A5", go: strip },
          { e: "🔢", t: { hi: "सही क्रम", en: "Day in order" }, c: "#B3E5FC", go: sequence },
          { e: "☀️🌙", t: { hi: "सुबह या रात?", en: "Day or night?" }, c: "#D1C4E9", go: sortGame }
        ];
        opts.forEach((o) => {
          const b = tap("tile", () => { say(o.t); o.go(); }, { background: o.c, minHeight: "130px", borderRadius: "24px" }, T(o.t));
          b.appendChild(big(o.e, "clamp(44px, 13vw, 60px)"));
          b.appendChild(label(o.t, { fontSize: "clamp(17px, 4.8vw, 21px)" }));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      /* ---- (a) अभी क्या करने का समय है? ---- */
      function nowGame() {
        const w = page(T({ hi: "⏰ अभी क्या?", en: "⏰ What now?" }), menu);
        const now = clockNow(), h = now.getHours();
        const hl = hourLabel(h);
        const idx = nowIndex(items, h, doneToday());
        const item = items[idx];
        const sky = el("div", "sky", null, { background: SKY[partOf(h)], borderRadius: "24px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "14px" });
        sky.appendChild(clockFace(h, now.getMinutes(), 110, T(hl)));
        const nowText = { hi: "अभी " + hl.hiPart + " के " + hl.h12 + " बजे हैं।", en: "It's about " + hl.h12 + " o'clock " + hl.en.replace(/^\d+ o'clock /, "") + "." };
        sky.appendChild(el("div", "nowtext", T(hl), { fontSize: "clamp(20px, 6vw, 28px)", fontWeight: "800", color: partOf(h) === "night" ? "#FFF" : "#4E342E" }));
        w.appendChild(sky);
        const q = { hi: "अभी क्या करने का समय है?", en: "What is it time for now?" };
        const cap = caption(q);
        w.appendChild(cap);
        const nChoices = age() === "2-3" ? 2 : 3;
        const far = shuffle(items.map((_, i) => i).filter((i) => hourGap(items[i].hour, item.hour) >= 5));
        const choices = shuffle([idx].concat(far.slice(0, nChoices - 1)));
        const row = el("div", "choices", null, { display: "grid", gridTemplateColumns: "repeat(" + choices.length + ", 1fr)", gap: "10px" });
        let solved = false;
        choices.forEach((ci) => {
          const it = items[ci];
          const b = tap("choice", () => {
            if (solved) return;
            if (ci === idx) {
              solved = true;
              b.style.background = "#C8E6C9";
              b.style.outline = "4px solid #2EAD6B";
              pop(b, true);
              row.querySelectorAll("button").forEach((x) => { if (x !== b) x.style.opacity = ".35"; });
              cap.textContent = T(it.line);
              say(it.line);
              later(() => askDid(w, it), 600);
            } else {
              wiggle(b);
              b.style.opacity = ".45";
              const msg = { hi: "“" + it.title.hi + "” तो " + hourLabel(it.hour).hi + " होता है। घड़ी देखो, फिर से सोचो!", en: "“" + it.title.en + "” is at " + hourLabel(it.hour).en + ". Look at the clock and think again!" };
              cap.textContent = T(msg);
              say(msg);
            }
          }, { minHeight: "120px" }, T(it.title));
          b.appendChild(big(it.emoji));
          b.appendChild(label(it.title));
          row.appendChild(b);
        });
        w.appendChild(row);
        say(T(nowText) + " " + T(q));
      }

      function askDid(w, it) {
        const box = el("div", "did", null, { display: "flex", flexDirection: "column", gap: "10px", background: "#FFF", borderRadius: "22px", padding: "12px" });
        const already = doneToday().indexOf(it.id) >= 0;
        const qText = already ? { hi: "तुमने यह आज कर लिया है! ⭐", en: "You already did this today! ⭐" } : it.did;
        const qp = caption(qText, { fontSize: "clamp(17px, 4.8vw, 22px)" });
        box.appendChild(qp);
        const r = el("div", "didrow", null, { display: "flex", gap: "10px", flexWrap: "wrap" });
        const yes = btn("✅ " + T({ hi: "हाँ, किया!", en: "Yes, I did!" }), "yes", () => {
          report(it);
          r.remove();
          qp.textContent = "⭐ " + T(it.yay);
          pop(qp, true);
          const sp = say(it.yay);
          if (it.id === "sleep") award({ sticker: "🌙", reason: T({ hi: "सोने की तैयारी!", en: "Ready for bed!" }) }, sp);
          later(() => afterDone(w, it), 900);
        }, { flex: "1 1 140px" });
        const notYet = btn("🙂 " + T({ hi: "अभी करेंगे", en: "Going to do it" }), "later", () => {
          r.remove();
          const m = { hi: "ठीक है! करके आओ, फिर मुझे बताना।", en: "Okay! Go do it, then come and tell me." };
          qp.textContent = T(m);
          say(m);
          later(() => afterDone(w, it), 900);
        }, { flex: "1 1 140px", background: "#FFA726" });
        if (already) {
          r.appendChild(btn("👍 " + T({ hi: "आगे", en: "Next" }), "next", () => { r.remove(); afterDone(w, it); }, { flex: "1" }));
        } else {
          r.appendChild(yes);
          r.appendChild(notYet);
        }
        box.appendChild(r);
        w.appendChild(box);
        box.scrollIntoView && box.scrollIntoView({ behavior: k.reduced ? "auto" : "smooth", block: "nearest" });
        later(() => say(qText), 1800);
      }

      function afterDone(w, it) {
        if (w.querySelector(".routine-after")) return;
        const box = el("div", "after", null, { display: "flex", flexDirection: "column", gap: "10px" });
        const i = items.indexOf(it), next = items[(i + 1) % items.length];
        const nl = hourLabel(next.hour);
        const nb = el("div", "next", null, { display: "flex", alignItems: "center", gap: "12px", background: "#FFF8E1", borderRadius: "20px", padding: "10px 12px" });
        nb.appendChild(clockFace(next.hour, 0, 64, T(nl)));
        nb.appendChild(big(next.emoji, "clamp(36px, 10vw, 48px)"));
        nb.appendChild(label({ hi: "इसके बाद: " + next.title.hi + " — " + nl.hi, en: "Next: " + next.title.en + " — " + nl.en }, { textAlign: "left", flex: "1" }));
        box.appendChild(nb);
        box.appendChild(label({ hi: "और क्या किया?", en: "What else did you do?" }, { marginTop: "4px" }));
        const ex = el("div", "extras", null, { display: "grid", gridTemplateColumns: "repeat(" + C.extras.length + ", 1fr)", gap: "10px" });
        C.extras.forEach((x) => {
          const done = doneToday().indexOf(x.id) >= 0;
          const b = tap("extra", () => {
            const first = report(x);
            b.style.background = "#C8E6C9";
            pop(b, true);
            say(first ? x.yay : { hi: "हाँ, तुमने आज यह किया है! ⭐", en: "Yes, you did this today! ⭐" });
          }, { background: done ? "#C8E6C9" : "#fff", minHeight: "96px" }, T(x.title));
          b.appendChild(big(x.emoji, "clamp(34px, 10vw, 46px)"));
          b.appendChild(label(x.title));
          ex.appendChild(b);
        });
        box.appendChild(ex);
        w.appendChild(box);
        box.scrollIntoView && box.scrollIntoView({ behavior: k.reduced ? "auto" : "smooth", block: "nearest" });
      }

      /* ---- the whole day as a picture strip ---- */
      function strip() {
        const w = page(T({ hi: "🌈 मेरा पूरा दिन", en: "🌈 My whole day" }), menu);
        const intro = { hi: "यह है तुम्हारा पूरा दिन — सुबह से रात तक। किसी भी तस्वीर को छूकर सुनो!", en: "Here is your whole day — from morning to night. Touch any picture to hear it!" };
        w.appendChild(caption(intro));
        const done = doneToday();
        const now = nowIndex(items, clockNow().getHours(), done);
        const grid = el("div", "strip", null, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 150px), 1fr))", gap: "10px" });
        items.forEach((it, i) => {
          const hl = hourLabel(it.hour);
          const b = tap("step", () => { pop(b); say(it.line); }, {
            background: SKY[hl.part], color: hl.part === "night" ? "#FFF" : "#3E2723", position: "relative",
            outline: i === now ? "4px solid #FF6F00" : "none", minHeight: "150px", padding: "10px 6px"
          }, T(it.title) + ", " + T(hl));
          const top = el("div", "steptop", null, { display: "flex", alignItems: "center", gap: "6px", justifyContent: "center" });
          top.appendChild(big(it.emoji, "clamp(34px, 9vw, 44px)"));
          top.appendChild(clockFace(it.hour, 0, 52, T(hl)));
          b.appendChild(top);
          b.appendChild(label(it.title));
          b.appendChild(el("div", "time", T(hl), { fontSize: "14px", fontWeight: "600", opacity: ".9" }));
          if (done.indexOf(it.id) >= 0) b.appendChild(el("div", "star", "⭐", { position: "absolute", top: "4px", right: "6px", fontSize: "22px" }));
          if (i === now) b.appendChild(el("div", "nowtag", T({ hi: "अभी", en: "Now" }), { position: "absolute", top: "4px", left: "6px", background: "#FF6F00", color: "#fff", borderRadius: "10px", padding: "0 8px", fontSize: "13px", fontWeight: "800" }));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      /* ---- (b) put the day in order ---- */
      let seqWins = 0;
      function sequence() {
        const w = page(T({ hi: "🔢 सही क्रम", en: "🔢 Day in order" }), menu);
        const band = age();
        const n = band === "2-3" ? 3 : 4;
        const gap = band === "2-3" ? 4 : band === "4-5" ? 3 : 1;
        const pick = pickSequence(items, n, Math.random, gap);
        let pool = shuffle(pick);
        if (pool.every((v, i) => v === pick[i])) pool = pool.slice(1).concat(pool[0]);
        const slots = new Array(n).fill(null);
        const locked = new Array(n).fill(false);
        const intro = { hi: "दिन में पहले क्या होता है? तस्वीरों को सुबह से रात के क्रम में लगाओ।", en: "What happens first in the day? Put the pictures in order, from morning to night." };
        const cap = caption(intro);
        w.appendChild(cap);
        const lane = el("div", "lane", null, { display: "flex", alignItems: "stretch", gap: "6px" });
        const sunMoon = (e) => el("div", "end", e, { fontSize: "clamp(24px, 7vw, 34px)", alignSelf: "center" });
        const slotRow = el("div", "slots", null, { display: "grid", gridTemplateColumns: "repeat(" + n + ", 1fr)", gap: "6px", flex: "1" });
        lane.appendChild(sunMoon("🌅"));
        lane.appendChild(slotRow);
        lane.appendChild(sunMoon("🌙"));
        w.appendChild(lane);
        const poolRow = el("div", "pool", null, { display: "grid", gridTemplateColumns: "repeat(" + n + ", 1fr)", gap: "8px", minHeight: "110px" });
        w.appendChild(poolRow);
        const bottom = el("div", "seqbottom", null, { display: "flex", justifyContent: "center" });
        w.appendChild(bottom);

        function draw() {
          while (slotRow.firstChild) slotRow.removeChild(slotRow.firstChild);
          while (poolRow.firstChild) poolRow.removeChild(poolRow.firstChild);
          slots.forEach((v, i) => {
            const s = tap("slot", () => {
              if (v == null || locked[i]) return;
              slots[i] = null; pool.push(v); draw();
            }, { background: v == null ? "rgba(255,255,255,.55)" : "#fff", border: locked[i] ? "3px solid #2EAD6B" : "3px dashed #BCAAA4", minHeight: "112px", padding: "6px 2px", boxShadow: "none" },
            v == null ? T({ hi: "खाली जगह " + (i + 1), en: "Empty place " + (i + 1) }) : T(items[v].title));
            s.appendChild(el("div", "num", String(i + 1), { fontSize: "14px", fontWeight: "800", color: "#8D6E63" }));
            if (v != null) {
              s.appendChild(big(items[v].emoji, "clamp(30px, 9vw, 46px)"));
              s.appendChild(label(items[v].title, { fontSize: "clamp(12px, 3.4vw, 16px)" }));
            }
            slotRow.appendChild(s);
          });
          poolRow.style.display = pool.length ? "grid" : "none";
          pool.forEach((v) => {
            const b = tap("card", () => {
              const free = slots.indexOf(null);
              if (free < 0) return;
              slots[free] = v; pool = pool.filter((x) => x !== v);
              say(items[v].title);
              draw();
              if (slots.indexOf(null) < 0) later(check, 500);
            }, { minHeight: "106px", background: "#FFFDE7" }, T(items[v].title));
            b.appendChild(big(items[v].emoji, "clamp(32px, 10vw, 48px)"));
            b.appendChild(label(items[v].title, { fontSize: "clamp(12px, 3.6vw, 17px)" }));
            poolRow.appendChild(b);
          });
        }
        function check() {
          const ok = checkOrder(slots);
          if (ok.every(Boolean)) {
            seqWins++;
            slots.forEach((_, i) => { locked[i] = true; });
            draw();
            slotRow.querySelectorAll("button").forEach((b, i) => {
              const it = items[slots[i]];
              b.appendChild(clockFace(it.hour, 0, 40, T(hourLabel(it.hour))));
              pop(b, true);
            });
            const names = slots.map((v) => items[v].title);
            const msg = {
              hi: "सही! पहले " + names.map((t) => t.hi).join(", फिर ") + "। घड़ी भी यही कहती है!",
              en: "Right! First " + names.map((t) => t.en).join(", then ") + ". The clocks agree!"
            };
            cap.textContent = T(msg);
            const sp = say(msg);
            if (seqWins === 3) award({ sticker: "⏰", reason: T({ hi: "दिन का क्रम समझ लिया!", en: "You know the order of the day!" }) }, sp);
            while (bottom.firstChild) bottom.removeChild(bottom.firstChild);
            bottom.appendChild(btn("🔁 " + T({ hi: "एक और", en: "One more" }), "more", sequence));
          } else {
            ok.forEach((good, i) => { if (good) locked[i] = true; else { pool.push(slots[i]); slots[i] = null; } });
            draw();
            const msg = { hi: "लगभग! जो सही हैं, वे रुक गए। बाकी फिर से लगाओ — सोचो, पहले क्या होता है?", en: "Almost! The right ones stayed. Try the others again — what comes first?" };
            cap.textContent = T(msg);
            say(msg);
          }
        }
        draw();
        say(intro);
      }

      /* ---- (c) सुबह या रात? ---- */
      let sortWins = 0;
      function sortGame() {
        const w = page(T({ hi: "☀️🌙 सुबह या रात?", en: "☀️🌙 Day or night?" }), menu);
        const rounds = shuffle(C.sort).slice(0, age() === "2-3" ? 4 : 6);
        let r = 0;
        const intro = { hi: "यह सुबह होता है या रात को? सही टोकरी छुओ!", en: "Does this happen in the morning or at night? Touch the right basket!" };
        const cap = caption(intro);
        w.appendChild(cap);
        const card = el("div", "sortcard", null, { background: "#fff", borderRadius: "26px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", minHeight: "160px", justifyContent: "center" });
        w.appendChild(card);
        const baskets = el("div", "baskets", null, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" });
        const got = { morning: null, night: null };
        let busy = false;
        const mk = (part, emoji, t, bg, fg) => {
          const b = tap("basket", () => choose(part, b), { background: bg, color: fg, minHeight: "150px", borderRadius: "26px" }, T(t));
          b.appendChild(big(emoji, "clamp(40px, 12vw, 56px)"));
          b.appendChild(label(t, { fontSize: "clamp(19px, 5.4vw, 24px)" }));
          got[part] = el("div", "got", "", { fontSize: "20px", minHeight: "26px", letterSpacing: "2px", wordBreak: "break-all" });
          b.appendChild(got[part]);
          return b;
        };
        baskets.appendChild(mk("morning", "☀️", { hi: "सुबह", en: "Morning" }, "linear-gradient(#FFF59D, #FFCC80)", "#5D4037"));
        baskets.appendChild(mk("night", "🌙", { hi: "रात", en: "Night" }, "linear-gradient(#303F9F, #1A237E)", "#FFFFFF"));
        w.appendChild(baskets);
        function show() {
          while (card.firstChild) card.removeChild(card.firstChild);
          const it = rounds[r];
          card.appendChild(big(it.emoji, "clamp(64px, 20vw, 96px)"));
          card.appendChild(label(it.title, { fontSize: "clamp(20px, 5.6vw, 26px)" }));
          pop(card);
        }
        function choose(part, b) {
          if (busy || r >= rounds.length) return;
          const it = rounds[r];
          if (part === it.part) {
            busy = true;
            got[part].textContent += it.emoji;
            pop(b, true);
            cap.textContent = T(it.why);
            say(it.why);
            later(() => {
              busy = false; r++;
              if (r < rounds.length) { show(); cap.textContent = T(intro); return; }
              sortWins++;
              while (card.firstChild) card.removeChild(card.firstChild);
              card.appendChild(big("🌅🌙", "clamp(52px, 16vw, 80px)"));
              const done = { hi: "वाह! सब अपनी सही टोकरी में पहुँच गए। तुम्हें दिन और रात की पूरी पहचान है!", en: "Wow! Everything is in the right basket. You really know day and night!" };
              cap.textContent = T(done);
              const sp = say(done);
              if (sortWins === 1) award({ sticker: "🌞", reason: T({ hi: "सुबह और रात की पहचान!", en: "You know morning and night!" }) }, sp);
              card.appendChild(btn("🔁 " + T({ hi: "फिर से खेलें", en: "Play again" }), "again", sortGame));
            }, 1700);
          } else {
            wiggle(b);
            const m = { hi: "ऊँहूँ… " + it.why.hi + " फिर से छुओ!", en: "Hmm… " + it.why.en + " Try again!" };
            cap.textContent = T(m);
            say(m);
          }
        }
        show();
        say(intro);
      }

      menu();
      return k.cleanup;
    }
  });
})();
