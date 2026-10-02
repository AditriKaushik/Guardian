/* नन्हा स्कूल — "बात बडी": chat with मिट्ठू the parrot (activity id "buddy").

   The brain (js/brain/brain.js) decides what to say; this screen shows it and speaks it:
   a mascot face that changes with the mood, a big 🎤 button, tappable reply bubbles, and an
   optional keyboard for grown-ups. Actions from the brain are applied here:
     setLang  → NS.setLang (after the confirmation is spoken)
     habit    → NS.emit("habit:done", {habit}) (the garden grows a plant)
     open     → ctx.open(id) (after the line is spoken)
     remember → ctx.data (only nickname, dream, favColour — never anything private)
   The child's words are never stored. The chat lives in memory only, so a re-render (for
   example after a language change) can restore it for a few minutes. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS || typeof NS.registerActivity !== "function" || !NS.Brain) return;

  const L = (hi, en, hinglish) => ({ hi, en, hinglish });
  const UI = {
    name: L("मिट्ठू", "Mitthu", "Mitthu"),
    talk: L("बोलो", "Talk", "Bolo"),
    listening: L("सुन रहा हूँ…", "Listening…", "Sun raha hoon…"),
    micLabel: L("दबाओ और बोलो", "Press and talk", "Dabao aur bolo"),
    keyboard: L("लिखो (बड़ों के लिए)", "Type (for grown-ups)", "Likho (bado ke liye)"),
    placeholder: L("यहाँ लिखो…", "Type here…", "Yahan likho…"),
    send: L("भेजो", "Send", "Bhejo"),
    noMic: L("मुझे सुनाई नहीं दिया 🙉 फिर से बोलो, या नीचे वाला कोई बुलबुला दबाओ!",
      "I couldn't hear you 🙉 Try again, or tap one of the bubbles below!",
      "Mujhe sunai nahi diya 🙉 Phir se bolo, ya neeche wala koi bulbula dabao!"),
    micOff: L("अभी माइक बंद है 🎤 नीचे वाले बुलबुले दबाओ — या बड़े सेटिंग में माइक चालू कर दें!",
      "The mic is off right now 🎤 Tap the bubbles below — or ask a grown-up to turn it on in settings!",
      "Abhi mic band hai 🎤 Neeche wale bulbule dabao — ya bade settings mein mic chalu kar dein!"),
  };
  const FACE = { happy: "😄", curious: "🤔", calm: "😌", sleepy: "😴", proud: "🌟", caring: "💛", listening: "👂", thinking: "💭" };
  const REMEMBER_KEYS = ["nickname", "dream", "favColour"];
  const RESTORE_MS = 5 * 60 * 1000;
  let session = null;   // {pid, at, msgs:[{who, text}], lastTopics, lang} — memory only

  const CSS = `
.bd-host{flex:1;min-height:0;display:flex;flex-direction:column}
.bd{flex:1;min-height:0;display:flex;flex-direction:column;width:100%;max-width:720px;margin:0 auto}
.bd-top{display:flex;align-items:center;gap:12px;padding:10px 14px 4px}
.bd-face{position:relative;flex:none;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;
  font-size:46px;line-height:1;background:#BFF0C9;box-shadow:0 4px 0 rgba(0,0,0,.08);transition:background .3s}
.bd-face svg{width:84%;height:auto;overflow:visible}
.bd-face .bd-badge{position:absolute;right:-4px;bottom:-4px;width:34px;height:34px;border-radius:50%;background:#fff;
  display:grid;place-items:center;font-size:20px;box-shadow:0 2px 6px rgba(0,0,0,.15)}
.bd-face[data-mood=sleepy]{background:#C9D3F5}.bd-face[data-mood=caring]{background:#FFE1E6}
.bd-face[data-mood=proud]{background:#FFE9A8}.bd-face[data-mood=calm]{background:#D6F2F0}
.bd-face[data-mood=curious]{background:#E6DDFB}.bd-face[data-mood=listening]{background:#CFE3FF}
.bd-face.talk{animation:bd-bob .6s ease-in-out infinite alternate}
.bd-face[data-mood=listening]{animation:bd-pulse 1s ease-in-out infinite}
@keyframes bd-bob{from{transform:translateY(0) rotate(-3deg)}to{transform:translateY(-4px) rotate(3deg)}}
@keyframes bd-pulse{0%,100%{box-shadow:0 0 0 0 rgba(76,139,245,.45)}50%{box-shadow:0 0 0 12px rgba(76,139,245,0)}}
@media (prefers-reduced-motion:reduce){.bd-face.talk,.bd-face[data-mood=listening]{animation:none}}
.bd-name{font-size:22px;font-weight:800}
.bd-msgs{flex:1;min-height:110px;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}
.bd-bub{max-width:86%;padding:10px 14px;font-size:18px;line-height:1.4;white-space:pre-line;overflow-wrap:anywhere;
  border-radius:18px;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.bd-bub.b{align-self:flex-start;background:var(--card,#fff);border-bottom-left-radius:4px}
.bd-bub.k{align-self:flex-end;background:var(--kid,#C8F0D8);border-bottom-right-radius:4px}
.bd-dock{position:sticky;bottom:0;z-index:2;background:var(--bg,#FFF8E7)}
.bd-face svg:not(.m-sleepy) .m-z,.bd-face svg:not(.m-sleepy) .m-closed{display:none}
.bd-chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:6px 10px}
.bd-chip{font:inherit;font-size:17px;font-weight:600;border:2px solid #4C8BF5;color:#1F4FA8;background:#fff;
  border-radius:999px;padding:8px 14px;min-height:44px;cursor:pointer;max-width:100%}
.bd-chip:active{transform:scale(.96)}
.bd-bar{display:flex;align-items:center;justify-content:center;gap:16px;padding:8px 12px calc(10px + env(safe-area-inset-bottom,0px))}
.bd-mic{font:inherit;width:84px;height:84px;border-radius:50%;border:none;background:var(--mic,#4C8BF5);color:#fff;
  font-size:38px;cursor:pointer;box-shadow:0 5px 0 rgba(0,0,0,.18);display:grid;place-items:center}
.bd-mic.on{background:var(--stop,#EF5350)}
.bd-mic:active{transform:translateY(2px);box-shadow:0 3px 0 rgba(0,0,0,.18)}
.bd-kbd{font:inherit;width:52px;height:52px;border-radius:50%;border:none;background:#fff;font-size:24px;cursor:pointer;
  box-shadow:0 2px 6px rgba(0,0,0,.12)}
.bd-micwrap{display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:700}
.bd-type{display:flex;gap:8px;padding:0 10px 10px}
.bd-type[hidden]{display:none}
.bd-type input{flex:1;min-width:0;font:inherit;font-size:17px;padding:10px 12px;border-radius:14px;border:2px solid #ddd}
.bd-type button{font:inherit;font-weight:700;border:none;border-radius:14px;background:var(--send,#2EAD6B);color:#fff;padding:0 16px;min-height:44px}
@media (max-height:720px){.bd-top{padding:6px 12px 2px}.bd-face{width:58px;height:58px;font-size:34px}
  .bd-face .bd-badge{width:28px;height:28px;font-size:16px}.bd-mic{width:68px;height:68px;font-size:30px}
  .bd-kbd{width:44px;height:44px;font-size:20px}.bd-chip{font-size:16px;padding:6px 12px;min-height:40px}
  .bd-chips{gap:6px;padding:4px 8px}.bd-bar{padding-top:4px;padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))}
  .bd-micwrap{flex-direction:row;gap:8px}}
@media (min-width:700px){.bd-face{width:96px;height:96px;font-size:58px}.bd-bub{font-size:20px}}
`;
  function injectStyle() {
    if (document.getElementById("bd-style")) return;
    const st = document.createElement("style");
    st.id = "bd-style";
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function dayKey() {
    if (NS.dayKey) return NS.dayKey();
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }
  const now = () => new Date(NS.now ? NS.now() : Date.now());

  function open(ctx) {
    injectStyle();
    const T = obj => obj[lang] || obj.hi;
    const el = (tag, cls, text) => (ctx.el ? ctx.el(tag, cls, text) : NS.el(tag, cls, text));
    const pid = ctx.profile && ctx.profile.id;
    const restore = session && session.pid === pid && Date.now() - session.at < RESTORE_MS ? session : null;
    let lang = restore && restore.lang ? restore.lang : ctx.lang;
    let alive = true, listening = false, thinkTimer = null;
    const lastTopics = restore ? restore.lastTopics.slice() : [];
    const msgs = restore ? restore.msgs.slice() : [];
    const brain = NS.Brain.createBrain({ random: Math.random, now });

    /* ---------- DOM ---------- */
    ctx.screen.classList.add("bd-host");
    const root = el("div", "bd");
    const top = el("div", "bd-top");
    const face = el("div", "bd-face");
    face.setAttribute("aria-hidden", "true");
    let svg = null;   // the core's parrot (NS.mascot) when available, else the 🦜 emoji
    try { svg = typeof NS.mascot === "function" ? NS.mascot("happy", "bd-mascot") : null; } catch (e) { svg = null; }
    face.appendChild(svg || el("span", "bd-emoji", "🦜"));
    const badge = el("span", "bd-badge", FACE.happy);
    face.appendChild(badge);
    const nameEl = el("div", "bd-name", T(UI.name));
    top.append(face, nameEl);
    const log = el("div", "bd-msgs");
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    const chips = el("div", "bd-chips");
    const bar = el("div", "bd-bar");
    const kbd = el("button", "bd-kbd", "⌨️");
    kbd.type = "button";
    const micWrap = el("div", "bd-micwrap");
    const mic = el("button", "bd-mic", "🎤");
    mic.type = "button";
    const micText = el("span", null, T(UI.talk));
    micWrap.append(mic, micText);
    const spacer = el("div");
    spacer.style.width = "52px";
    bar.append(kbd, micWrap, spacer);
    const typeRow = el("form", "bd-type");
    typeRow.hidden = true;
    const input = el("input");
    input.type = "text";
    input.maxLength = 200;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("enterkeyhint", "send");
    const sendBtn = el("button", null, T(UI.send));
    sendBtn.type = "submit";
    typeRow.append(input, sendBtn);
    const dock = el("div", "bd-dock");   // sticks to the bottom even if the page itself scrolls
    dock.append(chips, bar, typeRow);
    root.append(top, log, dock);
    ctx.screen.appendChild(root);

    function labels() {
      nameEl.textContent = T(UI.name);
      micText.textContent = listening ? T(UI.listening) : T(UI.talk);
      mic.setAttribute("aria-label", T(UI.micLabel));
      kbd.setAttribute("aria-label", T(UI.keyboard));
      kbd.title = T(UI.keyboard);
      input.placeholder = T(UI.placeholder);
      sendBtn.textContent = T(UI.send);
    }
    function setMood(m) {
      face.dataset.mood = m;
      badge.textContent = FACE[m] || FACE.happy;
      if (svg) {
        const core = m === "sleepy" ? "sleepy" : (m === "happy" || m === "proud") ? "happy" : "idle";
        ["m-idle", "m-happy", "m-sleepy"].forEach(c => svg.classList.remove(c));
        svg.classList.add("m-" + core);
      }
    }
    function talking(on) {
      face.classList.toggle("talk", on);
      if (svg) svg.classList.toggle("talking", on);
    }
    function bubble(who, text, keep) {
      const b = el("div", "bd-bub " + who, text);
      log.appendChild(b);
      while (log.children.length > 40) log.removeChild(log.firstChild);
      log.scrollTop = log.scrollHeight;
      if (keep !== false) { msgs.push({ who, text }); if (msgs.length > 40) msgs.shift(); }
    }
    function renderChips(list) {
      chips.replaceChildren();
      (list || []).slice(0, 3).forEach(s => {
        const c = el("button", "bd-chip", s);
        c.type = "button";
        c.addEventListener("click", () => send(s));
        chips.appendChild(c);
      });
    }

    /* ---------- context for the brain ---------- */
    /* Habits reported today anywhere in the app (the core logs every habit:done), plus our own. */
    function habitsToday() {
      const h = ctx.data.get("habits", null);
      const own = h && h.day === dayKey() && Array.isArray(h.list) ? h.list : [];
      let core = [];
      try {
        const log = NS.store && NS.store.core && NS.store.core() ? NS.store.core().get("habits", {}) : {};
        core = Object.keys((log && log[dayKey()]) || {});
      } catch (e) { core = []; }
      return own.concat(core.filter(x => !own.includes(x)));
    }
    /* The dream told to the buddy, or else the one chosen in "बड़े होकर" (dreams). */
    function dream() {
      const mine = ctx.data.get("dream", null);
      if (typeof mine === "string" && mine) return mine;
      try {
        const d = NS.activeData && NS.activeData("dreams") ? NS.activeData("dreams").get("dream", null) : null;
        if (d && d.title) return d.title.hi || d.title.en || null;
      } catch (e) { /* ignore */ }
      return null;
    }
    function context(extra) {
      const d = now();
      const p = ctx.profile || {};
      return Object.assign({
        lang,
        name: ctx.data.get("nickname", "") || p.name || "",
        ageBand: p.ageBand || "4-5",
        daypart: ctx.daypart ? ctx.daypart() : undefined,
        hour: d.getHours() + d.getMinutes() / 60,
        minutesToday: ctx.minutesToday ? ctx.minutesToday() : 0,
        dream: dream(),
        habitsToday: habitsToday(),
        lastTopics: lastTopics.slice(-6),
      }, extra || {});
    }

    /* ---------- speaking & actions ---------- */
    async function buddySays(res) {
      if (!alive) return;
      if (res.topic) { lastTopics.push(res.topic); if (lastTopics.length > 12) lastTopics.shift(); }
      const later = [];
      (res.actions || []).forEach(a => {
        if (!a) return;
        if (a.type === "habit" && typeof a.habit === "string") {
          const h = habitsToday();
          if (!h.includes(a.habit)) ctx.data.set("habits", { day: dayKey(), list: h.concat(a.habit) });
          NS.emit("habit:done", { habit: a.habit });
        } else if (a.type === "remember" && REMEMBER_KEYS.includes(a.key) && typeof a.value === "string") {
          ctx.data.set(a.key, a.value.slice(0, 30));
        } else if (a.type === "setLang" || a.type === "open") {
          later.push(a);
        }
      });
      const switchTo = later.find(a => a.type === "setLang");
      if (switchTo && NS.LANGS && NS.LANGS.includes(switchTo.lang)) { lang = switchTo.lang; labels(); }
      bubble("b", res.text);
      setMood(res.mood);
      renderChips(res.suggestions);
      saveSession();
      talking(true);
      try { await ctx.say(res.text, res.lang); } catch (e) { /* speech is best-effort */ }
      if (!alive) return;
      talking(false);
      if (switchTo && typeof NS.setLang === "function") NS.setLang(switchTo.lang);   // may re-render; the chat is restored
      const go = later.find(a => a.type === "open");
      if (go && alive && (!NS.activity || NS.activity(go.id))) ctx.open(go.id);
    }
    function send(text) {
      text = String(text || "").trim().slice(0, 200);
      if (!text || !alive) return;
      ctx.stopVoice();
      talking(false);
      bubble("k", text);
      setMood("thinking");
      clearTimeout(thinkTimer);
      thinkTimer = setTimeout(() => { if (alive) buddySays(brain.reply(text, context())); }, 350);
    }
    async function listen() {
      if (listening || !alive) return;
      ctx.stopVoice();
      talking(false);
      const canListen = !NS.voice || typeof NS.voice.canListen !== "function" || NS.voice.canListen();
      if (!canListen) { fallback(UI.micOff); return; }
      listening = true;
      mic.classList.add("on");
      setMood("listening");
      labels();
      let heard = null;
      try { heard = await ctx.listen({ lang }); } catch (e) { heard = null; }
      listening = false;
      if (!alive) return;
      mic.classList.remove("on");
      labels();
      if (heard && String(heard).trim()) send(heard);
      else fallback(UI.noMic);
    }
    function fallback(line) {
      const text = T(line);
      bubble("b", text, false);
      setMood("caring");
      typeRow.hidden = false;
      if (!chips.children.length) renderChips(brain.greet(context({ seenToday: true })).suggestions);
      talking(true);
      Promise.resolve(ctx.say(text, lang)).catch(() => {}).then(() => talking(false));
    }
    function saveSession() {
      session = { pid, at: Date.now(), msgs: msgs.slice(), lastTopics: lastTopics.slice(), lang };
    }

    mic.addEventListener("click", listen);
    kbd.addEventListener("click", () => {
      typeRow.hidden = !typeRow.hidden;
      if (!typeRow.hidden) input.focus();
    });
    typeRow.addEventListener("submit", e => {
      e.preventDefault();
      const v = input.value;
      input.value = "";
      send(v);
    });

    /* ---------- start ---------- */
    labels();
    if (restore && msgs.length) {
      msgs.slice().forEach(m => bubble(m.who, m.text, false));
      setMood("happy");
      renderChips(brain.greet(context({ seenToday: true })).suggestions);
      session = null;
      saveSession();
    } else {
      const today = dayKey();
      const seenToday = ctx.data.get("greetDay", null) === today;
      ctx.data.set("greetDay", today);
      buddySays(brain.greet(context({ seenToday })));
    }

    return function cleanup() {
      alive = false;
      clearTimeout(thinkTimer);
      try { ctx.stopVoice(); } catch (e) { /* ignore */ }
      ctx.screen.classList.remove("bd-host");
      if (msgs.length) saveSession();
    };
  }

  /* A dream chosen in "बड़े होकर" is remembered for the buddy too (latest wins). */
  if (typeof NS.on === "function") {
    NS.on("dream:chosen", ev => {
      const t = ev && ev.title && (ev.title.hi || ev.title.en);
      const data = NS.activeData && NS.activeData("buddy");
      if (t && data) data.set("dream", String(t).slice(0, 30));
    });
  }

  NS.registerActivity({
    id: "buddy",
    icon: "🦜",
    title: { hi: "बात बडी", en: "Talk Buddy", hinglish: "Baat Buddy" },
    color: "#2EAD6B",
    section: "play",
    free: true,
    order: 1,
    open,
  });
})();
