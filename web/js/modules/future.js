/* नन्हा स्कूल — "भविष्य की सैर" (Future Trip), section "future" (कल की दुनिया).

   Short narrated picture journeys (6–8 pages) about what will shape the next 10–15 years:
   solar power, electric vehicles, drones, space (Chandrayaan in kid words), robot helpers,
   talking computers (they learn from reading, and can be wrong), saving water & recycling,
   3D printers and staying safe online. Every picture can be tapped; most pages have a tiny
   interaction (tap the Sun to charge the car, help the drone deliver, sort the rubbish).
   Each trip ends with one or two picture questions and an off-screen mission.
   Content: web/js/content/future.js (NS.content.future.journeys). Pure logic: NS.future.trip. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.future = NS.future || {};

  /* ---------------- pure logic (unit-tested) ---------------- */
  const BANDS = ["2-3", "4-5", "6+"];
  const rank = (b) => Math.max(0, BANDS.indexOf(b));
  /* pages a child of this age band sees (pages with min above the band are skipped) */
  function pagesFor(journey, band) { return (journey.pages || []).filter((p) => !p.min || rank(p.min) <= rank(band)); }
  /* a choice/quiz answer: index match, or any answer for open questions */
  function isRight(q, i) { return q.answer === "any" ? i >= 0 && i < (q.options || []).length : q.answer === i; }
  function sortRight(item, bin) { return !!item && item.bin === bin; }
  /* the trip to suggest next: the first one not finished yet (or the first) */
  function suggest(journeys, done) { const d = done || []; const j = (journeys || []).find((x) => d.indexOf(x.id) < 0); return j ? j.id : (journeys[0] && journeys[0].id); }
  function markDone(done, id) { const d = Array.isArray(done) ? done.filter((x) => typeof x === "string") : []; if (d.indexOf(id) < 0) d.push(id); return d; }
  NS.future.trip = { pagesFor, isRight, sortRight, suggest, markDone };

  /* ---------------- fixed spoken lines ---------------- */
  const L = {
    mapIntro: { hi: "चलो, आने वाले कल की सैर करें! किसी भी तस्वीर पर दबाओ।", en: "Let's take a trip into tomorrow! Tap any picture." },
    tapThings: { hi: "तस्वीर में चीज़ों को छूकर देखो!", en: "Tap the things in the picture!" },
    next: { hi: "आगे", en: "Next" },
    prev: { hi: "पीछे", en: "Back" },
    hear: { hi: "फिर से सुनो", en: "Hear again" },
    tryAgain: { hi: "फिर से सोचो!", en: "Think again!" },
    quizIntro: { hi: "चलो, एक छोटा सा सवाल!", en: "Now, a little question!" },
    mission: { hi: "आज का मिशन", en: "Today's mission" },
    ok: { hi: "ठीक है, करूँगा!", en: "OK, I'll do it!" },
    missionDone: { hi: "शाबाश, खोजी! आने वाला कल तुम जैसे बच्चों से ही बनेगा।", en: "Well done, explorer! Tomorrow will be made by children like you." },
    map: { hi: "सैर का नक्शा", en: "Trip map" },
    more: { hi: "और सैर", en: "Another trip" },
    goPlay: { hi: "बाहर खेलने चलो", en: "Go play outside" },
    eyes: { hi: "आज बहुत सैर हो गई! अब स्क्रीन को आराम दो — बाहर खेलो और दूर तक देखो। आँखों को भी खुली हवा चाहिए!", en: "That's a lot of trips today! Now let the screen rest — play outside and look far away. Eyes need fresh air too!" },
    wrongBin: { hi: "हम्म… ये उस डिब्बे का नहीं। फिर से सोचो!", en: "Hmm… that's not its bin. Think again!" },
    back: { hi: "वापस", en: "Back" },
    sticker: { hi: "भविष्य की सैर की!", en: "Took a trip into the future!" },
  };
  const LABEL_ONLY = ["next", "prev", "hear", "ok", "map", "more", "goPlay", "back", "sticker"];
  NS.voiceLines = (NS.voiceLines || []).concat(Object.keys(L).filter((k) => LABEL_ONLY.indexOf(k) < 0).reduce((a, k) => a.concat([
    { lang: "hi", text: L[k].hi, section: "future" }, { lang: "en", text: L[k].en, section: "future" }]), []));

  /* ---------------- look ---------------- */
  const CSS = `
.future-wrap{display:flex;flex-direction:column;gap:10px;width:100%;max-width:820px;margin:0 auto;box-sizing:border-box}
.future-bar{display:flex;align-items:center;gap:8px}
.future-rb{width:56px;height:56px;border-radius:50%;border:none;background:#fff;color:#2D2A32;box-shadow:0 3px 0 rgba(0,0,0,.12);font-size:24px;display:grid;place-items:center;flex:0 0 auto;padding:0;cursor:pointer;touch-action:manipulation}
.future-bartitle{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(18px,5vw,24px);line-height:1.2;color:var(--ink,#2D2A32)}
.future-head{font-size:clamp(24px,7vw,34px);font-weight:800;text-align:center;color:var(--ink,#2D2A32);margin:0}
.future-say{margin:0;text-align:center;font-weight:700;font-size:clamp(17px,4.6vw,23px);line-height:1.4;color:var(--ink,#2D2A32);text-wrap:balance}
.future-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}
.future-tile{position:relative;border:none;border-radius:22px;min-height:124px;padding:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;color:#fff;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.16);touch-action:manipulation;text-shadow:0 1px 2px rgba(0,0,0,.25)}
.future-tile-e{font-size:clamp(40px,11vw,54px);line-height:1;text-shadow:none}
.future-tile-t{font-size:clamp(15px,4.2vw,19px);font-weight:800;text-align:center;line-height:1.2}
.future-tick{position:absolute;top:6px;right:8px;background:#fff;border-radius:50%;width:30px;height:30px;display:grid;place-items:center;font-size:18px;text-shadow:none;box-shadow:0 2px 0 rgba(0,0,0,.15)}
.future-sugg{outline:4px solid #FFD54F;outline-offset:3px;animation:future-glow 1.4s ease-in-out infinite alternate}
@keyframes future-glow{from{outline-color:#FFD54F}to{outline-color:#FFF59D}}
.future-stage{position:relative;width:min(100%,calc(56vh * 1.6));width:min(100%,calc(56dvh * 1.6));aspect-ratio:16/10;border-radius:22px;overflow:hidden;box-shadow:inset 0 0 0 3px rgba(0,0,0,.06),0 4px 0 rgba(0,0,0,.08);--u:3.4px;margin:0 auto}
.future-el{position:absolute;transform:translate(-50%,-50%);line-height:1;border:none;background:none;padding:0;margin:0;font:inherit;color:inherit;transition:left .6s ease,top .6s ease,font-size .6s ease}
.future-tap{cursor:pointer;touch-action:manipulation}
.future-tap::before{content:"";position:absolute;inset:-10px}
.future-in{display:block;transform-origin:center}
.future-el svg{display:block;width:100%;height:auto;overflow:visible}
.future-target::after{content:"";position:absolute;inset:-14%;border:4px solid #FFD54F;border-radius:50%;animation:future-ring 1.1s ease-out infinite;pointer-events:none}
@keyframes future-ring{from{transform:scale(.8);opacity:1}to{transform:scale(1.25);opacity:0}}
.future-a-float{animation:future-float 2.6s ease-in-out infinite alternate}
.future-a-spin{animation:future-spin 22s linear infinite}
.future-a-drive{animation:future-drive 2.4s ease-in-out infinite alternate}
.future-a-fly{animation:future-fly 4s ease-in-out infinite}
.future-a-pulse{animation:future-pulse .9s ease-in-out infinite alternate}
.future-a-twinkle{animation:future-twinkle 1.3s ease-in-out infinite alternate}
.future-a-launch{animation:future-launch 1.8s ease-in forwards}
.future-rotor{transform-box:fill-box;transform-origin:center;animation:future-rotor .18s linear infinite alternate}
@keyframes future-float{from{transform:translateY(0)}to{transform:translateY(-12%)}}
@keyframes future-spin{to{transform:rotate(360deg)}}
@keyframes future-drive{from{transform:translateX(-14%)}to{transform:translateX(14%)}}
@keyframes future-fly{0%,100%{transform:translate(0,0)}33%{transform:translate(8%,-10%)}66%{transform:translate(-8%,-4%)}}
@keyframes future-pulse{from{transform:scale(1)}to{transform:scale(1.14)}}
@keyframes future-twinkle{from{opacity:1}to{opacity:.3}}
@keyframes future-launch{0%{transform:translateY(0)}15%{transform:translateY(4%)}100%{transform:translateY(-420%)}}
@keyframes future-rotor{from{transform:scaleX(1)}to{transform:scaleX(.25)}}
.future-bg-sky{background:linear-gradient(#81D4FA 0%,#E1F5FE 70%,#A5D6A7 70%,#81C784 100%)}
.future-bg-city{background:linear-gradient(#90CAF9 0%,#E3F2FD 68%,#B0BEC5 68%,#90A4AE 100%)}
.future-bg-space{background:radial-gradient(circle at 12% 22%,#fff 0 1.5px,transparent 2.5px),radial-gradient(circle at 34% 64%,#fff 0 1px,transparent 2px),radial-gradient(circle at 58% 14%,#fff 0 1.5px,transparent 2.5px),radial-gradient(circle at 76% 48%,#fff 0 1px,transparent 2px),radial-gradient(circle at 90% 82%,#fff 0 1.5px,transparent 2.5px),radial-gradient(circle at 24% 90%,#fff 0 1px,transparent 2px),linear-gradient(#0D1240,#3A1C71)}
.future-bg-night{background:radial-gradient(circle at 18% 14%,#fff 0 1px,transparent 2px),radial-gradient(circle at 48% 26%,#fff 0 1px,transparent 2px),linear-gradient(#141B4D 0%,#3949AB 70%,#2E7D32 70%,#1B5E20 100%)}
.future-bg-sea{background:linear-gradient(#4FC3F7,#0277BD)}
.future-bg-farm{background:linear-gradient(#B3E5FC 0%,#E1F5FE 60%,#AED581 60%,#7CB342 100%)}
.future-bg-hospital{background:linear-gradient(#E0F7FA 0%,#E0F7FA 72%,#B2DFDB 72%,#80CBC4 100%)}
.future-bg-home{background:linear-gradient(#FFF3E0 0%,#FFE0B2 74%,#D7A86E 74%,#BC8A5F 100%)}
.future-bg-garden{background:linear-gradient(#B3E5FC 0%,#E8F5E9 64%,#9CCC65 64%,#7CB342 100%)}
.future-bg-screen{background:linear-gradient(135deg,#EDE7F6,#C5CAE9)}
.future-bg-lab{background:linear-gradient(#ECEFF1 0%,#ECEFF1 74%,#CFD8DC 74%,#B0BEC5 100%)}
.future-text{margin:0;background:#fff;color:#2D2A32;border-radius:18px;padding:10px 14px;font-weight:700;font-size:clamp(17px,4.6vw,22px);line-height:1.4;box-shadow:0 3px 0 rgba(0,0,0,.08)}
.future-prompt{align-self:center;background:#FFF8E1;color:#5D4037;border:3px solid #FFD54F;border-radius:999px;padding:6px 14px;font-weight:800;font-size:clamp(15px,4.2vw,19px);text-align:center;line-height:1.3}
.future-prompt-btn{min-height:56px;cursor:pointer;font-family:inherit;touch-action:manipulation}
.future-prompt-done{background:#E8F5E9;border-color:#66BB6A;color:#1B5E20}
.future-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px;width:100%}
.future-opt{border:3px solid #E0E0E0;border-radius:20px;background:#fff;color:#2D2A32;padding:8px;min-height:96px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.08);touch-action:manipulation}
.future-opt-p{font-size:clamp(34px,10vw,46px);line-height:1.1}
.future-opt-t{font-size:clamp(14px,4vw,18px);font-weight:800;text-align:center;line-height:1.2}
.future-opt-ok{border-color:#2EAD6B;background:#E8F5E9}
.future-opt-no{border-color:#E57373;background:#FFEBEE}
.future-sort{display:flex;flex-direction:column;align-items:center;gap:8px}
.future-sortitem{display:flex;align-items:center;gap:8px;background:#fff;color:#2D2A32;border-radius:18px;padding:6px 16px;font-weight:800;font-size:clamp(16px,4.4vw,20px);box-shadow:0 3px 0 rgba(0,0,0,.08)}
.future-sortitem b{font-size:clamp(36px,11vw,48px);line-height:1.1}
.future-bins{display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%}
.future-bin{width:100%;border:none;border-radius:18px;color:#fff;font:inherit;font-weight:800;font-size:clamp(15px,4.2vw,19px);min-height:64px;padding:8px;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.18);touch-action:manipulation;display:flex;align-items:center;justify-content:center;gap:6px}
.future-binpile{font-size:22px;min-height:26px;text-align:center;display:flex;flex-wrap:wrap;justify-content:center;gap:2px;margin-top:4px}
.future-nav{display:flex;gap:10px;align-items:center}
.future-navb{border:none;border-radius:999px;min-height:58px;font:inherit;font-weight:800;font-size:clamp(18px,5vw,24px);color:#fff;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.18);touch-action:manipulation}
.future-prev{flex:0 0 26%;background:#A0A4B8}
.future-next{flex:1;background:#2EAD6B}
.future-next-ready{animation:future-ready 1s ease-out 5}
@keyframes future-ready{from{box-shadow:0 4px 0 rgba(0,0,0,.18),0 0 0 0 rgba(46,173,107,.7)}to{box-shadow:0 4px 0 rgba(0,0,0,.18),0 0 0 14px rgba(46,173,107,0)}}
.future-dots{display:flex;justify-content:center;gap:6px}
.future-dot{width:10px;height:10px;border-radius:50%;background:#CFD8DC}
.future-dot-on{background:#7E57C2;transform:scale(1.25)}
.future-card{background:#fff;color:#2D2A32;border-radius:24px;padding:16px;display:flex;flex-direction:column;align-items:center;gap:10px;box-shadow:0 4px 0 rgba(0,0,0,.08);text-align:center}
.future-big{font-size:clamp(64px,20vw,96px);line-height:1.1}
.future-label{font-weight:800;font-size:clamp(16px,4.4vw,20px);color:#7E57C2;letter-spacing:.5px}
.future-row{display:flex;gap:10px;flex-wrap:wrap}
.future-row>.future-navb{flex:1 1 150px;padding:10px 16px}
.future-in,.future-tile-e,.future-opt-p,.future-big,.future-sortitem b,.future-binpile,.future-tick,.future-bin span:first-child{font-family:"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",var(--font,sans-serif)}
.future-in .pic-img{width:1.05em}
.future-binpile .pic-img{width:1.1em}
@media (prefers-reduced-motion: reduce){.future-in,.future-el,.future-rotor,.future-target::after,.future-sugg,.future-next-ready{animation:none!important;transition:none!important}}
`;
  function injectCSS() {
    if (document.getElementById("future-css")) return;
    const s = document.createElement("style");
    s.id = "future-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- props (inline SVG drawings) ---------------- */
  const S = (tag, attrs, kids) => NS.svg(tag, attrs, kids);
  const svg = (vb, kids) => S("svg", { viewBox: vb, "aria-hidden": "true", focusable: "false" }, kids);
  function prop(def) {
    const lv = Math.max(0, Math.min(1, def.level == null ? 1 : def.level));
    switch (def.p) {
      case "panel":
        return svg("0 0 100 100", [
          S("rect", { x: 46, y: 66, width: 8, height: 24, fill: "#78909C" }),
          S("rect", { x: 32, y: 88, width: 36, height: 7, rx: 3, fill: "#607D8B" }),
          S("g", { transform: "skewY(-8) translate(0 10)" }, [
            S("rect", { x: 6, y: 22, width: 88, height: 48, rx: 4, fill: "#1565C0", stroke: "#0D47A1", "stroke-width": 3 }),
            S("path", { d: "M28 22 V70 M50 22 V70 M72 22 V70 M6 38 H94 M6 54 H94", stroke: "#64B5F6", "stroke-width": 2 }),
            S("path", { d: "M10 26 L40 26 L22 66 L10 66 Z", fill: "#fff", opacity: ".22" }),
          ]),
        ]);
      case "battery": {
        const h = 64 * lv, col = lv < 0.3 ? "#E53935" : lv < 0.7 ? "#FFB300" : "#43A047";
        return svg("0 0 100 100", [
          S("rect", { x: 40, y: 4, width: 20, height: 10, rx: 3, fill: "#37474F" }),
          S("rect", { x: 26, y: 12, width: 48, height: 84, rx: 9, fill: "#fff", stroke: "#37474F", "stroke-width": 5 }),
          S("rect", { x: 33, y: 89 - h, width: 34, height: Math.max(0.1, h), rx: 4, fill: col }),
          S("path", { d: "M54 30 L40 58 H51 L46 80 L63 48 H52 Z", fill: "#FFD54F", stroke: "#37474F", "stroke-width": 2 }),
        ]);
      }
      case "charger":
        return svg("0 0 100 120", [
          S("path", { d: "M70 70 Q96 76 92 104", stroke: "#263238", "stroke-width": 5, fill: "none", "stroke-linecap": "round" }),
          S("rect", { x: 26, y: 8, width: 46, height: 96, rx: 12, fill: "#43A047", stroke: "#2E7D32", "stroke-width": 3 }),
          S("rect", { x: 35, y: 20, width: 28, height: 20, rx: 4, fill: "#E8F5E9" }),
          S("path", { d: "M52 46 L42 66 H50 L46 82 L58 60 H50 Z", fill: "#FFD54F" }),
          S("rect", { x: 20, y: 102, width: 58, height: 10, rx: 4, fill: "#607D8B" }),
        ]);
      case "drone":
        return svg("0 0 100 70", [
          S("path", { d: "M36 40 L12 26 M64 40 L88 26", stroke: "#455A64", "stroke-width": 5, "stroke-linecap": "round" }),
          S("rect", { x: 10, y: 18, width: 4, height: 10, fill: "#455A64" }), S("rect", { x: 86, y: 18, width: 4, height: 10, fill: "#455A64" }),
          S("ellipse", { class: "future-rotor", cx: 12, cy: 17, rx: 14, ry: 3.5, fill: "#90A4AE" }),
          S("ellipse", { class: "future-rotor", cx: 88, cy: 17, rx: 14, ry: 3.5, fill: "#90A4AE" }),
          S("rect", { x: 32, y: 34, width: 36, height: 18, rx: 9, fill: "#546E7A", stroke: "#37474F", "stroke-width": 2 }),
          S("circle", { cx: 50, cy: 43, r: 3, fill: "#69F0AE" }),
          S("circle", { cx: 50, cy: 58, r: 5, fill: "#263238" }),
          S("path", { d: "M38 52 L32 64 M62 52 L68 64", stroke: "#455A64", "stroke-width": 3, "stroke-linecap": "round" }),
        ]);
      case "printer": {
        const n = Math.round(lv * 4), cols = ["#FF7043", "#FFB300", "#66BB6A", "#42A5F5"], kids = [];
        for (let i = 0; i < n; i++) { const w = 46 - i * 9; kids.push(S("rect", { x: 50 - w / 2, y: 79 - (i + 1) * 11, width: w, height: 10, rx: 2, fill: cols[i] })); }
        const ny = 79 - (n + 1) * 11 - 4;
        return svg("0 0 100 100", [
          S("rect", { x: 8, y: 6, width: 84, height: 88, rx: 6, fill: "rgba(255,255,255,.55)", stroke: "#455A64", "stroke-width": 6 }),
          S("rect", { x: 8, y: 6, width: 84, height: 12, fill: "#455A64" }),
          S("rect", { x: 18, y: 80, width: 64, height: 7, rx: 2, fill: "#90A4AE" }),
          S("g", {}, kids),
          S("path", { d: "M50 18 V" + Math.max(20, ny - 6), stroke: "#78909C", "stroke-width": 3 }),
          S("path", { d: "M42 " + (ny - 8) + " H58 L50 " + ny + " Z", fill: "#FF7043" }),
        ]);
      }
      case "bin": {
        const c = def.color || "#2E9D4A";
        return svg("0 0 100 100", [
          S("rect", { x: 42, y: 8, width: 16, height: 8, rx: 3, fill: c }),
          S("rect", { x: 16, y: 16, width: 68, height: 12, rx: 5, fill: c, stroke: "rgba(0,0,0,.25)", "stroke-width": 2 }),
          S("path", { d: "M22 30 H78 L71 94 H29 Z", fill: c, stroke: "rgba(0,0,0,.25)", "stroke-width": 2 }),
          S("path", { d: "M38 42 L41 84 M50 42 V84 M62 42 L59 84", stroke: "rgba(255,255,255,.55)", "stroke-width": 3, "stroke-linecap": "round" }),
        ]);
      }
      case "lander":
        return svg("0 0 100 100", [
          S("path", { d: "M34 60 L20 84 M66 60 L80 84 M44 62 L40 86 M56 62 L60 86", stroke: "#B0BEC5", "stroke-width": 4, "stroke-linecap": "round" }),
          S("ellipse", { cx: 20, cy: 86, rx: 7, ry: 3, fill: "#CFD8DC" }), S("ellipse", { cx: 80, cy: 86, rx: 7, ry: 3, fill: "#CFD8DC" }),
          S("rect", { x: 30, y: 30, width: 40, height: 32, rx: 4, fill: "#FFC107", stroke: "#FF8F00", "stroke-width": 3 }),
          S("rect", { x: 36, y: 20, width: 28, height: 10, fill: "#1565C0", stroke: "#0D47A1", "stroke-width": 2 }),
          S("circle", { cx: 50, cy: 46, r: 6, fill: "#FFE082" }),
        ]);
      case "rover":
        return svg("0 0 100 80", [
          S("path", { d: "M66 36 V16", stroke: "#78909C", "stroke-width": 4 }),
          S("rect", { x: 58, y: 8, width: 16, height: 9, rx: 2, fill: "#455A64" }),
          S("rect", { x: 22, y: 22, width: 48, height: 9, rx: 2, fill: "#1565C0", stroke: "#0D47A1", "stroke-width": 2 }),
          S("rect", { x: 18, y: 32, width: 62, height: 20, rx: 4, fill: "#FFC107", stroke: "#FF8F00", "stroke-width": 2 }),
          S("circle", { cx: 26, cy: 60, r: 9, fill: "#424242", stroke: "#9E9E9E", "stroke-width": 3 }),
          S("circle", { cx: 49, cy: 60, r: 9, fill: "#424242", stroke: "#9E9E9E", "stroke-width": 3 }),
          S("circle", { cx: 72, cy: 60, r: 9, fill: "#424242", stroke: "#9E9E9E", "stroke-width": 3 }),
        ]);
      case "moon":
        return svg("0 0 100 100", [
          S("circle", { cx: 50, cy: 50, r: 47, fill: "#FFF3B0", stroke: "#F4D35E", "stroke-width": 2 }),
          S("circle", { cx: 34, cy: 36, r: 9, fill: "#F2DF8A" }), S("circle", { cx: 62, cy: 28, r: 6, fill: "#F2DF8A" }),
          S("circle", { cx: 66, cy: 60, r: 12, fill: "#F2DF8A" }), S("circle", { cx: 36, cy: 70, r: 7, fill: "#F2DF8A" }),
          S("path", { d: "M80 22 A47 47 0 0 1 72 92 A40 40 0 0 0 80 22 Z", fill: "#000", opacity: ".06" }),
        ]);
      default:
        return svg("0 0 10 10", []);
    }
  }

  /* ---------------- UI kit ---------------- */
  function kit(ctx) {
    const timers = new Set();
    let gen = 0, last = [];
    const T = (o) => (o == null ? "" : typeof o === "string" ? o : (ctx.t(o) || o.hi || o.en || ""));
    const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map((x) => "future-" + x).join(" ") : "", text == null ? null : String(text));
    const say = (o) => {
      const list = (Array.isArray(o) ? o : [o]).map(T).filter(Boolean);
      last = list;
      try { ctx.stopVoice(); } catch (e) { /* ignore */ }
      return Promise.resolve().then(() => (list.length > 1 ? ctx.sayLines(list) : ctx.say(list[0] || ""))).catch(() => {});
    };
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const anim = (e, frames, opt) => { if (reduced || !e || !e.animate) return null; try { return e.animate(frames, opt); } catch (er) { return null; } };
    const pop = (e, big) => anim(e, [{ transform: "scale(1)" }, { transform: "scale(" + (big ? 1.25 : 1.12) + ")" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
    const wiggle = (e) => anim(e, [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(0)" }], { duration: 360 });
    const sfx = (n) => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* ignore */ } };
    const buzz = (k) => { try { if (NS.native && NS.native.available) NS.native.call("vibrate", k); } catch (e) { /* ignore */ } };
    const age = () => ((ctx.profile && ctx.profile.ageBand) || "4-5");
    /* a realistic picture of an emoji when the core has one (NS.picture), else the emoji itself */
    const pic = (e, alt) => (typeof NS.picture === "function" ? NS.picture(e, { alt: alt || "", size: 96, eager: true }) : document.createTextNode(e));
    const picEl = (tag, c, e, alt) => { const x = el(tag, c); x.appendChild(pic(e, alt)); return x; };
    const round = (icon, label, onTap) => {
      const b = el("button", "rb", icon);
      b.type = "button";
      b.setAttribute("aria-label", T(label));
      b.addEventListener("click", onTap);
      return b;
    };
    const navb = (label, c, onTap) => {
      const b = el("button", "navb " + c, label);
      b.type = "button";
      b.addEventListener("click", onTap);
      return b;
    };
    let ro = null;
    const page = (title, onBack) => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      gen++;
      if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } ro = null; }
      try { ctx.stopVoice(); } catch (e) { /* ignore */ }
      const root = ctx.screen;
      /* a new screen starts at the top (the scroller is the core's #body) */
      try { if (root.parentElement) root.parentElement.scrollTop = 0; } catch (e) { /* ignore */ }
      while (root.firstChild) root.removeChild(root.firstChild);
      const w = el("div", "wrap");
      if (title) {
        const bar = el("div", "bar");
        bar.appendChild(round("⬅️", L.back, onBack));
        bar.appendChild(el("div", "bartitle", title));
        bar.appendChild(round("🔊", L.hear, () => say(last)));
        w.appendChild(bar);
      }
      root.appendChild(w);
      return w;
    };
    /* keeps --u (1% of the picture's width) in step with its size */
    const watch = (stage) => {
      const set = () => { const wd = stage.getBoundingClientRect().width; if (wd > 0) stage.style.setProperty("--u", (wd / 100).toFixed(2) + "px"); };
      if (window.ResizeObserver) { ro = new ResizeObserver(set); ro.observe(stage); }
      later(set, 0);
      set();
    };
    const live = () => { const g = gen; return () => g === gen && ctx.screen.isConnected; };
    const cleanup = () => { for (const id of timers) clearTimeout(id); timers.clear(); gen++; if (ro) { try { ro.disconnect(); } catch (e) { /* ignore */ } } try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    return { T, el, say, later, pop, wiggle, sfx, buzz, pic, picEl, age, round, navb, page, watch, live, cleanup, anim };
  }

  /* ---------------- the activity ---------------- */
  NS.registerActivity({
    id: "future",
    icon: "🗺️",
    title: { hi: "भविष्य की सैर", en: "Future Trip", hinglish: "Bhavishya ki sair" },
    color: "#7B4FD6",
    section: "future",
    free: false,
    order: 30,
    open(ctx) {
      injectCSS();
      const C = (NS.content && NS.content.future) || { journeys: [] };
      const J = C.journeys || [];
      const k = kit(ctx);
      const { T, el, say, later, pop, wiggle, sfx, buzz, pic, picEl, age, navb, page, watch, live } = k;
      let finishedNow = 0;
      const done = () => ctx.data.get("done", []) || [];

      /* ---------- the map ---------- */
      function map() {
        const w = page(null);
        w.appendChild(el("h2", "head", "🚀 " + T({ hi: "भविष्य की सैर", en: "Future Trip" })));
        w.appendChild(el("p", "say", T(L.mapIntro)));
        const tiles = el("div", "tiles");
        const d = done();
        const sug = suggest(J, d);
        J.forEach((j) => {
          const b = el("button", "tile" + (j.id === sug ? " sugg" : ""));
          b.type = "button";
          b.style.background = j.color;
          b.setAttribute("aria-label", T(j.title));
          b.append(picEl("span", "tile-e", j.icon), el("span", "tile-t", T(j.title)));
          if (d.indexOf(j.id) >= 0) { const t = el("span", "tick", "⭐"); t.setAttribute("aria-hidden", "true"); b.appendChild(t); }
          b.dataset.sfx = "whoosh";
          b.addEventListener("click", () => trip(j.id, 0));
          tiles.appendChild(b);
        });
        w.appendChild(tiles);
        say(L.mapIntro);
      }

      /* ---------- one page of a trip ---------- */
      function trip(id, pi) {
        const j = J.find((x) => x.id === id);
        if (!j) return map();
        const pages = pagesFor(j, age());
        if (pi >= pages.length) return quiz(j, 0);
        const pg = pages[pi];
        const w = page(j.icon + " " + T(j.title), map);
        const stage = el("div", "stage bg-" + (pg.bg || "sky"));
        w.appendChild(stage);
        watch(stage);
        const els = {};
        let target = null;
        (pg.scene || []).forEach((d, i) => {
          const named = !!d.name;
          const isTarget = pg.act && pg.act.type === "tap" && pg.act.target === d.id;
          /* pictures are images you can tap (not buttons); every task also has a real button */
          const node = el("span", "el" + (isTarget ? " target" : "") + (named || isTarget ? " tap" : ""));
          if (named || isTarget) { node.setAttribute("role", "img"); node.setAttribute("aria-label", T(d.name || { hi: "चित्र", en: "picture" })); }
          else node.setAttribute("aria-hidden", "true");
          const inner = el("span", "in" + (d.a ? " a-" + d.a : ""));
          if (d.p) inner.appendChild(prop(d));
          else inner.appendChild(pic(d.e));
          node.appendChild(inner);
          node.style.left = d.x + "%";
          node.style.top = d.y + "%";
          if (d.p) node.style.width = "calc(var(--u) * " + d.s + ")";
          else node.style.fontSize = "calc(var(--u) * " + d.s + ")";
          node.style.zIndex = String(10 + i);
          if (d.hidden) node.hidden = true;
          els[d.id || "_" + i] = { d: Object.assign({}, d), node, inner };
          if (isTarget) target = els[d.id];
          if (named && !isTarget) node.addEventListener("click", () => { sfx("pop"); pop(inner, true); say(d.name); });
          stage.appendChild(node);
        });
        const text = el("p", "text", T(pg.text));
        w.appendChild(text);
        const actBox = el("div", "sort");
        w.appendChild(actBox);
        /* nav */
        const nav = el("div", "nav");
        const prev = navb("◀", "prev", () => { if (pi > 0) trip(id, pi - 1); else map(); });
        prev.setAttribute("aria-label", T(L.prev));
        prev.dataset.sfx = "flip";
        const next = navb("▶ " + T(L.next), "next", () => trip(id, pi + 1));
        next.dataset.sfx = "flip";
        nav.append(prev, next);
        w.appendChild(nav);
        const dots = el("div", "dots");
        pages.forEach((_, i) => dots.appendChild(el("span", "dot" + (i === pi ? " dot-on" : ""))));
        w.appendChild(dots);
        const ready = () => { next.classList.remove("future-next-ready"); void next.offsetWidth; next.classList.add("future-next-ready"); };

        /* apply one change to the picture */
        const apply = (c) => {
          const r = els[c.id];
          if (!r) return;
          if (c.e != null && !r.d.p) r.inner.replaceChildren(pic(c.e));
          if (c.level != null && r.d.p) { r.d.level = c.level; while (r.inner.firstChild) r.inner.removeChild(r.inner.firstChild); r.inner.appendChild(prop(r.d)); }
          if (c.x != null) r.node.style.left = c.x + "%";
          if (c.y != null) r.node.style.top = c.y + "%";
          if (c.s != null) { if (r.d.p) r.node.style.width = "calc(var(--u) * " + c.s + ")"; else r.node.style.fontSize = "calc(var(--u) * " + c.s + ")"; }
          if (c.show) { r.node.hidden = false; pop(r.inner, true); }
          if (c.hide) r.node.hidden = true;
          if (c.a) { r.inner.className = "future-in future-a-" + c.a; }
          if (!c.hide && !c.a) pop(r.inner);
        };
        const act = pg.act;
        let promptEl = null;
        const finish = () => {
          if (promptEl) { promptEl.textContent = "✅ " + T(act.done); promptEl.classList.add("future-prompt-done"); }
          sfx("correct");
          buzz("success");
          ready();
          return say(act.done);
        };
        if (act) {
          promptEl = el(act.type === "tap" && target ? "button" : "div", "prompt", "👉 " + T(act.prompt));
          if (promptEl.tagName === "BUTTON") { promptEl.type = "button"; promptEl.dataset.sfx = "none"; promptEl.classList.add("future-prompt-btn"); }
          w.insertBefore(promptEl, actBox);
        }
        if (act && act.type === "tap" && target) {
          let n = 0;
          promptEl.addEventListener("click", () => { if (n < act.times) target.node.click(); else say(act.done); });
          target.node.addEventListener("click", () => {
            if (n >= act.times) { pop(target.inner, true); sfx("pop"); return; }
            n++;
            (act.steps && act.steps[n - 1] || []).forEach(apply);
            pop(target.inner, true);
            sfx("sparkle");
            buzz("tap");
            if (n >= act.times) {
              target.node.classList.remove("future-target");
              (act.after || []).forEach(apply);
              finish();
            }
          });
        } else if (act && act.type === "choose") {
          const opts = el("div", "opts");
          let solved = false;
          act.options.forEach((o, i) => {
            const b = el("button", "opt");
            b.type = "button";
            b.setAttribute("aria-label", T(o));
            b.dataset.sfx = "none";           /* answers sound correct / tryagain */
            b.append(picEl("span", "opt-p", o.e), el("span", "opt-t", T(o)));
            b.addEventListener("click", () => {
              if (solved) return;
              if (isRight(act, i)) {
                solved = true;
                b.classList.add("future-opt-ok");
                pop(b, true);
                finish();
              } else {
                b.classList.add("future-opt-no");
                wiggle(b);
                sfx("tryagain");
                say(act.wrong || L.tryAgain);
              }
            });
            opts.appendChild(b);
          });
          actBox.appendChild(opts);
        } else if (act && act.type === "sort") {
          let idx = 0;
          const cur = el("div", "sortitem");
          const bins = el("div", "bins");
          const piles = {};
          const showItem = () => {
            while (cur.firstChild) cur.removeChild(cur.firstChild);
            const it = act.items[idx];
            cur.append(picEl("b", null, it.e), el("span", null, T(it)));
            pop(cur);
          };
          act.bins.forEach((bn) => {
            const col = el("div", null);
            const b = el("button", "bin");
            b.type = "button";
            b.style.background = bn.color;
            b.setAttribute("aria-label", T(bn));
            b.dataset.sfx = "none";
            b.append(el("span", null, bn.e), el("span", null, T(bn)));
            const pile = el("div", "binpile", "");
            piles[bn.id] = pile;
            b.addEventListener("click", () => {
              if (idx >= act.items.length) return;
              const it = act.items[idx];
              if (sortRight(it, bn.id)) {
                sfx("pop");
                buzz("tap");
                pile.appendChild(pic(it.e));
                pop(b, true);
                idx++;
                if (idx >= act.items.length) { cur.hidden = true; finish(); }
                else { showItem(); say(act.items[idx]); }
              } else {
                wiggle(b);
                sfx("tryagain");
                say([act.items[idx], L.wrongBin]);
              }
            });
            col.append(b, pile);
            bins.appendChild(col);
          });
          actBox.append(cur, bins);
          showItem();
        } else {
          ready();
        }
        const lines = pi === 0 ? [j.title, pg.text] : [pg.text];
        if (act) lines.push(act.prompt);
        else if (pi === 0 && (pg.scene || []).some((d) => d.name)) lines.push(L.tapThings);
        if (act && act.type === "sort") lines.push(act.items[0]);
        say(lines);
      }

      /* ---------- picture questions ---------- */
      function quiz(j, qi) {
        const qs = j.quiz || [];
        if (qi >= qs.length) return mission(j);
        const q = qs[qi];
        const w = page(j.icon + " " + T(j.title), map);
        const ok = live();
        w.appendChild(el("p", "say", "❓ " + T(q.q)));
        const opts = el("div", "opts");
        let solved = false, misses = 0;
        const btns = q.options.map((o, i) => {
          const b = el("button", "opt");
          b.type = "button";
          b.setAttribute("aria-label", T(o));
          b.dataset.sfx = "none";
          b.append(picEl("span", "opt-p", o.e), el("span", "opt-t", T(o)));
          b.style.minHeight = "140px";
          b.addEventListener("click", () => {
            if (solved) return;
            if (isRight(q, i)) {
              solved = true;
              b.classList.add("future-opt-ok");
              pop(b, true);
              sfx("correct");
              buzz("success");
              const p = say(q.why || { hi: "शाबाश!", en: "Well done!" });
              const go = () => { if (ok()) quiz(j, qi + 1); };
              p.then(() => later(go, 600));
            } else {
              misses++;
              b.classList.add("future-opt-no");
              wiggle(b);
              sfx("tryagain");
              say(L.tryAgain);
              if (misses >= 2 && typeof q.answer === "number") pop(btns[q.answer], true);
            }
          });
          opts.appendChild(b);
          return b;
        });
        w.appendChild(opts);
        say(qi === 0 ? [L.quizIntro, q.q] : [q.q]);
      }

      /* ---------- the off-screen mission ---------- */
      function mission(j) {
        const w = page(j.icon + " " + T(j.title), map);
        const card = el("div", "card");
        card.append(el("div", "label", "🎯 " + T(L.mission)), picEl("div", "big", j.mission.e), el("p", "say", T(j.mission)));
        w.appendChild(card);
        const row = el("div", "row");
        const okb = navb("👍 " + T(L.ok), "next", () => {
          const first = done().indexOf(j.id) < 0;
          ctx.data.set("done", markDone(done(), j.id));
          finishedNow++;
          const p = say(finishedNow >= 2 ? [L.missionDone, L.eyes] : [L.missionDone]);
          if (first) p.then(() => ctx.reward({ sticker: j.sticker || j.icon, reason: T(j.title) }));
          end(j);
        });
        okb.dataset.sfx = "sparkle";
        row.appendChild(okb);
        w.appendChild(row);
        say([L.mission, j.mission]);
      }
      function end(j) {
        const w = page(j.icon + " " + T(j.title), map);
        const tired = finishedNow >= 2;
        const card = el("div", "card");
        card.append(picEl("div", "big", tired ? "🌳👀" : "⭐"), el("p", "say", T(tired ? L.eyes : L.missionDone)));
        w.appendChild(card);
        const row = el("div", "row");
        if (tired) {
          row.append(navb("🏃 " + T(L.goPlay), "next", () => ctx.home()), navb("🗺️ " + T(L.map), "prev", map));
        } else {
          row.append(navb("🗺️ " + T(L.more), "next", map));
        }
        w.appendChild(row);
      }

      map();
      return k.cleanup;
    },
  });
})();
