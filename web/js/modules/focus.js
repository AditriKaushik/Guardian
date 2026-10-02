/* नन्हा स्कूल — "ध्यान" (Focus & calm). Four gentle games: memory pairs, odd one out,
   "जो मैं कहूँ वही दबाओ" (listen and tap) and "गुब्बारा साँस" (balloon breathing).
   No timers on screen, no scores, no losing: praise is for looking and listening carefully. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.grow = NS.grow || {};

  /* ---------- pure logic (unit-tested) ---------- */
  function memoryCount(ageBand, round) {
    if (ageBand === "2-3") return 4;
    if (ageBand === "6+") return 12;
    return round > 0 ? 8 : 6;
  }
  function shuffleWith(a, rand) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /* count cards (even) → each symbol exactly twice, shuffled */
  function makeDeck(symbols, count, rand) {
    rand = rand || Math.random;
    const pairs = Math.floor(count / 2);
    const faces = shuffleWith(symbols, rand).slice(0, pairs);
    const deck = [];
    faces.forEach((sym) => { deck.push({ sym }); deck.push({ sym }); });
    return shuffleWith(deck, rand).map((c, i) => ({ id: i, sym: c.sym }));
  }
  function isPair(deck, i, j) { return i !== j && !!deck[i] && !!deck[j] && deck[i].sym === deck[j].sym; }
  function oddLevels(ageBand) { return ageBand === "2-3" ? [1] : ageBand === "6+" ? [2, 3] : [1, 2]; }
  /* one odd-one-out round: `size` cards, exactly one is the odd one */
  function oddRound(set, size, rand) {
    rand = rand || Math.random;
    const same = [];
    for (let i = 0; same.length < size - 1; i++) same.push(set.same[i % set.same.length]);
    const pos = Math.floor(rand() * size);
    const cards = same.slice();
    cards.splice(pos, 0, set.odd);
    return { cards, oddIndex: pos };
  }
  function breathCount(ageBand) { return ageBand === "2-3" ? 3 : ageBand === "6+" ? 5 : 4; }
  NS.grow.focus = { memoryCount, makeDeck, isPair, oddLevels, oddRound, breathCount };

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

  NS.registerActivity({
    id: "focus",
    icon: "🎈",
    title: { hi: "ध्यान", en: "Focus", hinglish: "Dhyaan" },
    color: "#00ACC1",
    section: "grow",
    free: false,
    order: 50,
    open(ctx) {
      const F = (NS.content && NS.content.focus) || { memory: [], odd: [], listen: [], praise: [], tryAgain: [] };
      const k = kit(ctx, "focus");
      const { T, el, tap, btn, say, later, pop, wiggle, shuffle, age, page, caption, award } = k;
      const pick = (a) => a[Math.floor(Math.random() * a.length)];
      const rewarded = {};
      const gentleReward = (key, sticker, reason, afterSay) => { if (!rewarded[key]) { rewarded[key] = true; award({ sticker, reason: T(reason) }, afterSay); } };

      function menu() {
        const w = page(null);
        const night = ctx.daypart && ctx.daypart() === "night";
        w.appendChild(el("div", "head", "🧘 " + T({ hi: "ध्यान", en: "Focus" }), { fontSize: "clamp(24px, 7.5vw, 34px)", fontWeight: "800", textAlign: "center", color: "#00838F" }));
        const intro = night
          ? { hi: "सोने से पहले गुब्बारा साँस करें? शरीर शांत, नींद मीठी!", en: "Shall we do balloon breathing before bed? Calm body, sweet sleep!" }
          : { hi: "आँखें और कान तैयार? कौन-सा खेल खेलें?", en: "Eyes and ears ready? Which game shall we play?" };
        w.appendChild(caption(intro));
        const grid = el("div", "menu", null, { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" });
        const games = [
          { e: "🎈", t: { hi: "गुब्बारा साँस", en: "Balloon breathing" }, c: "#B2EBF2", go: breathe },
          { e: "🧩", t: { hi: "जोड़ी ढूँढो", en: "Find the pairs" }, c: "#FFE0B2", go: () => memory(0) },
          { e: "🔍", t: { hi: "कौन अलग है?", en: "Odd one out" }, c: "#DCEDC8", go: oddGame },
          { e: "👂", t: { hi: "सुनो और दबाओ", en: "Listen and tap" }, c: "#F8BBD0", go: listenGame }
        ];
        if (!night) games.push(games.shift());
        games.forEach((g, i) => {
          const b = tap("tile", () => g.go(), { background: g.c, minHeight: "130px", borderRadius: "24px", outline: night && i === 0 ? "4px solid #00838F" : "none" }, T(g.t));
          b.appendChild(el("div", "tileemoji", g.e, { fontSize: "clamp(44px, 13vw, 60px)" }));
          b.appendChild(el("div", "tilelabel", T(g.t), { fontSize: "clamp(17px, 4.8vw, 21px)", fontWeight: "800" }));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      /* ---- (a) memory match ---- */
      function memory(round) {
        const w = page("🧩 " + T({ hi: "जोड़ी ढूँढो", en: "Find the pairs" }), menu);
        const count = memoryCount(age(), round);
        const deck = makeDeck(F.memory, count, Math.random);
        const intro = { hi: "दो एक जैसी तस्वीरें ढूँढो। एक पत्ता पलटो, फिर दूसरा!", en: "Find two pictures that match. Turn one card, then another!" };
        const cap = caption(intro);
        w.appendChild(cap);
        const cols = count === 4 ? 2 : count === 6 ? 3 : 4;
        const grid = el("div", "board", null, { display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)", gap: "10px", maxWidth: cols * 130 + "px", width: "100%", margin: "0 auto" });
        const open = [], matched = new Set();
        let lock = false;
        const cards = deck.map((c, i) => {
          const b = tap("card", () => flip(i), { aspectRatio: "3 / 4", minHeight: "0", background: "linear-gradient(135deg, #4DD0E1, #00838F)", color: "#fff", fontSize: "clamp(30px, 9vw, 52px)", borderRadius: "16px", padding: "0" }, T({ hi: "पत्ता " + (i + 1), en: "Card " + (i + 1) }));
          b.appendChild(el("span", "face", "✨"));
          grid.appendChild(b);
          return b;
        });
        const face = (i, up) => {
          const b = cards[i];
          b.firstChild.textContent = up ? deck[i].sym : "✨";
          b.style.background = up ? "#FFFFFF" : "linear-gradient(135deg, #4DD0E1, #00838F)";
        };
        function flip(i) {
          if (lock || matched.has(i) || open.indexOf(i) >= 0) return;
          face(i, true);
          pop(cards[i]);
          open.push(i);
          if (open.length < 2) return;
          const [a, b] = open;
          if (isPair(deck, a, b)) {
            matched.add(a); matched.add(b);
            open.length = 0;
            [a, b].forEach((x) => { cards[x].style.outline = "4px solid #2EAD6B"; pop(cards[x], true); });
            if (matched.size === deck.length) {
              const m = pick(F.praise);
              const done = { hi: m.hi + " सारी जोड़ियाँ मिल गईं!", en: m.en + " You found all the pairs!" };
              cap.textContent = T(done);
              const sp = say(done);
              gentleReward("memory", "🧩", { hi: "ध्यान से जोड़ियाँ ढूँढीं!", en: "Found the pairs carefully!" }, sp);
              later(() => w.appendChild(btn("🔁 " + T({ hi: "एक और", en: "One more" }), "more", () => memory(round + 1))), 900);
            } else {
              const m = { hi: "जोड़ी मिल गई! " + deck[a].sym + deck[b].sym, en: "A pair! " + deck[a].sym + deck[b].sym };
              cap.textContent = T(m);
              say({ hi: "जोड़ी मिल गई!", en: "A pair!" });
            }
          } else {
            lock = true;
            const m = { hi: "ये अलग हैं — याद रखो कहाँ क्या है!", en: "These are different — remember where they are!" };
            cap.textContent = T(m);
            later(() => { face(a, false); face(b, false); open.length = 0; lock = false; }, 1100);
          }
        }
        w.appendChild(grid);
        say(intro);
      }

      /* ---- (b) odd one out ---- */
      function oddGame() {
        const w = page("🔍 " + T({ hi: "कौन अलग है?", en: "Odd one out" }), menu);
        const levels = oddLevels(age());
        const size = age() === "2-3" ? 3 : 4;
        const sets = shuffle(F.odd.filter((s) => levels.indexOf(s.level) >= 0)).slice(0, 5);
        let r = 0;
        const q = { hi: "कौन-सा अलग है? ध्यान से देखो!", en: "Which one is different? Look carefully!" };
        const cap = caption(q);
        w.appendChild(cap);
        const row = el("div", "row", null, { display: "grid", gridTemplateColumns: "repeat(" + size + ", 1fr)", gap: "10px" });
        w.appendChild(row);
        const stars = el("div", "stars", "", { textAlign: "center", fontSize: "26px", minHeight: "34px", letterSpacing: "4px" });
        w.appendChild(stars);
        function show() {
          while (row.firstChild) row.removeChild(row.firstChild);
          const set = sets[r];
          const rd = oddRound(set, size, Math.random);
          let done = false;
          rd.cards.forEach((c, i) => {
            const b = tap("pic", () => {
              if (done) return;
              if (i === rd.oddIndex) {
                done = true;
                b.style.background = "#C8E6C9";
                b.style.outline = "4px solid #2EAD6B";
                pop(b, true);
                stars.textContent += "⭐";
                const m = { hi: pick(F.praise).hi + " " + set.why.hi, en: pick(F.praise).en + " " + set.why.en };
                cap.textContent = T(m);
                let moved = false;
                const go = () => {
                  if (moved || !w.isConnected) return;
                  moved = true; r++;
                  if (r < sets.length) { cap.textContent = T(q); show(); say(q); return; }
                  const end = { hi: "वाह! तुमने हर बार ध्यान से देखा!", en: "Wow! You looked carefully every time!" };
                  cap.textContent = T(end);
                  const sp = say(end);
                  gentleReward("odd", "🔍", { hi: "जासूस जैसी आँखें!", en: "Detective eyes!" }, sp);
                  while (row.firstChild) row.removeChild(row.firstChild);
                  row.appendChild(btn("🔁 " + T({ hi: "फिर से खेलें", en: "Play again" }), "again", oddGame, { gridColumn: "1 / -1" }));
                };
                say(m).then(() => later(go, 500));
                later(go, 6000);
              } else {
                wiggle(b);
                const m = pick(F.tryAgain);
                cap.textContent = T(m);
                say(m);
              }
            }, { minHeight: "clamp(90px, 26vw, 140px)", fontSize: "clamp(40px, 13vw, 72px)", padding: "4px" }, String(i + 1));
            b.appendChild(el("span", "picemoji", c));
            row.appendChild(b);
          });
        }
        show();
        say(q);
      }

      /* ---- (c) जो मैं कहूँ वही दबाओ ---- */
      function listenGame() {
        const w = page("👂 " + T({ hi: "सुनो और दबाओ", en: "Listen and tap" }), menu);
        const band = age();
        const n = band === "2-3" ? 3 : 4;
        const rounds = 6;
        let r = 0;
        const intro = { hi: "मैं जो बोलूँ, बस वही दबाना। कान तैयार?", en: "Tap only what I say. Ears ready?" };
        const cap = caption(intro, { fontSize: "clamp(20px, 6vw, 30px)", color: "#AD1457" });
        w.appendChild(cap);
        const grid = el("div", "grid", null, { display: "grid", gridTemplateColumns: "repeat(" + (n === 3 ? 3 : 2) + ", 1fr)", gap: "10px" });
        w.appendChild(grid);
        const stars = el("div", "stars", "", { textAlign: "center", fontSize: "26px", minHeight: "34px", letterSpacing: "4px" });
        w.appendChild(stars);
        const name = (x) => T({ hi: x.hi, en: x.en });
        function round() {
          while (grid.firstChild) grid.removeChild(grid.firstChild);
          const opts = shuffle(F.listen).slice(0, n);
          const twoStep = band === "6+" && r % 2 === 1;
          const targets = twoStep ? opts.slice(0, 2) : [opts[0]];
          let step = 0, done = false;
          const prompt = twoStep
            ? { hi: "पहले " + targets[0].hi + ", फिर " + targets[1].hi + " दबाओ!", en: "First the " + targets[0].en + ", then the " + targets[1].en + "!" }
            : { hi: targets[0].hi + " को दबाओ!", en: "Tap the " + targets[0].en + "!" };
          cap.textContent = T(prompt);
          shuffle(opts).forEach((o) => {
            const b = tap("thing", () => {
              if (done) return;
              if (o === targets[step]) {
                b.style.background = "#C8E6C9";
                b.style.outline = "4px solid #2EAD6B";
                pop(b, true);
                step++;
                if (step < targets.length) { say({ hi: "हाँ! अब " + targets[step].hi, en: "Yes! Now the " + targets[step].en }); return; }
                done = true;
                stars.textContent += "⭐";
                const m = pick(F.praise);
                cap.textContent = T(m);
                let moved = false;
                const go = () => {
                  if (moved || !w.isConnected) return;
                  moved = true; r++;
                  if (r < rounds) { round(); return; }
                  const end = { hi: "शाबाश! तुमने हर बार ध्यान से सुना!", en: "Well done! You listened carefully every time!" };
                  cap.textContent = T(end);
                  const sp = say(end);
                  gentleReward("listen", "👂", { hi: "ध्यान से सुना!", en: "Listened carefully!" }, sp);
                  while (grid.firstChild) grid.removeChild(grid.firstChild);
                  grid.appendChild(btn("🔁 " + T({ hi: "फिर से खेलें", en: "Play again" }), "again", listenGame, { gridColumn: "1 / -1" }));
                };
                say(m).then(() => later(go, 400));
                later(go, 5000);
              } else {
                wiggle(b);
                const m = { hi: "यह तो " + o.hi + " है। फिर से सुनो: " + T(prompt), en: "That's the " + o.en + ". Listen again: " + prompt.en };
                say(ctx.lang === "en" ? m.en : m.hi);
              }
            }, { minHeight: "clamp(96px, 26vw, 150px)" }, name(o));
            b.appendChild(el("div", "thingemoji", o.emoji, { fontSize: "clamp(44px, 13vw, 70px)", lineHeight: "1.1" }));
            b.appendChild(el("div", "thinglabel", name(o), { fontSize: "clamp(15px, 4.2vw, 19px)", fontWeight: "700" }));
            grid.appendChild(b);
          });
          say(prompt);
        }
        say(intro).then(() => later(() => { if (w.isConnected && r === 0 && !grid.firstChild) round(); }, 300));
        later(() => { if (w.isConnected && r === 0 && !grid.firstChild) round(); }, 3500);
      }

      /* ---- (d) गुब्बारा साँस ---- */
      function breathe() {
        const w = page("🎈 " + T({ hi: "गुब्बारा साँस", en: "Balloon breathing" }), menu);
        const total = breathCount(age());
        const intro = { hi: "आराम से बैठो। हम पेट में एक गुब्बारा फुलाएँगे — धीरे-धीरे।", en: "Sit comfortably. We'll fill a balloon in our tummy — slowly." };
        const cap = caption(intro);
        w.appendChild(cap);
        const stage = el("div", "stage", null, { background: "linear-gradient(#E0F7FA, #B2EBF2)", borderRadius: "28px", minHeight: "clamp(230px, 46vh, 380px)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" });
        const balloon = el("div", "balloon", "🎈", { fontSize: "clamp(90px, 28vw, 150px)", lineHeight: "1", transform: "scale(.55)", transition: "transform 4s ease-in-out", willChange: "transform" });
        stage.appendChild(balloon);
        const count = el("div", "count", "", { position: "absolute", bottom: "10px", left: "0", right: "0", textAlign: "center", fontSize: "clamp(26px, 8vw, 40px)", fontWeight: "800", color: "#006064" });
        stage.appendChild(count);
        w.appendChild(stage);
        const dots = el("div", "dots", null, { display: "flex", justifyContent: "center", gap: "8px" });
        const dotEls = [];
        for (let i = 0; i < total; i++) { const d = el("span", "dot", "○", { fontSize: "24px", color: "#00838F" }); dotEls.push(d); dots.appendChild(d); }
        w.appendChild(dots);
        const go = btn("▶️ " + T({ hi: "शुरू करें", en: "Start" }), "start", () => { go.remove(); breath(0); }, { background: "#00ACC1" });
        w.appendChild(go);
        const counts = { hi: ["एक", "दो", "तीन", "चार"], en: ["one", "two", "three", "four"] };
        const word = (i) => (ctx.lang === "en" ? counts.en[i] : counts.hi[i]);
        function countUp(i) {
          for (let s = 0; s < 4; s++) later(() => { count.textContent = String(s + 1) + "  " + word(s); }, 1000 * s + 200);
        }
        function breath(i) {
          if (i >= total) return finish();
          const inh = { hi: "नाक से साँस अंदर… गुब्बारा फूल रहा है।", en: "Breathe in through your nose… the balloon is filling up." };
          cap.textContent = T(inh);
          say(inh);
          balloon.style.transform = "scale(1.15)";
          countUp();
          later(() => {
            const exh = { hi: "अब मुँह से धीरे-धीरे बाहर… फ़ूँऊँऊँ…", en: "Now breathe out slowly through your mouth… whoooosh…" };
            cap.textContent = T(exh);
            say(exh);
            balloon.style.transform = "scale(.55)";
            count.textContent = "🌬️";
            later(() => {
              dotEls[i].textContent = "●";
              count.textContent = "";
              later(() => breath(i + 1), 800);
            }, 4800);
          }, 4600);
        }
        function finish() {
          const m = { hi: "शाबाश! अब तुम्हारा शरीर शांत है और मन तैयार है।", en: "Well done! Your body is calm and your mind is ready." };
          cap.textContent = T(m);
          const sp = say(m);
          pop(balloon, true);
          /* at bedtime we keep it calm: no sparkle burst */
          if (!(ctx.daypart && ctx.daypart() === "night")) gentleReward("breathe", "🎈", { hi: "शांत साँसें!", en: "Calm breathing!" }, sp);
          const row = el("div", "endrow", null, { display: "flex", gap: "10px", flexWrap: "wrap" });
          row.appendChild(btn("🔁 " + T({ hi: "फिर से", en: "Again" }), "again", breathe, { flex: "1 1 120px", background: "#00ACC1" }));
          row.appendChild(btn("👍 " + T({ hi: "हो गया", en: "Done" }), "done", menu, { flex: "1 1 120px" }));
          w.appendChild(row);
        }
        say(intro);
      }

      menu();
      return k.cleanup;
    }
  });
})();
