/* नन्हा स्कूल — "मेरा बगीचा" (My Garden). Every real habit the child reports waters a plant
   that grows over days: seed → sprout → plant → flower → fruit. Plants never wilt or die;
   a missed day just means no growth that day. A plant drinks at most twice a day, so growth
   follows days of habits, not taps.

   How habits arrive: this script listens to NS.on("habit:done") from load time, so habits
   reported in "मेरा दिन" or by the buddy count even when the garden is closed.
   - garden open        → stored straight into the garden's ctx.data;
   - garden closed      → stored through NS.activeData("garden") if the core provides it
                          (same get/set shape as ctx.data, for the active profile);
   - neither available  → kept in a small in-memory queue and applied on the next open
                          (cleared on profile:changed so one child's habits never water another's).
   New stages reached while the garden was closed are celebrated (sticker) on the next open. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.grow = NS.grow || {};

  /* ---------- plants ---------- */
  const PLANTS = {
    brush: { emoji: "🪥", leaf: "🌿", flower: "🌼", fruit: "🌻", name: { hi: "सूरजमुखी", en: "Sunflower" }, by: { hi: "ब्रश करने से", en: "when you brush" }, lastName: { hi: "बड़ा फूल", en: "big bloom" } },
    eat:   { emoji: "🍛", leaf: "🌿", flower: "🌼", fruit: "🍅", name: { hi: "टमाटर", en: "Tomato" }, by: { hi: "समय पर खाना खाने से", en: "when you eat on time" } },
    play:  { emoji: "⚽", leaf: "🌾", flower: "🌾", fruit: "🌽", name: { hi: "मक्का", en: "Corn" }, by: { hi: "खेलने से", en: "when you play" } },
    read:  { emoji: "📖", leaf: "🌳", flower: "🌸", fruit: "🥭", name: { hi: "आम", en: "Mango" }, by: { hi: "पढ़ने और कहानी सुनने से", en: "when you read or hear a story" } },
    sleep: { emoji: "😴", leaf: "🌿", flower: "🌸", fruit: "🍇", name: { hi: "अंगूर", en: "Grapes" }, by: { hi: "समय पर सोने से", en: "when you sleep on time" } },
    water: { emoji: "💧", leaf: "🌿", flower: "🌼", fruit: "🍉", name: { hi: "तरबूज़", en: "Watermelon" }, by: { hi: "पानी पीने से", en: "when you drink water" } },
    bath:  { emoji: "🛁", leaf: "🌿", flower: "🌸", fruit: "🍓", name: { hi: "स्ट्रॉबेरी", en: "Strawberry" }, by: { hi: "नहाने से", en: "when you take a bath" } },
    help:  { emoji: "🤝", leaf: "🌳", flower: "🌸", fruit: "🍎", name: { hi: "सेब", en: "Apple" }, by: { hi: "मदद करने से", en: "when you help" } }
  };
  /* gender-neutral names for the picker (the "act" past forms above are only used in English) */
  const PICK = {
    brush: { hi: "ब्रश", en: "Brushed" }, eat: { hi: "खाना", en: "Ate" }, play: { hi: "खेल", en: "Played" },
    read: { hi: "पढ़ाई", en: "Read" }, sleep: { hi: "नींद", en: "Slept" }, water: { hi: "पानी", en: "Water" },
    bath: { hi: "नहाना", en: "Bath" }, help: { hi: "मदद", en: "Helped" }
  };
  const CONFIRM = {
    brush: { hi: "क्या तुमने सच में ब्रश किया?", en: "Did you really brush your teeth?" },
    eat: { hi: "क्या तुमने समय पर खाना खाया?", en: "Did you eat your food on time?" },
    play: { hi: "क्या तुमने खेला?", en: "Did you play?" },
    read: { hi: "क्या तुमने पढ़ाई की या कहानी सुनी?", en: "Did you read or hear a story?" },
    sleep: { hi: "क्या तुमने कल रात समय पर नींद ली?", en: "Did you sleep on time last night?" },
    water: { hi: "क्या तुमने पानी पिया?", en: "Did you drink water?" },
    bath: { hi: "क्या तुमने नहा लिया?", en: "Did you have a bath?" },
    help: { hi: "क्या तुमने किसी की मदद की?", en: "Did you help someone?" }
  };
  const HABITS = Object.keys(PLANTS);
  const STAGE_AT = [0, 1, 3, 6, 10];
  const FRUIT_EVERY = 4;
  const DAILY_CAP = 2;
  const STAGE_NAME = [
    { hi: "बीज", en: "a seed" }, { hi: "नन्हा अंकुर", en: "a tiny sprout" }, { hi: "पौधा", en: "a little plant" },
    { hi: "फूलों वाला पौधा", en: "a plant with flowers" }, { hi: "फलों वाला पौधा", en: "a plant with fruit" }
  ];

  /* ---------- pure logic (unit-tested) ---------- */
  const pad = (n) => (n < 10 ? "0" : "") + n;
  const dateKey = (d) => { d = d || new Date(typeof NS.now === "function" ? NS.now() : Date.now()); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  function stageOf(w) { let s = 0; STAGE_AT.forEach((t, i) => { if (w >= t) s = i; }); return s; }
  function fruitsOf(w) { return w < STAGE_AT[4] ? 0 : 1 + Math.floor((w - STAGE_AT[4]) / FRUIT_EVERY); }
  function levelOf(w) { return stageOf(w) * 1000 + fruitsOf(w); }
  /* drops collected toward the next stage (or next fruit) */
  function progressOf(w) {
    const s = stageOf(w);
    if (s < 4) return { have: w - STAGE_AT[s], need: STAGE_AT[s + 1] - STAGE_AT[s] };
    return { have: (w - STAGE_AT[4]) % FRUIT_EVERY, need: FRUIT_EVERY };
  }
  /* returns a NEW plants object; never decreases growth */
  function applyHabit(plants, habit, day, cap) {
    cap = cap || DAILY_CAP;
    plants = plants && typeof plants === "object" ? plants : {};
    if (!PLANTS[habit]) return { plants, changed: false, capped: false, unknown: true };
    const p = Object.assign({ w: 0, d: "", n: 0, seen: 0 }, plants[habit] || {});
    const n = p.d === day ? p.n : 0;
    if (n >= cap) return { plants, changed: false, capped: true, habit, w: p.w };
    const before = p.w;
    p.w = before + 1; p.d = day; p.n = n + 1;
    const out = Object.assign({}, plants);
    out[habit] = p;
    return { plants: out, changed: true, capped: false, habit, w: p.w,
      grewStage: stageOf(p.w) > stageOf(before), newFruit: fruitsOf(p.w) > fruitsOf(before) };
  }
  /* plants whose growth the child hasn't seen celebrated yet */
  function unseen(plants) {
    return HABITS.filter((h) => plants[h] && levelOf(plants[h].w) > (plants[h].seen || 0));
  }

  /* ---------- habits arriving from anywhere ---------- */
  const pending = [];
  let openData = null;     // ctx.data while the garden is open
  let onLive = null;       // UI callback while open
  function storeFor() {
    if (openData) return openData;
    try {
      if (typeof NS.activeData === "function") return NS.activeData("garden") || null;
      /* the core's per-profile store (store.js): only when a child profile is active */
      if (NS.store && typeof NS.store.activityData === "function" && typeof NS.store.current === "function" && NS.store.current()) return NS.store.activityData("garden");
    } catch (e) { /* ignore */ }
    return null;
  }
  function record(habit, day) {
    const st = storeFor();
    if (!st) {
      pending.push({ habit, day });
      if (pending.length > 60) pending.shift();
      return null;
    }
    const res = applyHabit(st.get("plants", {}), habit, day);
    if (res.changed) st.set("plants", res.plants);
    return res;
  }
  function flush(data) {
    while (pending.length) {
      const it = pending.shift();
      const res = applyHabit(data.get("plants", {}), it.habit, it.day);
      if (res.changed) data.set("plants", res.plants);
    }
  }
  function onHabit(payload) {
    const habit = payload && payload.habit;
    if (!habit || !PLANTS[habit]) return;
    const res = record(habit, dateKey());
    if (onLive) onLive(habit, res);
  }
  if (typeof NS.on === "function") {
    NS.on("habit:done", onHabit);
    NS.on("profile:changed", () => { pending.length = 0; });
  }

  NS.grow.garden = { PLANTS, HABITS, STAGE_AT, DAILY_CAP, stageOf, fruitsOf, levelOf, progressOf, applyHabit, unseen,
    _pending: pending, _record: record, _flush: flush };

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

  const SKY = { morning: "linear-gradient(#FFF3C4, #C8E6C9)", noon: "linear-gradient(#B3E5FC, #C8E6C9)", evening: "linear-gradient(#FFCC80, #C5E1A5)", night: "linear-gradient(#1A237E, #33691E)" };

  NS.registerActivity({
    id: "garden",
    icon: "🌻",
    title: { hi: "मेरा बगीचा", en: "My Garden", hinglish: "Mera Bageecha" },
    color: "#43A047",
    section: "grow",
    free: false,
    order: 20,
    open(ctx) {
      const k = kit(ctx, "garden");
      const { T, el, tap, btn, say, later, pop, page, caption, award } = k;
      openData = ctx.data;
      flush(ctx.data);
      const plants = () => ctx.data.get("plants", {}) || {};
      const part = ctx.daypart ? ctx.daypart() : "morning";
      let cap = null;
      const plotEls = {};

      function stageVisual(h, w) {
        const p = PLANTS[h], s = stageOf(w);
        const box = el("div", "plant", null, { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", minHeight: "92px", lineHeight: "1" });
        const sz = ["30px", "42px", "54px", "50px", "50px"][s];
        if (s === 3) box.appendChild(el("div", "bloom", p.flower + p.flower, { fontSize: "28px" }));
        if (s === 4) {
          const f = Math.min(h === "brush" ? 3 : 4, fruitsOf(w));
          box.appendChild(el("div", "fruit", p.fruit.repeat(f), { fontSize: f === 1 ? "38px" : "28px", letterSpacing: "1px" }));
        }
        const base = s === 0 ? "🌰" : s === 1 ? "🌱" : p.leaf;
        box.appendChild(el("div", "base", base, { fontSize: sz }));
        return box;
      }
      function drops(w) {
        const pr = progressOf(w);
        const row = el("div", "drops", null, { display: "flex", gap: "3px", justifyContent: "center", minHeight: "16px" });
        for (let i = 0; i < pr.need; i++) row.appendChild(el("span", "drop", i < pr.have ? "💧" : "◦", { fontSize: "13px", opacity: i < pr.have ? "1" : ".55" }));
        return row;
      }
      function plotSpeech(h) {
        const p = PLANTS[h], w = (plants()[h] || { w: 0 }).w, s = stageOf(w);
        const nm = s === 4 && p.lastName ? p.lastName : STAGE_NAME[s];
        return {
          hi: p.name.hi + " " + p.by.hi + " बढ़ता है। अभी यह " + nm.hi + " है।" + (s === 4 ? " वाह!" : " रोज़ थोड़ा-थोड़ा बढ़ेगा।"),
          en: "The " + p.name.en.toLowerCase() + " grows " + p.by.en + ". Right now it is " + nm.en + "." + (s === 4 ? " Wow!" : " It grows a little every day.")
        };
      }
      function drawPlot(h) {
        const b = plotEls[h];
        while (b.firstChild) b.removeChild(b.firstChild);
        const rec = plants()[h] || { w: 0 };
        const today = rec.d === dateKey() && rec.n > 0;
        b.appendChild(stageVisual(h, rec.w));
        b.appendChild(el("div", "soil", "", { width: "70%", height: "10px", borderRadius: "50%", background: "#8D6E63", margin: "0 auto" }));
        b.appendChild(drops(rec.w));
        const tag = el("div", "tag", PLANTS[h].emoji + " " + T(PLANTS[h].name), { fontSize: "clamp(13px, 3.6vw, 16px)", fontWeight: "700" });
        b.appendChild(tag);
        if (today) b.appendChild(el("div", "todaymark", "✨", { position: "absolute", top: "6px", right: "8px", fontSize: "18px" }));
        b.setAttribute("aria-label", T(plotSpeech(h)));
      }
      function rain(h) {
        const b = plotEls[h];
        if (!b || k.reduced) return;
        const d = el("div", "raindrop", "💧", { position: "absolute", left: "50%", top: "0", fontSize: "28px", pointerEvents: "none", transform: "translateX(-50%)" });
        b.appendChild(d);
        if (d.animate) d.animate([{ transform: "translate(-50%, -10px)", opacity: 1 }, { transform: "translate(-50%, 60px)", opacity: 0 }], { duration: 900, easing: "ease-in" });
        later(() => d.remove(), 950);
      }
      function celebrate(h, quiet) {
        const all = plants();
        const rec = all[h];
        if (!rec) return null;
        const p = PLANTS[h], s = stageOf(rec.w);
        rec.seen = levelOf(rec.w);
        all[h] = rec;
        ctx.data.set("plants", all);
        const sticker = s === 4 ? p.fruit : s === 3 ? p.flower : s === 2 ? p.leaf : "🌱";
        const msg = s === 4 && fruitsOf(rec.w) > 1
          ? { hi: "देखो! " + p.name.hi + " पर एक और फल आया! " + p.fruit, en: "Look! Another fruit on the " + p.name.en.toLowerCase() + "! " + p.fruit }
          : { hi: "देखो! तुम्हारा " + p.name.hi + " अब " + (s === 4 && p.lastName ? p.lastName : STAGE_NAME[s]).hi + " बन गया!", en: "Look! Your " + p.name.en.toLowerCase() + " is now " + (s === 4 && p.lastName ? p.lastName : STAGE_NAME[s]).en + "!" };
        return { msg, reward: quiet ? null : { sticker, reason: T(msg) } };
      }

      function view() {
        const w = page(null);
        const sky = el("div", "sky", null, { background: SKY[part] || SKY.morning, borderRadius: "24px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" });
        sky.appendChild(el("div", "sun", part === "night" ? "🌙" : part === "evening" ? "🌇" : "☀️", { fontSize: "clamp(40px, 12vw, 56px)" }));
        sky.appendChild(el("div", "title", T({ hi: "मेरा बगीचा", en: "My Garden" }), { flex: "1", fontSize: "clamp(24px, 7.5vw, 34px)", fontWeight: "800", color: part === "night" ? "#FFF" : "#2E7D32" }));
        w.appendChild(sky);
        cap = caption("");
        w.appendChild(cap);
        const grid = el("div", "plots", null, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 150px), 1fr))", gap: "10px" });
        HABITS.forEach((h) => {
          const b = tap("plot", () => { pop(b); const m = plotSpeech(h); cap.textContent = T(m); say(m); }, {
            background: part === "night" ? "linear-gradient(#C5CAE9, #DCEDC8)" : "linear-gradient(#F1F8E9, #DCEDC8)", position: "relative", minHeight: "170px", justifyContent: "flex-end", overflow: "hidden"
          });
          plotEls[h] = b;
          drawPlot(h);
          grid.appendChild(b);
        });
        w.appendChild(grid);

        const pickHead = el("div", "pickhead", T({ hi: "🌟 आज मैंने…", en: "🌟 Today I…" }), { fontSize: "clamp(20px, 6vw, 26px)", fontWeight: "800", textAlign: "center", marginTop: "6px" });
        w.appendChild(pickHead);
        const picker = el("div", "picker", null, { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" });
        const confirm = el("div", "confirm", null, { display: "none", flexDirection: "column", gap: "10px", background: "#FFF", borderRadius: "22px", padding: "12px" });
        HABITS.forEach((h) => {
          const b = tap("pick", () => ask(h), { minHeight: "84px", padding: "6px 2px", background: "#FFFDE7" }, T(PICK[h]));
          b.appendChild(el("div", "pickemoji", PLANTS[h].emoji, { fontSize: "clamp(28px, 8vw, 38px)" }));
          b.appendChild(el("div", "picklabel", T(PICK[h]), { fontSize: "clamp(12px, 3.4vw, 16px)", fontWeight: "700" }));
          picker.appendChild(b);
        });
        w.appendChild(picker);
        w.appendChild(confirm);

        function ask(h) {
          while (confirm.firstChild) confirm.removeChild(confirm.firstChild);
          confirm.style.display = "flex";
          const q = CONFIRM[h];
          confirm.appendChild(el("div", "askemoji", PLANTS[h].emoji, { fontSize: "44px", textAlign: "center" }));
          confirm.appendChild(caption(q, { fontSize: "clamp(17px, 4.8vw, 22px)" }));
          const r = el("div", "askrow", null, { display: "flex", gap: "10px", flexWrap: "wrap" });
          r.appendChild(btn("✅ " + T({ hi: "हाँ!", en: "Yes!" }), "yes", () => {
            confirm.style.display = "none";
            if (typeof NS.emit === "function" && typeof NS.on === "function") NS.emit("habit:done", { habit: h });
            else onHabit({ habit: h });
          }, { flex: "1 1 120px" }));
          r.appendChild(btn("🙂 " + T({ hi: "अभी नहीं", en: "Not yet" }), "no", () => {
            confirm.style.display = "none";
            const m = { hi: "कोई बात नहीं! जब करो, तब आकर बताना — पौधा इंतज़ार करेगा।", en: "That's okay! Tell me when you do it — the plant will wait." };
            cap.textContent = T(m); say(m);
          }, { flex: "1 1 120px", background: "#FFA726" }));
          confirm.appendChild(r);
          confirm.scrollIntoView && confirm.scrollIntoView({ behavior: k.reduced ? "auto" : "smooth", block: "nearest" });
          say(q);
        }

        const intro = part === "night"
          ? { hi: "रात हो गई — पौधे भी सो रहे हैं। जो अच्छे काम तुमने आज किए, उनसे तुम्हारा बगीचा बढ़ता है!", en: "It's night — the plants are sleeping too. The good things you did today help your garden grow!" }
          : { hi: "यह तुम्हारा बगीचा है! जब तुम ब्रश करते हो, खाना खाते हो, खेलते हो या सोते हो — पौधों को पानी मिलता है।", en: "This is your garden! When you brush, eat, play or sleep on time, your plants get water." };
        cap.textContent = T(intro);

        /* growth that happened while the garden was closed */
        const fresh = unseen(plants());
        if (fresh.length) {
          const msgs = fresh.map((h, i) => { const c = celebrate(h, i > 0); drawPlot(h); pop(plotEls[h], true); return c; }).filter(Boolean);
          const first = msgs[0];
          cap.textContent = T(first.msg);
          const sp = say(T(first.msg) + (msgs.length > 1 ? " " + T({ hi: "और भी पौधे बढ़े हैं!", en: "Other plants grew too!" }) : ""));
          if (first.reward) award(first.reward, sp);
        } else {
          say(intro);
        }
      }

      onLive = (h, res) => {
        if (!plotEls[h]) return;
        rain(h);
        later(() => {
          drawPlot(h);
          pop(plotEls[h], true);
          const p = PLANTS[h];
          let m, prize = null;
          if (!res) m = { hi: "💧 पानी मिला!", en: "💧 Watered!" };
          else if (res.capped) m = { hi: p.name.hi + " ने आज भरपेट पानी पी लिया! कल यह और बढ़ेगा।", en: "The " + p.name.en.toLowerCase() + " has had plenty of water today! It will grow more tomorrow." };
          else if (res.grewStage || res.newFruit) { const c = celebrate(h); m = c.msg; prize = c.reward; }
          else m = { hi: "💧 " + p.name.hi + " को पानी मिला! देखो, बूँदें भर रही हैं।", en: "💧 The " + p.name.en.toLowerCase() + " got water! Look, the drops are filling up." };
          cap.textContent = T(m);
          const sp = say(m);
          if (prize) award(prize, sp);
          plotEls[h].scrollIntoView && plotEls[h].scrollIntoView({ behavior: k.reduced ? "auto" : "smooth", block: "nearest" });
        }, k.reduced ? 0 : 700);
      };

      view();
      return () => { onLive = null; openData = null; k.cleanup(); };
    }
  });
})();
