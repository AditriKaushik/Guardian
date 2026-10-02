/* नन्हा स्कूल — the shell: header, living-sky home, navigation, first-run profiles, the
   "कौन खेल रहा है?" picker, sticker book, grown-ups' area, the session wind-down and the PWA bits.
   Loaded last: every module has registered its activity by now, so this file boots the app.

   Adds to NS: NS.open(id), NS.home(), NS.mascot(mood, cls) (+ .mood, .react, .look, .lookAt),
   NS.ui = {setTop, setProg, panel, state, talk, minutesToday, render, …, install}.

   Feel (why the app feels alive rather than mechanical):
   - every press squashes and springs back (Web Animations on the `scale` property, so it never
     fights a module's own transforms) with a soft "tap" sound, a "pop" for home tiles;
   - मिट्ठू breathes, blinks at random, looks toward whatever the child taps, nods at right
     answers and tilts his head on "try again" (NS.mascot.react);
   - screens arrive with a gentle spring; the home sky has parallax layers and drifting clouds;
   - when the child is idle on home, मिट्ठू suggests one tile and that tile wiggles while he
     speaks about it (once, never pushy);
   - everything respects prefers-reduced-motion. */
(function () {
  "use strict";
  const NS = window.NS;
  const el = NS.el;
  const $ = id => document.getElementById(id);
  const body = $("body"), backBtn = $("backBtn"), soundBtn = $("soundBtn"), scrTitle = $("scrTitle"), prog = $("prog");
  const app = $("app");
  const root = document.documentElement;
  const sfx = name => (NS.sfx ? NS.sfx.play(name) : false);
  const reduceMotion = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };

  /* ---------------- Screen state ---------------- */
  let state = "boot";            // home | activity | core | grownup | onboard | picker | rest
  let rerender = null;           // re-draws the current core screen (language change)
  let cleanup = null;            // returned by an activity's open()
  let ctxAlive = null;           // the open activity's liveness flag
  let pushed = false;            // one history entry while away from home (Android back / browser back)
  let currentActivity = null;

  function leaveScreen() {
    if (ctxAlive) { ctxAlive.alive = false; ctxAlive = null; }
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) { console.error(e); } }
    cleanup = null;
    currentActivity = null;
    homeGen++;
    NS.voice.stop();
    const c = document.querySelector(".celebrate");
    if (c && state !== "activity") c.remove();
  }
  let secure = false;
  function setState(s, draw) {
    state = s;
    // Android shell: block screenshots while grown-ups' screens (gate, paywall, restore code) show.
    if (NS.native.available && secure !== (s === "grownup")) { secure = s === "grownup"; NS.native.call("secure", secure ? "true" : "false"); }
    rerender = draw || null;
    app.dataset.state = s;
    if (s !== "home" && !pushed) { try { history.pushState({ ns: 1 }, ""); pushed = true; } catch (e) {} }
  }
  /* Header: a title (an optional icon is shown as a picture), the home button, sound. */
  function setTop(title, showBack, icon) {
    scrTitle.replaceChildren();
    if (icon) {
      const ic = NS.picture(icon, { cls: "title-ic", size: 96, eager: true });
      ic.setAttribute("aria-hidden", "true");
      scrTitle.appendChild(ic);
    }
    scrTitle.appendChild(el("span", "title-t", title));
    backBtn.hidden = !showBack;
    prog.textContent = "";
    // Home, the picker, the first run and the rest screen draw their own sky: no header there.
    app.classList.toggle("on-home", !showBack && ["home", "picker", "onboard", "rest"].includes(state));
  }
  function panel(title) {
    leaveScreen();
    setState("grownup", null);
    app.classList.remove("on-home");
    app.style.removeProperty("--act");
    body.replaceChildren();
    const box = el("div", "panel screen-in");
    if (title) box.appendChild(el("h2", "ptitle", title));
    body.appendChild(box);
    body.scrollTop = 0;
    return box;
  }
  function fresh(cls) {
    body.replaceChildren();
    body.scrollTop = 0;
    const wrap = el("div", cls + " screen-in");
    body.appendChild(wrap);
    return wrap;
  }

  /* ---------------- Mascot: मिट्ठू the parrot (inline SVG, animated by app.css) ---------------- */
  const MOODS = ["idle", "happy", "sleepy", "curious", "calm", "proud", "caring"];
  function mascot(mood, cls) {
    const s = NS.svg;
    const eye = (cx, px) => s("g", { class: "m-eye" }, [
      s("circle", { cx, cy: 40, r: 8, fill: "#fff" }),
      s("g", { class: "m-pupil" }, [
        s("circle", { cx: px, cy: 41.5, r: 4.8, fill: "#3B2A26" }),
        s("circle", { cx: px + 1.6, cy: 39.4, r: 1.7, fill: "#fff" }),
      ]),
    ]);
    const z = s("text", { class: "m-z", x: 92, y: 24 }); z.textContent = "z";
    const svg = s("svg", { viewBox: "0 0 120 132", class: "mascot m-" + (MOODS.includes(mood) ? mood : "idle") + (cls ? " " + cls : ""), role: "img", "aria-label": NS.tr("mascotName"), focusable: "false" }, [
      s("ellipse", { class: "m-shadow", cx: 60, cy: 126, rx: 27, ry: 4.5, fill: "#5A3A1A", opacity: ".14" }),
      s("g", { class: "m-all" }, [
        s("g", { class: "m-body" }, [
          s("path", { d: "M50 100 Q38 122 45 129 Q54 118 58 104 Z", fill: "#E8504A" }),
          s("path", { d: "M70 100 Q82 122 75 129 Q66 118 62 104 Z", fill: "#3D8FE0" }),
          s("path", { d: "M55 104 Q60 131 65 104 Z", fill: "#FFC23D" }),
          s("g", { class: "m-wing-l" }, [s("ellipse", { cx: 34, cy: 80, rx: 10, ry: 20, fill: "#2E9E48", transform: "rotate(18 34 80)" })]),
          s("g", { class: "m-wing-r" }, [s("ellipse", { cx: 86, cy: 80, rx: 10, ry: 20, fill: "#2E9E48", transform: "rotate(-18 86 80)" })]),
          s("ellipse", { cx: 60, cy: 80, rx: 29, ry: 30, fill: "#3DBE5A" }),
          s("ellipse", { cx: 60, cy: 87, rx: 18, ry: 20, fill: "#C8F27C" }),
          s("ellipse", { cx: 52, cy: 66, rx: 7, ry: 4, fill: "#fff", opacity: ".18", transform: "rotate(-25 52 66)" }),
          s("path", { d: "M50 108 l-5 7 M50 108 l0 8 M50 108 l5 7 M70 108 l-5 7 M70 108 l0 8 M70 108 l5 7", stroke: "#F08A1C", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }),
        ]),
        s("g", { class: "m-look" }, [
          s("g", { class: "m-react" }, [
            s("g", { class: "m-head" }, [
              s("ellipse", { cx: 51, cy: 14, rx: 4.5, ry: 10, fill: "#FF7A4D", transform: "rotate(-22 51 14)" }),
              s("ellipse", { cx: 60, cy: 11, rx: 4.5, ry: 11, fill: "#FFCB3D" }),
              s("ellipse", { cx: 69, cy: 14, rx: 4.5, ry: 10, fill: "#FF7A4D", transform: "rotate(22 69 14)" }),
              s("circle", { cx: 60, cy: 43, r: 30, fill: "#47C95F" }),
              s("ellipse", { cx: 49, cy: 24, rx: 9, ry: 5, fill: "#fff", opacity: ".2", transform: "rotate(-20 49 24)" }),
              s("ellipse", { cx: 60, cy: 45, rx: 24, ry: 17, fill: "#E8FAD6" }),
              eye(49, 50.5), eye(71, 72.5),
              s("path", { class: "m-closed", d: "M42 41 Q49 47 56 41 M64 41 Q71 47 78 41", stroke: "#3B2A26", "stroke-width": 2.6, "stroke-linecap": "round", fill: "none" }),
              s("ellipse", { class: "m-cheek", cx: 40, cy: 52, rx: 5, ry: 3.2, fill: "#FF8A80", opacity: ".8" }),
              s("ellipse", { class: "m-cheek", cx: 80, cy: 52, rx: 5, ry: 3.2, fill: "#FF8A80", opacity: ".8" }),
              s("g", { class: "m-beak-low" }, [s("ellipse", { cx: 60, cy: 58, rx: 5.5, ry: 3.6, fill: "#E06A10" })]),
              s("path", { d: "M52 47 Q60 42 68 47 Q67 56 60 61 Q53 56 52 47 Z", fill: "#FF9A1F" }),
              z,
            ]),
          ]),
        ]),
      ]),
    ]);
    return svg;
  }
  /* Moods: idle, happy, sleepy, curious, calm, proud, caring (anything else shows idle). */
  mascot.MOODS = MOODS;
  mascot.mood = function (svg, mood) {
    if (!svg || !svg.classList) return;
    MOODS.forEach(m => svg.classList.remove("m-" + m));
    svg.classList.add("m-" + (MOODS.includes(mood) ? mood : "idle"));
  };
  /* One-off reactions: "nod" (yes! right answer), "tilt" (hmm, try again), "hop" (joy),
     "wiggle" (a little dance), "blink". */
  const reactTimers = new WeakMap();
  const REACT_MS = { nod: 900, tilt: 1500, hop: 1150, wiggle: 950 };
  mascot.react = function (svg, kind) {
    if (!svg || !svg.classList) return;
    if (kind === "blink") { blink(svg); return; }
    const k = REACT_MS[kind] ? kind : "nod";
    const timers = reactTimers.get(svg) || {};
    clearTimeout(timers[k]);
    svg.classList.remove("r-" + k);
    void svg.getBoundingClientRect();
    svg.classList.add("r-" + k);
    timers[k] = setTimeout(() => svg.classList.remove("r-" + k), REACT_MS[k]);
    reactTimers.set(svg, timers);
  };
  /* Eyes (and a slight head turn) toward a point on the screen; back to the middle after a while. */
  const lookTimers = new WeakMap();
  mascot.look = function (svg, x, y) {
    if (!svg || !svg.getBoundingClientRect || svg.classList.contains("m-sleepy") || svg.classList.contains("m-calm")) return;
    const r = svg.getBoundingClientRect();
    if (!r.width) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.31;
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / (r.width * 0.9));
    svg.style.setProperty("--lx", (dx / d * 2.4 * reach).toFixed(2));
    svg.style.setProperty("--ly", (dy / d * 2.2 * reach).toFixed(2));
    svg.style.setProperty("--hr", (Math.max(-1, Math.min(1, dx / (r.width * 3))) * 7).toFixed(1));
    clearTimeout(lookTimers.get(svg));
    lookTimers.set(svg, setTimeout(() => { ["--lx", "--ly", "--hr"].forEach(p => svg.style.removeProperty(p)); }, 1800));
  };
  mascot.lookAt = function (svg, target) {
    if (!target || !target.getBoundingClientRect) return;
    const r = target.getBoundingClientRect();
    mascot.look(svg, r.left + r.width / 2, r.top + r.height / 2);
  };
  function visibleMascots() {
    return [...document.querySelectorAll(".mascot")].filter(m => { const r = m.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight; });
  }
  function blink(svg) {
    if (svg.classList.contains("blinking")) return;
    svg.classList.add("blinking");
    setTimeout(() => svg.classList.remove("blinking"), 150);
  }
  /* Natural, irregular blinking (sometimes a double blink). */
  setInterval(() => {
    if (document.hidden) return;
    visibleMascots().forEach(m => {
      if (Math.random() < 0.13) { blink(m); if (Math.random() < 0.25) setTimeout(() => blink(m), 260); }
    });
  }, 700);

  /* Speaks while the mascot's beak moves. */
  function talk(m, text, opt) {
    if (m) m.classList.add("talking");
    const p = NS.voice.say(text, opt);
    const end = () => { if (m) m.classList.remove("talking"); };
    p.then(end, end);
    return p;
  }

  /* ---------------- Feel: tap sounds, squash & stretch, मिट्ठू's eyes ---------------- */
  const PRESSABLE = "button, [role=button], [role=radio], [role=switch], [role=tab], a[href], summary";
  let lastInteract = Date.now();
  function squash(t) {
    if (reduceMotion() || typeof t.animate !== "function") return;
    const r = t.getBoundingClientRect();
    const big = r.width * r.height > 70000;
    const sx = big ? 1.012 : 1.045, sy = big ? 0.975 : 0.91;
    let down;
    try { down = t.animate([{ scale: "1 1" }, { scale: sx + " " + sy }], { duration: 110, easing: "cubic-bezier(.3,.7,.4,1)", fill: "forwards" }); } catch (e) { return; }
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      window.removeEventListener("pointerup", release, true);
      window.removeEventListener("pointercancel", release, true);
      try {
        down.cancel();
        t.animate([
          { scale: sx + " " + sy },
          { scale: (1 - (sx - 1) * 0.7).toFixed(3) + " " + (1 + (1 - sy) * 0.55).toFixed(3), offset: 0.35 },
          { scale: (1 + (sx - 1) * 0.25).toFixed(3) + " " + (1 - (1 - sy) * 0.2).toFixed(3), offset: 0.68 },
          { scale: "1 1" },
        ], { duration: 430, easing: "ease-out" });
      } catch (e) {}
    };
    window.addEventListener("pointerup", release, true);
    window.addEventListener("pointercancel", release, true);
    setTimeout(release, 1500);
  }
  document.addEventListener("pointerdown", e => {
    lastInteract = Date.now();
    visibleMascots().forEach(m => mascot.look(m, e.clientX, e.clientY));
    const t = e.target && e.target.closest ? e.target.closest(PRESSABLE) : null;
    if (!t || t.disabled || t.getAttribute("aria-disabled") === "true") return;
    const kind = t.dataset.sfx || (t.classList.contains("tile") ? "pop" : "tap");
    if (kind !== "none") sfx(kind);
    squash(t);
  }, { capture: true, passive: true });
  /* Keyboard and switch-access presses get the same little sound. */
  document.addEventListener("click", e => {
    if (e.detail !== 0 || !e.isTrusted) return;
    const t = e.target && e.target.closest ? e.target.closest(PRESSABLE) : null;
    if (t && !t.disabled && t.dataset.sfx !== "none") sfx(t.dataset.sfx || "tap");
  }, true);
  document.addEventListener("keydown", () => { lastInteract = Date.now(); }, true);

  /* ---------------- Activities ---------------- */
  const billing = () => NS.billing;
  function makeCtx(def, screen, life) {
    const live = fn => (...a) => (life.alive ? fn(...a) : Promise.resolve(null));
    return {
      screen,
      get lang() { return NS.lang(); },
      t: obj => NS.t(obj),
      say: live((text, lang) => NS.voice.say(text, { lang: lang || NS.lang() })),
      sayLines: live((lines, lang) => NS.voice.sayLines(lines, lang || NS.lang())),
      stopVoice: () => NS.voice.stop(),
      listen: live(opt => NS.voice.listen(opt || {})),
      get profile() {
        const p = NS.store.current() || {};
        return Object.freeze({ id: p.id, name: p.name || "", avatar: p.avatar, ageBand: p.ageBand, voice: p.voice, lang: p.lang });
      },
      data: NS.store.activityData(def.id),
      reward: r => { if (life.alive) NS.rewards.grant(r, def.id); },
      daypart: () => NS.daypart(),
      minutesToday,
      habitsToday: () => { const c = NS.store.core(); return c ? Object.keys((c.get("habits", {}) || {})[NS.dayKey()] || {}) : []; },
      canListen: () => NS.voice.canListen(),
      home: () => NS.home(),
      open: id => NS.open(id),
      el: NS.el,
      button: NS.button,
      isLocked: false,
    };
  }
  function openActivity(id) {
    const def = NS.activity(id);
    if (!def) { goHome(); return; }
    if (!NS.store.current()) { onboarding(); return; }
    if (billing().isLocked(def)) { leaveScreen(); billing().askGrownUp(); return; }
    leaveScreen();
    setState("activity", null);
    currentActivity = def;
    setTop(NS.t(def.title), true, def.icon);
    app.style.setProperty("--act", def.color);
    const screen = fresh("act act-" + def.id);
    screen.lang = NS.langTag(NS.lang());
    const life = { alive: true };
    ctxAlive = life;
    countOpen(def.id);
    sfx("whoosh");
    try {
      const r = def.open(makeCtx(def, screen, life));
      if (typeof r === "function") cleanup = r;
    } catch (e) {
      console.error("activity " + id, e);
      screen.replaceChildren(el("p", "oops", NS.tr("oops")), NS.button("🏠 " + NS.tr("home"), "big primary", goHome));
    }
  }

  /* ---------------- Home: the living sky ---------------- */
  // Section pictures differ from every tile's own icon (🎈 is "ध्यान", 🔭 is "जादुई खिड़की").
  const SECTION_INFO = { learn: ["📚", "secLearn"], grow: ["🌱", "secGrow"], play: ["🪁", "secPlay"], future: ["💡", "secFuture"] };
  let greeted = false;
  let homeGen = 0;
  let lastSuggest = 0;

  function skyPosition(now) {
    const h = now.getHours() + now.getMinutes() / 60;
    // The sun travels 5:00 → 19:00, the moon 19:00 → 5:00, along the same gentle arc.
    const f = h >= 5 && h < 19 ? (h - 5) / 14 : ((h < 5 ? h + 24 : h) - 19) / 10;
    return { x: 8 + 84 * f, y: 54 - 26 * Math.sin(Math.PI * f) };
  }
  const deco = (cls, text) => { const d = el("div", cls, text); d.setAttribute("aria-hidden", "true"); return d; };
  function buildSky(profile) {
    const now = new Date(NS.now());
    const dp = NS.daypart(now);
    const sky = el("section", "sky sky-" + dp);
    sky.setAttribute("aria-label", NS.tr(dp));
    // Parallax layers: far (sun/moon, stars, small clouds) → mid (clouds, far hills) → near (hills).
    const far = deco("layer l-far"), mid = deco("layer l-mid"), near = deco("layer l-near");
    const pos = skyPosition(now);
    const orb = el("div", dp === "night" ? "moon" : "sun");
    orb.style.setProperty("--x", pos.x.toFixed(1) + "%");
    orb.style.setProperty("--y", pos.y.toFixed(1) + "%");
    far.appendChild(orb);
    if (dp === "night" || dp === "evening") {
      const stars = el("div", "stars");
      const n = dp === "night" ? 26 : 8;
      for (let i = 0; i < n; i++) {
        const st = el("i");
        st.style.setProperty("--x", ((i * 37.7) % 100).toFixed(1) + "%");
        st.style.setProperty("--y", ((i * 23.3) % 62).toFixed(1) + "%");
        st.style.setProperty("--d", (i % 7) * 0.4 + "s");
        stars.appendChild(st);
      }
      far.appendChild(stars);
    }
    if (dp !== "night") {
      far.append(el("div", "cloud c3"), el("div", "cloud c4"));
      mid.append(el("div", "cloud c1"), el("div", "cloud c2"));
    }
    mid.appendChild(el("div", "hills far-hills"));
    near.appendChild(el("div", "hills"));
    sky.append(far, mid, near);

    // Top row: the child's avatar (opens the sticker book), sound, grown-ups.
    const top = el("div", "skytop");
    const me = NS.button("", "me", () => stickerBook(), NS.tr("stickerBook"));
    const count = NS.rewards.list().length;
    const av = NS.picture(profile.avatar, { cls: "me-av", size: 96, eager: true });
    me.append(av, el("span", "me-name", profile.name || NS.tr("friend")));
    const badge = el("span", "me-stk", "⭐ " + count);
    me.append(badge);
    const snd = soundToggle("roundbtn sky-btn");
    const gear = NS.button("⚙️", "roundbtn sky-btn", () => billing().gate(parents), NS.tr("grownups"));
    gear.dataset.sfx = "open";
    top.append(me, el("span", "grow1"), snd, gear);
    sky.appendChild(top);

    // Greeting (a speech bubble from Mitthu) + Mitthu.
    const greet = el("div", "greet");
    const name = profile.name ? ", " + profile.name : "";
    const key = { morning: "greetMorning", noon: "greetNoon", evening: "greetEvening", night: "greetNight" }[dp];
    const line = NS.tr(key, { name });
    const h = el("h1", "greet-big", NS.tr(dp) + (profile.name ? ", " + profile.name : "") + "!");
    h.lang = NS.langTag(NS.lang());
    const sub = el("p", "greet-sub", line.replace(/^[^!]*!\s*/, ""));
    sub.lang = h.lang;
    greet.append(h, sub);
    const m = mascot(dp === "night" ? "sleepy" : "idle", "mascot-home");
    m.setAttribute("preserveAspectRatio", "xMidYMax meet");
    const mb = NS.button("", "mascot-btn", () => {
      mascot.react(m, dp === "night" ? "wiggle" : "hop");
      sub.classList.remove("say"); void sub.offsetWidth; sub.classList.add("say");
      talk(m, line);
    }, NS.tr("mascotName"));
    mb.dataset.sfx = "pop";
    mb.appendChild(m);
    sky.append(greet, mb);
    return { sky, m, say: () => talk(m, line) };
  }

  function soundToggle(cls) {
    const on = NS.store.settings().sound;
    const b = NS.button(on ? "🔊" : "🔇", cls, () => {
      const now = !NS.store.settings().sound;
      NS.store.setSetting("sound", now);
      if (!now) NS.voice.stop();
      b.textContent = now ? "🔊" : "🔇";
      b.setAttribute("aria-pressed", String(now));
      soundBtn.textContent = b.textContent;
      soundBtn.setAttribute("aria-pressed", String(now));
      if (now) sfx("pop");
    }, NS.tr("sound"));
    b.setAttribute("aria-pressed", String(on));
    return b;
  }

  function tile(def, extraCls) {
    const locked = billing().isLocked(def);
    const title = NS.t(def.title);
    const b = NS.button("", "tile" + (locked ? " locked" : "") + (extraCls ? " " + extraCls : ""), () => {
      if (billing().isLocked(def)) { leaveScreen(); billing().askGrownUp(); return; }
      const p = NS.voice.say(title);
      openActivity(def.id);
      return p;
    }, title + (locked ? " · " + NS.tr("locked") : ""));
    b.style.setProperty("--c", def.color || "#7E57C2");
    b.dataset.id = def.id;
    const ic = el("span", "ic");
    ic.appendChild(NS.picture(def.icon, { alt: title, size: 192 }));
    ic.setAttribute("aria-hidden", "true");
    const lb = el("span", "lb", title);
    lb.lang = NS.langTag(NS.lang());
    b.append(ic, lb);
    if (locked) { const l = el("span", "lock", "🔒"); l.setAttribute("aria-hidden", "true"); b.appendChild(l); }
    return b;
  }

  function goHome() {
    const profile = NS.store.current();
    if (!profile) { onboarding(); return; }
    const wasAway = state !== "home" && state !== "boot";
    leaveScreen();
    if (pushed) { pushed = false; try { history.back(); } catch (e) {} }
    setState("home", goHome);
    app.classList.add("on-home");
    app.style.removeProperty("--act");
    setTop(NS.tr("appName"), false);
    updateDaypart();
    const wrap = fresh("home");
    const { sky, m, say } = buildSky(profile);
    wrap.appendChild(sky);
    if (wasAway && state === "home") sfx("close");

    const acts = NS.activities().filter(a => !a.hidden);
    const dp = NS.daypart();
    const content = el("div", "home-content");
    const sleep = NS.activity("sleep");
    if (dp === "night" && sleep) {
      const hero = NS.button("", "bedtime", () => { NS.voice.say(NS.tr("bedtime")); openActivity("sleep"); }, NS.tr("bedtime"));
      const moon = NS.picture("🌙", { cls: "bt-ic", size: 192, eager: true }); moon.setAttribute("aria-hidden", "true");
      const txt = el("span", "bt-txt");
      txt.append(el("span", "bt-title", NS.tr("bedtime")), el("span", "bt-sub", NS.tr("bedtimeSub")));
      const zz = el("span", "bt-z", "💤"); zz.setAttribute("aria-hidden", "true");
      hero.append(moon, txt, zz);
      content.appendChild(hero);
    }
    let n = 0;
    NS.SECTIONS.forEach(sec => {
      const list = acts.filter(a => a.section === sec);
      if (!list.length) return;
      const section = el("section", "sect sect-" + sec);
      const head = el("h2", "sect-h");
      const [icon, key] = SECTION_INFO[sec] || ["⭐", "secPlay"];
      const hi = el("span", "sect-ic"); hi.setAttribute("aria-hidden", "true");
      hi.appendChild(NS.picture(icon, { size: 96, eager: true }));
      head.append(hi, el("span", "sect-t", NS.tr(key)));
      head.lang = NS.langTag(NS.lang());
      section.setAttribute("aria-label", NS.tr(key));
      const grid = el("div", "grid");
      list.forEach(a => { const t = tile(a); t.style.setProperty("--i", String(Math.min(n++, 14))); grid.appendChild(t); });
      section.append(head, grid);
      content.appendChild(section);
    });
    const banner = billing().statusBanner();
    if (banner) content.appendChild(banner);
    if (installAvailable() && !NS.store.settings().installHide) content.appendChild(installCard("home"));
    wrap.appendChild(content);
    if (!greeted) { greeted = true; setTimeout(() => { if (state === "home") say(); }, 350); }
    scheduleSuggest(m, homeGen);
    onScroll();
  }

  /* When the child is idle on home, मिट्ठू looks at one tile and suggests it while it wiggles. */
  function scheduleSuggest(m, myGen) {
    const wait = 9000;
    const tick = () => {
      if (myGen !== homeGen || state !== "home") return;
      if (Date.now() - lastSuggest < 180000 || NS.daypart() === "night") return;
      if (document.hidden || NS.voice.speaking() || Date.now() - lastInteract < wait - 200 || document.querySelector(".celebrate")) { setTimeout(tick, 2500); return; }
      const tiles = [...document.querySelectorAll(".home .tile:not(.locked)")].filter(t => {
        const r = t.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0;
      });
      if (!tiles.length) return;
      const core = NS.store.core();
      const opened = core ? ((core.get("opens", {}) || {})[NS.dayKey()] || {}) : {};
      const fresh_ = tiles.filter(t => !opened[t.dataset.id]);
      const pool = fresh_.length ? fresh_ : tiles;
      const t = pool[Math.floor(Math.random() * pool.length)];
      const def = NS.activity(t.dataset.id);
      if (!def) return;
      lastSuggest = Date.now();
      const lines = NS.strings.suggest;
      const line = NS.t(lines[Math.floor(Math.random() * lines.length)]).split("{name}").join(NS.t(def.title));
      mascot.lookAt(m, t);
      mascot.react(m, "nod");
      t.classList.add("wiggle");
      const stop = () => { t.classList.remove("wiggle"); };
      talk(m, line).then(stop, stop);
      setTimeout(stop, 6000);
    };
    setTimeout(tick, wait);
  }

  /* Parallax: as home scrolls, the sky's layers move at different speeds. */
  let scrollRaf = 0;
  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      const h = body.querySelector(".home");
      if (h) h.style.setProperty("--sy", String(Math.min(400, Math.round(body.scrollTop))));
    });
  }
  body.addEventListener("scroll", onScroll, { passive: true });

  /* ---------------- First run: make a profile (voice + taps; a grown-up may type a name) -------- */
  function onboarding() {
    leaveScreen();
    setState("onboard", null);
    setTop("", false);
    const hadProfiles = NS.store.profiles().length > 0;
    let L = NS.lang();
    const draft = { avatar: null, name: "", ageBand: null, voice: null, lang: L };
    const T = (k, v) => NS.tr(k, v, L);
    const wrap = fresh("onboard");
    wrap.append(deco("cloud c1"), deco("cloud c2"));
    const m = mascot("idle", "mascot-ob");
    const bubble = el("p", "ob-bubble");
    bubble.setAttribute("aria-live", "polite");
    const stage = el("div", "ob-stage");
    const dots = el("div", "ob-dots");
    dots.setAttribute("aria-hidden", "true");
    const steps = [welcome, avatar, nameStep, age, voice, language];
    for (let i = 0; i < steps.length; i++) dots.appendChild(el("i"));
    const top = el("div", "ob-top");
    if (hadProfiles) top.appendChild(NS.button("✕", "roundbtn ob-close", () => picker(), NS.tr("back")));
    const hero = el("div", "ob-hero");
    hero.append(m, bubble);
    wrap.append(top, hero, stage, dots);
    let step = 0;
    function go(i) {
      step = i;
      [...dots.children].forEach((d, j) => d.classList.toggle("on", j <= i));
      stage.replaceChildren();
      stage.classList.remove("in"); void stage.offsetWidth; stage.classList.add("in");
      if (i > 0) sfx("whoosh");
      steps[i]();
    }
    function prompt(key, gender) {
      bubble.textContent = T(key);
      bubble.lang = NS.langTag(L);
      bubble.classList.remove("say"); void bubble.offsetWidth; bubble.classList.add("say");
      return talk(m, T(key), { lang: L, gender: gender || draft.voice || "female" });
    }
    function choice(label, cls, onPick, aria) {
      return NS.button(label, "choice " + (cls || ""), onPick, aria);
    }
    function pickIn(group, b) {
      [...group.children].forEach(c => c.setAttribute("aria-checked", String(c === b)));
      mascot.react(m, "nod");
    }
    function welcome() {
      prompt("hello");
      const b = NS.button("▶  " + T("letsGo"), "big primary", () => go(1));
      b.id = "obStart";
      stage.appendChild(b);
    }
    function avatar() {
      prompt("pickAvatar");
      const grid = el("div", "ob-avatars");
      grid.setAttribute("role", "radiogroup");
      grid.setAttribute("aria-label", T("pickAvatar"));
      NS.store.AVATARS.forEach(a => {
        const b = choice("", "av", () => {
          draft.avatar = a;
          pickIn(grid, b);
          b.classList.add("pop");
          mascot.react(m, "hop");
          setTimeout(() => { go(2); }, 650);
        }, a);
        b.appendChild(NS.picture(a, { size: 96, eager: true }));
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        b.dataset.sfx = "pop";
        grid.appendChild(b);
      });
      stage.appendChild(grid);
    }
    function nameStep() {
      prompt("askName");
      const row = el("div", "ob-name");
      const av = NS.picture(draft.avatar || NS.store.AVATARS[0], { cls: "ob-av", size: 96, eager: true }); av.setAttribute("aria-hidden", "true");
      const input = document.createElement("input");
      input.type = "text"; input.id = "obName"; input.className = "pin"; input.maxLength = 24;
      input.autocomplete = "off"; input.spellcheck = false; input.placeholder = T("namePlaceholder");
      input.setAttribute("aria-label", T("namePlaceholder")); input.setAttribute("enterkeyhint", "next");
      input.value = draft.name;
      row.append(av, input);
      const next = () => { draft.name = input.value.trim(); go(3); };
      input.addEventListener("keydown", e => { if (e.key === "Enter") next(); });
      const btns = el("div", "row2");
      btns.append(NS.button(T("skip"), "big secondary", () => { draft.name = ""; go(3); }), NS.button(T("next") + "  ▶", "big primary", next));
      stage.append(row, btns);
    }
    function age() {
      prompt("askAge");
      const g = el("div", "ob-choices three");
      [["🐣", "2-3", "age23"], ["🐥", "4-5", "age45"], ["🦅", "6+", "age6"]].forEach(([e, band, key]) => {
        const b = choice("", "ocard", () => { draft.ageBand = band; pickIn(g, b); setTimeout(() => go(4), 260); }, T(key));
        b.append(NS.picture(e, { cls: "ch-ic", size: 96, eager: true }), el("span", "ch-lb", T(key)));
        b.dataset.age = band;
        b.setAttribute("aria-checked", "false");
        g.appendChild(b);
      });
      stage.appendChild(g);
    }
    function voice() {
      prompt("askVoice");
      const g = el("div", "ob-choices two");
      const nextBtn = NS.button("✓  " + T("next"), "big primary", () => go(5));
      nextBtn.hidden = true;
      [["👩", "female", "didi", "sampleFemale"], ["👨", "male", "bhaiya", "sampleMale"]].forEach(([e, gender, key, sample]) => {
        const b = choice("", "ocard", () => {
          draft.voice = gender;
          pickIn(g, b);
          nextBtn.hidden = false;
          talk(m, T(sample), { lang: L, gender });
        }, T(key));
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        b.dataset.voice = gender;
        b.append(NS.picture(e, { cls: "ch-ic", size: 96, eager: true }), el("span", "ch-lb", T(key) + "  🔊"));
        g.appendChild(b);
      });
      g.setAttribute("role", "radiogroup");
      stage.append(g, nextBtn);
    }
    function language() {
      prompt("askLang");
      const g = el("div", "ob-choices three");
      const done = NS.button("✓  " + T("letsGo"), "big primary", finish);
      done.id = "obDone";
      done.hidden = true;
      [["hi", "हिंदी", "🇮🇳", "नमस्ते! हम हिंदी में बात करेंगे।"], ["en", "English", "🔤", "Hello! We will talk in English."], ["hinglish", "Hinglish", "💬", "Hello dost! Hum Hinglish mein baat karenge."]].forEach(([code, label, e, hello]) => {
        const b = choice("", "ocard", () => {
          draft.lang = L = code;
          pickIn(g, b);
          done.hidden = false;
          done.textContent = "✓  " + T("letsGo");
          talk(m, hello, { lang: code, gender: draft.voice || "female" });
        }, label);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        b.dataset.lang = code;
        const lb = el("span", "ch-lb", label); lb.lang = NS.langTag(code);
        b.append(NS.picture(e, { cls: "ch-ic", size: 96, eager: true }), lb);
        g.appendChild(b);
      });
      g.setAttribute("role", "radiogroup");
      stage.append(g, done);
    }
    function finish() {
      NS.store.addProfile({ name: draft.name, avatar: draft.avatar || NS.store.AVATARS[0], ageBand: draft.ageBand || "4-5", voice: draft.voice || "female", lang: draft.lang });
      resetSession();
      greeted = true;
      goHome();
      NS.rewards.celebrate(draft.avatar || "🎉", T("ready"));
    }
    go(0);
  }

  /* ---------------- "कौन खेल रहा है?" ---------------- */
  function picker() {
    const list = NS.store.profiles();
    if (!list.length) { onboarding(); return; }
    leaveScreen();
    setState("picker", picker);
    setTop("", false);
    const wrap = fresh("picker");
    wrap.append(deco("cloud c1"), deco("cloud c2"));
    const m = mascot("happy", "mascot-pick");
    const h = el("h1", "pick-h", NS.tr("whoPlays"));
    const grid = el("div", "pick-grid");
    list.forEach((p, i) => {
      const b = NS.button("", "pick-card", () => {
        NS.store.setCurrent(p.id);
        resetSession();
        greeted = false;
        goHome();
      }, p.name || NS.tr("friend"));
      b.style.setProperty("--i", String(i));
      b.append(NS.picture(p.avatar, { cls: "pick-av", size: 192, eager: true }), el("span", "pick-name", p.name || NS.tr("friend")));
      b.dataset.pid = p.id;
      b.dataset.sfx = "pop";
      grid.appendChild(b);
    });
    const add = NS.button("", "pick-card add", () => onboarding(), NS.tr("addChild"));
    add.append(deco("pick-av pick-plus"), el("span", "pick-name", NS.tr("addChild")));
    grid.appendChild(add);
    wrap.append(m, h, grid);
    talk(m, NS.tr("whoPlays"));
  }

  /* ---------------- Sticker book ---------------- */
  function stickerBook() {
    const p = NS.store.current();
    if (!p) return onboarding();
    leaveScreen();
    setState("core", stickerBook);
    app.classList.remove("on-home");
    app.style.setProperty("--act", "#FF9F45");
    setTop(NS.tr("stickerBook"), true, "📒");
    const wrap = fresh("book");
    const all = NS.rewards.list();
    const head = el("div", "book-head");
    const av = NS.picture(p.avatar, { cls: "book-av", size: 192, eager: true }); av.setAttribute("aria-hidden", "true");
    const m = mascot(all.length ? "happy" : "idle", "mascot-sm");
    const msg = all.length ? NS.tr("stickerCount", { n: all.length }) : NS.tr("stickerEmpty");
    const t = el("p", "book-msg", msg);
    head.append(av, t, m);
    wrap.appendChild(head);
    const page = el("div", "book-page");
    if (all.length) {
      const counts = new Map();
      all.slice().reverse().forEach(x => counts.set(x.s, (counts.get(x.s) || 0) + 1));
      let i = 0;
      counts.forEach((n, s) => {
        const c = el("div", "stk");
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", s + (n > 1 ? " × " + n : ""));
        c.style.setProperty("--i", String(Math.min(i++, 20)));
        c.appendChild(NS.picture(s, { cls: "stk-e", size: 192 }));
        if (n > 1) c.appendChild(el("span", "stk-n", "×" + n));
        page.appendChild(c);
      });
    } else {
      for (let i = 0; i < 8; i++) page.appendChild(el("div", "stk empty"));
    }
    wrap.appendChild(page);
    const row = el("div", "row2");
    row.append(NS.button("👫  " + NS.tr("switchPlayer"), "big secondary", picker), NS.button("🏠  " + NS.tr("home"), "big primary", goHome));
    wrap.appendChild(row);
    talk(m, msg);
  }

  /* ---------------- Session: usage, gentle wind-down ---------------- */
  const TICK = 5000;
  let sess = { ms: 0, last: NS.now() };
  function loadSession() {
    try {
      const s = JSON.parse(NS.store.raw.get("ns_session") || "null");
      if (s && NS.now() - s.at < 10 * 60000 && s.pid === (NS.store.current() || {}).id) { sess.ms = s.ms || 0; return !!s.rest; }
    } catch (e) {}
    return false;
  }
  function saveSession(rest) {
    const p = NS.store.current();
    NS.store.raw.set("ns_session", JSON.stringify({ ms: Math.round(sess.ms), at: NS.now(), pid: p ? p.id : null, rest: !!rest }));
  }
  function resetSession() { sess.ms = 0; sess.last = NS.now(); saveSession(false); }
  function addUsage(ms) {
    const core = NS.store.core();
    if (!core) return;
    const u = core.get("usage", {});
    const k = NS.dayKey();
    u[k] = Math.round((u[k] || 0) + ms / 1000);
    const keys = Object.keys(u).sort();
    while (keys.length > 60) delete u[keys.shift()];
    core.set("usage", u);
  }
  function minutesToday() {
    const core = NS.store.core();
    if (!core) return 0;
    return Math.floor((core.get("usage", {})[NS.dayKey()] || 0) / 60);
  }
  function countOpen(id) {
    const core = NS.store.core();
    if (!core) return;
    const o = core.get("opens", {});
    const k = NS.dayKey();
    o[k] = o[k] || {};
    o[k][id] = (o[k][id] || 0) + 1;
    const keys = Object.keys(o).sort();
    while (keys.length > 60) delete o[keys.shift()];
    core.set("opens", o);
  }
  NS.on("habit:done", ev => {
    const core = NS.store.core();
    if (!core || !ev || !ev.habit) return;
    const h = core.get("habits", {});
    const k = NS.dayKey();
    h[k] = h[k] || {};
    const name = String(ev.habit).slice(0, 20);
    h[k][name] = (h[k][name] || 0) + 1;
    const keys = Object.keys(h).sort();
    while (keys.length > 60) delete h[keys.shift()];
    core.set("habits", h);
  });

  function tick() {
    const now = NS.now();
    let dt = now - sess.last;
    sess.last = now;
    if (document.hidden || !NS.store.current()) return;
    if (!["home", "activity", "core"].includes(state)) return;
    if (dt < 0 || dt > 60000) dt = 0;          // the device slept or the clock jumped
    sess.ms += dt;
    addUsage(dt);
    saveSession(false);
    if (sess.ms >= NS.store.settings().sessionMin * 60000) windDown();
  }
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { hiddenAt = NS.now(); return; }
    sess.last = NS.now();
    if (hiddenAt && NS.now() - hiddenAt > 10 * 60000 && state !== "rest") sess.ms = 0;   // a real break happened
    if (billing()) billing().refresh().then(changed => { if (changed && state === "home") goHome(); });
  });

  const IDEAS = [
    { e: "💧", hi: "एक गिलास पानी पियो!", en: "drink a glass of water!", hinglish: "ek glass paani piyo!" },
    { e: "⚽", hi: "बाहर जाकर गेंद से खेलो!", en: "go outside and play with a ball!", hinglish: "bahar jaakar ball se khelo!" },
    { e: "🤗", hi: "मम्मी-पापा को कसकर गले लगाओ!", en: "give Mummy and Papa a big hug!", hinglish: "Mummy-Papa ko tight hug karo!" },
    { e: "🖍️", hi: "कागज़ पर एक सुंदर चित्र बनाओ!", en: "draw a lovely picture on paper!", hinglish: "paper pe ek sundar drawing banao!" },
    { e: "🐸", hi: "मेंढक की तरह पाँच बार कूदो!", en: "jump five times like a frog!", hinglish: "frog ki tarah paanch baar kudo!" },
    { e: "🧸", hi: "अपने खिलौने समेटकर रखो!", en: "put your toys away neatly!", hinglish: "apne toys sametkar rakho!" },
    { e: "🌳", hi: "खिड़की से बाहर देखो — कितने पेड़ दिखते हैं?", en: "look out of the window — how many trees can you see?", hinglish: "window se bahar dekho — kitne trees dikhte hain?" },
  ];
  const NIGHT_IDEA = { e: "🪥", hi: "दाँत ब्रश करो और बिस्तर पर चलो!", en: "brush your teeth and go to bed!", hinglish: "daant brush karo aur bed pe chalo!" };

  function windDown() {
    if (state === "rest") return;
    saveSession(true);
    NS.emit("session:wind-down", { minutes: Math.round(sess.ms / 60000) });
    leaveScreen();
    setState("rest", windDown);
    setTop(NS.tr("restTitle"), false);
    const wrap = fresh("rest");
    wrap.append(deco("cloud c1"), deco("cloud c2"));
    const night = NS.daypart() === "night";
    const idea = night ? NIGHT_IDEA : IDEAS[Math.floor(NS.now() / 60000) % IDEAS.length];
    const m = mascot(night ? "sleepy" : "caring", "mascot-rest");
    const h = el("h1", "rest-h", NS.tr("restTitle"));
    const card = el("div", "idea");
    card.append(NS.picture(idea.e, { cls: "idea-e", size: 192, eager: true }), el("span", "idea-t", NS.t(idea)));
    const more = NS.button(NS.tr("restMore"), "plink rest-more", () => billing().gate(() => { resetSession(); goHome(); }));
    wrap.append(m, h, card, more);
    talk(m, NS.tr("restSay", { idea: NS.t(idea) }));
  }

  /* ---------------- Install (grown-ups only; never inside the Android shell or once installed) --- */
  let deferredInstall = null;
  const standalone = () => {
    try { return matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true; } catch (e) { return false; }
  };
  const inShell = () => !!(NS.native.available || window.NanhaNative);
  function installAvailable() { return !!deferredInstall && !inShell() && !standalone(); }
  /* iPhone/iPad Safari has no install prompt: grown-ups get the steps instead. */
  const iosNeedsSteps = () => !inShell() && !standalone() && /iP(hone|ad|od)/.test(navigator.userAgent || "") && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent || "");
  async function promptInstall() {
    const e = deferredInstall;
    if (!e) return false;
    deferredInstall = null;
    try { e.prompt(); await e.userChoice; } catch (x) {}
    refreshInstall();
    return true;
  }
  function installCard(where) {
    const c = el("div", "install-card install-" + where);
    c.setAttribute("role", "group");
    c.setAttribute("aria-label", NS.tr("install"));
    const ic = NS.picture("📲", { cls: "install-ic", size: 96 }); ic.setAttribute("aria-hidden", "true");
    const txt = el("p", "install-t", NS.tr("installCard"));
    const go = NS.button(NS.tr("install"), "pbtn small install-go", () => {
      if (where === "home") billing().gate(() => { promptInstall(); goHome(); });
      else promptInstall();
    });
    c.append(ic, txt, go);
    if (where === "home") {
      const x = NS.button("✕", "roundbtn install-x", () => { NS.store.setSetting("installHide", true); c.remove(); }, NS.tr("notNow"));
      x.dataset.sfx = "close";
      c.appendChild(x);
    }
    return c;
  }
  function refreshInstall() {
    document.querySelectorAll(".install-card").forEach(c => c.remove());
    if (!installAvailable()) return;
    const homeContent = state === "home" ? body.querySelector(".home-content") : null;
    if (homeContent && !NS.store.settings().installHide) homeContent.appendChild(installCard("home"));
    const slot = state === "grownup" ? $("installSlot") : null;
    if (slot) slot.replaceChildren(installCard("parents"));
  }

  /* ---------------- Grown-ups' area ---------------- */
  const G = o => NS.t(o, NS.lang() === "en" ? "en" : "hi");
  function seg(options, value, onChange, label, id) {
    const g = el("div", "seg");
    if (id) g.id = id;
    g.setAttribute("role", "radiogroup");
    if (label) g.setAttribute("aria-label", label);
    options.forEach(([v, text]) => {
      const b = NS.button(text, "seg-b", () => {
        [...g.children].forEach(c => c.setAttribute("aria-checked", String(c === b)));
        onChange(v);
      });
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(v === value));
      b.dataset.v = String(v);
      g.appendChild(b);
    });
    return g;
  }
  function card(title, icon) {
    const c = el("section", "pcard");
    const h = el("h3", "pcard-h");
    const i = el("span", "pcard-ic", icon); i.setAttribute("aria-hidden", "true");
    h.append(i, el("span", null, title));
    c.appendChild(h);
    return c;
  }
  /* An on/off switch with its state written next to it. */
  function switchRow(id, label, on, set) {
    const onT = G({ hi: "चालू", en: "On" }), offT = G({ hi: "बंद", en: "Off" });
    const st = el("span", "switch-state", on ? onT : offT);
    const sw = NS.button("", "switch", () => {
      const now = sw.getAttribute("aria-checked") !== "true";
      sw.setAttribute("aria-checked", String(now));
      st.textContent = now ? onT : offT;
      set(now);
    }, label);
    sw.id = id;
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(on));
    const row = el("div", "row-inline");
    row.append(sw, st);
    return row;
  }
  const HABITS = { brush: "🪥", bath: "🛁", eat: "🍽️", play: "⚽", read: "📖", sleep: "😴", water: "💧", help: "🤝" };

  function parents(focusPid) {
    const box = panel(G({ hi: "बड़ों के लिए", en: "For grown-ups" }));
    setState("grownup", () => parents(focusPid));
    setTop(G({ hi: "बड़ों के लिए", en: "For grown-ups" }), true, "👨‍👩‍👧");
    box.classList.add("parents");
    const profiles = NS.store.profiles();
    const cur = NS.store.current();
    const s = NS.store.settings();
    box.appendChild(el("p", "psmall", G({ hi: "यहाँ की हर जानकारी सिर्फ़ इसी फ़ोन पर रहती है — कुछ भी कहीं भेजा नहीं जाता।", en: "Everything here stays on this phone — nothing is sent anywhere." })));

    // Summary
    if (cur) {
      const c = card(G({ hi: "आपके बच्चे ने क्या किया", en: "What your child did" }) + " — " + (cur.name || cur.avatar), "📊");
      c.id = "summary";
      const core = NS.store.core();
      const usage = core.get("usage", {}), habits = core.get("habits", {}), opens = core.get("opens", {});
      const days = [];
      for (let i = 6; i >= 0; i--) { const d = new Date(NS.now() - i * 86400000); days.push(d); }
      const mins = days.map(d => Math.round((usage[NS.dayKey(d)] || 0) / 60));
      const max = Math.max(s.sessionMin, ...mins);
      const chart = el("div", "bars" + (mins.every(x => x === 0) ? " quiet" : ""));
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", G({ hi: "इस हफ़्ते रोज़ के मिनट: ", en: "Minutes per day this week: " }) + mins.join(", "));
      days.forEach((d, i) => {
        const col = el("div", "bar" + (i === 6 ? " today" : ""));
        const fill = el("i");
        fill.style.setProperty("--h", Math.round((mins[i] / max) * 100) + "%");
        col.append(el("span", "bar-v", String(mins[i])), fill, el("span", "bar-d", d.toLocaleDateString(NS.lang() === "en" ? "en-IN" : "hi-IN", { weekday: "short" })));
        chart.appendChild(col);
      });
      const weekKeys = new Set(days.map(d => NS.dayKey(d)));
      const weekStart = days[0].setHours(0, 0, 0, 0);
      const stickers = NS.rewards.list().filter(x => x.t >= weekStart);
      const hab = {};
      Object.keys(habits).filter(k => weekKeys.has(k)).forEach(k => { for (const h in habits[k]) hab[h] = (hab[h] || 0) + habits[k][h]; });
      const act = {};
      Object.keys(opens).filter(k => weekKeys.has(k)).forEach(k => { for (const a in opens[k]) act[a] = (act[a] || 0) + opens[k][a]; });
      const top = Object.entries(act).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => { const d = NS.activity(id); return (d ? d.icon + " " + NS.t(d.title) : id) + " ×" + n; });
      const facts = el("ul", "facts");
      facts.append(
        el("li", null, G({ hi: "आज: ", en: "Today: " }) + minutesToday() + G({ hi: " मिनट", en: " min" })),
        el("li", null, G({ hi: "इस हफ़्ते स्टिकर: ", en: "Stickers this week: " }) + (stickers.length ? stickers.length + "  " + stickers.slice(-8).map(x => x.s).join(" ") : "—")),
        el("li", null, G({ hi: "बताई गई अच्छी आदतें: ", en: "Good habits reported: " }) + (Object.keys(hab).length ? Object.entries(hab).map(([h, n]) => (HABITS[h] || "✓") + " " + h + " ×" + n).join(" · ") : "—")),
        el("li", null, G({ hi: "सबसे ज़्यादा खोला: ", en: "Opened most: " }) + (top.length ? top.join(" · ") : "—")));
      c.append(chart, facts);
      box.appendChild(c);
    }

    // Children
    {
      const c = card(G({ hi: "बच्चे", en: "Children" }), "👧");
      c.id = "profilesCard";
      profiles.forEach(p => {
        const isCur = cur && p.id === cur.id;
        const row = el("div", "prow" + (isCur ? " cur" : ""));
        const who = el("span", "prow-who");
        who.append(NS.picture(p.avatar, { cls: "prow-av", size: 96 }), el("span", "prow-name", (p.name || NS.tr("friend")) + " · " + p.ageBand.replace("-", "–")));
        if (isCur) who.appendChild(el("span", "prow-now", "✓ " + G({ hi: "अभी", en: "Now" })));
        const acts = el("span", "prow-acts");
        if (!isCur) acts.appendChild(NS.button(G({ hi: "चुनें", en: "Select" }), "pbtn small secondary", () => { NS.store.setCurrent(p.id); resetSession(); parents(); }));
        acts.appendChild(NS.button(G({ hi: "बदलें", en: "Edit" }), "pbtn small secondary", () => editProfile(p.id)));
        row.append(who, acts);
        c.appendChild(row);
      });
      c.appendChild(NS.button("➕ " + G({ hi: "नया बच्चा जोड़ें", en: "Add a child" }), "pbtn secondary", onboarding));
      box.appendChild(c);
    }

    // Voice & language (current child)
    if (cur) {
      const c = card(G({ hi: "आवाज़ और भाषा", en: "Voice & language" }) + " — " + (cur.name || cur.avatar), "🗣️");
      c.id = "voiceCard";
      c.appendChild(el("p", "plabel", G({ hi: "आवाज़", en: "Voice" })));
      const vrow = el("div", "row-inline");
      vrow.append(seg([["female", "👩 दीदी"], ["male", "👨 भैया"]], cur.voice, v => { NS.store.updateProfile(cur.id, { voice: v }); parents(); preview(); }, G({ hi: "आवाज़", en: "Voice" }), "segVoice"),
        NS.button("🔊 सुनो", "pbtn small", () => preview(), G({ hi: "आवाज़ सुनो", en: "Hear the voice" })));
      c.appendChild(vrow);
      c.appendChild(el("p", "plabel", G({ hi: "बोलने की रफ़्तार", en: "Speaking speed" })));
      c.appendChild(seg([["slow", "🐢 धीमा"], ["normal", "🐇 सामान्य"]], s.speed, v => { NS.store.setSetting("speed", v); preview(); }, G({ hi: "रफ़्तार", en: "Speed" }), "segSpeed"));
      c.appendChild(el("p", "plabel", G({ hi: "भाषा", en: "Language" })));
      c.appendChild(seg([["hi", "हिंदी"], ["en", "English"], ["hinglish", "Hinglish"]], cur.lang, v => { NS.setLang(v); }, G({ hi: "भाषा", en: "Language" }), "segLang"));
      // Advanced: pick a specific installed voice.
      const vl = NS.speechLang(cur.lang);
      const voices = NS.voice.voiceList(vl);
      const det = el("details", "adv");
      det.appendChild(el("summary", null, G({ hi: "और आवाज़ें (एडवांस्ड)", en: "More voices (advanced)" })));
      const sel = document.createElement("select");
      sel.className = "pin"; sel.id = "voiceSelect";
      sel.setAttribute("aria-label", G({ hi: "आवाज़ चुनें", en: "Choose a voice" }));
      const auto = el("option", null, G({ hi: "अपने-आप (सबसे अच्छी)", en: "Automatic (best)" })); auto.value = "";
      sel.appendChild(auto);
      const key = vl + "|" + cur.voice;
      voices.forEach(v => {
        const o = el("option", null, v.label + (v.gender !== "unknown" ? (v.gender === "female" ? " · 👩" : " · 👨") : "") + (v.local ? " · " + G({ hi: "फ़ोन पर", en: "on device" }) : " · " + G({ hi: "ऑनलाइन", en: "online" })));
        o.value = v.id;
        sel.appendChild(o);
      });
      sel.value = s.voicePick[key] || "";
      sel.addEventListener("change", () => { const vp = NS.store.settings().voicePick; if (sel.value) vp[key] = sel.value; else delete vp[key]; NS.store.setSetting("voicePick", vp); preview(); });
      det.append(sel, el("p", "psmall", voices.length ? G({ hi: "“फ़ोन पर” वाली आवाज़ें इंटरनेट के बिना चलती हैं और कुछ बाहर नहीं भेजतीं।", en: "“On device” voices work offline and send nothing out." })
        : G({ hi: "इस ब्राउज़र में इस भाषा की कोई आवाज़ नहीं मिली। फ़ोन की सेटिंग में Text-to-speech की हिंदी आवाज़ इंस्टॉल करें।", en: "No voice for this language in this browser. Install a Hindi text-to-speech voice in the phone's settings." })));
      c.appendChild(det);
      box.appendChild(c);
    }

    // Sound effects
    {
      const c = card(G({ hi: "आवाज़ें (sound effects)", en: "Sound effects (आवाज़ें)" }), "🔔");
      c.id = "sfxCard";
      c.append(switchRow("sfxSwitch", G({ hi: "आवाज़ें", en: "Sound effects" }), s.sfx, on => { NS.store.setSetting("sfx", on); if (on) sfx("correct"); }),
        el("p", "psmall", G({ hi: "बटन दबाने, सही जवाब और स्टिकर पर छोटी, धीमी आवाज़ें (Android ऐप में हल्का कंपन भी)। रात में ये और धीमी हो जाती हैं। 🔊 बटन से सब कुछ चुप हो जाता है।", en: "Small, soft sounds for taps, right answers and stickers (and a light buzz in the Android app). Quieter at night. The 🔊 button mutes everything." })));
      box.appendChild(c);
    }

    // Time
    {
      const c = card(G({ hi: "समय", en: "Time" }), "⏰");
      c.appendChild(el("p", "plabel", G({ hi: "एक बार में कितनी देर (फिर ऐप आराम का सुझाव देगा)", en: "How long at a time (then the app suggests a break)" })));
      c.appendChild(seg([[10, "10"], [15, "15"], [20, "20"], [30, "30"]].map(([v, t]) => [v, t + G({ hi: " मिनट", en: " min" })]), s.sessionMin, v => NS.store.setSetting("sessionMin", v), G({ hi: "सत्र", en: "Session" }), "segSession"));
      c.appendChild(el("p", "plabel", G({ hi: "सोने का समय", en: "Bedtime" })));
      c.appendChild(seg([[19, "7 PM"], [20, "8 PM"], [21, "9 PM"], [22, "10 PM"]], s.bedtimeHour, v => NS.store.setSetting("bedtimeHour", v), G({ hi: "सोने का समय", en: "Bedtime" }), "segBedtime"));
      c.appendChild(el("p", "psmall", G({ hi: "बच्चे को कोई उलटी गिनती नहीं दिखती। समय पूरा होने पर ऐप प्यार से आराम या बाहर खेलने को कहता है, और आगे बढ़ने के लिए बड़ों से सवाल पूछता है।", en: "Your child never sees a countdown. When time is up, the app gently suggests a break or outdoor play, and asks a grown-up's question to continue." })));
      box.appendChild(c);
    }

    // AI conversation for मिट्ठू (js/core/ai.js): off until a grown-up consents; only when the app has a server.
    if (NS.ai && typeof NS.ai.configured === "function" && NS.ai.configured()) {
      try { box.appendChild(NS.ai.settingsCard()); } catch (e) { console.error("ai settings", e); }
    }

    // Microphone
    {
      const c = card(G({ hi: "माइक (बोलकर जवाब देना)", en: "Microphone (talking back)" }), "🎤");
      c.append(switchRow("micSwitch", G({ hi: "माइक", en: "Microphone" }), s.mic, on => NS.store.setSetting("mic", on)), el("p", "psmall", G({
        hi: "माइक शुरू में बंद रहता है। चालू करने पर बच्चा बोलकर जवाब दे सकता है। Android ऐप में आवाज़ फ़ोन पर ही पहचानी जाती है। कुछ ब्राउज़र (जैसे Chrome या Safari) बोली गई आवाज़ पहचानने के लिए उसे अपनी स्पीच सर्विस पर भेजते हैं — नन्हा स्कूल खुद कुछ नहीं भेजता या रखता।" + (NS.native.available || window.SpeechRecognition || window.webkitSpeechRecognition ? "" : " इस ब्राउज़र में बोलकर जवाब देना उपलब्ध नहीं है।"),
        en: "The mic is off at first. When on, your child can answer by speaking. In the Android app, speech is recognised on the phone. Some browsers (such as Chrome or Safari) send the spoken audio to their speech service to recognise it — Nanha School itself sends or keeps nothing." + (NS.native.available || window.SpeechRecognition || window.webkitSpeechRecognition ? "" : " Speaking answers is not available in this browser."),
      })));
      box.appendChild(c);
    }

    // Install (browsers only; never in the Android app or when already installed)
    if (!inShell() && !standalone() && (installAvailable() || iosNeedsSteps())) {
      const c = card(G({ hi: "ऐप फ़ोन पर रखें", en: "Keep the app on your phone" }), "📲");
      c.id = "installCardParents";
      const slot = el("div", "install-slot");
      slot.id = "installSlot";
      if (installAvailable()) slot.appendChild(installCard("parents"));
      else slot.appendChild(el("p", "psmall", G({ hi: "Safari में नीचे शेयर बटन (⬆️) दबाएँ, फिर “Add to Home Screen” चुनें।", en: "In Safari, tap the Share button (⬆️), then “Add to Home Screen”." })));
      c.appendChild(slot);
      box.appendChild(c);
    }

    // Subscription
    {
      const c = card(G({ hi: "सदस्यता", en: "Subscription" }), "⭐");
      const b = billing();
      if (!b.PAYMENTS_ON) c.appendChild(el("p", "psmall", G({ hi: "अभी पूरा ऐप मुफ़्त है।", en: "The whole app is free right now." })));
      else {
        c.appendChild(el("p", "psmall", b.subscribed() ? G({ hi: "प्रीमियम चालू है।", en: "Premium is on." })
          : b.trialDaysLeft() > 0 ? G({ hi: `मुफ़्त ट्रायल: ${b.trialDaysLeft()} दिन बाकी।`, en: `Free trial: ${b.trialDaysLeft()} days left.` }) : G({ hi: "मुफ़्त ट्रायल पूरा हो गया।", en: "The free trial is over." })));
        c.appendChild(NS.button(b.subscribed() ? G({ hi: "सदस्यता देखें", en: "View subscription" }) : G({ hi: "पूरा ऐप खोलें", en: "Open the full app" }), "pbtn", b.paywall));
      }
      box.appendChild(c);
    }

    // Data
    {
      const c = card(G({ hi: "डेटा", en: "Data" }), "🗑️");
      c.appendChild(el("p", "psmall", G({ hi: "बच्चों के नाम, स्टिकर और प्रगति सिर्फ़ इसी डिवाइस पर रहते हैं। यहाँ से आप उन्हें हमेशा के लिए मिटा सकते हैं।", en: "Children's names, stickers and progress live only on this device. You can erase them here for good." })));
      const msg = el("p", "pmsg", "");
      if (cur) c.appendChild(confirmButton(G({ hi: "इस बच्चे का डेटा मिटाएँ", en: "Delete this child's data" }) + " (" + (cur.name || cur.avatar) + ")", "delProfile", () => {
        NS.store.deleteProfile(cur.id);
        resetSession();
        if (NS.store.profiles().length) parents(); else onboarding();
      }));
      c.appendChild(confirmButton(G({ hi: "सारा डेटा मिटाएँ (सब बच्चे और सेटिंग)", en: "Delete all data (all children and settings)" }), "delAll", () => {
        NS.store.deleteAll();
        NS.store.raw.del("ns_session");
        onboarding();
      }));
      c.append(msg, el("p", "psmall", G({ hi: "सदस्यता (रिस्टोर कोड) नहीं मिटती, ताकि आपका भुगतान सुरक्षित रहे।", en: "The subscription (restore code) is kept, so your payment stays safe." })));
      box.appendChild(c);
    }
    const legal = el("p", "psmall plegal");
    const a = (href, t) => { const x = el("a", null, t); x.href = href; return x; };
    legal.append(a("legal/privacy.html", "गोपनीयता नीति"), " · ", a("legal/terms.html", "नियम और शर्तें"), " · ", a("legal/contact.html", "संपर्क"));
    box.append(legal, NS.button("🏠 " + G({ hi: "ऐप पर चलें", en: "Back to the app" }), "pbtn primary", goHome));

    function preview() {
      const p = NS.store.current();
      if (!p) return;
      NS.voice.say(NS.tr(p.voice === "male" ? "sampleMale" : "sampleFemale"));
    }
  }
  function confirmButton(label, id, action) {
    const wrap = el("div", "confirm-wrap");
    const b = NS.button(label, "pbtn danger", () => { b.hidden = true; row.hidden = false; });
    b.id = id;
    const row = el("div", "confirm");
    row.hidden = true;
    const yes = NS.button(G({ hi: "हाँ, मिटाएँ", en: "Yes, delete" }), "pbtn danger", action);
    yes.id = id + "Yes";
    row.append(el("p", "plead", G({ hi: "पक्का? यह वापस नहीं आएगा।", en: "Sure? This cannot be undone." })), yes,
      NS.button(G({ hi: "नहीं", en: "No" }), "pbtn secondary", () => { row.hidden = true; b.hidden = false; }));
    wrap.append(b, row);
    return wrap;
  }
  function editProfile(pid) {
    const p = NS.store.profiles().find(x => x.id === pid);
    if (!p) return parents();
    const box = panel(G({ hi: "बदलें", en: "Edit" }) + " — " + (p.name || p.avatar));
    setState("grownup", () => editProfile(pid));
    setTop(G({ hi: "बड़ों के लिए", en: "For grown-ups" }), true, "👨‍👩‍👧");
    const draft = Object.assign({}, p);
    const name = document.createElement("input");
    name.className = "pin"; name.id = "editName"; name.maxLength = 24; name.value = p.name;
    name.autocomplete = "off"; name.spellcheck = false;
    name.placeholder = NS.tr("namePlaceholder");
    name.setAttribute("aria-label", NS.tr("namePlaceholder"));
    const avs = el("div", "av-row");
    avs.setAttribute("role", "radiogroup");
    NS.store.AVATARS.forEach(a => {
      const b = NS.button("", "av-b", () => { draft.avatar = a; [...avs.children].forEach(c => c.setAttribute("aria-checked", String(c === b))); }, a);
      b.appendChild(NS.picture(a, { size: 96 }));
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(a === p.avatar));
      avs.appendChild(b);
    });
    box.append(el("p", "plabel", G({ hi: "नाम", en: "Name" })), name, el("p", "plabel", G({ hi: "तस्वीर", en: "Picture" })), avs,
      el("p", "plabel", G({ hi: "उम्र", en: "Age" })), seg([["2-3", "2–3"], ["4-5", "4–5"], ["6+", "6+"]], p.ageBand, v => { draft.ageBand = v; }),
      el("p", "plabel", G({ hi: "आवाज़", en: "Voice" })), seg([["female", "👩 दीदी"], ["male", "👨 भैया"]], p.voice, v => { draft.voice = v; }),
      el("p", "plabel", G({ hi: "भाषा", en: "Language" })), seg([["hi", "हिंदी"], ["en", "English"], ["hinglish", "Hinglish"]], p.lang, v => { draft.lang = v; }),
      NS.button("✓ " + G({ hi: "सहेजें", en: "Save" }), "pbtn primary", () => {
        const langChanged = draft.lang !== p.lang;
        NS.store.updateProfile(pid, { name: name.value, avatar: draft.avatar, ageBand: draft.ageBand, voice: draft.voice, lang: draft.lang });
        if (langChanged && NS.store.current() && NS.store.current().id === pid) NS.emit("lang:changed", { lang: draft.lang });
        parents();
      }),
      NS.button(G({ hi: "रद्द करें", en: "Cancel" }), "pbtn secondary", () => parents()));
  }

  /* ---------------- Language, profile and daypart changes ---------------- */
  function applyLang() {
    root.lang = NS.langTag(NS.lang());
    backBtn.setAttribute("aria-label", NS.tr("home"));
    soundBtn.setAttribute("aria-label", NS.tr("sound"));
  }
  NS.on("lang:changed", () => {
    applyLang();
    if (state === "activity" && currentActivity && currentActivity.relang) {
      openActivity(currentActivity.id);           // the activity asked to be redrawn in the new language
    } else if (state === "activity" && currentActivity) {
      setTop(NS.t(currentActivity.title), true, currentActivity.icon);
      const s = body.firstElementChild; if (s) s.lang = NS.langTag(NS.lang());
    } else if (rerender && state !== "onboard") {
      const y = body.scrollTop;
      rerender();
      body.scrollTop = y;
    }
  });
  NS.on("profile:changed", applyLang);
  NS.on("activity:registered", () => { if (state === "home") goHome(); });

  function updateDaypart() {
    const dp = NS.daypart();
    const changed = root.dataset.daypart !== dp;
    root.dataset.daypart = dp;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = { morning: "#FFC48A", noon: "#7CC8F5", evening: "#F7A07C", night: "#1B1F4B" }[dp];
    return changed;
  }

  /* ---------------- Boot ---------------- */
  backBtn.addEventListener("click", () => goHome());
  backBtn.dataset.sfx = "close";
  soundBtn.addEventListener("click", () => {
    const now = !NS.store.settings().sound;
    NS.store.setSetting("sound", now);
    if (!now) NS.voice.stop();
    soundBtn.textContent = now ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", String(now));
    if (now) sfx("pop");
  });
  soundBtn.textContent = NS.store.settings().sound ? "🔊" : "🔇";
  soundBtn.setAttribute("aria-pressed", String(NS.store.settings().sound));
  window.addEventListener("popstate", () => {
    pushed = false;
    if (state === "rest" || state === "onboard" || state === "picker" || state === "home") {
      // Not a place "back" should leave: keep the entry so the next back press lands here again.
      if (state !== "home") { try { history.pushState({ ns: 1 }, ""); pushed = true; } catch (e) {} }
      return;
    }
    goHome();
  });

  /* Android back button: the shell calls NS.back(); true = handled, false = let the app close. */
  NS.back = function () {
    const c = document.querySelector(".celebrate");
    if (c) { c.click(); return true; }
    if (state === "home") return false;
    if (state === "rest") return true;                       // only a grown-up's answer leaves this screen
    if (state === "onboard" || state === "boot") {
      if (!NS.store.profiles().length) return false;
      picker();
      return true;
    }
    if (state === "picker") return false;
    goHome();
    return true;
  };
  NS.open = openActivity;
  NS.home = goHome;
  NS.mascot = mascot;
  NS.ui = {
    setTop, panel, talk, minutesToday, mascot,
    setProg: t => { prog.textContent = t == null ? "" : String(t); },
    state: () => state,
    render: () => { if (rerender) rerender(); },
    stickerBook, parents, picker, onboarding, windDown,
    install: { available: installAvailable, prompt: promptInstall },
  };

  applyLang();
  updateDaypart();
  const resting = loadSession();
  sess.last = NS.now();
  const profiles = NS.store.profiles();
  if (!profiles.length) onboarding();
  else if (resting) windDown();
  else if (profiles.length > 1) picker();
  else goHome();
  setInterval(tick, TICK);
  setInterval(() => { if (updateDaypart() && state === "home") goHome(); }, 60000);
  if (NS.billing) NS.billing.refresh().then(changed => { if (changed && state === "home") goHome(); });

  /* ---------------- PWA: offline + install (not inside the Android shell, which serves files itself) ---------------- */
  if ("serviceWorker" in navigator && !window.NanhaNative) {
    const reg = () => navigator.serviceWorker.register("sw.js").catch(() => {});
    if (document.readyState === "complete") reg(); else window.addEventListener("load", reg);
  }
  /* The browser's install offer is kept for the grown-ups: a small card at the end of home (behind
     the grown-ups' question) and one in the grown-ups' area. Never on an activity screen, never
     floating over anything, never inside the Android app, never once installed. */
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    if (inShell() || standalone()) return;
    deferredInstall = e;
    refreshInstall();
  });
  window.addEventListener("appinstalled", () => { deferredInstall = null; refreshInstall(); });
})();
