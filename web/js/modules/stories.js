/* नन्हा स्कूल — "कहानी समय" (Story time). Original picture stories read aloud page by page,
   then 1–2 picture questions and an off-screen "घर पर करो" mission. Stories live in
   js/content/stories.js (NS.content.stories). */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.grow = NS.grow || {};

  /* pure: how many questions to ask for an age band */
  function questionCount(ageBand, available) { return Math.min(available, ageBand === "2-3" ? 1 : 2); }
  NS.grow.stories = { questionCount };

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
    id: "stories",
    icon: "📖",
    title: { hi: "कहानी समय", en: "Story Time", hinglish: "Kahaani Time" },
    color: "#8E24AA",
    section: "grow",
    free: false,
    order: 30,
    open(ctx) {
      const STORIES = (NS.content && NS.content.stories) || [];
      const k = kit(ctx, "stories");
      const { T, el, tap, btn, say, later, pop, wiggle, page, caption, age, award } = k;
      const P = (o) => T(o);           // story strings are {hi, en}

      function shelf() {
        const w = page(null);
        const read = ctx.data.get("read", {}) || {};
        w.appendChild(el("div", "head", "📚 " + T({ hi: "कहानी समय", en: "Story Time" }), { fontSize: "clamp(24px, 7.5vw, 34px)", fontWeight: "800", textAlign: "center", color: "#6A1B9A" }));
        const intro = { hi: "कौन-सी कहानी सुनें? किसी तस्वीर को छुओ!", en: "Which story shall we hear? Touch a picture!" };
        w.appendChild(caption(intro));
        const grid = el("div", "shelf", null, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(46%, 160px), 1fr))", gap: "12px" });
        STORIES.forEach((s) => {
          const b = tap("cover", () => reader(s, 0), { background: s.color || "#7E57C2", color: "#fff", minHeight: "150px", borderRadius: "24px", position: "relative", padding: "12px 8px", textShadow: "0 1px 2px rgba(0,0,0,.35)" }, P(s.title));
          b.appendChild(el("div", "coveremoji", s.cover, { fontSize: "clamp(48px, 14vw, 64px)", lineHeight: "1.1" }));
          b.appendChild(el("div", "covertitle", P(s.title), { fontSize: "clamp(15px, 4.3vw, 19px)", fontWeight: "800", textAlign: "center", lineHeight: "1.25" }));
          if (read[s.id]) b.appendChild(el("div", "star", "⭐", { position: "absolute", top: "6px", right: "8px", fontSize: "22px" }));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      function reader(s, i) {
        const w = page(s.cover + " " + P(s.title), shelf);
        const pg = s.pages[i];
        const scene = tap("scene", () => { pop(scene); say(P(pg)); }, {
          background: "linear-gradient(#FFFFFF, #F3E5F5)", minHeight: "clamp(150px, 34vh, 280px)", borderRadius: "28px",
          fontSize: "clamp(56px, 17vw, 112px)", lineHeight: "1.15", letterSpacing: "4px", flexDirection: "row", flexWrap: "wrap"
        }, T({ hi: "चित्र — फिर से सुनो", en: "Picture — hear again" }));
        scene.appendChild(el("span", "sceneemoji", pg.scene));
        w.appendChild(scene);
        const txt = caption(P(pg), { fontSize: "clamp(19px, 5.2vw, 26px)", color: "#311B92", minHeight: "3em" });
        w.appendChild(txt);
        const dots = el("div", "dots", null, { display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap" });
        s.pages.forEach((_, j) => dots.appendChild(el("span", "dot", "", { width: "10px", height: "10px", borderRadius: "50%", background: j === i ? "#8E24AA" : j < i ? "#CE93D8" : "#E0E0E0", display: "inline-block" })));
        w.appendChild(dots);
        const nav = el("div", "nav", null, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "auto" });
        const prev = btn("⬅️", "prev", () => reader(s, i - 1), { background: "#B39DDB", fontSize: "28px" });
        prev.setAttribute("aria-label", T({ hi: "पिछला पन्ना", en: "Previous page" }));
        if (i === 0) { prev.disabled = true; prev.style.opacity = ".35"; }
        const last = i === s.pages.length - 1;
        const next = btn(last ? "✅" : "➡️", "next", () => (last ? questions(s, 0) : reader(s, i + 1)), { background: "#8E24AA", fontSize: "28px" });
        next.setAttribute("aria-label", T(last ? { hi: "कहानी पूरी", en: "Story done" } : { hi: "अगला पन्ना", en: "Next page" }));
        nav.appendChild(prev);
        nav.appendChild(next);
        w.appendChild(nav);
        if (last) pop(next, true);
        say(P(pg));
      }

      function questions(s, qi) {
        const n = questionCount(age(), s.questions.length);
        if (qi >= n) return mission(s);
        const q = s.questions[qi];
        const w = page(s.cover + " " + P(s.title), shelf);
        w.appendChild(el("div", "qicon", "🤔", { fontSize: "clamp(44px, 13vw, 60px)", textAlign: "center" }));
        const cap = caption(q.q, { fontSize: "clamp(20px, 5.6vw, 28px)", color: "#4A148C" });
        w.appendChild(cap);
        const grid = el("div", "choices", null, { display: "grid", gridTemplateColumns: "repeat(" + Math.min(q.choices.length, 3) + ", 1fr)", gap: "10px" });
        let misses = 0, done = false;
        const buttons = q.choices.map((c, ci) => {
          const b = tap("choice", () => {
            if (done) return;
            if (ci === q.answer) {
              done = true;
              b.style.background = "#C8E6C9";
              b.style.outline = "4px solid #2EAD6B";
              pop(b, true);
              const m = { hi: "हाँ! " + c.hi + "। तुमने कहानी ध्यान से सुनी!", en: "Yes! " + c.en + ". You listened so carefully!" };
              cap.textContent = T(m);
              let moved = false;
              const go = () => { if (moved || !w.isConnected) return; moved = true; questions(s, qi + 1); };
              say(m).then(() => later(go, 500));
              later(go, 6000);
            } else {
              misses++;
              wiggle(b);
              b.style.opacity = ".45";
              const m = misses >= 2
                ? { hi: "चलो साथ में देखें — सही जवाब है: " + q.choices[q.answer].hi, en: "Let's look together — the answer is: " + q.choices[q.answer].en }
                : { hi: "अरे, फिर से सोचो! कहानी में क्या हुआ था?", en: "Hmm, think again! What happened in the story?" };
              if (misses >= 2) { buttons[q.answer].style.outline = "4px dashed #2EAD6B"; pop(buttons[q.answer], true); }
              cap.textContent = T(m);
              say(m);
            }
          }, { minHeight: "130px", background: "#FFF" }, P(c));
          b.appendChild(el("div", "chemoji", c.emoji, { fontSize: "clamp(36px, 11vw, 54px)", lineHeight: "1.1" }));
          b.appendChild(el("div", "chlabel", P(c), { fontSize: "clamp(14px, 4vw, 18px)", fontWeight: "700", textAlign: "center", lineHeight: "1.25" }));
          grid.appendChild(b);
          return b;
        });
        w.appendChild(grid);
        say(q.q);
      }

      function mission(s) {
        const w = page(s.cover + " " + P(s.title), shelf);
        const read = ctx.data.get("read", {}) || {};
        const first = !read[s.id];
        read[s.id] = (read[s.id] || 0) + 1;
        ctx.data.set("read", read);
        w.appendChild(el("div", "done", "🎉 " + T({ hi: "कहानी पूरी हुई!", en: "The story is done!" }), { fontSize: "clamp(22px, 6.5vw, 30px)", fontWeight: "800", textAlign: "center", color: "#6A1B9A" }));
        const card = el("div", "mission", null, { background: "#FFF8E1", borderRadius: "26px", padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", border: "3px dashed #FFB300" });
        card.appendChild(el("div", "mtitle", "🏠 " + T({ hi: "घर पर करो", en: "Try at home" }), { fontSize: "clamp(18px, 5vw, 22px)", fontWeight: "800", color: "#E65100" }));
        card.appendChild(el("div", "memoji", s.mission.emoji, { fontSize: "clamp(56px, 16vw, 80px)" }));
        card.appendChild(caption(s.mission, { fontSize: "clamp(18px, 5vw, 24px)" }));
        w.appendChild(card);
        const row = el("div", "endrow", null, { display: "flex", gap: "10px", flexWrap: "wrap" });
        row.appendChild(btn("👍 " + T({ hi: "ठीक है!", en: "Okay!" }), "ok", shelf, { flex: "1 1 140px" }));
        row.appendChild(btn("🔁 " + T({ hi: "फिर से सुनें", en: "Hear it again" }), "again", () => reader(s, 0), { flex: "1 1 140px", background: "#8E24AA" }));
        w.appendChild(row);
        const sp = say(T({ hi: "शाबाश! अब घर पर करके देखो:", en: "Well done! Now try this at home:" }) + " " + T(s.mission));
        if (first) award({ sticker: s.cover, reason: T({ hi: "पूरी कहानी सुनी!", en: "You heard the whole story!" }) }, sp);
      }

      shelf();
      return k.cleanup;
    }
  });
})();
