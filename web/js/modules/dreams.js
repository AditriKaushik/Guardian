/* नन्हा स्कूल — "बड़े होकर" (When I grow up). Career cards for future awareness: what they do,
   a pretend-play moment, and a quiet link to today's habits ("डॉक्टर रोज़ थोड़ा-थोड़ा पढ़ते हैं").
   Every job is shown with two characters of different genders. The child may pick "मेरा सपना":
   saved in ctx.data "dream" = {id, title:{hi,en}, icon, at} and announced with
   NS.emit("dream:chosen", {id, title:{hi,en}, icon}) so the buddy/home can mention it. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.grow = NS.grow || {};

  const pad = (n) => (n < 10 ? "0" : "") + n;
  const dateKey = (d) => { d = d || new Date(typeof NS.now === "function" ? NS.now() : Date.now()); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  /* pure: the record we store and emit for a chosen dream */
  function dreamRecord(c, day) { return { id: c.id, title: { hi: c.title.hi, en: c.title.en }, icon: c.icon, at: day || dateKey() }; }
  NS.grow.dreams = { dreamRecord };

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
    id: "dreams",
    icon: "🚀",
    title: { hi: "बड़े होकर", en: "When I Grow Up", hinglish: "Bade Hokar" },
    color: "#3949AB",
    section: "grow",
    free: false,
    order: 40,
    open(ctx) {
      const CAREERS = (NS.content && NS.content.careers) || [];
      const k = kit(ctx, "dreams");
      const { T, el, tap, btn, say, later, pop, page, caption, award } = k;
      const myDream = () => ctx.data.get("dream", null);

      function gallery() {
        const w = page(null);
        w.appendChild(el("div", "head", "🌠 " + T({ hi: "बड़े होकर क्या बनें?", en: "What will I be?" }), { fontSize: "clamp(22px, 7vw, 32px)", fontWeight: "800", textAlign: "center", color: "#283593" }));
        const d = myDream();
        const dc = d && CAREERS.find((c) => c.id === d.id);
        let intro;
        if (dc) {
          const banner = tap("mine", () => detail(dc), { background: "linear-gradient(#FFF59D, #FFE082)", flexDirection: "row", gap: "12px", padding: "10px 14px", borderRadius: "22px" }, T({ hi: "मेरा सपना", en: "My dream" }));
          banner.appendChild(el("div", "mineemoji", "⭐" + dc.icon, { fontSize: "clamp(34px, 10vw, 46px)" }));
          banner.appendChild(el("div", "minetext", T({ hi: "मेरा सपना: " + dc.title.hi, en: "My dream: " + dc.title.en }), { fontSize: "clamp(18px, 5vw, 23px)", fontWeight: "800", flex: "1", textAlign: "left" }));
          w.appendChild(banner);
          intro = { hi: "तुम्हारा सपना है — " + dc.title.hi + "! रोज़ थोड़ा-थोड़ा, सपने की ओर। और भी काम देखो!", en: "Your dream is — " + dc.title.en + "! A little every day, towards your dream. Look at more jobs!" };
        } else {
          intro = { hi: "बड़े होकर लोग बहुत सारे काम करते हैं। किसी को छूकर देखो!", en: "Grown-ups do so many kinds of work. Touch one to see!" };
        }
        w.appendChild(caption(intro));
        const tried = ctx.data.get("tried", {}) || {};
        const grid = el("div", "grid", null, { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(30%, 150px), 1fr))", gap: "10px" });
        CAREERS.forEach((c) => {
          const b = tap("card", () => detail(c), { background: c.color, color: "#fff", minHeight: "128px", borderRadius: "22px", position: "relative", padding: "8px 4px", textShadow: "0 1px 2px rgba(0,0,0,.35)" }, T(c.title));
          b.appendChild(el("div", "people", c.people.join(""), { fontSize: "clamp(28px, 8.5vw, 40px)", lineHeight: "1.1", textShadow: "none" }));
          b.appendChild(el("div", "cardtitle", c.icon + " " + T(c.title), { fontSize: "clamp(13px, 3.8vw, 17px)", fontWeight: "800", textAlign: "center", lineHeight: "1.2" }));
          if (d && d.id === c.id) b.appendChild(el("div", "star", "⭐", { position: "absolute", top: "4px", right: "6px", fontSize: "20px" }));
          else if (tried[c.id]) b.appendChild(el("div", "tried", "✓", { position: "absolute", top: "4px", right: "8px", fontSize: "18px", fontWeight: "800" }));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      function detail(c) {
        const w = page(c.icon + " " + T(c.title), gallery);
        const hero = el("div", "hero", null, { background: c.color, borderRadius: "28px", padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" });
        hero.appendChild(el("div", "heropeople", c.people.join(" "), { fontSize: "clamp(56px, 17vw, 88px)", lineHeight: "1.1" }));
        hero.appendChild(el("div", "herotitle", T(c.title), { fontSize: "clamp(24px, 7vw, 34px)", fontWeight: "800", color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.4)" }));
        w.appendChild(hero);
        const cap = caption(c.does);
        w.appendChild(cap);
        const step = el("div", "step", null, { display: "flex", flexDirection: "column", gap: "10px" });
        w.appendChild(step);
        step.appendChild(btn("🎭 " + T({ hi: "चलो, करके देखें!", en: "Let's pretend!" }), "pretend", () => pretend(c, step, cap), { background: "#7E57C2" }));
        say(c.does);
      }

      function pretend(c, step, cap) {
        while (step.firstChild) step.removeChild(step.firstChild);
        const box = el("div", "act", null, { background: "#EDE7F6", borderRadius: "24px", padding: "14px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" });
        const em = el("div", "actemoji", c.act.emoji, { fontSize: "clamp(60px, 18vw, 90px)" });
        box.appendChild(em);
        cap.textContent = T(c.act);
        step.appendChild(box);
        if (!k.reduced && em.animate) em.animate([{ transform: "translateY(0)" }, { transform: "translateY(-10px)" }, { transform: "translateY(0)" }], { duration: 900, iterations: 3 });
        const did = btn("👍 " + T({ hi: "मैंने किया!", en: "I did it!" }), "did", () => {
          did.remove();
          const tried = ctx.data.get("tried", {}) || {};
          const first = !tried[c.id];
          tried[c.id] = true;
          ctx.data.set("tried", tried);
          pop(em, true);
          const praise = { hi: "वाह! बिल्कुल असली " + c.title.hi + " की तरह!", en: "Wow! Just like a real " + c.title.en.toLowerCase() + "!" };
          const sp = showLink(c, step, cap, praise);
          if (first) award({ sticker: c.icon, reason: T(praise) }, sp);
        }, { background: "#2EAD6B" });
        step.appendChild(did);
        say(c.act);
      }

      function showLink(c, step, cap, praise) {
        const link = el("div", "link", null, { background: "#E8F5E9", borderRadius: "22px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "10px" });
        link.appendChild(el("div", "linkemoji", "🌱", { fontSize: "36px" }));
        link.appendChild(el("div", "linktext", T(c.link), { fontSize: "clamp(16px, 4.6vw, 21px)", fontWeight: "700", flex: "1", lineHeight: "1.35" }));
        step.appendChild(link);
        cap.textContent = T(praise);
        const d = myDream();
        const isMine = d && d.id === c.id;
        const row = el("div", "row", null, { display: "flex", gap: "10px", flexWrap: "wrap" });
        if (isMine) {
          row.appendChild(el("div", "mine", "⭐ " + T({ hi: "यह मेरा सपना है!", en: "This is my dream!" }), { flex: "1 1 160px", textAlign: "center", fontSize: "clamp(17px, 4.6vw, 22px)", fontWeight: "800", padding: "14px", background: "#FFF59D", borderRadius: "18px" }));
        } else {
          row.appendChild(btn("⭐ " + T({ hi: "यह मेरा सपना!", en: "This is my dream!" }), "choose", () => choose(c), { flex: "1 1 160px", background: "#FFB300", color: "#3E2723" }));
        }
        row.appendChild(btn("🔍 " + T({ hi: "और काम देखें", en: "See more jobs" }), "more", gallery, { flex: "1 1 140px", background: "#5C6BC0" }));
        step.appendChild(row);
        link.scrollIntoView && link.scrollIntoView({ behavior: k.reduced ? "auto" : "smooth", block: "nearest" });
        return say(T(praise) + " " + T(c.link));
      }

      function choose(c) {
        const rec = dreamRecord(c);
        ctx.data.set("dream", rec);
        if (typeof NS.emit === "function") NS.emit("dream:chosen", { id: rec.id, title: rec.title, icon: rec.icon });
        const w = page(c.icon + " " + T(c.title), gallery);
        const card = el("div", "chosen", null, { background: "linear-gradient(#FFF59D, #FFCC80)", borderRadius: "28px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" });
        const big = el("div", "chosenemoji", "🌟" + c.icon + "🌟", { fontSize: "clamp(56px, 17vw, 88px)" });
        card.appendChild(big);
        const m = { hi: "तुम्हारा सपना: " + c.title.hi + "! रोज़ थोड़ा-थोड़ा सीखेंगे, अच्छा खाएँगे, समय पर सोएँगे — और सपना बड़ा होता जाएगा।", en: "Your dream: " + c.title.en + "! We'll learn a little every day, eat well and sleep on time — and the dream will keep growing." };
        card.appendChild(caption(m));
        w.appendChild(card);
        w.appendChild(btn("👍 " + T({ hi: "ठीक है!", en: "Okay!" }), "ok", gallery));
        pop(big, true);
        say(m);
        later(() => pop(big), 900);
      }

      gallery();
      return k.cleanup;
    }
  });
})();
