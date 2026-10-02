/* नन्हा स्कूल — "संगीत" (music). Every sound is synthesised with WebAudio — no audio files.
     🎹 ज़ाइलोफ़ोन      eight rainbow bars (सा रे ग म प ध नि सां), tap or slide a finger across
     🥁 ढोलक           three drum sounds (धा, ता, टिक) and an optional gentle ताल to play along with
     👂 सुनो और बजाओ   listen to 2–5 notes, then play them back (memory & rhythm). Grows with age:
                       2–3 years: 3 bars, 2→3 notes · 4–5: 5 bars, 3→4 notes · 6+: 8 bars, 3→5 notes.
                       A miss just plays the tune again (with a glowing hint after two); no score.
     🎶 गाना बजाओ      play-along with an original tune ("चिड़िया की धुन"): the next bar glows; for
                       2–3 year olds any tap plays the next note (like a music box).
   Mute: the header's 🔊 button is NS.store.settings().sound (false = muted, the same switch the
   voice uses). While it is off nothing here makes a sound — the bars still light up — and a
   small note says how to turn sound on; "settings:changed" {key: "sound"} updates it live.
   (NS.sfx's own "sound effects" switch only covers the little effects, not the instruments.)

   Pure logic for tools/test/create.test.mjs: NS.create.music. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.create = NS.create || {};

  /* C major from C5: सा रे ग म प ध नि सां (sargam) / Do Re Mi … for English */
  const SCALE = [
    { f: 523.25, hi: "सा", en: "Do", hinglish: "Sa", c: "#E53935" },
    { f: 587.33, hi: "रे", en: "Re", hinglish: "Re", c: "#FB8C00" },
    { f: 659.25, hi: "ग", en: "Mi", hinglish: "Ga", c: "#FDD835", ink: "#5D4037" },
    { f: 698.46, hi: "म", en: "Fa", hinglish: "Ma", c: "#7CB342" },
    { f: 783.99, hi: "प", en: "So", hinglish: "Pa", c: "#00ACC1" },
    { f: 880.0, hi: "ध", en: "La", hinglish: "Dha", c: "#1E88E5" },
    { f: 987.77, hi: "नि", en: "Ti", hinglish: "Ni", c: "#8E24AA" },
    { f: 1046.5, hi: "सां", en: "Do", hinglish: "Sa", c: "#EC407A" },
  ];
  const DRUMS = [
    { id: "dha", hi: "धा", en: "Dha", c: "#8D6E63", size: 1 },
    { id: "ta", hi: "ता", en: "Ta", c: "#FFB300", size: 0.86 },
    { id: "tik", hi: "टिक", en: "Tik", c: "#26A69A", size: 0.72 },
  ];
  /* ताल (keherwa-like, 8 beats): which drum sounds on each beat (null = rest) */
  const TAAL = ["dha", "tik", "ta", "tik", "ta", "tik", "dha", "ta"];
  /* An original little tune, "चिड़िया की धुन" — [scale index, beats] */
  const TUNE = [
    [0, 1], [2, 1], [4, 1], [4, 1], [5, 1], [4, 1], [2, 2],
    [3, 1], [2, 1], [1, 1], [0, 1], [1, 1], [2, 1], [1, 2],
    [0, 1], [2, 1], [4, 1], [4, 1], [5, 1], [4, 1], [7, 2],
    [6, 1], [5, 1], [4, 1], [2, 1], [1, 1], [1, 1], [0, 2],
  ];
  const band = a => (a === "2-3" || a === "6+" ? a : "4-5");
  /* listen-and-play settings for an age band */
  function memoryLevel(ageBand) {
    const b = band(ageBand);
    if (b === "2-3") return { keys: [0, 2, 4], start: 2, max: 3, gap: 760, repeats: false };
    if (b === "6+") return { keys: [0, 1, 2, 3, 4, 5, 6, 7], start: 3, max: 5, gap: 480, repeats: true };
    return { keys: [0, 1, 2, 3, 4], start: 3, max: 4, gap: 600, repeats: false };
  }
  /* round 0, 1, 2…: how many notes (grows by one after each success up to the band's maximum) */
  function patternLength(ageBand, round) {
    const L = memoryLevel(ageBand);
    return Math.min(L.max, L.start + Math.max(0, round | 0));
  }
  /* a pattern of scale indices for this band and round */
  function makePattern(ageBand, round, rand) {
    rand = rand || Math.random;
    const L = memoryLevel(ageBand);
    const n = patternLength(ageBand, round);
    const out = [];
    while (out.length < n) {
      let j = Math.floor(rand() * L.keys.length) % L.keys.length;
      if (!(j >= 0)) j = 0;
      /* no note twice in a row for the younger bands: take its neighbour instead (never loops) */
      if (!L.repeats && out.length && out[out.length - 1] === L.keys[j]) j = (j + 1) % L.keys.length;
      out.push(L.keys[j]);
    }
    return out;
  }
  /* the child's next tap against the pattern: "ok" (keep going), "done" (all right) or "miss" */
  function checkTap(pattern, pos, key) {
    if (pattern[pos] !== key) return "miss";
    return pos + 1 >= pattern.length ? "done" : "ok";
  }
  /* the tune for an age band: little ones play the first half */
  const tuneFor = ageBand => (band(ageBand) === "2-3" ? TUNE.slice(0, 14) : TUNE.slice());
  NS.create.music = { SCALE, DRUMS, TAAL, TUNE, memoryLevel, patternLength, makePattern, checkTap, tuneFor };

  /* ---------------- sound (WebAudio) ---------------- */
  const AC = window.AudioContext || window.webkitAudioContext || null;
  const soundOn = () => { try { return !(NS.store && NS.store.settings && NS.store.settings().sound === false); } catch (e) { return true; } };
  function engine() {
    let ac = null, master = null, noise = null;
    function ensure() {
      if (!AC || !soundOn()) return null;
      if (!ac) {
        try { ac = new AC({ latencyHint: "interactive" }); } catch (e) { try { ac = new AC(); } catch (x) { return null; } }
        const comp = ac.createDynamicsCompressor();
        master = ac.createGain();
        master.connect(comp);
        comp.connect(ac.destination);
        const len = Math.floor(ac.sampleRate * 0.5);
        noise = ac.createBuffer(1, len, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") { try { ac.resume().catch(() => {}); } catch (e) { /* ignore */ } }
      let night = false;
      try { night = NS.daypart() === "night"; } catch (e) { /* day */ }
      master.gain.setValueAtTime(night ? 0.4 : 0.75, ac.currentTime);
      return ac;
    }
    const env = (g, t, peak, decay) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    };
    function osc(type, f, t, peak, decay, dest) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      env(g, t, peak, decay);
      o.connect(g); g.connect(dest || master);
      o.start(t); o.stop(t + decay + 0.05);
      return o;
    }
    function noiseHit(t, freq, q, peak, decay) {
      const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise;
      bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = q;
      env(g, t, peak, decay);
      s.connect(bp); bp.connect(g); g.connect(master);
      s.start(t); s.stop(t + decay + 0.05);
    }
    return {
      /* a wooden mallet bar: the fundamental + a bright, quickly fading 4th partial */
      bar(i, at) {
        const c = ensure();
        if (!c) return false;
        const t = Math.max(c.currentTime + 0.005, at || 0), f = SCALE[i] ? SCALE[i].f : 523.25;
        osc("sine", f, t, 0.42, 1.3);
        osc("sine", f * 3.99, t, 0.12, 0.16);
        osc("triangle", f * 2, t, 0.05, 0.4);
        noiseHit(t, 3000, 0.8, 0.05, 0.03);
        return true;
      },
      drum(id, at) {
        const c = ensure();
        if (!c) return false;
        const t = Math.max(c.currentTime + 0.005, at || 0);
        if (id === "dha") {            // deep, bending bass head + a soft ring
          const o = osc("sine", 140, t, 0.9, 0.7);
          o.frequency.exponentialRampToValueAtTime(58, t + 0.35);
          osc("sine", 330, t, 0.12, 0.35);
          noiseHit(t, 400, 0.7, 0.18, 0.06);
        } else if (id === "ta") {      // ringing treble head
          osc("sine", 420, t, 0.4, 0.55);
          osc("sine", 840, t, 0.14, 0.35);
          osc("sine", 1260, t, 0.06, 0.2);
          noiseHit(t, 2600, 1.2, 0.12, 0.025);
        } else {                       // a dry slap
          noiseHit(t, 1800, 1, 0.5, 0.08);
          osc("triangle", 900, t, 0.1, 0.06);
        }
        return true;
      },
      now() { return ac ? ac.currentTime : 0; },
      close() { if (ac) { const a = ac; ac = null; try { a.close().catch(() => {}); } catch (e) { /* ignore */ } } },
    };
  }

  /* ---------------- UI ---------------- */
  const CSS = `
.music-wrap{display:flex;flex-direction:column;gap:10px;flex:1 1 auto;min-height:0;width:100%;max-width:1040px;margin:0 auto}
.music-bar{display:flex;align-items:center;gap:8px}
.music-rb{width:56px;height:56px;flex:0 0 auto;border:none;border-radius:50%;padding:0;background:var(--surface);color:var(--ink);font-size:24px;line-height:1;display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.12);touch-action:manipulation}
.music-bt{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(19px,5vw,28px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.music-cap{margin:0;text-align:center;font-weight:700;font-size:clamp(16px,4.3vw,22px);line-height:1.35;min-height:1.35em;text-wrap:balance}
.music-mute{margin:0;text-align:center;font-weight:800;font-size:clamp(15px,4vw,18px);background:#FFF3CD;color:#6D4C00;border-radius:14px;padding:6px 10px}
.music-work{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto minmax(200px,1fr) auto;grid-template-areas:"bar" "mute" "cap" "stage" "side"}
.music-work>.music-bar{grid-area:bar}.music-work>.music-mute{grid-area:mute}.music-work>.music-cap{grid-area:cap}.music-work>.music-stage{grid-area:stage}.music-work>.music-side{grid-area:side}
@media (orientation:landscape) and (min-aspect-ratio:5/4){
  .music-work{grid-template-columns:minmax(0,1fr) minmax(230px,34%);grid-template-rows:auto auto auto minmax(0,1fr);grid-template-areas:"stage bar" "stage mute" "stage cap" "stage side"}
  .music-work>.music-side{align-self:start}
}
.music-side{display:flex;flex-direction:column;gap:8px;min-width:0}
.music-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.music-tile{border:none;border-radius:24px;min-height:130px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-weight:800;font-size:clamp(17px,4.6vw,21px);color:#2D2A32;box-shadow:0 4px 0 rgba(0,0,0,.1);touch-action:manipulation}
.music-tile .music-big{font-size:clamp(44px,12vw,60px);line-height:1}
.music-xylo{flex:1 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;gap:clamp(4px,1.4vw,12px);padding:10px clamp(6px,2vw,18px);border-radius:26px;background:linear-gradient(#8D6E63,#6D4C41);box-shadow:var(--shadow);touch-action:none;-webkit-user-select:none;user-select:none}
.music-key{flex:1 1 0;min-width:0;max-width:110px;border:none;border-radius:14px;padding:0;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:space-between;color:#fff;font-weight:800;font-size:clamp(15px,4.2vw,24px);text-shadow:0 2px 0 rgba(0,0,0,.25);box-shadow:inset 0 -6px 0 rgba(0,0,0,.18),0 4px 0 rgba(0,0,0,.25);touch-action:none;transition:transform .08s,filter .08s}
.music-key::before,.music-key::after{content:"";width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.75);margin:10px 0;box-shadow:0 1px 0 rgba(0,0,0,.3)}
.music-key span{position:absolute;top:50%;left:0;right:0;transform:translateY(-50%);text-align:center;pointer-events:none}
.music-key.music-on{transform:scale(.96);filter:brightness(1.3) saturate(1.1)}
.music-key.music-glow{outline:5px solid #FFF59D;outline-offset:3px;animation:music-pulse 1s ease-in-out infinite}
@keyframes music-pulse{50%{outline-color:#FFFFFF}}
.music-pads{flex:1 1 auto;min-height:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:clamp(10px,3vw,28px);padding:10px;touch-action:none;-webkit-user-select:none;user-select:none}
.music-pad{border:none;border-radius:50%;aspect-ratio:1;display:grid;place-items:center;color:#fff;font-weight:800;font-size:clamp(22px,6vw,36px);text-shadow:0 2px 0 rgba(0,0,0,.25);box-shadow:inset 0 0 0 8px rgba(255,255,255,.35),inset 0 -10px 0 rgba(0,0,0,.18),0 6px 0 rgba(0,0,0,.25);touch-action:none;transition:transform .08s}
.music-pad.music-on{transform:scale(.92)}
.music-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.music-btn{border:none;border-radius:999px;min-height:56px;padding:8px 16px;font-weight:800;font-size:clamp(16px,4.2vw,20px);background:var(--surface);color:var(--ink);box-shadow:0 4px 0 rgba(0,0,0,.12);touch-action:manipulation}
.music-btn.music-go{background:#1E88E5;color:#fff;box-shadow:0 4px 0 #1565C0}
.music-btn[aria-pressed="true"]{background:#1E88E5;color:#fff}
.music-stars{text-align:center;font-size:26px;min-height:34px;letter-spacing:4px}
.music-prog{height:12px;border-radius:999px;background:var(--line);overflow:hidden}
.music-prog i{display:block;height:100%;width:0;background:linear-gradient(90deg,#FDD835,#FB8C00);transition:width .2s}
@media (prefers-reduced-motion:reduce){.music-key.music-glow{animation:none}.music-key,.music-pad{transition:none}}
@media (max-height:560px) and (orientation:landscape){
  .music-wrap{gap:8px}.music-rb{width:50px;height:50px}.music-bt{font-size:20px}.music-cap{font-size:16px}
  .music-xylo{min-height:0}.music-pads{min-height:0}.music-btn{min-height:50px;padding:5px 12px;font-size:16px}
  .music-tile{min-height:96px}.music-key::before,.music-key::after{margin:6px 0}
}`;

  NS.registerActivity({
    id: "music",
    icon: "🥁",
    title: { hi: "संगीत", en: "Music", hinglish: "Sangeet" },
    color: "#1E88E5",
    section: "play",
    free: false,
    order: 40,
    open(ctx) {
      if (!document.getElementById("music-style")) {
        const st = document.createElement("style");
        st.id = "music-style";
        st.textContent = CSS;
        document.head.appendChild(st);
      }
      const P = "music";
      const timers = new Set();
      let alive = true, lastSay = null, muteNote = null, stopLoop = null;
      const snd = engine();
      const T = o => (o == null ? "" : typeof o === "string" ? o : ctx.t(o));
      const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map(x => P + "-" + x).join(" ") : null, text == null ? null : String(text));
      const btn = (label, c, fn, aria) => { const b = ctx.button(label, c.split(" ").map(x => P + "-" + x).join(" "), fn); if (aria) b.setAttribute("aria-label", aria); return b; };
      const sfx = n => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* quiet */ } };
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
      const say = o => { const s = T(o); lastSay = s; return Promise.resolve(ctx.say(s)).catch(() => {}); };
      const age = (ctx.profile && ctx.profile.ageBand) || "4-5";
      const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
      const rewarded = {};
      const award = (key, sticker, reason, after) => {
        if (rewarded[key]) return;
        rewarded[key] = true;
        Promise.resolve(after).then(() => { if (alive) ctx.reward({ sticker, reason }); });
      };
      const muteText = { hi: "🔇 आवाज़ बंद है — सुनने के लिए ऊपर 🔇 दबाओ।", en: "🔇 Sound is off — tap 🔇 at the top to hear it.", hinglish: "🔇 Awaaz band hai — upar 🔇 dabao." };
      const offSettings = NS.on ? NS.on("settings:changed", ev => {
        if (!ev || ev.key !== "sound") return;
        if (muteNote) muteNote.hidden = soundOn();
        if (!soundOn()) { if (stopLoop) stopLoop(); snd.close(); }
      }) : null;
      const clean = () => {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        if (stopLoop) stopLoop();
      };
      function page(title, onBack, work) {
        clean();
        const root = ctx.screen;
        while (root.firstChild) root.removeChild(root.firstChild);
        const w = el("div", work ? "wrap work" : "wrap");
        if (title != null) {
          const bar = el("div", "bar");
          bar.append(btn("⬅️", "rb", onBack, T({ hi: "वापस", en: "Back", hinglish: "Wapas" })), el("div", "bt", title),
            btn("🔊", "rb", () => { if (lastSay) say(lastSay); }, T({ hi: "फिर से सुनो", en: "Hear again", hinglish: "Phir se suno" })));
          w.appendChild(bar);
        }
        muteNote = el("p", "mute", T(muteText));
        muteNote.setAttribute("role", "status");
        muteNote.hidden = soundOn();
        w.appendChild(muteNote);
        root.appendChild(w);
        return w;
      }
      const flash = (node, ms) => { node.classList.add("music-on"); later(() => node.classList.remove("music-on"), ms || 160); };
      const label = s => T({ hi: s.hi, en: s.en, hinglish: s.hinglish });

      /* a set of xylophone bars; onHit(index, viaSlide) is called for every bar struck */
      function xylophone(keys, onHit) {
        const box = el("div", "xylo stage");
        const n = keys.length;
        const bars = keys.map((k, j) => {
          const s = SCALE[k];
          const b = btn("", "key", e => { if (e.detail === 0) hit(j, false); }, T({ hi: "सुर ", en: "Note ", hinglish: "Sur " }) + label(s));
          b.dataset.sfx = "none";
          b.dataset.j = String(j);
          b.style.background = s.c;
          if (s.ink) { b.style.color = s.ink; b.style.textShadow = "none"; }
          b.style.height = Math.round(100 - (j * 34) / Math.max(1, n - 1)) + "%";
          b.appendChild(el("span", null, label(s)));
          box.appendChild(b);
          return b;
        });
        const down = new Map();          // pointerId → last bar index
        /* onHit may return a scale index to sound instead (the music-box play-along) */
        function hit(j, slide) {
          const r = onHit(keys[j], j, slide);
          const k = typeof r === "number" ? r : keys[j];
          const bj = keys.indexOf(k);
          snd.bar(k);
          flash(bars[bj >= 0 ? bj : j]);
        }
        const barAt = (x, y) => { const e = document.elementFromPoint(x, y); const b = e && e.closest ? e.closest("." + P + "-key") : null; return b && box.contains(b) ? Number(b.dataset.j) : -1; };
        box.addEventListener("pointerdown", e => {
          const j = barAt(e.clientX, e.clientY);
          if (j < 0) return;
          e.preventDefault();
          down.set(e.pointerId, j);
          hit(j, false);
        });
        box.addEventListener("pointermove", e => {
          if (!down.has(e.pointerId)) return;
          const j = barAt(e.clientX, e.clientY);
          if (j >= 0 && j !== down.get(e.pointerId)) { down.set(e.pointerId, j); hit(j, true); }
        });
        const up = e => down.delete(e.pointerId);
        box.addEventListener("pointerup", up);
        box.addEventListener("pointercancel", up);
        box.addEventListener("contextmenu", e => e.preventDefault());
        return { box, bars };
      }

      /* ---------- menu ---------- */
      function menu() {
        const w = page(null);
        const intro = { hi: "चलो संगीत बजाएँ! कौन-सा बाजा?", en: "Let's make music! Which one?", hinglish: "Chalo sangeet bajayein! Kaun sa baaja?" };
        w.appendChild(el("p", "cap", T(intro)));
        const grid = el("div", "menu");
        [
          { e: "🎹", t: { hi: "ज़ाइलोफ़ोन", en: "Xylophone", hinglish: "Xylophone" }, c: "#FFCDD2", go: xylo },
          { e: "🥁", t: { hi: "ढोलक", en: "Dholak drum", hinglish: "Dholak" }, c: "#FFE0B2", go: drums },
          { e: "👂", t: { hi: "सुनो और बजाओ", en: "Listen and play", hinglish: "Suno aur bajao" }, c: "#C8E6C9", go: () => memory(0) },
          { e: "🎶", t: { hi: "गाना बजाओ", en: "Play a song", hinglish: "Gaana bajao" }, c: "#BBDEFB", go: song },
        ].forEach(g => {
          const b = btn("", "tile", () => g.go(), T(g.t));
          b.style.background = g.c;
          b.append(el("span", "big", g.e), el("span", null, T(g.t)));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      /* ---------- free xylophone ---------- */
      function xylo() {
        const w = page("🎹 " + T({ hi: "ज़ाइलोफ़ोन", en: "Xylophone", hinglish: "Xylophone" }), menu, true);
        const m = { hi: "रंग-बिरंगी पट्टियों पर दबाओ — या उँगली फिसलाओ! सा रे ग म प ध नि सां।", en: "Tap the rainbow bars — or slide your finger across! Do re mi fa so la ti do.", hinglish: "Rang-birangi pattiyon par dabao — ya ungli phislao!" };
        w.appendChild(el("p", "cap", T(m)));
        let hits = 0;
        const x = xylophone([0, 1, 2, 3, 4, 5, 6, 7], () => {
          hits++;
          if (hits === 24) award("xylo", "🎹", { hi: "ज़ाइलोफ़ोन बजाया!", en: "Played the xylophone!" }, say({ hi: "वाह, कितना मीठा संगीत!", en: "Wow, what sweet music!", hinglish: "Waah, kitna meetha sangeet!" }));
        });
        w.appendChild(x.box);
        say(m);
      }

      /* ---------- dholak ---------- */
      function drums() {
        const w = page("🥁 " + T({ hi: "ढोलक", en: "Dholak drum", hinglish: "Dholak" }), menu, true);
        const m = { hi: "धा, ता, टिक! ढोलक पर थाप दो। चाहो तो ताल चलाकर साथ में बजाओ।", en: "Dha, ta, tik! Tap the drum. Turn on the beat and play along if you like.", hinglish: "Dha, ta, tik! Dholak par thaap do." };
        w.appendChild(el("p", "cap", T(m)));
        const pads = el("div", "pads stage");
        const padEls = {};
        let hits = 0;
        DRUMS.forEach(d => {
          const b = btn(T({ hi: d.hi, en: d.en, hinglish: d.en }), "pad", e => { if (e.detail === 0) strike(d.id); }, T({ hi: "ढोलक ", en: "Drum " }) + T({ hi: d.hi, en: d.en }));
          b.dataset.sfx = "none";
          b.style.background = "radial-gradient(circle at 50% 45%, " + d.c + "CC, " + d.c + ")";
          b.style.width = "clamp(" + Math.round(90 * d.size) + "px, " + Math.round(28 * d.size) + "vmin, " + Math.round(220 * d.size) + "px)";
          b.addEventListener("pointerdown", e => { e.preventDefault(); strike(d.id); });
          b.addEventListener("contextmenu", e => e.preventDefault());
          padEls[d.id] = b;
          pads.appendChild(b);
        });
        function strike(id) {
          snd.drum(id);
          flash(padEls[id], 120);
          hits++;
          if (hits === 20) award("drum", "🥁", { hi: "ढोलक बजाई!", en: "Played the dholak!" }, say({ hi: "धिन धिन! बढ़िया ताल!", en: "Dhin dhin! Great rhythm!", hinglish: "Dhin dhin! Badhiya taal!" }));
        }
        w.appendChild(pads);
        const row = el("div", "row side");
        const loopBtn = btn("🎵 " + T({ hi: "ताल चलाओ", en: "Play a beat", hinglish: "Taal chalao" }), "btn", () => (stopLoop ? stopLoop() : startLoop()));
        loopBtn.setAttribute("aria-pressed", "false");
        row.appendChild(loopBtn);
        w.appendChild(row);
        /* a soft background beat (about 100 beats a minute) the child can play along with */
        function startLoop() {
          if (!soundOn()) { say(muteText); return; }
          let beat = 0, id = null;
          const tick = () => {
            if (!alive) return;
            const k = TAAL[beat % TAAL.length];
            if (k) { snd.drum(k); if (padEls[k] && !reduced) flash(padEls[k], 90); }
            beat++;
            id = setTimeout(tick, 300);
          };
          stopLoop = () => { clearTimeout(id); stopLoop = null; loopBtn.setAttribute("aria-pressed", "false"); loopBtn.textContent = "🎵 " + T({ hi: "ताल चलाओ", en: "Play a beat", hinglish: "Taal chalao" }); };
          loopBtn.setAttribute("aria-pressed", "true");
          loopBtn.textContent = "⏹️ " + T({ hi: "ताल रोको", en: "Stop the beat", hinglish: "Taal roko" });
          tick();
        }
        say(m);
      }

      /* ---------- सुनो और बजाओ ---------- */
      function memory(round) {
        const w = page("👂 " + T({ hi: "सुनो और बजाओ", en: "Listen and play", hinglish: "Suno aur bajao" }), menu, true);
        const L = memoryLevel(age);
        const pattern = makePattern(age, round);
        const cap = el("p", "cap", "");
        w.appendChild(cap);
        let pos = 0, misses = 0, listening = true;
        const x = xylophone(L.keys, k => {
          if (listening) return;
          const r = checkTap(pattern, pos, k);
          if (r === "miss") {
            misses++;
            listening = true;
            sfx("tryagain");
            const o = misses >= 2
              ? { hi: "कोई बात नहीं! फिर से सुनो — चमकती पट्टी देखो।", en: "That's okay! Listen again — watch the glowing bar.", hinglish: "Koi baat nahi! Phir se suno — chamakti patti dekho." }
              : { hi: "हम्म, फिर से ध्यान से सुनो!", en: "Hmm, listen carefully once more!", hinglish: "Hmm, phir se dhyan se suno!" };
            cap.textContent = T(o);
            say(o).then(() => later(play, 400));
            return;
          }
          pos++;
          if (misses >= 2) hint();
          if (r === "done") {
            listening = true;
            clearHint();
            stars.textContent += "⭐";
            sfx("correct");
            const o = [{ hi: "शाबाश! बिल्कुल वैसा ही बजाया!", en: "Well done! You played it just the same!", hinglish: "Shabash! Bilkul waisa hi bajaya!" },
              { hi: "वाह! तुम्हारे कान बहुत तेज़ हैं!", en: "Wow! You have sharp ears!", hinglish: "Waah! Tumhare kaan bahut tez hain!" }][round % 2];
            cap.textContent = T(o);
            const p = say(o);
            if (round + 1 >= 3) award("memory", "👂", { hi: "ध्यान से सुना और बजाया!", en: "Listened and played!" }, p);
            const next = btn("➡️ " + T({ hi: "अगला", en: "Next", hinglish: "Agla" }), "btn go", () => memory(round + 1));
            row.replaceChildren(next);
          }
        });
        w.appendChild(x.box);
        const side = el("div", "side");
        const stars = el("div", "stars", "⭐".repeat(Math.min(round, 12)));
        const row = el("div", "row");
        side.append(stars, row);
        w.appendChild(side);
        row.appendChild(btn("🔁 " + T({ hi: "फिर से सुनाओ", en: "Play it again", hinglish: "Phir se sunao" }), "btn", () => { if (!listening) { listening = true; play(); } }));
        const barOf = k => x.bars[L.keys.indexOf(k)];
        const clearHint = () => x.bars.forEach(b => b.classList.remove("music-glow"));
        const hint = () => { clearHint(); if (pos < pattern.length) barOf(pattern[pos]).classList.add("music-glow"); };
        function play() {
          if (!alive) return;
          listening = true;
          pos = 0;
          clearHint();
          const o = { hi: "सुनो…", en: "Listen…", hinglish: "Suno…" };
          cap.textContent = T(o) + " " + pattern.length + " " + T({ hi: "सुर", en: "notes", hinglish: "sur" });
          const gap = L.gap * (misses >= 2 ? 1.3 : 1);
          let started = false;
          const notes = () => {
            if (started || !alive) return;
            started = true;
            pattern.forEach((k, i) => later(() => { snd.bar(k); flash(barOf(k), gap * 0.6); }, 250 + i * gap));
            later(() => {
              listening = false;
              const t = { hi: "अब तुम बजाओ!", en: "Now you play!", hinglish: "Ab tum bajao!" };
              cap.textContent = T(t);
              say(t);
              if (misses >= 2) hint();
            }, 250 + pattern.length * gap + 200);
          };
          say(o).then(notes);
          later(notes, 2500);              // never wait long for the voice
        }
        const intro = round === 0
          ? { hi: "मैं कुछ सुर बजाऊँगा — ध्यान से सुनो और देखो, फिर वैसे ही बजाना!", en: "I'll play a few notes — listen and watch, then play them the same way!", hinglish: "Main kuch sur bajaunga — dhyan se suno, phir waise hi bajana!" }
          : { hi: "अगली धुन, " + pattern.length + " सुरों की!", en: "Next tune, with " + pattern.length + " notes!", hinglish: "Agli dhun, " + pattern.length + " suron ki!" };
        cap.textContent = T(intro);
        say(intro).then(() => later(play, 300));
      }

      /* ---------- गाना बजाओ (play-along) ---------- */
      function song() {
        const tune = tuneFor(age);
        const easy = age === "2-3";
        const w = page("🎶 " + T({ hi: "चिड़िया की धुन", en: "Little bird tune", hinglish: "Chidiya ki dhun" }), menu, true);
        const cap = el("p", "cap", "");
        w.appendChild(cap);
        let pos = 0, missRun = 0, auto = false;
        const x = xylophone([0, 1, 2, 3, 4, 5, 6, 7], (k, j, slide) => {
          if (auto || slide) return;
          if (pos >= tune.length) return;
          const want = tune[pos][0];
          if (easy || k === want) { missRun = 0; step(); return want; }     // little ones: any tap plays the next note
          missRun++;
          if (missRun === 3) { const o = { hi: "चमकती हुई पट्टी दबाओ!", en: "Tap the glowing bar!", hinglish: "Chamakti hui patti dabao!" }; cap.textContent = T(o); say(o); missRun = 0; }
        });
        w.appendChild(x.box);
        const prog = el("div", "prog");
        const fill = document.createElement("i");
        prog.appendChild(fill);
        const side = el("div", "side");
        const row = el("div", "row");
        side.append(prog, row);
        const listenBtn = btn("▶️ " + T({ hi: "पूरा गाना सुनो", en: "Hear the whole song", hinglish: "Poora gaana suno" }), "btn", () => listenAll());
        const againBtn = btn("🔁 " + T({ hi: "शुरू से", en: "From the start", hinglish: "Shuru se" }), "btn", () => { pos = 0; show(); });
        row.append(listenBtn, againBtn);
        w.appendChild(side);
        const show = () => {
          x.bars.forEach(b => b.classList.remove("music-glow"));
          fill.style.width = Math.round(100 * pos / tune.length) + "%";
          if (pos < tune.length && !auto) x.bars[tune[pos][0]].classList.add("music-glow");
        };
        function step() {
          pos++;
          show();
          if (pos >= tune.length) {
            sfx("sparkle");
            const o = { hi: "वाह! तुमने पूरा गाना बजा दिया! फिर से बजाएँ?", en: "Wow! You played the whole song! Again?", hinglish: "Waah! Tumne poora gaana baja diya!" };
            cap.textContent = T(o);
            award("song", "🎶", { hi: "पूरा गाना बजाया!", en: "Played a whole song!" }, say(o));
          }
        }
        function listenAll() {
          if (auto) return;
          auto = true;
          show();
          let t = 300;
          tune.forEach(([k, beats]) => { const at = t; later(() => { snd.bar(k); flash(x.bars[k], 260); }, at); t += beats * 380; });
          later(() => { auto = false; show(); }, t + 100);
        }
        const intro = easy
          ? { hi: "किसी भी पट्टी पर दबाओ — गाना अपने-आप बजेगा!", en: "Tap any bar — the song plays note by note!", hinglish: "Kisi bhi patti par dabao — gaana apne-aap bajega!" }
          : { hi: "जो पट्टी चमके, उसे दबाओ — और गाना बजेगा!", en: "Tap the bar that glows — and the song plays!", hinglish: "Jo patti chamke, use dabao — gaana bajega!" };
        cap.textContent = T(intro);
        show();
        say(intro);
      }

      menu();
      return () => { alive = false; clean(); if (offSettings) offSettings(); snd.close(); try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    },
  });
})();
