/* नन्हा स्कूल — "जादुई खिड़की" (Magic Window), section "future" (कल की दुनिया).

   A window into another world on top of the real one — the feeling of VR/AR without the words:
   - Window scenes (default, every age): a jungle / sea / space / garden panorama in parallax
     layers. Tilting or turning the phone looks around (DeviceOrientationEvent; on iPhone a button
     asks permission first); without a gyroscope the child drags with a finger (or uses ◀ ▶).
     Animals hide behind bushes and peek out when the child looks their way; a tap brings them out.
   - "असली कमरे में तितली" (4+ only, off by default): after a grown-up answers a question inside
     this activity, the rear camera shows the real room and a drawn butterfly flies over it; taps
     plant flowers it visits. Video only, never recorded or sent; stopped on exit, when the app is
     hidden, and after about 5 minutes (a calm "अब असली दुनिया में ढूँढो!" — no countdown).
   Every scene ends by sending the child back to the real world (an off-screen mission).
   Scenes: NS.content.future.windows (web/js/content/future.js). Pure logic: NS.future.magic. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.future = NS.future || {};

  /* ---------------- pure logic (unit-tested) ---------------- */
  const BANDS = ["2-3", "4-5", "6+"];
  const rank = (b) => Math.max(0, BANDS.indexOf(b));
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  /* signed difference of two compass angles, -180…180 */
  const angDiff = (from, to) => ((((to - from) % 360) + 540) % 360) - 180;
  /* device orientation (degrees) → where the window looks: x, y in -1…1 (-1 = left / top).
     base = the orientation when looking started; angle = screen orientation (0, 90, -90, 180). */
  function panFromTilt(o, base, angle) {
    if (!o || typeof o.beta !== "number" || typeof o.gamma !== "number") return null;
    const b = base || o;
    let turn = typeof o.alpha === "number" && typeof b.alpha === "number" ? -angDiff(b.alpha, o.alpha) / 45 : 0;
    let x, y;
    const a = ((angle || 0) % 360 + 360) % 360;
    if (a === 90) { x = (b.beta - o.beta) / 28; y = (b.gamma - o.gamma) / 25; }
    else if (a === 270) { x = (o.beta - b.beta) / 28; y = (o.gamma - b.gamma) / 25; }
    else if (a === 180) { x = (b.gamma - o.gamma) / 28; y = (o.beta - b.beta) / 25; }
    else { x = (o.gamma - b.gamma) / 28; y = (b.beta - o.beta) / 25; }
    if (!isFinite(turn)) turn = 0;
    return { x: clamp(x + turn, -1, 1), y: clamp(y, -1, 1) };
  }
  /* a layer of depth d (0 far … 1 near) is (1 + 2d) windows wide; this is how far it slides */
  function layerShift(panX, depth, viewW) {
    const lw = viewW * (1 + 2 * depth);
    return { width: lw, x: 0 - ((clamp(panX, -1, 1) + 1) / 2) * (lw - viewW) };
  }
  /* where a thing at u (0–100 across the panorama) on layer d appears on screen (px) */
  function screenX(u, depth, panX, viewW) { const s = layerShift(panX, depth, viewW); return (u / 100) * s.width + s.x; }
  const inView = (sx, viewW) => sx > viewW * 0.18 && sx < viewW * 0.82;
  function animalsFor(scene, band) { const n = band === "2-3" ? 3 : band === "4-5" ? 4 : 99; return (scene.animals || []).slice(0, n); }
  const cameraAllowed = (band) => rank(band) >= 1;
  const CAMERA_MS = 5 * 60 * 1000;
  /* the grown-up question: a × b with a, b in 6…9; answers may use Devanagari digits */
  function gateQuestion(rand) { const r = rand || Math.random; const a = 6 + Math.floor(r() * 4), b = 6 + Math.floor(r() * 4); return { a, b, answer: a * b }; }
  function gateCheck(q, input) {
    const s = String(input == null ? "" : input).replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966)).trim();
    return /^\d+$/.test(s) && Number(s) === q.answer;
  }
  NS.future.magic = { panFromTilt, angDiff, layerShift, screenX, inView, animalsFor, cameraAllowed, gateQuestion, gateCheck, CAMERA_MS };

  /* ---------------- fixed spoken lines ---------------- */
  const L = {
    intro: { hi: "ये जादुई खिड़की है! इसमें से एक दूसरी दुनिया दिखती है। कौन-सी दुनिया देखें?", en: "This is a magic window! It shows another world. Which world shall we look at?" },
    look: { hi: "खिड़की में देखो! कुछ जानवर छिपे हैं। इधर-उधर देखकर उन्हें ढूँढो!", en: "Look through the window! Some animals are hiding. Look around to find them!" },
    tiltHint: { hi: "फ़ोन को धीरे-धीरे घुमाओ — खिड़की भी घूमेगी!", en: "Turn the phone slowly — the window turns too!" },
    dragHint: { hi: "उँगली से खिड़की को इधर-उधर खिसकाओ!", en: "Slide the window around with your finger!" },
    askTilt: { hi: "फ़ोन घुमाकर देखना है? ये बटन दबाओ!", en: "Want to look by turning the phone? Press this button!" },
    peek: { hi: "अरे! कोई झाँक रहा है! उसे छुओ!", en: "Oh! Someone is peeking! Tap it!" },
    allFound: { hi: "शाबाश! तुमने सबको ढूँढ लिया!", en: "Well done! You found everyone!" },
    eyes: { hi: "अब आँखों को आराम दो — बाहर खेलो और दूर तक देखो!", en: "Now rest your eyes — play outside and look far away!" },
    arTitle: { hi: "असली कमरे में तितली", en: "A butterfly in your room" },
    arKid: { hi: "जादू देखो! फ़ोन के कैमरे से तुम्हारे असली कमरे में एक जादुई तितली आएगी। पहले किसी बड़े को बुलाओ — वो कैमरा चालू करेंगे।", en: "Watch some magic! Through the phone's camera, a magic butterfly will fly into your real room. First call a grown-up — they will turn the camera on." },
    grown: { hi: "बड़ों के लिए: कैमरा चालू करें", en: "For grown-ups: turn the camera on" },
    gateSay: { hi: "यह हिस्सा बड़ों के लिए है।", en: "This part is for grown-ups." },
    gateWrong: { hi: "जवाब सही नहीं है। नया सवाल…", en: "That's not right. A new question…" },
    arStart: { hi: "देखो! तितली तुम्हारे कमरे में आ गई! स्क्रीन पर कहीं भी छुओ — वहाँ एक फूल उगेगा, और तितली उस पर बैठेगी।", en: "Look! The butterfly is in your room! Tap anywhere on the screen — a flower will grow there, and the butterfly will sit on it." },
    flower: { hi: "तितली फूल पर बैठ गई!", en: "The butterfly sat on the flower!" },
    tickle: { hi: "हीही! गुदगुदी हुई!", en: "Hee hee! That tickles!" },
    arEnd: { hi: "ये तितली जादू की थी — असली नहीं! अब असली दुनिया में ढूँढो — किसी बड़े के साथ बाहर जाकर असली तितली या फूल ढूँढो!", en: "That butterfly was magic — not real! Now look in the real world — go outside with a grown-up and find a real butterfly or flower!" },
    camDenied: { hi: "कैमरा चालू नहीं हुआ — कोई बात नहीं! चलो, तितली के जादुई बगीचे में चलें। नीचे बटन दबाओ।", en: "The camera didn't turn on — that's OK! Let's visit the butterfly's magic garden instead. Press the button below." },
    camNone: { hi: "इस फ़ोन में कैमरा नहीं मिला — कोई बात नहीं! चलो, तितली के जादुई बगीचे में चलें। नीचे बटन दबाओ।", en: "There's no camera here — that's OK! Let's visit the butterfly's magic garden instead. Press the button below." },
    camOff: { hi: "कैमरा बंद हो गया।", en: "The camera is off." },
    back: { hi: "वापस", en: "Back" },
    hear: { hi: "फिर से सुनो", en: "Hear again" },
    other: { hi: "दूसरी दुनिया", en: "Another world" },
    garden: { hi: "जादुई बगीचा", en: "Magic garden" },
    stop: { hi: "कैमरा बंद करो", en: "Turn the camera off" },
    recenter: { hi: "बीच में", en: "Centre" },
    left: { hi: "बाएँ देखो", en: "Look left" },
    right: { hi: "दाएँ देखो", en: "Look right" },
    tiltBtn: { hi: "फ़ोन घुमाकर देखो", en: "Look by turning the phone" },
    gateTitle: { hi: "यह हिस्सा माता-पिता के लिए है", en: "This part is for parents" },
    gatePrivacy: { hi: "कैमरे की तस्वीर सिर्फ़ इसी फ़ोन की स्क्रीन पर दिखती है। न कुछ रिकॉर्ड होता है, न सेव, न कहीं भेजा जाता है। आवाज़ (माइक) कभी नहीं ली जाती। इस खेल से बाहर निकलते ही, ऐप छिपते ही या लगभग 5 मिनट बाद कैमरा अपने-आप बंद हो जाता है। बच्चे के साथ बैठें।", en: "The camera picture is shown only on this phone's screen. Nothing is recorded, saved or sent anywhere, and the microphone is never used. The camera turns off when you leave this game, when the app is hidden, or after about 5 minutes. Please sit with your child." },
    gateAsk: { hi: "आगे जाने के लिए इस सवाल का जवाब लिखें:", en: "To continue, type the answer:" },
    gateGo: { hi: "कैमरा चालू करें", en: "Turn the camera on" },
    answer: { hi: "जवाब", en: "Answer" },
    onlyHere: { hi: "सिर्फ़ इस फ़ोन पर · कुछ रिकॉर्ड नहीं होता", en: "Only on this phone · nothing is recorded" },
  };
  const LABEL_ONLY = ["back", "hear", "other", "garden", "stop", "recenter", "left", "right", "tiltBtn", "gateTitle", "gatePrivacy", "gateAsk", "gateGo", "answer", "onlyHere", "grown", "arTitle"];
  NS.voiceLines = (NS.voiceLines || []).concat(Object.keys(L).filter((k) => LABEL_ONLY.indexOf(k) < 0).reduce((a, k) => a.concat([
    { lang: "hi", text: L[k].hi, section: "magic" }, { lang: "en", text: L[k].en, section: "magic" }]), []));

  /* ---------------- look ---------------- */
  const EMO = 'font-family:"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",var(--font,sans-serif)';
  const CSS = `
.magic-wrap{display:flex;flex-direction:column;gap:10px;width:100%;max-width:900px;margin:0 auto;box-sizing:border-box}
.magic-bar{display:flex;align-items:center;gap:8px}
.magic-rb{width:56px;height:56px;border-radius:50%;border:none;background:#fff;color:#2D2A32;box-shadow:0 3px 0 rgba(0,0,0,.12);font-size:24px;display:grid;place-items:center;flex:0 0 auto;padding:0;cursor:pointer;touch-action:manipulation}
.magic-bartitle{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(18px,5vw,24px);line-height:1.2;color:var(--ink,#2D2A32)}
.magic-head{font-size:clamp(24px,7vw,34px);font-weight:800;text-align:center;color:var(--ink,#2D2A32);margin:0}
.magic-say{margin:0;text-align:center;font-weight:700;font-size:clamp(17px,4.6vw,22px);line-height:1.4;color:var(--ink,#2D2A32);text-wrap:balance}
.magic-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.magic-tile{position:relative;border:none;border-radius:22px;min-height:124px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;color:#2D2A32;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.14);touch-action:manipulation}
.magic-tile-e{font-size:clamp(40px,11vw,54px);line-height:1}
.magic-tile-t{font-size:clamp(15px,4.2vw,19px);font-weight:800;text-align:center;line-height:1.2}
.magic-tick{position:absolute;top:6px;right:8px;font-size:20px}
.magic-ar{background:linear-gradient(135deg,#FFE0B2,#F8BBD0);grid-column:1/-1;min-height:96px;flex-direction:row;gap:12px}
.magic-frame{position:relative;width:100%;height:clamp(260px,58vh,560px);border-radius:26px;overflow:hidden;border:10px solid #8D6E63;box-shadow:inset 0 0 0 4px #A1887F,0 6px 0 rgba(0,0,0,.12);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab;outline:none;box-sizing:border-box}
.magic-frame:focus-visible{box-shadow:inset 0 0 0 4px #A1887F,0 0 0 4px var(--focus,#2F6BFF)}
.magic-layer{position:absolute;left:0;top:0;height:100%;will-change:transform;pointer-events:none}
.magic-thing{position:absolute;transform:translate(-50%,-50%);line-height:1;pointer-events:none}
.magic-animal{position:absolute;border:none;background:none;padding:0;margin:0;line-height:1;cursor:pointer;transform:translate(-50%,-50%);touch-action:manipulation;pointer-events:auto}
.magic-animal>span{display:block;transition:transform .45s cubic-bezier(.3,1.6,.5,1);transform:translateY(70%) scale(.55)}
.magic-peek>span{transform:translateY(-4%) scale(.95);animation:magic-wig .5s ease-in-out infinite alternate}
.magic-out>span{transform:translateY(-55%) scale(1.2)}
@keyframes magic-wig{from{rotate:-7deg}to{rotate:7deg}}
.magic-cover{position:absolute;transform:translate(-50%,-50%);line-height:1;pointer-events:none}
.magic-found{display:flex;justify-content:center;gap:6px;flex-wrap:wrap;font-size:clamp(26px,8vw,34px);min-height:40px}
.magic-found>span{background:#fff;border-radius:14px;padding:2px 6px;box-shadow:0 2px 0 rgba(0,0,0,.08)}
.magic-ctl{display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap}
.magic-hint{flex:1 1 160px;text-align:center;font-weight:800;font-size:clamp(15px,4.2vw,19px);color:var(--ink,#2D2A32)}
.magic-btn{border:none;border-radius:18px;padding:12px 18px;min-height:56px;font:inherit;font-weight:800;font-size:clamp(16px,4.4vw,21px);color:#fff;background:#2EAD6B;box-shadow:0 4px 0 rgba(0,0,0,.15);cursor:pointer;touch-action:manipulation}
.magic-row{display:flex;gap:10px;flex-wrap:wrap}
.magic-row>.magic-btn{flex:1 1 150px}
.magic-card{background:#fff;color:#2D2A32;border-radius:24px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 4px 0 rgba(0,0,0,.08);text-align:center}
.magic-big{font-size:clamp(60px,18vw,90px);line-height:1.1}
.magic-gate{background:#fff;color:#2D2A32;border-radius:22px;padding:16px;display:flex;flex-direction:column;gap:10px;box-shadow:0 4px 0 rgba(0,0,0,.08)}
.magic-gate h3{margin:0;font-size:clamp(18px,5vw,22px)}
.magic-gate p{margin:0;font-size:clamp(15px,4.2vw,18px);line-height:1.45}
.magic-q{font-size:clamp(28px,8vw,36px);font-weight:800;text-align:center}
.magic-input{font:inherit;font-size:24px;padding:10px 14px;border-radius:14px;border:3px solid #CFD8DC;text-align:center;width:100%;box-sizing:border-box}
.magic-cam{position:relative;width:100%;height:clamp(300px,62vh,600px);border-radius:26px;overflow:hidden;background:#263238;touch-action:manipulation;cursor:pointer;border:10px solid #8D6E63;box-sizing:border-box}
.magic-cam video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.magic-bfly{position:absolute;transform:translate(-50%,-50%);font-size:clamp(52px,15vw,72px);line-height:1;transition:left 1.4s ease-in-out,top 1.4s ease-in-out;z-index:3;pointer-events:none;filter:drop-shadow(0 8px 5px rgba(0,0,0,.35))}
.magic-flap{display:block;animation:magic-flap .24s ease-in-out infinite alternate}
.magic-rest .magic-flap{animation-duration:1.3s}
@keyframes magic-flap{from{transform:scaleX(1)}to{transform:scaleX(.5)}}
.magic-flower{position:absolute;transform:translate(-50%,-50%);font-size:46px;line-height:1;z-index:2;pointer-events:none}
.magic-chip{position:absolute;left:10px;bottom:10px;z-index:4;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:4px 12px;font-size:13px;font-weight:700;pointer-events:none}
.magic-room{position:absolute;inset:0;background:linear-gradient(#FFE0B2 0%,#FFE0B2 70%,#BCAAA4 70%)}
.magic-tile-e,.magic-thing,.magic-animal,.magic-cover,.magic-found,.magic-big,.magic-flower,.magic-bfly{${EMO}}
.magic-thing .pic-img,.magic-animal .pic-img,.magic-cover .pic-img,.magic-flower .pic-img{width:1.08em}
@media (prefers-reduced-motion: reduce){.magic-flap,.magic-peek>span{animation:none}.magic-animal>span,.magic-bfly{transition:none}}
`;
  function injectCSS() {
    if (document.getElementById("magic-css")) return;
    const s = document.createElement("style");
    s.id = "magic-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  /* ---------------- the activity ---------------- */
  NS.registerActivity({
    id: "magic",
    icon: "🔭",
    title: { hi: "जादुई खिड़की", en: "Magic Window", hinglish: "Jaadui khidki" },
    color: "#0E9F8E",
    section: "future",
    free: false,
    order: 20,
    open(ctx) {
      injectCSS();
      const W = ((NS.content && NS.content.future) || {}).windows || [];
      const timers = new Set();
      const offs = [];               // window/document listeners to remove
      let gen = 0, last = [], raf = 0, stream = null, camTimer = 0, seenThisVisit = 0;
      const T = (o) => (o == null ? "" : typeof o === "string" ? o : (ctx.t(o) || o.hi || o.en || ""));
      const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map((x) => "magic-" + x).join(" ") : "", text == null ? null : String(text));
      const say = (o) => {
        const list = (Array.isArray(o) ? o : [o]).map(T).filter(Boolean);
        last = list;
        try { ctx.stopVoice(); } catch (e) { /* ignore */ }
        return Promise.resolve().then(() => (list.length > 1 ? ctx.sayLines(list) : ctx.say(list[0] || ""))).catch(() => {});
      };
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
      const sfx = (n) => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* ignore */ } };
      const buzz = (k) => { try { if (NS.native && NS.native.available) NS.native.call("vibrate", k); } catch (e) { /* ignore */ } };
      const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const pop = (e) => { if (!reduced && e && e.animate) { try { e.animate([{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }], { duration: 420 }); } catch (er) { /* ignore */ } } };
      const age = () => ((ctx.profile && ctx.profile.ageBand) || "4-5");
      /* a realistic picture of an emoji when the core has one (NS.picture), else the emoji itself */
      const pic = (e, alt) => (typeof NS.picture === "function" ? NS.picture(e, { alt: alt || "", size: 96, eager: true }) : document.createTextNode(e));
      const picEl = (tag, c, e, alt) => { const x = el(tag, c); x.appendChild(pic(e, alt)); return x; };
      const listen = (target, type, fn, opt) => { target.addEventListener(type, fn, opt); offs.push(() => target.removeEventListener(type, fn, opt)); };
      const btn = (label, onTap, bg) => { const b = el("button", "btn", label); b.type = "button"; if (bg) b.style.background = bg; b.addEventListener("click", onTap); return b; };
      const round = (icon, label, onTap) => { const b = el("button", "rb", icon); b.type = "button"; b.setAttribute("aria-label", T(label)); b.addEventListener("click", onTap); return b; };

      function stopCamera() {
        if (camTimer) { clearTimeout(camTimer); camTimer = 0; }
        if (stream) { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ } stream = null; }
      }
      function reset() {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        gen++;
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        offs.splice(0).forEach((f) => { try { f(); } catch (e) { /* ignore */ } });
        stopCamera();
        try { ctx.stopVoice(); } catch (e) { /* ignore */ }
      }
      function page(title, onBack) {
        reset();
        const root = ctx.screen;
        /* a new screen starts at the top (the scroller is the core's #body) */
        try { if (root.parentElement) root.parentElement.scrollTop = 0; } catch (e) { /* ignore */ }
        while (root.firstChild) root.removeChild(root.firstChild);
        const w = el("div", "wrap");
        if (title) {
          const bar = el("div", "bar");
          bar.append(round("⬅️", L.back, onBack), el("div", "bartitle", title), round("🔊", L.hear, () => say(last)));
          w.appendChild(bar);
        }
        root.appendChild(w);
        return w;
      }

      /* ---------- choose a world ---------- */
      function menu() {
        const w = page(null);
        w.appendChild(el("h2", "head", "🔭 " + T({ hi: "जादुई खिड़की", en: "Magic Window" })));
        w.appendChild(el("p", "say", T(L.intro)));
        const tiles = el("div", "tiles");
        const found = ctx.data.get("found", {}) || {};
        const colors = { jungle: "#C5E1A5", sea: "#B3E5FC", space: "#D1C4E9", garden: "#FFF59D" };
        W.forEach((s) => {
          const b = el("button", "tile");
          b.type = "button";
          b.style.background = colors[s.id] || "#E0F2F1";
          b.setAttribute("aria-label", T(s.title));
          b.append(picEl("span", "tile-e", s.icon), el("span", "tile-t", T(s.title)));
          if (found[s.id]) b.appendChild(el("span", "tick", "⭐"));
          b.dataset.sfx = "whoosh";
          b.addEventListener("click", () => view(s.id));
          tiles.appendChild(b);
        });
        if (cameraAllowed(age())) {
          const b = el("button", "tile ar");
          b.type = "button";
          b.setAttribute("aria-label", T(L.arTitle));
          b.append(picEl("span", "tile-e", "🦋📷"), el("span", "tile-t", T(L.arTitle)));
          b.addEventListener("click", () => arIntro());
          tiles.appendChild(b);
        }
        w.appendChild(tiles);
        say(L.intro);
      }

      /* ---------- a window scene ---------- */
      function view(id) {
        const scene = W.find((s) => s.id === id);
        if (!scene) return menu();
        const w = page(scene.icon + " " + T(scene.title), menu);
        const g = gen;
        const animals = animalsFor(scene, age());
        const foundRow = el("div", "found");
        const slots = animals.map(() => { const s = el("span", null, "❔"); foundRow.appendChild(s); return s; });
        w.appendChild(foundRow);
        const frame = el("div", "frame");
        frame.tabIndex = 0;
        frame.setAttribute("role", "application");
        frame.setAttribute("aria-label", T(scene.title));
        frame.style.background = "linear-gradient(" + scene.sky[0] + " 0%, " + scene.sky[1] + " 64%, " + scene.ground + " 64%)";
        w.appendChild(frame);
        /* layers */
        const layers = [];
        const all = scene.layers.map((ly) => ({ d: ly.d, items: ly.items.map((x) => ({ thing: x })) }));
        animals.forEach((a, i) => {
          let ly = all.find((l) => l.d === a.d);
          if (!ly) { ly = { d: a.d, items: [] }; all.push(ly); }
          ly.items.push({ animal: a, i });
        });
        all.sort((a, b) => a.d - b.d).forEach((ly) => {
          const div = el("div", "layer");
          div.style.zIndex = String(1 + Math.round(ly.d * 10));
          const recs = [];
          ly.items.forEach((it) => {
            if (it.thing) {
              const t = picEl("span", "thing", it.thing.e);
              t.setAttribute("aria-hidden", "true");
              t.style.left = it.thing.x + "%";
              t.style.top = it.thing.y + "%";
              recs.push({ node: t, s: it.thing.s });
              div.appendChild(t);
            } else {
              const a = it.animal;
              /* an image you can tap (it moves with the picture, so it is not a button); the
                 window itself takes Enter/Space for the animal that is peeking */
              const b = el("span", "animal");
              b.setAttribute("role", "img");
              b.setAttribute("aria-label", T(a));
              b.appendChild(picEl("span", null, a.e, T(a)));
              b.style.left = a.x + "%";
              b.style.top = a.y + "%";
              const cv = picEl("span", "cover", a.cover || "🌿");
              cv.setAttribute("aria-hidden", "true");
              cv.style.left = a.x + "%";
              cv.style.top = (a.y + 7) + "%";
              const rec = { node: b, s: a.s, a, i: it.i, cover: cv, state: "hide" };
              recs.push(rec, { node: cv, s: a.s * 1.1 });
              b.addEventListener("click", () => tapAnimal(rec));
              div.append(b, cv);
            }
          });
          frame.appendChild(div);
          layers.push({ d: ly.d, div, recs });
        });
        const ctl = el("div", "ctl");
        const hint = el("div", "hint", "👆 " + T(L.dragHint));
        const lb = round("◀", L.left, () => nudge(-0.35)), rb = round("▶", L.right, () => nudge(0.35));
        lb.dataset.sfx = rb.dataset.sfx = "none";   /* nudge plays whoosh */
        ctl.append(lb, hint, rb);
        w.appendChild(ctl);
        const ctl2 = el("div", "row");
        w.appendChild(ctl2);

        /* where we look */
        let vw = 300, vh = 300;
        const pan = { x: -1, y: 0 }, target = { x: -1, y: 0 }, drag = { x: 0, y: 0 };
        let tilt = null, base = null, tiltOn = false, peekSaid = false, done = false;
        const size = () => {
          vw = frame.clientWidth || 300;
          vh = frame.clientHeight || 300;
          const unit = Math.min(vw, vh * 1.6) / 100;
          layers.forEach((ly) => {
            ly.div.style.width = layerShift(0, ly.d, vw).width + "px";
            ly.recs.forEach((r) => { r.node.style.fontSize = (r.s * unit).toFixed(1) + "px"; });
          });
          kick();
        };
        const draw = () => {
          layers.forEach((ly) => {
            const sh = layerShift(pan.x, ly.d, vw);
            ly.div.style.transform = "translate3d(" + sh.x.toFixed(1) + "px," + (-pan.y * ly.d * vh * 0.08).toFixed(1) + "px,0)";
            ly.recs.forEach((r) => {
              if (!r.a || r.state === "out") return;
              const sx = screenX(r.a.x, ly.d, pan.x, vw);
              const want = inView(sx, vw) ? "peek" : "hide";
              if (want !== r.state) {
                r.state = want;
                r.node.classList.toggle("magic-peek", want === "peek");
                if (want === "peek") { sfx("pop"); if (!peekSaid) { peekSaid = true; say(L.peek); } }
              }
            });
          });
        };
        const step = () => {
          raf = 0;
          if (g !== gen) return;
          const tx = clamp((tilt ? tilt.x : 0) + drag.x + target.x * (tilt ? 0 : 1), -1, 1);
          const ty = clamp((tilt ? tilt.y : 0) + drag.y * 0.6, -1, 1);
          pan.x += (tx - pan.x) * (reduced ? 1 : 0.18);
          pan.y += (ty - pan.y) * (reduced ? 1 : 0.18);
          draw();
          if (Math.abs(tx - pan.x) > 0.002 || Math.abs(ty - pan.y) > 0.002) raf = requestAnimationFrame(step);
        };
        function kick() { if (!raf && g === gen) raf = requestAnimationFrame(step); }
        function nudge(dx) { sfx("whoosh"); if (tilt) drag.x = clamp(drag.x + dx, -2, 2); else target.x = clamp(target.x + dx, -1, 1); kick(); }
        /* finger / mouse */
        let down = null;
        listen(frame, "pointerdown", (e) => { if (e.target.closest && e.target.closest(".magic-animal")) return; down = { x: e.clientX, y: e.clientY, tx: target.x, dx: drag.x, dy: drag.y }; try { frame.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } });
        listen(frame, "pointermove", (e) => {
          if (!down) return;
          const mx = -(e.clientX - down.x) / vw * 1.6, my = -(e.clientY - down.y) / vh * 1.4;
          if (tilt) { drag.x = clamp(down.dx + mx, -2, 2); drag.y = clamp(down.dy + my, -1, 1); }
          else { target.x = clamp(down.tx + mx, -1, 1); drag.y = clamp(down.dy + my, -1, 1); }
          kick();
        });
        const up = () => { down = null; };
        listen(frame, "pointerup", up);
        listen(frame, "pointercancel", up);
        listen(frame, "keydown", (e) => {
          if (e.key === "ArrowLeft") { nudge(-0.2); e.preventDefault(); }
          else if (e.key === "ArrowRight") { nudge(0.2); e.preventDefault(); }
          else if (e.key === "Enter" || e.key === " ") {
            const r = layers.reduce((f, ly) => f || ly.recs.find((x) => x.a && x.state === "peek"), null);
            if (r) { tapAnimal(r); e.preventDefault(); }
          }
        });
        if (window.ResizeObserver) { const ro = new ResizeObserver(size); ro.observe(frame); offs.push(() => ro.disconnect()); }
        else listen(window, "resize", size);
        /* tilt */
        const angle = () => { try { return (screen.orientation && typeof screen.orientation.angle === "number") ? screen.orientation.angle : (typeof window.orientation === "number" ? window.orientation : 0); } catch (e) { return 0; } };
        const onTilt = (ev) => {
          if (g !== gen || typeof ev.beta !== "number" || typeof ev.gamma !== "number") return;
          const o = { alpha: ev.alpha, beta: ev.beta, gamma: ev.gamma };
          if (!base) base = o;
          const p = panFromTilt(o, base, angle());
          if (!p) return;
          if (!tiltOn) {
            tiltOn = true;
            drag.x = target.x; target.x = 0;
            hint.textContent = "📱 " + T(L.tiltHint);
            ctl2.appendChild(btn("🎯 " + T(L.recenter), () => { base = null; drag.x = 0; drag.y = 0; }, "#7E57C2"));
            say(L.tiltHint);
          }
          tilt = p;
          kick();
        };
        const startTilt = () => listen(window, "deviceorientation", onTilt);
        const DOE = window.DeviceOrientationEvent;
        if (DOE && typeof DOE.requestPermission === "function") {
          const ask = btn("📱 " + T(L.tiltBtn), () => {
            Promise.resolve().then(() => DOE.requestPermission()).then((st) => { if (st === "granted" && g === gen) { startTilt(); ask.remove(); } }).catch(() => { ask.remove(); });
          }, "#0E9F8E");
          ctl2.appendChild(ask);
          later(() => say(L.askTilt), 4000);
        } else if (DOE) startTilt();

        function tapAnimal(r) {
          if (r.state === "out") { pop(r.node); say([r.a, r.a.fact]); return; }
          const sx = screenX(r.a.x, layers.find((l) => l.recs.indexOf(r) >= 0).d, pan.x, vw);
          if (sx < 0 || sx > vw) return;
          r.state = "out";
          r.node.classList.remove("magic-peek");
          r.node.classList.add("magic-out");
          slots[r.i].replaceChildren(pic(r.a.e, T(r.a)));
          pop(slots[r.i]);
          sfx("sparkle");
          buzz("tap");
          const left = layers.reduce((n, ly) => n + ly.recs.filter((x) => x.a && x.state !== "out").length, 0);
          const p = say([{ hi: "ये तो " + r.a.hi + " है!", en: "It's " + r.a.en + "!" }, r.a.fact]);
          if (!left) { done = true; p.then(() => { if (g === gen) finish(); }); }
        }
        function finish() {
          seenThisVisit++;
          sfx("correct");
          buzz("success");
          const found = ctx.data.get("found", {}) || {};
          const first = !found[scene.id];
          found[scene.id] = true;
          ctx.data.set("found", found);
          const card = el("div", "card");
          card.append(picEl("div", "big", "🌍👀"), el("p", "say", T(scene.end)));
          if (seenThisVisit >= 2) card.appendChild(el("p", "say", "🌳 " + T(L.eyes)));
          const row = el("div", "row");
          row.append(btn("🔭 " + T(L.other), menu), btn("🏠", () => ctx.home(), "#5C6BC0"));
          row.lastChild.setAttribute("aria-label", NS.tr ? NS.tr("home") : "Home");
          w.append(card, row);
          try { card.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "nearest" }); } catch (e) { /* ignore */ }
          const p = say([L.allFound, scene.end].concat(seenThisVisit >= 2 ? [L.eyes] : []));
          if (first) p.then(() => { if (g === gen) ctx.reward({ sticker: scene.icon, reason: T(scene.title) }); });
        }
        size();
        draw();
        say([scene.title, L.look]);
        later(() => { if (!tiltOn) say(L.dragHint); }, 5200);
      }

      /* ---------- AR: a butterfly in the real room (4+, grown-up turns the camera on) ---------- */
      function arIntro() {
        if (!cameraAllowed(age())) return menu();
        const w = page("🦋 " + T(L.arTitle), menu);
        const card = el("div", "card");
        card.append(picEl("div", "big", "🦋📱🏠"), el("p", "say", T(L.arKid)));
        w.appendChild(card);
        w.appendChild(btn("👨‍👩‍👧 " + T(L.grown), gate, "#5C6BC0"));
        say(L.arKid);
      }
      function gate() {
        const w = page("👨‍👩‍👧 " + T(L.grown), arIntro);
        const q = gateQuestion();
        const box = el("div", "gate");
        box.appendChild(el("h3", null, T(L.gateTitle)));
        box.appendChild(el("p", null, "🔒 " + T(L.gatePrivacy)));
        box.appendChild(el("p", null, T(L.gateAsk)));
        box.appendChild(el("div", "q", q.a + " × " + q.b + " = ?"));
        const input = el("input", "input");
        input.type = "text";
        input.inputMode = "numeric";
        input.autocomplete = "off";
        input.setAttribute("aria-label", T(L.answer));
        input.placeholder = T(L.answer);
        const msg = el("p", null, "");
        msg.setAttribute("role", "alert");
        const check = () => {
          if (gateCheck(q, input.value)) { startCamera(); return; }
          msg.textContent = T(L.gateWrong);
          later(gate, 1000);
        };
        listen(input, "keydown", (e) => { if (e.key === "Enter") check(); });
        box.append(input, btn("📷 " + T(L.gateGo), check, "#2EAD6B"), msg);
        w.appendChild(box);
        say(L.gateSay);
        later(() => { try { input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 60);
      }
      function camFail(err) {
        const w = page("🦋 " + T(L.arTitle), menu);
        const name = err && err.name;
        const none = name === "NotFoundError" || name === "OverconstrainedError" || name === "nocam" || name === "DevicesNotFoundError";
        const card = el("div", "card");
        card.append(picEl("div", "big", "🦋🌷"), el("p", "say", T(none ? L.camNone : L.camDenied)));
        w.append(card, btn("🦋 " + T(L.garden), () => view("garden"), "#0E9F8E"));
        say(none ? L.camNone : L.camDenied);
      }
      function startCamera() {
        const md = navigator.mediaDevices;
        if (!md || typeof md.getUserMedia !== "function") { camFail({ name: "nocam" }); return; }
        const g0 = gen;
        /* video only, rear camera: a request with audio would be refused by the Android shell */
        md.getUserMedia({ video: { facingMode: "environment" } }).then((s) => {
          if (g0 !== gen) { s.getTracks().forEach((t) => t.stop()); return; }
          arView(s);
        }).catch((e) => { if (g0 === gen) camFail(e); });
      }
      function arView(s) {
        const w = page("🦋 " + T(L.arTitle), menu);
        stream = s;
        const g = gen;
        const cam = el("div", "cam");
        cam.setAttribute("role", "application");
        cam.setAttribute("aria-label", T(L.arTitle));
        const video = document.createElement("video");
        video.muted = true;
        video.setAttribute("muted", "");
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.autoplay = true;
        video.srcObject = s;
        cam.appendChild(video);
        try { const pr = video.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (e) { /* ignore */ }
        const chip = el("div", "chip", "🔒 " + T(L.onlyHere));
        const bf = el("div", "bfly");
        bf.setAttribute("aria-hidden", "true");
        bf.appendChild(picEl("span", "flap", "🦋"));
        bf.style.left = "50%";
        bf.style.top = "40%";
        cam.append(bf, chip);
        w.appendChild(cam);
        const row = el("div", "row");
        row.appendChild(btn("📷 " + T(L.stop), () => { stopCamera(); endAR(); }, "#E57373"));
        w.appendChild(row);
        let flowers = 0, resting = false, ending = false;
        const wander = () => {
          if (g !== gen) return;
          if (!resting) {
            bf.style.left = (15 + Math.random() * 70).toFixed(0) + "%";
            bf.style.top = (15 + Math.random() * 60).toFixed(0) + "%";
          }
          later(wander, 2600);
        };
        later(wander, 1200);
        listen(cam, "click", (e) => {
          const r = cam.getBoundingClientRect();
          const x = e.clientX - r.left, y = e.clientY - r.top;
          const bx = parseFloat(bf.style.left) / 100 * r.width, by = parseFloat(bf.style.top) / 100 * r.height;
          if (Math.hypot(x - bx, y - by) < 50) { resting = false; bf.classList.remove("magic-rest"); sfx("pop"); say(L.tickle); bf.style.left = (x < r.width / 2 ? 75 : 25) + "%"; return; }
          const f = picEl("span", "flower", ["🌸", "🌼", "🌷", "🌻"][flowers % 4]);
          f.setAttribute("aria-hidden", "true");
          f.style.left = x + "px";
          f.style.top = y + "px";
          cam.appendChild(f);
          pop(f);
          sfx("sparkle");
          flowers++;
          resting = true;
          bf.classList.remove("magic-rest");
          bf.style.left = (x / r.width * 100).toFixed(1) + "%";
          bf.style.top = ((y - 30) / r.height * 100).toFixed(1) + "%";
          later(() => {
            if (g !== gen) return;
            bf.classList.add("magic-rest");
            buzz("soft");
            if (flowers >= 3 && !ending) { ending = true; say([L.flower, L.arEnd]); later(() => { if (g === gen) { stopCamera(); endAR(true); } }, 9000); }
            else if (!ending) say(L.flower);
            later(() => { resting = false; bf.classList.remove("magic-rest"); }, 3000);
          }, 1500);
        });
        /* never in the background; never longer than ~5 minutes */
        listen(document, "visibilitychange", () => { if (document.hidden) { stopCamera(); if (g === gen) endAR(); } });
        camTimer = setTimeout(() => { camTimer = 0; if (g === gen) { stopCamera(); endAR(); } }, CAMERA_MS);
        say(L.arStart);
      }
      function endAR(spoken) {
        stopCamera();
        const w = page("🦋 " + T(L.arTitle), menu);
        const card = el("div", "card");
        card.append(picEl("div", "big", "🦋🌳"), el("p", "say", T(L.arEnd)));
        w.appendChild(card);
        const row = el("div", "row");
        row.append(btn("🔭 " + T(L.other), menu), btn("🏠", () => ctx.home(), "#5C6BC0"));
        row.lastChild.setAttribute("aria-label", NS.tr ? NS.tr("home") : "Home");
        w.appendChild(row);
        const once = ctx.data.get("arDone", false);
        if (!once) ctx.data.set("arDone", true);
        const p = spoken ? Promise.resolve() : say([L.camOff, L.arEnd]);
        if (!once) p.then(() => ctx.reward({ sticker: "🦋", reason: T(L.arTitle) }));
      }

      menu();
      return () => { reset(); gen++; };
    },
  });
})();
