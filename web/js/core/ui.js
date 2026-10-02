/* नन्हा स्कूल — the shell: header, living-sky home, navigation, first-run profiles, the
   "कौन खेल रहा है?" picker, sticker book, grown-ups' area, the session wind-down and the PWA bits.
   Loaded last: every module has registered its activity by now, so this file boots the app.

   Adds to NS: NS.open(id), NS.home(), NS.mascot(mood, cls), NS.ui = {setTop, setProg, panel,
   state, talk, minutesToday, render}. */
(function () {
  "use strict";
  const NS = window.NS;
  const el = NS.el;
  const $ = id => document.getElementById(id);
  const body = $("body"), backBtn = $("backBtn"), soundBtn = $("soundBtn"), scrTitle = $("scrTitle"), prog = $("prog");
  const app = $("app");
  const root = document.documentElement;

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
  function setTop(title, showBack) {
    scrTitle.textContent = title;
    backBtn.hidden = !showBack;
    prog.textContent = "";
    app.classList.toggle("on-home", !showBack && state === "home");
  }
  function panel(title) {
    leaveScreen();
    setState("grownup", null);
    app.classList.remove("on-home");
    body.replaceChildren();
    const box = el("div", "panel");
    if (title) box.appendChild(el("h2", "ptitle", title));
    body.appendChild(box);
    body.scrollTop = 0;
    return box;
  }
  function fresh(cls) {
    body.replaceChildren();
    body.scrollTop = 0;
    const wrap = el("div", cls);
    body.appendChild(wrap);
    return wrap;
  }

  /* ---------------- Mascot: मिट्ठू the parrot (inline SVG, animated by app.css) ---------------- */
  function mascot(mood, cls) {
    const s = NS.svg;
    const eye = (cx, px) => s("g", { class: "m-eye" }, [
      s("circle", { cx, cy: 40, r: 8, fill: "#fff" }),
      s("circle", { class: "m-pupil", cx: px, cy: 41.5, r: 4.8, fill: "#263238" }),
      s("circle", { cx: px + 1.6, cy: 39.4, r: 1.7, fill: "#fff" }),
    ]);
    const z = s("text", { class: "m-z", x: 92, y: 24 }); z.textContent = "z";
    const svg = s("svg", { viewBox: "0 0 120 132", class: "mascot m-" + (MOODS.includes(mood) ? mood : "idle") + (cls ? " " + cls : ""), role: "img", "aria-label": NS.tr("mascotName"), focusable: "false" }, [
      s("g", { class: "m-body" }, [
        s("path", { d: "M50 100 Q38 122 45 129 Q54 118 58 104 Z", fill: "#E53935" }),
        s("path", { d: "M70 100 Q82 122 75 129 Q66 118 62 104 Z", fill: "#1E88E5" }),
        s("path", { d: "M55 104 Q60 131 65 104 Z", fill: "#FFC107" }),
        s("g", { class: "m-wing-l" }, [s("ellipse", { cx: 34, cy: 80, rx: 10, ry: 20, fill: "#2E9E48", transform: "rotate(18 34 80)" })]),
        s("g", { class: "m-wing-r" }, [s("ellipse", { cx: 86, cy: 80, rx: 10, ry: 20, fill: "#2E9E48", transform: "rotate(-18 86 80)" })]),
        s("ellipse", { cx: 60, cy: 80, rx: 29, ry: 30, fill: "#3DBE5A" }),
        s("ellipse", { cx: 60, cy: 87, rx: 18, ry: 20, fill: "#C8F27C" }),
        s("path", { d: "M50 108 l-5 7 M50 108 l0 8 M50 108 l5 7 M70 108 l-5 7 M70 108 l0 8 M70 108 l5 7", stroke: "#FF8F00", "stroke-width": 3, "stroke-linecap": "round", fill: "none" }),
      ]),
      s("g", { class: "m-head" }, [
        s("ellipse", { cx: 51, cy: 14, rx: 4.5, ry: 10, fill: "#FF7043", transform: "rotate(-22 51 14)" }),
        s("ellipse", { cx: 60, cy: 11, rx: 4.5, ry: 11, fill: "#FFCA28" }),
        s("ellipse", { cx: 69, cy: 14, rx: 4.5, ry: 10, fill: "#FF7043", transform: "rotate(22 69 14)" }),
        s("circle", { cx: 60, cy: 43, r: 30, fill: "#47C95F" }),
        s("ellipse", { cx: 60, cy: 45, rx: 24, ry: 17, fill: "#E3F9CF" }),
        eye(49, 50.5), eye(71, 72.5),
        s("path", { class: "m-closed", d: "M42 41 Q49 47 56 41 M64 41 Q71 47 78 41", stroke: "#263238", "stroke-width": 2.6, "stroke-linecap": "round", fill: "none" }),
        s("ellipse", { class: "m-cheek", cx: 40, cy: 52, rx: 5, ry: 3.2, fill: "#FF8A80", opacity: ".8" }),
        s("ellipse", { class: "m-cheek", cx: 80, cy: 52, rx: 5, ry: 3.2, fill: "#FF8A80", opacity: ".8" }),
        s("g", { class: "m-beak-low" }, [s("ellipse", { cx: 60, cy: 58, rx: 5.5, ry: 3.6, fill: "#E65100" })]),
        s("path", { d: "M52 47 Q60 42 68 47 Q67 56 60 61 Q53 56 52 47 Z", fill: "#FF9800" }),
        z,
      ]),
    ]);
    return svg;
  }
  /* Moods: idle, happy, sleepy, curious, calm, proud, caring (anything else shows idle). */
  const MOODS = ["idle", "happy", "sleepy", "curious", "calm", "proud", "caring"];
  mascot.MOODS = MOODS;
  mascot.mood = function (svg, mood) {
    if (!svg || !svg.classList) return;
    MOODS.forEach(m => svg.classList.remove("m-" + m));
    svg.classList.add("m-" + (MOODS.includes(mood) ? mood : "idle"));
  };
  /* Speaks while the mascot's beak moves. */
  function talk(m, text, opt) {
    if (m) m.classList.add("talking");
    const p = NS.voice.say(text, opt);
    const end = () => { if (m) m.classList.remove("talking"); };
    p.then(end, end);
    return p;
  }

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
    setTop(def.icon + " " + NS.t(def.title), true);
    app.style.setProperty("--act", def.color);
    const screen = fresh("act act-" + def.id);
    screen.lang = NS.langTag(NS.lang());
    const life = { alive: true };
    ctxAlive = life;
    countOpen(def.id);
    try {
      const r = def.open(makeCtx(def, screen, life));
      if (typeof r === "function") cleanup = r;
    } catch (e) {
      console.error("activity " + id, e);
      screen.replaceChildren(el("p", "oops", NS.tr("oops")), NS.button("🏠 " + NS.tr("home"), "big", goHome));
    }
  }

  /* ---------------- Home: the living sky ---------------- */
  const SECTION_INFO = { learn: ["📚", "secLearn"], grow: ["🌱", "secGrow"], play: ["🎈", "secPlay"] };
  let greeted = false;

  function skyPosition(now) {
    const h = now.getHours() + now.getMinutes() / 60;
    // The sun travels 5:00 → 19:00, the moon 19:00 → 5:00, along the same gentle arc.
    const f = h >= 5 && h < 19 ? (h - 5) / 14 : ((h < 5 ? h + 24 : h) - 19) / 10;
    return { x: 8 + 84 * f, y: 54 - 26 * Math.sin(Math.PI * f) };
  }
  function buildSky(profile) {
    const now = new Date(NS.now());
    const dp = NS.daypart(now);
    const sky = el("section", "sky sky-" + dp);
    sky.setAttribute("aria-label", NS.tr(dp));
    const pos = skyPosition(now);
    const orb = el("div", dp === "night" ? "moon" : "sun");
    orb.style.setProperty("--x", pos.x.toFixed(1) + "%");
    orb.style.setProperty("--y", pos.y.toFixed(1) + "%");
    orb.setAttribute("aria-hidden", "true");
    sky.appendChild(orb);
    if (dp === "night" || dp === "evening") {
      const stars = el("div", "stars");
      stars.setAttribute("aria-hidden", "true");
      const n = dp === "night" ? 26 : 8;
      for (let i = 0; i < n; i++) {
        const st = el("i");
        st.style.setProperty("--x", ((i * 37.7) % 100).toFixed(1) + "%");
        st.style.setProperty("--y", ((i * 23.3) % 62).toFixed(1) + "%");
        st.style.setProperty("--d", (i % 7) * 0.4 + "s");
        stars.appendChild(st);
      }
      sky.appendChild(stars);
    }
    if (dp !== "night") {
      ["c1", "c2", "c3"].forEach(c => { const cl = el("div", "cloud " + c); cl.setAttribute("aria-hidden", "true"); sky.appendChild(cl); });
    }
    sky.appendChild(el("div", "hills"));

    // Top row: the child's avatar (opens the sticker book), sound, grown-ups.
    const top = el("div", "skytop");
    const me = NS.button("", "me", () => stickerBook(), NS.tr("stickerBook"));
    const count = NS.rewards.list().length;
    me.append(el("span", "me-av", profile.avatar), el("span", "me-name", profile.name || NS.tr("friend")));
    const badge = el("span", "me-stk", "⭐ " + count);
    me.append(badge);
    const snd = soundToggle("roundbtn sky-btn");
    const gear = NS.button("⚙️", "roundbtn sky-btn", () => billing().gate(parents), NS.tr("grownups"));
    top.append(me, el("span", "grow1"), snd, gear);
    sky.appendChild(top);

    // Greeting + Mitthu.
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
    const mb = NS.button("", "mascot-btn", () => { m.classList.remove("happy"); void m.getBBox; m.classList.add("happy"); setTimeout(() => m.classList.remove("happy"), 900); talk(m, line); }, NS.tr("mascotName"));
    mb.appendChild(m);
    sky.append(greet, mb);
    return { sky, say: () => talk(m, line) };
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
    const ic = el("span", "ic", def.icon);
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
    leaveScreen();
    if (pushed) { pushed = false; try { history.back(); } catch (e) {} }
    setState("home", goHome);
    app.classList.add("on-home");
    setTop(NS.tr("appName"), false);
    updateDaypart();
    const wrap = fresh("home");
    const { sky, say } = buildSky(profile);
    wrap.appendChild(sky);

    const acts = NS.activities().filter(a => !a.hidden);
    const dp = NS.daypart();
    const content = el("div", "home-content");
    const sleep = NS.activity("sleep");
    if (dp === "night" && sleep) {
      const hero = NS.button("", "bedtime", () => { NS.voice.say(NS.tr("bedtime")); openActivity("sleep"); }, NS.tr("bedtime"));
      const moon = el("span", "bt-ic", "🌙"); moon.setAttribute("aria-hidden", "true");
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
      const [icon, key] = SECTION_INFO[sec];
      const hi = el("span", "sect-ic", icon); hi.setAttribute("aria-hidden", "true");
      head.append(hi, el("span", null, NS.tr(key)));
      head.lang = NS.langTag(NS.lang());
      const grid = el("div", "grid");
      list.forEach(a => { const t = tile(a); t.style.setProperty("--i", String(n++)); grid.appendChild(t); });
      section.append(head, grid);
      content.appendChild(section);
    });
    const banner = billing().statusBanner();
    if (banner) content.appendChild(banner);
    wrap.appendChild(content);
    if (!greeted) { greeted = true; setTimeout(() => { if (state === "home") say(); }, 350); }
  }

  /* ---------------- First run: make a profile (voice + taps; a grown-up may type a name) -------- */
  function onboarding() {
    leaveScreen();
    setState("onboard", null);
    app.classList.remove("on-home");
    setTop("", false);
    app.classList.add("on-home");
    const hadProfiles = NS.store.profiles().length > 0;
    let L = NS.lang();
    const draft = { avatar: null, name: "", ageBand: null, voice: null, lang: L };
    const T = (k, v) => NS.tr(k, v, L);
    const wrap = fresh("onboard");
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
      steps[i]();
    }
    function prompt(key, gender) {
      bubble.textContent = T(key);
      bubble.lang = NS.langTag(L);
      return talk(m, T(key), { lang: L, gender: gender || draft.voice || "female" });
    }
    function choice(label, cls, onPick, aria) {
      const b = NS.button(label, "choice " + (cls || ""), onPick, aria);
      return b;
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
        const b = choice(a, "av", () => {
          draft.avatar = a;
          [...grid.children].forEach(c => c.setAttribute("aria-checked", String(c === b)));
          b.classList.add("pop");
          m.classList.add("happy");
          setTimeout(() => { m.classList.remove("happy"); go(2); }, 650);
        }, a);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        grid.appendChild(b);
      });
      stage.appendChild(grid);
    }
    function nameStep() {
      prompt("askName");
      const row = el("div", "ob-name");
      const av = el("span", "ob-av", draft.avatar); av.setAttribute("aria-hidden", "true");
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
        const b = choice("", "ocard", () => { draft.ageBand = band; go(4); }, T(key));
        b.append(el("span", "ch-ic", e), el("span", "ch-lb", T(key)));
        b.dataset.age = band;
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
          [...g.children].forEach(c => c.setAttribute("aria-checked", String(c === b)));
          nextBtn.hidden = false;
          talk(m, T(sample), { lang: L, gender });
        }, T(key));
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        b.dataset.voice = gender;
        b.append(el("span", "ch-ic", e), el("span", "ch-lb", T(key) + "  🔊"));
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
          [...g.children].forEach(c => c.setAttribute("aria-checked", String(c === b)));
          done.hidden = false;
          done.textContent = "✓  " + T("letsGo");
          talk(m, hello, { lang: code, gender: draft.voice || "female" });
        }, label);
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", "false");
        b.dataset.lang = code;
        const lb = el("span", "ch-lb", label); lb.lang = NS.langTag(code);
        b.append(el("span", "ch-ic", e), lb);
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
    app.classList.add("on-home");
    setTop("", false);
    const wrap = fresh("picker");
    const m = mascot("happy", "mascot-sm");
    const h = el("h1", "pick-h", NS.tr("whoPlays"));
    const grid = el("div", "pick-grid");
    list.forEach(p => {
      const b = NS.button("", "pick-card", () => {
        NS.store.setCurrent(p.id);
        resetSession();
        greeted = false;
        goHome();
      }, p.name || NS.tr("friend"));
      b.append(el("span", "pick-av", p.avatar), el("span", "pick-name", p.name || NS.tr("friend")));
      b.dataset.pid = p.id;
      grid.appendChild(b);
    });
    const add = NS.button("", "pick-card add", () => onboarding(), NS.tr("addChild"));
    add.append(el("span", "pick-av", "➕"), el("span", "pick-name", NS.tr("addChild")));
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
    setTop("📒 " + NS.tr("stickerBook"), true);
    const wrap = fresh("book");
    const all = NS.rewards.list();
    const head = el("div", "book-head");
    const av = el("span", "book-av", p.avatar); av.setAttribute("aria-hidden", "true");
    const m = mascot(all.length ? "happy" : "idle", "mascot-sm");
    const msg = all.length ? NS.tr("stickerCount", { n: all.length }) : NS.tr("stickerEmpty");
    const t = el("p", "book-msg", msg);
    head.append(av, t, m);
    wrap.appendChild(head);
    const page = el("div", "book-page");
    if (all.length) {
      const counts = new Map();
      all.slice().reverse().forEach(x => counts.set(x.s, (counts.get(x.s) || 0) + 1));
      counts.forEach((n, s) => {
        const c = el("div", "stk");
        c.setAttribute("role", "img");
        c.setAttribute("aria-label", s + (n > 1 ? " × " + n : ""));
        c.appendChild(el("span", "stk-e", s));
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
    app.classList.remove("on-home");
    setTop("🌈 " + NS.tr("restTitle"), false);
    const wrap = fresh("rest");
    const night = NS.daypart() === "night";
    const idea = night ? NIGHT_IDEA : IDEAS[Math.floor(NS.now() / 60000) % IDEAS.length];
    const m = mascot(night ? "sleepy" : "happy", "mascot-rest");
    const h = el("h1", "rest-h", NS.tr("restTitle"));
    const card = el("div", "idea");
    card.append(el("span", "idea-e", idea.e), el("span", "idea-t", NS.t(idea)));
    const more = NS.button(NS.tr("restMore"), "plink rest-more", () => billing().gate(() => { resetSession(); goHome(); }));
    wrap.append(m, h, card, more);
    talk(m, NS.tr("restSay", { idea: NS.t(idea) }));
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
    const i = el("span", null, icon); i.setAttribute("aria-hidden", "true");
    h.append(i, el("span", null, title));
    c.appendChild(h);
    return c;
  }
  const HABITS = { brush: "🪥", bath: "🛁", eat: "🍽️", play: "⚽", read: "📖", sleep: "😴", water: "💧", help: "🤝" };

  function parents(focusPid) {
    const box = panel(G({ hi: "बड़ों के लिए", en: "For grown-ups" }));
    setState("grownup", () => parents(focusPid));
    setTop("👨‍👩‍👧 " + G({ hi: "बड़ों के लिए", en: "For grown-ups" }), true);
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
      const chart = el("div", "bars");
      chart.setAttribute("role", "img");
      chart.setAttribute("aria-label", G({ hi: "इस हफ़्ते रोज़ के मिनट: ", en: "Minutes per day this week: " }) + mins.join(", "));
      days.forEach((d, i) => {
        const col = el("div", "bar");
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
        const row = el("div", "prow" + (cur && p.id === cur.id ? " cur" : ""));
        row.append(el("span", "prow-av", p.avatar), el("span", "prow-name", (p.name || NS.tr("friend")) + " · " + p.ageBand.replace("-", "–")));
        const use = NS.button(G({ hi: "चुनें", en: "Select" }), "pbtn small secondary", () => { NS.store.setCurrent(p.id); resetSession(); parents(); });
        if (cur && p.id === cur.id) use.disabled = true;
        const edit = NS.button(G({ hi: "बदलें", en: "Edit" }), "pbtn small secondary", () => editProfile(p.id));
        row.append(use, edit);
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

    // Microphone
    {
      const c = card(G({ hi: "माइक (बोलकर जवाब देना)", en: "Microphone (talking back)" }), "🎤");
      const sw = NS.button("", "switch", () => {
        const on = !NS.store.settings().mic;
        NS.store.setSetting("mic", on);
        sw.setAttribute("aria-checked", String(on));
        state_.textContent = on ? G({ hi: "चालू", en: "On" }) : G({ hi: "बंद", en: "Off" });
      }, G({ hi: "माइक", en: "Microphone" }));
      sw.id = "micSwitch";
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", String(s.mic));
      const state_ = el("span", "switch-state", s.mic ? G({ hi: "चालू", en: "On" }) : G({ hi: "बंद", en: "Off" }));
      const row = el("div", "row-inline");
      row.append(sw, state_);
      c.append(row, el("p", "psmall", G({
        hi: "माइक शुरू में बंद रहता है। चालू करने पर बच्चा बोलकर जवाब दे सकता है। Android ऐप में आवाज़ फ़ोन पर ही पहचानी जाती है। कुछ ब्राउज़र (जैसे Chrome या Safari) बोली गई आवाज़ पहचानने के लिए उसे अपनी स्पीच सर्विस पर भेजते हैं — नन्हा स्कूल खुद कुछ नहीं भेजता या रखता।" + (NS.native.available || window.SpeechRecognition || window.webkitSpeechRecognition ? "" : " इस ब्राउज़र में बोलकर जवाब देना उपलब्ध नहीं है।"),
        en: "The mic is off at first. When on, your child can answer by speaking. In the Android app, speech is recognised on the phone. Some browsers (such as Chrome or Safari) send the spoken audio to their speech service to recognise it — Nanha School itself sends or keeps nothing." + (NS.native.available || window.SpeechRecognition || window.webkitSpeechRecognition ? "" : " Speaking answers is not available in this browser."),
      })));
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
    box.append(legal, NS.button("🏠 " + G({ hi: "ऐप पर चलें", en: "Back to the app" }), "pbtn", goHome));

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
    setTop("👨‍👩‍👧 " + G({ hi: "बड़ों के लिए", en: "For grown-ups" }), true);
    const draft = Object.assign({}, p);
    const name = document.createElement("input");
    name.className = "pin"; name.id = "editName"; name.maxLength = 24; name.value = p.name;
    name.autocomplete = "off"; name.spellcheck = false;
    name.placeholder = NS.tr("namePlaceholder");
    name.setAttribute("aria-label", NS.tr("namePlaceholder"));
    const avs = el("div", "av-row");
    avs.setAttribute("role", "radiogroup");
    NS.store.AVATARS.forEach(a => {
      const b = NS.button(a, "av-b", () => { draft.avatar = a; [...avs.children].forEach(c => c.setAttribute("aria-checked", String(c === b))); }, a);
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(a === p.avatar));
      avs.appendChild(b);
    });
    box.append(el("p", "plabel", G({ hi: "नाम", en: "Name" })), name, el("p", "plabel", G({ hi: "तस्वीर", en: "Picture" })), avs,
      el("p", "plabel", G({ hi: "उम्र", en: "Age" })), seg([["2-3", "2–3"], ["4-5", "4–5"], ["6+", "6+"]], p.ageBand, v => { draft.ageBand = v; }),
      el("p", "plabel", G({ hi: "आवाज़", en: "Voice" })), seg([["female", "👩 दीदी"], ["male", "👨 भैया"]], p.voice, v => { draft.voice = v; }),
      el("p", "plabel", G({ hi: "भाषा", en: "Language" })), seg([["hi", "हिंदी"], ["en", "English"], ["hinglish", "Hinglish"]], p.lang, v => { draft.lang = v; }),
      NS.button("✓ " + G({ hi: "सहेजें", en: "Save" }), "pbtn", () => {
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
    const ib = $("installBtn"); if (ib) ib.textContent = "📲 " + NS.tr("install");
  }
  NS.on("lang:changed", () => {
    applyLang();
    if (state === "activity" && currentActivity && currentActivity.relang) {
      openActivity(currentActivity.id);           // the activity asked to be redrawn in the new language
    } else if (state === "activity" && currentActivity) {
      scrTitle.textContent = currentActivity.icon + " " + NS.t(currentActivity.title);
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
    if (meta) meta.content = { morning: "#FFB86B", noon: "#4FB8F0", evening: "#FF8A65", night: "#1B1F4B" }[dp];
    return changed;
  }

  /* ---------------- Boot ---------------- */
  backBtn.addEventListener("click", () => goHome());
  soundBtn.addEventListener("click", () => {
    const now = !NS.store.settings().sound;
    NS.store.setSetting("sound", now);
    if (!now) NS.voice.stop();
    soundBtn.textContent = now ? "🔊" : "🔇";
    soundBtn.setAttribute("aria-pressed", String(now));
  });
  soundBtn.textContent = NS.store.settings().sound ? "🔊" : "🔇";
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
  let deferredInstall = null;
  const installBtn = $("installBtn");
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferredInstall = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) {}
    deferredInstall = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => { installBtn.hidden = true; });
})();
