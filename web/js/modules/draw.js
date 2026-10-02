/* नन्हा स्कूल — "रंग भरो और चित्र बनाओ" (colouring and drawing).
   (a) रंग भरो: ten simple line pictures (आम, हाथी, घर और सूरज, तितली, कार, फूल, मछली, मोर, पतंग,
       दीया). Every area is its own SVG path, so a tap fills exactly that area — reliable on any
       screen, with a finger, a stylus or a mouse. 12 bright colours (each name is spoken) + an
       eraser, undo, and the colours stay on the page for next time.
   (b) चित्र बनाओ: a free drawing paper with three brush sizes, the same colours, picture stamps,
       undo and a fresh page.
   "फ्रेम में लगाओ" keeps a small PNG of the picture in the child's own gallery on this device
   (ctx.data "gallery", at most 12 — the oldest makes room). Nothing ever leaves the device.

   Pure data/logic for tools/test/create.test.mjs: NS.create.draw. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.create = NS.create || {};

  /* ---------------- colouring pages (viewBox 0 0 200 200) ---------------- */
  const f = n => Math.round(n * 10) / 10;
  const circ = (cx, cy, r) => "M" + f(cx - r) + " " + f(cy) + " A" + r + " " + r + " 0 1 0 " + f(cx + r) + " " + f(cy) + " A" + r + " " + r + " 0 1 0 " + f(cx - r) + " " + f(cy) + " Z";
  /* an ellipse whose rx axis points at angle a (degrees) */
  function ell(cx, cy, rx, ry, a) {
    const t = a * Math.PI / 180, dx = rx * Math.cos(t), dy = rx * Math.sin(t);
    return "M" + f(cx + dx) + " " + f(cy + dy) + " A" + rx + " " + ry + " " + a + " 1 0 " + f(cx - dx) + " " + f(cy - dy) + " A" + rx + " " + ry + " " + a + " 1 0 " + f(cx + dx) + " " + f(cy + dy) + " Z";
  }
  /* a pie slice from angle a0 to a1 (degrees, clockwise on screen) */
  function wedge(cx, cy, r, a0, a1) {
    const p = a => f(cx + r * Math.cos(a * Math.PI / 180)) + " " + f(cy + r * Math.sin(a * Math.PI / 180));
    return "M" + cx + " " + cy + " L" + p(a0) + " A" + r + " " + r + " 0 0 1 " + p(a1) + " Z";
  }
  const BG = "M0 0 H200 V200 H0 Z";
  const rays = (cx, cy, r0, r1, n) => Array.from({ length: n }, (_, k) => { const a = k * 2 * Math.PI / n; return "M" + f(cx + r0 * Math.cos(a)) + " " + f(cy + r0 * Math.sin(a)) + " L" + f(cx + r1 * Math.cos(a)) + " " + f(cy + r1 * Math.sin(a)); }).join(" ");

  const PAGES = [
    { id: "mango", e: "🥭", name: { hi: "आम", en: "Mango", hinglish: "Aam" },
      regions: [BG,
        "M108 44 C96 28 70 22 52 30 C68 46 94 52 108 44 Z",
        "M113 42 C128 24 158 20 178 28 C160 44 134 50 113 42 Z",
        "M112 58 C150 62 172 100 162 138 C152 172 116 186 86 172 C62 160 60 136 72 122 C80 110 70 98 72 84 C76 66 92 56 112 58 Z",
        "M104 60 C103 50 105 44 110 38 L117 41 C113 47 112 53 113 60 Z"],
      lines: ["M116 41 C136 35 156 30 174 29", "M105 43 C92 37 72 32 56 31", "M142 96 C148 108 148 122 142 134"] },
    { id: "elephant", e: "🐘", name: { hi: "हाथी", en: "Elephant", hinglish: "Haathi" },
      regions: [BG, "M0 168 H200 V200 H0 Z",
        "M76 132 H98 V176 C98 180 76 180 76 176 Z", "M104 132 H124 V172 C124 176 104 176 104 172 Z",
        "M134 132 H154 V176 C154 180 134 180 134 176 Z", "M158 128 H176 V170 C176 174 158 174 158 170 Z",
        "M178 96 C188 102 192 116 190 128 L185 129 C185 118 181 108 172 103 Z",
        "M62 82 C88 58 160 58 178 90 C190 112 178 142 152 146 L84 146 C58 142 48 104 62 82 Z",
        "M28 74 C30 50 64 44 78 62 C88 78 80 104 62 108 C44 112 26 96 28 74 Z",
        "M32 96 C24 114 24 136 18 152 C16 160 28 162 30 154 C36 134 44 118 52 104 Z",
        "M58 60 C72 50 94 58 94 80 C94 100 76 108 64 100 C56 92 54 74 58 60 Z",
        "M44 104 C48 114 58 118 66 114 C58 112 52 106 50 100 Z"],
      dots: [[42, 74, 3.5]] },
    { id: "house", e: "🏠", name: { hi: "घर और सूरज", en: "House and sun", hinglish: "Ghar aur suraj" },
      regions: [BG, "M0 158 H200 V200 H0 Z", circ(162, 38, 18),
        "M24 50 C22 38 38 32 46 40 C52 28 72 30 74 44 C86 44 88 60 74 62 H30 C18 62 16 50 24 50 Z",
        "M118 64 H132 V90 H118 Z", "M48 102 H144 V164 H48 Z", "M36 104 L96 56 L156 104 Z",
        "M84 124 H108 V164 H84 Z", "M58 112 H76 V130 H58 Z", "M118 112 H136 V130 H118 Z",
        "M168 122 H178 V162 H168 Z", circ(173, 110, 18)],
      lines: [rays(162, 38, 23, 31, 8), "M67 112 V130 M58 121 H76", "M127 112 V130 M118 121 H136", "M90 164 L82 200 M102 164 L110 200"],
      dots: [[103, 145, 2]] },
    { id: "butterfly", e: "🦋", name: { hi: "तितली", en: "Butterfly", hinglish: "Titli" },
      regions: [BG,
        "M96 92 C80 48 38 26 24 48 C12 70 38 98 96 104 Z", "M104 92 C120 48 162 26 176 48 C188 70 162 98 104 104 Z",
        "M96 106 C68 104 36 120 42 148 C48 170 84 160 96 118 Z", "M104 106 C132 104 164 120 158 148 C152 170 116 160 104 118 Z",
        circ(56, 62, 11), circ(144, 62, 11), circ(66, 138, 8), circ(134, 138, 8),
        "M94 78 C94 70 106 70 106 78 L106 152 C106 162 94 162 94 152 Z", circ(100, 66, 9)],
      lines: ["M96 59 C90 46 84 40 76 38", "M104 59 C110 46 116 40 124 38"],
      dots: [[76, 38, 3], [124, 38, 3]] },
    { id: "car", e: "🚗", name: { hi: "कार", en: "Car", hinglish: "Car" },
      regions: [BG, "M0 162 H200 V200 H0 Z", "M56 102 L74 70 H132 L150 102 Z",
        "M68 100 L80 78 H100 V100 Z", "M106 100 V78 H126 L138 100 Z",
        "M22 100 H178 C186 100 190 108 190 116 V140 C190 144 186 146 182 146 H18 C14 146 10 144 10 140 V116 C10 108 14 100 22 100 Z",
        circ(56, 146, 20), circ(56, 146, 8), circ(146, 146, 20), circ(146, 146, 8),
        "M174 112 H186 V124 H174 Z", "M14 112 H24 V124 H14 Z"],
      lines: ["M103 102 V140", "M110 114 H120", "M10 184 H40 M80 184 H120 M160 184 H190"] },
    { id: "flower", e: "🌸", name: { hi: "फूल", en: "Flower", hinglish: "Phool" },
      regions: [BG, "M0 172 H200 V200 H0 Z", "M97 96 H103 V174 H97 Z",
        "M98 144 C82 124 60 126 50 134 C62 150 84 154 98 144 Z", "M102 156 C118 136 140 138 150 146 C138 162 116 166 102 156 Z"]
        .concat([0, 1, 2, 3, 4, 5].map(k => { const a = k * 60 - 90, t = a * Math.PI / 180; return ell(100 + 27 * Math.cos(t), 76 + 27 * Math.sin(t), 20, 13, a); }))
        .concat([circ(100, 76, 14)]),
      lines: ["M100 112 C96 124 88 132 74 136", "M100 128 C106 140 116 146 128 148"] },
    { id: "fish", e: "🐟", name: { hi: "मछली", en: "Fish", hinglish: "Machhli" },
      regions: [BG, "M14 200 C4 180 24 170 14 150 C26 164 30 182 26 200 Z", "M178 200 C170 184 190 172 182 152 C194 168 196 186 190 200 Z",
        "M146 100 L182 68 C176 88 176 112 182 132 Z", "M76 70 C86 46 116 46 126 72 Z", "M88 130 C94 148 112 150 120 132 Z",
        "M36 100 C58 58 132 56 152 100 C132 144 58 142 36 100 Z",
        "M104 62 C114 80 114 120 104 138 C114 136 122 132 128 126 C134 110 134 90 128 74 C122 68 114 64 104 62 Z",
        circ(66, 94, 9), circ(28, 62, 6), circ(20, 42, 4.5), circ(32, 24, 5.5)],
      lines: ["M86 78 C78 92 78 108 86 122", "M38 103 L47 105"],
      dots: [[68, 94, 3.5]] },
    { id: "peacock", e: "🦚", name: { hi: "मोर", en: "Peacock", hinglish: "Mor" },
      regions: [BG, "M0 176 H200 V200 H0 Z"]
        .concat([0, 1, 2, 3, 4].map(k => wedge(100, 138, 84, 180 + 36 * k, 216 + 36 * k)))
        .concat([0, 1, 2, 3, 4].map(k => { const t = (198 + 36 * k) * Math.PI / 180; return circ(100 + 62 * Math.cos(t), 138 + 62 * Math.sin(t), 11); }))
        .concat([0, 1, 2, 3, 4].map(k => { const t = (198 + 36 * k) * Math.PI / 180; return circ(100 + 62 * Math.cos(t), 138 + 62 * Math.sin(t), 5); }))
        .concat(["M84 152 C78 124 88 104 100 102 C112 104 122 124 116 152 C112 166 88 166 84 152 Z",
          "M94 106 C92 90 92 74 96 62 L106 62 C106 74 106 90 106 106 Z", circ(101, 56, 10), "M91 55 L80 59 L91 62 Z"]),
      lines: ["M101 46 L96 33 M101 46 L101 31 M101 46 L106 33", "M94 162 L90 178 M106 162 L110 178"],
      dots: [[96, 32, 2.5], [101, 30, 2.5], [106, 32, 2.5], [98, 54, 2]] },
    { id: "kite", e: "🪁", name: { hi: "पतंग", en: "Kite", hinglish: "Patang" },
      regions: [BG,
        "M20 40 C18 30 32 24 40 32 C46 22 64 24 66 36 C76 36 78 50 66 52 H26 C16 52 14 42 20 40 Z",
        "M130 124 C128 114 142 108 150 116 C156 106 174 108 176 120 C186 120 188 134 176 136 H136 C126 136 124 126 130 124 Z",
        "M100 22 L48 82 L100 82 Z", "M100 22 L152 82 L100 82 Z", "M48 82 L100 150 L100 82 Z", "M152 82 L100 150 L100 82 Z",
        "M96 162 L84 154 L84 170 Z", "M96 162 L108 154 L108 170 Z", "M102 182 L90 174 L90 190 Z", "M102 182 L114 174 L114 190 Z"],
      lines: ["M100 150 C88 160 110 170 100 182 C94 190 98 196 102 200", "M100 82 C140 118 166 160 198 196"] },
    { id: "diya", e: "🪔", name: { hi: "दीया", en: "Diwali lamp", hinglish: "Diya" },
      regions: [BG, "M0 166 H200 V200 H0 Z", circ(30, 184, 7), circ(60, 186, 7), circ(140, 186, 7), circ(170, 184, 7),
        "M78 140 H122 L132 168 H68 Z",
        "M28 116 C36 152 140 158 162 128 L180 114 C152 110 62 106 28 116 Z",
        "M44 132 C76 144 124 144 154 132 L150 140 C120 152 80 152 48 140 Z",
        "M40 116 C66 106 140 106 164 116 C140 124 66 124 40 116 Z",
        "M170 110 C152 92 160 64 172 46 C178 66 194 82 182 106 C178 112 174 112 170 110 Z",
        "M172 106 C166 94 168 82 173 72 C177 84 184 94 179 104 Z"],
      lines: ["M30 34 V50 M22 42 H38", "M146 22 V34 M140 28 H152", "M70 30 V40 M65 35 H75"] },
  ];

  const COLORS = [
    { c: "#E53935", n: { hi: "लाल", en: "Red", hinglish: "Laal" } },
    { c: "#FB8C00", n: { hi: "नारंगी", en: "Orange", hinglish: "Naarangi" } },
    { c: "#FDD835", n: { hi: "पीला", en: "Yellow", hinglish: "Peela" } },
    { c: "#9CCC65", n: { hi: "हल्का हरा", en: "Light green", hinglish: "Halka hara" } },
    { c: "#2E7D32", n: { hi: "हरा", en: "Green", hinglish: "Hara" } },
    { c: "#4FC3F7", n: { hi: "आसमानी", en: "Sky blue", hinglish: "Aasmaani" } },
    { c: "#1E4FD8", n: { hi: "नीला", en: "Blue", hinglish: "Neela" } },
    { c: "#8E24AA", n: { hi: "बैंगनी", en: "Purple", hinglish: "Baingani" } },
    { c: "#F06292", n: { hi: "गुलाबी", en: "Pink", hinglish: "Gulaabi" } },
    { c: "#8D5A3C", n: { hi: "भूरा", en: "Brown", hinglish: "Bhoora" } },
    { c: "#FFCC80", n: { hi: "हल्का पीच", en: "Peach", hinglish: "Peach" } },
    { c: "#263238", n: { hi: "काला", en: "Black", hinglish: "Kaala" } },
  ];
  const ERASER = { c: "#FFFFFF", n: { hi: "रबड़", en: "Eraser", hinglish: "Rabad" }, eraser: true };
  const STAMPS = ["⭐", "🌸", "🦋", "🐟", "☀️", "🌈", "🐘", "🦚", "🏠", "🚗", "🎈", "🌳"];
  const BRUSHES = [0.014, 0.03, 0.06];
  const GALLERY_MAX = 12;
  const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

  /* gallery list → new list with `item` added; the oldest drop off beyond `max` */
  function addToGallery(list, item, max) {
    const out = (Array.isArray(list) ? list : []).filter(x => x && typeof x.src === "string" && PNG.test(x.src));
    out.push(item);
    while (out.length > (max || GALLERY_MAX)) out.shift();
    return out;
  }
  const regionCount = pg => pg.regions.length;
  /* free-drawing operations after the last "clear" (what is visible) */
  function visibleOps(ops) {
    let k = -1;
    ops.forEach((o, i) => { if (o.t === "clear") k = i; });
    return ops.slice(k + 1);
  }
  NS.create.draw = { PAGES, COLORS, ERASER, STAMPS, BRUSHES, GALLERY_MAX, addToGallery, regionCount, visibleOps, circ, ell, wedge };

  /* ---------------- UI ---------------- */
  const CSS = `
.draw-wrap{display:flex;flex-direction:column;gap:10px;flex:1 1 auto;min-height:0;width:100%;max-width:1040px;margin:0 auto}
.draw-bar{display:flex;align-items:center;gap:8px}
.draw-rb{width:56px;height:56px;flex:0 0 auto;border:none;border-radius:50%;padding:0;background:var(--surface);color:var(--ink);font-size:24px;line-height:1;display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.12);touch-action:manipulation}
.draw-bt{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(19px,5vw,28px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.draw-cap{margin:0;text-align:center;font-weight:700;font-size:clamp(16px,4.3vw,22px);line-height:1.35;text-wrap:balance}
.draw-menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.draw-tile{border:none;border-radius:24px;min-height:140px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font-weight:800;font-size:clamp(18px,4.8vw,22px);color:var(--ink);box-shadow:0 4px 0 rgba(0,0,0,.1);touch-action:manipulation}
.draw-tile .draw-big{font-size:clamp(46px,13vw,64px);line-height:1}
.draw-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px}
.draw-thumb{border:none;border-radius:20px;background:var(--surface);padding:8px;display:flex;flex-direction:column;align-items:center;gap:4px;font-weight:800;font-size:clamp(15px,4vw,18px);color:var(--ink);box-shadow:0 4px 0 rgba(0,0,0,.1);touch-action:manipulation}
.draw-thumb svg{width:100%;height:auto;aspect-ratio:1;display:block;border-radius:12px;pointer-events:none}
.draw-work{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto minmax(240px,1fr) auto;grid-template-areas:"bar" "mute" "cap" "stage" "side"}
.draw-work>.draw-bar{grid-area:bar}.draw-work>.draw-mute{grid-area:mute}.draw-work>.draw-cap{grid-area:cap}.draw-work>.draw-stage{grid-area:stage}.draw-work>.draw-side{grid-area:side}
@media (orientation:landscape) and (min-aspect-ratio:5/4){
  .draw-work{grid-template-columns:minmax(0,1fr) minmax(230px,42%);grid-template-rows:auto auto auto minmax(0,1fr);grid-template-areas:"stage bar" "stage mute" "stage cap" "stage side"}
  .draw-work>.draw-side{align-self:start}
}
.draw-stage{position:relative;min-height:0;min-width:0}
.draw-paper{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:22px;box-shadow:var(--shadow);overflow:hidden;touch-action:none}
.draw-paper svg,.draw-paper canvas{position:absolute;left:0;top:0;width:100%;height:100%;display:block;touch-action:none;-webkit-user-select:none;user-select:none}
.draw-paper path{cursor:pointer}
.draw-side{display:flex;flex-direction:column;gap:8px;align-items:stretch;min-width:0}
.draw-row{display:flex;flex-wrap:wrap;gap:8px 6px;justify-content:center;align-items:center}
.draw-sw{width:42px;height:42px;flex:0 0 auto;border-radius:50%;border:3px solid #fff;padding:0;box-shadow:0 0 0 2px rgba(0,0,0,.15);touch-action:manipulation;font-size:18px;line-height:1}
.draw-sw[aria-pressed="true"]{box-shadow:0 0 0 4px var(--ink);border-width:4px}
.draw-nowrap{flex-wrap:nowrap;justify-content:flex-start}
.draw-scroll{display:flex;gap:6px;overflow-x:auto;min-width:0;flex:1 1 auto;padding:5px 3px;overscroll-behavior-x:contain}
.draw-sz{width:48px;height:48px;flex:0 0 auto;border:none;border-radius:50%;background:var(--surface);display:grid;place-items:center;padding:0;box-shadow:0 3px 0 rgba(0,0,0,.1);touch-action:manipulation}
.draw-sz i{display:block;border-radius:50%;background:var(--ink)}
.draw-sz[aria-pressed="true"],.draw-st[aria-pressed="true"]{outline:4px solid #F4511E;outline-offset:1px}
.draw-st{width:46px;height:46px;flex:0 0 auto;border:none;border-radius:14px;background:var(--surface);font-size:26px;line-height:1;padding:3px;display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.1);touch-action:manipulation}
.draw-st img{width:36px;height:36px;object-fit:contain;pointer-events:none}
.draw-btn{border:none;border-radius:999px;min-height:56px;padding:8px 14px;font-weight:800;font-size:clamp(15px,4vw,19px);background:var(--surface);color:var(--ink);box-shadow:0 4px 0 rgba(0,0,0,.12);touch-action:manipulation;flex:1 1 auto}
.draw-btn.draw-go{background:#F4511E;color:#fff;box-shadow:0 4px 0 #BF360C}
.draw-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:14px}
.draw-frame{border:none;padding:8px;border-radius:10px;background:linear-gradient(135deg,#C68B59,#8D5A3C);box-shadow:0 5px 0 #5D3A22,inset 0 0 0 3px rgba(255,255,255,.25);touch-action:manipulation}
.draw-frame img{display:block;width:100%;height:auto;aspect-ratio:1;background:#fff;border-radius:4px;pointer-events:none}
.draw-view{display:flex;flex-direction:column;align-items:center;gap:12px}
.draw-view .draw-frame{width:min(92vw,58vh,520px)}
.draw-empty{text-align:center;font-size:clamp(17px,4.6vw,22px);font-weight:700;color:var(--muted);padding:24px 8px}
@media (max-height:560px) and (orientation:landscape){
  .draw-wrap{gap:8px}.draw-rb{width:50px;height:50px}.draw-bt{font-size:20px}.draw-cap{font-size:16px}
  .draw-side{gap:6px}.draw-sw{width:36px;height:36px}.draw-sz{width:44px;height:44px}.draw-st{width:44px;height:44px;font-size:24px}.draw-st img{width:32px;height:32px}
  .draw-btn{min-height:50px;padding:5px 10px;font-size:15px}
}`;

  NS.registerActivity({
    id: "draw",
    icon: "🎨",
    title: { hi: "रंग भरो और चित्र बनाओ", en: "Colour and draw", hinglish: "Rang bharo aur chitra banao" },
    color: "#F4511E",
    section: "play",
    free: false,
    order: 30,
    open(ctx) {
      if (!document.getElementById("draw-style")) {
        const st = document.createElement("style");
        st.id = "draw-style";
        st.textContent = CSS;
        document.head.appendChild(st);
      }
      const P = "draw";
      const timers = new Set();
      let alive = true, lastSay = null, ro = null, onWin = null, rewarded = false;
      const T = o => (o == null ? "" : typeof o === "string" ? o : ctx.t(o));
      const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map(x => P + "-" + x).join(" ") : null, text == null ? null : String(text));
      const btn = (label, c, fn, aria) => { const b = ctx.button(label, c.split(" ").map(x => P + "-" + x).join(" "), fn); if (aria) b.setAttribute("aria-label", aria); return b; };
      const sfx = n => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* quiet */ } };
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
      const say = o => { const s = T(o); lastSay = s; return Promise.resolve(ctx.say(s)).catch(() => {}); };
      const dpr = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      const imgUrl = e => {
        try {
          if (typeof NS.imgUrl === "function") return NS.imgUrl(e);
          const u = typeof NS.img === "function" ? NS.img(e) : null;
          return typeof u === "string" && /^[\w\-./]+\.(?:webp|png|jpe?g|avif|svg)$/.test(u) && u.indexOf("..") < 0 ? u : null;
        } catch (x) { return null; }
      };
      const picEl = (e, cls) => {
        const box = el("span", cls);
        box.setAttribute("aria-hidden", "true");
        const url = imgUrl(e);
        if (!url) { box.textContent = e; return box; }
        const im = document.createElement("img");
        im.alt = ""; im.draggable = false; im.decoding = "async";
        im.addEventListener("error", () => { im.remove(); box.textContent = e; }, { once: true });
        im.src = url;
        box.appendChild(im);
        return box;
      };
      const clean = () => {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        if (ro) { ro.disconnect(); ro = null; }
        if (onWin) { window.removeEventListener("resize", onWin); onWin = null; }
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
        root.appendChild(w);
        return w;
      }
      /* keeps a square paper as big as the stage allows */
      function fit(stage, paper, onSize) {
        let size = 0;
        const go = () => {
          if (!alive || !stage.isConnected) return;
          const r = stage.getBoundingClientRect();
          const s = Math.max(160, Math.floor(Math.min(r.width, r.height)));
          if (s === size) return;
          size = s;
          paper.style.width = s + "px";
          paper.style.height = s + "px";
          if (onSize) onSize(s);
        };
        if (typeof ResizeObserver === "function") { ro = new ResizeObserver(go); ro.observe(stage); }
        onWin = go;
        window.addEventListener("resize", onWin);
        go();
        later(go, 60);
      }
      const gallery = () => (ctx.data.get("gallery", []) || []).filter(x => x && typeof x.src === "string" && PNG.test(x.src));
      function saveToGallery(src, kind) {
        if (!PNG.test(src)) return false;
        const before = gallery();
        const next = addToGallery(before, { id: String(NS.now ? NS.now() : Date.now()), at: NS.now ? NS.now() : Date.now(), kind, src });
        ctx.data.set("gallery", next);
        sfx("sparkle");
        const dropped = before.length >= GALLERY_MAX;
        const m = dropped
          ? { hi: "फ्रेम में लग गया! गैलरी भर गई थी, इसलिए सबसे पुराना चित्र हटा।", en: "It's in a frame! The gallery was full, so the oldest picture made room.", hinglish: "Frame mein lag gaya! Sabse purana chitra hata." }
          : { hi: "वाह! तुम्हारा चित्र फ्रेम में लग गया! गैलरी में देखो।", en: "Wow! Your picture is in a frame! See it in the gallery.", hinglish: "Waah! Tumhara chitra frame mein lag gaya!" };
        const p = say(m);
        if (!rewarded) { rewarded = true; p.then(() => { if (alive) ctx.reward({ sticker: "🎨", reason: { hi: "अपना चित्र बनाया!", en: "Made a picture!" } }); }); }
        return true;
      }

      /* ---------- menu ---------- */
      function menu() {
        const w = page(null);
        const intro = { hi: "रंग भरें या अपना चित्र बनाएँ? जो मन करे, दबाओ!", en: "Shall we colour, or draw your own picture? Tap one!", hinglish: "Rang bharein ya apna chitra banayein? Jo mann kare, dabao!" };
        w.appendChild(el("p", "cap", T(intro)));
        const grid = el("div", "menu");
        const n = gallery().length;
        [
          { e: "🖍️", t: { hi: "रंग भरो", en: "Colouring", hinglish: "Rang bharo" }, c: "#FFE0B2", go: pages },
          { e: "🎨", t: { hi: "चित्र बनाओ", en: "Draw", hinglish: "Chitra banao" }, c: "#C8E6C9", go: freeDraw },
          { e: "🖼️", t: { hi: "मेरी गैलरी", en: "My gallery", hinglish: "Meri gallery" }, c: "#E1BEE7", go: galleryView, n },
        ].forEach(g => {
          const b = btn("", "tile", () => g.go(), T(g.t));
          b.style.background = g.c;
          b.append(el("span", "big", g.e), el("span", null, T(g.t) + (g.n != null ? " (" + g.n + ")" : "")));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      /* ---------- colouring ---------- */
      const savedFills = () => ctx.data.get("fills", {}) || {};
      function pageSvg(pg, fills, label) {
        const svg = NS.svg("svg", { viewBox: "0 0 200 200", role: "img", "aria-label": label || T(pg.name), focusable: "false" });
        pg.regions.forEach((d, i) => {
          const fill = typeof fills[i] === "string" && /^#[0-9A-Fa-f]{6}$/.test(fills[i]) ? fills[i] : "#FFFFFF";
          svg.appendChild(NS.svg("path", { d, fill, stroke: "#3E2723", "stroke-width": "2.2", "stroke-linejoin": "round", "data-r": String(i) }));
        });
        (pg.lines || []).forEach(d => svg.appendChild(NS.svg("path", { d, fill: "none", stroke: "#3E2723", "stroke-width": "2.2", "stroke-linecap": "round", "pointer-events": "none" })));
        (pg.dots || []).forEach(([x, y, r]) => svg.appendChild(NS.svg("circle", { cx: x, cy: y, r, fill: "#3E2723", "pointer-events": "none" })));
        return svg;
      }
      function pages() {
        const w = page("🖍️ " + T({ hi: "रंग भरो", en: "Colouring", hinglish: "Rang bharo" }), menu);
        const intro = { hi: "कौन-सा चित्र रंगें? किसी पर दबाओ!", en: "Which picture shall we colour? Tap one!", hinglish: "Kaun sa chitra rangein? Kisi par dabao!" };
        w.appendChild(el("p", "cap", T(intro)));
        const grid = el("div", "pages");
        const sf = savedFills();
        PAGES.forEach(pg => {
          const b = btn("", "thumb", () => colour(pg.id), T(pg.name));
          b.append(pageSvg(pg, sf[pg.id] || [], ""), el("span", null, T(pg.name)));
          b.firstChild.setAttribute("aria-hidden", "true");
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }
      function palette(onPick, withEraser, initial) {
        const row = el("div", "row");
        const list = withEraser ? COLORS.concat([ERASER]) : COLORS;
        const btns = list.map((c, i) => {
          const b = btn(c.eraser ? "🧽" : "", "sw", () => { btns.forEach(x => x.setAttribute("aria-pressed", String(x === b))); onPick(c); say(c.n); }, T(c.n));
          b.style.background = c.eraser ? "#FFFFFF" : c.c;
          b.setAttribute("aria-pressed", String(i === (initial || 0)));
          b.dataset.sfx = "none";
          row.appendChild(b);
          return b;
        });
        return row;
      }
      function colour(id) {
        const pg = PAGES.find(p => p.id === id) || PAGES[0];
        const w = page("🖍️ " + T(pg.name), pages, true);
        const all = savedFills();
        const fills = (all[pg.id] || []).slice(0, pg.regions.length);
        const hist = [];
        let color = COLORS[0];
        const stage = el("div", "stage");
        const side = el("div", "side");
        w.append(stage, side);
        const paper = el("div", "paper");
        const svg = pageSvg(pg, fills);
        paper.appendChild(svg);
        stage.appendChild(paper);
        const store = () => { const a = savedFills(); a[pg.id] = fills.slice(); ctx.data.set("fills", a); };
        const setFill = (i, c) => { fills[i] = c; const p = svg.querySelector('path[data-r="' + i + '"]'); if (p) p.setAttribute("fill", c || "#FFFFFF"); };
        svg.addEventListener("click", e => {
          const t = e.target;
          if (!t || !t.getAttribute) return;
          const r = t.getAttribute("data-r");
          if (r == null) return;
          const i = Number(r);
          const prev = fills[i] || "#FFFFFF";
          if (prev === color.c) return;
          hist.push([[i, prev]]);
          setFill(i, color.c);
          store();
          sfx(color.eraser ? "whoosh" : "pop");
          if (!t.animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
          t.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 260 });
        });
        side.appendChild(palette(c => { color = c; }, true));
        const tools = el("div", "row");
        tools.append(
          btn("↩️ " + T({ hi: "वापस लो", en: "Undo", hinglish: "Undo" }), "btn", () => {
            const h = hist.pop();
            if (!h) return;
            h.slice().reverse().forEach(([i, c]) => setFill(i, c === "#FFFFFF" ? null : c));
            store();
          }),
          btn("🧽 " + T({ hi: "सब साफ़", en: "Clear all", hinglish: "Sab saaf" }), "btn", () => {
            const batch = [];
            fills.forEach((c, i) => { if (c && c !== "#FFFFFF") batch.push([i, c]); });
            if (!batch.length) return;
            hist.push(batch);
            batch.forEach(([i]) => setFill(i, null));
            store();
            say({ hi: "सब साफ़! गलती से हुआ हो तो 'वापस लो' दबाओ।", en: "All clear! If that was a mistake, tap Undo.", hinglish: "Sab saaf! Galti se hua ho to Undo dabao." });
          }),
          btn("🖼️ " + T({ hi: "फ्रेम में लगाओ", en: "Put in a frame", hinglish: "Frame mein lagao" }), "btn go", () => frameSvg(pg, fills)));
        tools.children[1].dataset.sfx = "whoosh";        // the core plays it on press
        tools.children[2].dataset.sfx = "none";          // framing has its own sparkle
        side.appendChild(tools);
        fit(stage, paper);
        say({ hi: "पहले नीचे से रंग चुनो, फिर चित्र में जहाँ रंग भरना है वहाँ दबाओ!", en: "Pick a colour below, then tap where you want to colour!", hinglish: "Pehle neeche se rang chuno, phir chitra mein dabao!" });
      }
      /* the coloured page → a small PNG (drawn through an <img> of the SVG; nothing leaves the device) */
      function frameSvg(pg, fills) {
        const svg = pageSvg(pg, fills, T(pg.name));
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        svg.setAttribute("width", "256");
        svg.setAttribute("height", "256");
        let xml;
        try { xml = new XMLSerializer().serializeToString(svg); } catch (e) { return; }
        const im = new Image();
        im.onload = () => {
          if (!alive) return;
          try {
            const c = document.createElement("canvas");
            c.width = 256; c.height = 256;
            const g = c.getContext("2d");
            g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256);
            g.drawImage(im, 0, 0, 256, 256);
            saveToGallery(c.toDataURL("image/png"), "colour");
          } catch (e) { say({ hi: "ओह! अभी फ्रेम नहीं लग पाया।", en: "Oops! Could not frame it just now." }); }
        };
        im.onerror = () => say({ hi: "ओह! अभी फ्रेम नहीं लग पाया।", en: "Oops! Could not frame it just now." });
        im.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      }

      /* ---------- free drawing ---------- */
      const stampImgs = new Map();
      function stampImg(e, onReady) {
        const url = imgUrl(e);
        if (!url) return null;
        let im = stampImgs.get(url);
        if (!im) {
          im = new Image();
          im.decoding = "async";
          im.addEventListener("load", () => { if (alive && onReady) onReady(); }, { once: true });
          im.src = url;
          stampImgs.set(url, im);
        }
        return im.complete && im.naturalWidth ? im : null;
      }
      function render(g, size, ops, onReady) {
        g.save();
        g.fillStyle = "#FFFFFF";
        g.fillRect(0, 0, size, size);
        g.lineCap = "round"; g.lineJoin = "round";
        visibleOps(ops).forEach(o => {
          if (o.t === "line") {
            g.strokeStyle = o.c;
            g.lineWidth = Math.max(1, o.w * size);
            g.beginPath();
            o.p.forEach((q, k) => { if (k) g.lineTo(q[0] * size, q[1] * size); else g.moveTo(q[0] * size, q[1] * size); });
            if (o.p.length === 1) g.lineTo(o.p[0][0] * size + 0.01, o.p[0][1] * size);
            g.stroke();
          } else if (o.t === "stamp") {
            const s = o.s * size, im = stampImg(o.e, onReady);
            if (im) g.drawImage(im, o.x * size - s / 2, o.y * size - s / 2, s, s);
            else { g.font = Math.round(s * 0.85) + "px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "#000"; g.fillText(o.e, o.x * size, o.y * size); }
          }
        });
        g.restore();
      }
      function freeDraw() {
        const w = page("🎨 " + T({ hi: "चित्र बनाओ", en: "Draw", hinglish: "Chitra banao" }), menu, true);
        const ops = [];
        let color = COLORS[6], brush = 1, stamp = null, cur = null, pid = null, size = 0;
        const stage = el("div", "stage");
        const side = el("div", "side");
        w.append(stage, side);
        const paper = el("div", "paper");
        const cv = document.createElement("canvas");
        cv.setAttribute("role", "img");
        cv.setAttribute("aria-label", T({ hi: "चित्र बनाने का कागज़", en: "Drawing paper" }));
        paper.appendChild(cv);
        stage.appendChild(paper);
        const redraw = () => {
          if (!size) return;
          const g = cv.getContext("2d");
          g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
          render(g, size, cur ? ops.concat([cur]) : ops, redraw);
        };
        const pos = e => { const r = cv.getBoundingClientRect(); return [Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))]; };
        cv.addEventListener("pointerdown", e => {
          if (pid != null) return;
          e.preventDefault();
          if (stamp) {
            ops.push({ t: "stamp", e: stamp, x: pos(e)[0], y: pos(e)[1], s: [0.12, 0.18, 0.26][brush] });
            sfx("pop");
            redraw();
            return;
          }
          try { cv.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
          pid = e.pointerId;
          cur = { t: "line", c: color.c, w: BRUSHES[brush] * (color.eraser ? 1.6 : 1), p: [pos(e)] };
          redraw();
        });
        cv.addEventListener("pointermove", e => {
          if (e.pointerId !== pid || !cur) return;
          e.preventDefault();
          const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
          (evs.length ? evs : [e]).forEach(ev => cur.p.push(pos(ev)));
          redraw();
        });
        const up = e => {
          if (e.pointerId !== pid) return;
          pid = null;
          if (cur) { cur.p = cur.p.map(q => [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000]); ops.push(cur); }
          cur = null;
          if (ops.length > 600) ops.splice(0, ops.length - 600);
          redraw();
        };
        cv.addEventListener("pointerup", up);
        cv.addEventListener("pointercancel", up);
        cv.addEventListener("contextmenu", e => e.preventDefault());
        /* tools */
        const sizes = el("div", "row nowrap");
        const stampRow = el("div", "scroll");
        const pickStamp = s => { stamp = s; stampBtns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.e === s))); };
        side.appendChild(palette(c => { color = c; pickStamp(null); }, true, COLORS.indexOf(color)));
        const sizeBtns = [0, 1, 2].map(i => {
          const b = btn("", "sz", () => { brush = i; sizeBtns.forEach(x => x.setAttribute("aria-pressed", String(x === b))); },
            T([{ hi: "पतला", en: "Thin" }, { hi: "मोटा", en: "Thick" }, { hi: "बहुत मोटा", en: "Very thick" }][i]));
          const dot = document.createElement("i");
          dot.style.width = dot.style.height = [8, 16, 28][i] + "px";
          b.appendChild(dot);
          b.setAttribute("aria-pressed", String(i === brush));
          sizes.appendChild(b);
          return b;
        });
        const stampBtns = STAMPS.map(s => {
          const b = btn("", "st", () => { if (stamp === s) pickStamp(null); else { pickStamp(s); say({ hi: "अब कागज़ पर दबाओ — ठप्पा लगेगा!", en: "Now tap the paper to stamp it!", hinglish: "Ab kaagaz par dabao — thappa lagega!" }); } }, T({ hi: "ठप्पा", en: "Stamp" }) + " " + s);
          b.dataset.e = s;
          b.appendChild(picEl(s, "stampic"));
          b.setAttribute("aria-pressed", "false");
          stampRow.appendChild(b);
          return b;
        });
        sizes.appendChild(stampRow);
        side.appendChild(sizes);
        const tools = el("div", "row");
        tools.append(
          btn("↩️ " + T({ hi: "वापस लो", en: "Undo", hinglish: "Undo" }), "btn", () => { if (ops.length) { ops.pop(); redraw(); } }),
          btn("📄 " + T({ hi: "नया कागज़", en: "New paper", hinglish: "Naya kaagaz" }), "btn", () => {
            if (!visibleOps(ops).length) return;
            ops.push({ t: "clear" });
            redraw();
            say({ hi: "नया कागज़! पुराना वापस चाहिए तो 'वापस लो' दबाओ।", en: "A fresh page! Want the old one back? Tap Undo.", hinglish: "Naya kaagaz! Purana chahiye to Undo dabao." });
          }),
          btn("🖼️ " + T({ hi: "फ्रेम में लगाओ", en: "Put in a frame", hinglish: "Frame mein lagao" }), "btn go", () => {
            if (!visibleOps(ops).length) { say({ hi: "पहले कुछ बनाओ, फिर फ्रेम में लगाएँगे!", en: "Draw something first, then we'll frame it!" }); return; }
            try {
              const c = document.createElement("canvas");
              c.width = 256; c.height = 256;
              render(c.getContext("2d"), 256, ops, null);
              saveToGallery(c.toDataURL("image/png"), "draw");
            } catch (e) { say({ hi: "ओह! अभी फ्रेम नहीं लग पाया।", en: "Oops! Could not frame it just now." }); }
          }));
        tools.children[1].dataset.sfx = "whoosh";        // the core plays it on press
        tools.children[2].dataset.sfx = "none";          // framing has its own sparkle
        side.appendChild(tools);
        fit(stage, paper, s => {
          size = s;
          cv.width = Math.round(s * dpr());
          cv.height = Math.round(s * dpr());
          redraw();
        });
        say({ hi: "उँगली से जो मन करे, बनाओ! रंग, मोटाई और ठप्पे नीचे हैं।", en: "Draw anything with your finger! Colours, sizes and stamps are below.", hinglish: "Ungli se jo mann kare, banao! Rang aur thappe neeche hain." });
      }

      /* ---------- gallery ---------- */
      function galleryView() {
        const w = page("🖼️ " + T({ hi: "मेरी गैलरी", en: "My gallery", hinglish: "Meri gallery" }), menu);
        const list = gallery();
        if (!list.length) {
          const m = { hi: "अभी गैलरी खाली है। कोई चित्र बनाओ और 'फ्रेम में लगाओ' दबाओ!", en: "The gallery is empty. Make a picture and tap 'Put in a frame'!", hinglish: "Abhi gallery khaali hai. Chitra banao aur frame mein lagao!" };
          w.appendChild(el("p", "empty", T(m)));
          w.appendChild(btn("🎨 " + T({ hi: "चित्र बनाओ", en: "Draw", hinglish: "Chitra banao" }), "btn go", freeDraw));
          say(m);
          return;
        }
        const one = list.length === 1;
        const m = one
          ? { hi: "यह रहा तुम्हारा चित्र! बड़ा देखने के लिए दबाओ।", en: "Here is your picture! Tap it to see it big.", hinglish: "Ye raha tumhara chitra! Bada dekhne ke liye dabao." }
          : { hi: "तुम्हारे " + list.length + " चित्र! किसी को बड़ा देखने के लिए दबाओ।", en: "Your " + list.length + " pictures! Tap one to see it big.", hinglish: "Tumhare " + list.length + " chitra! Bada dekhne ke liye dabao." };
        w.appendChild(el("p", "cap", T(m)));
        const grid = el("div", "gal");
        list.slice().reverse().forEach((it, k) => {
          const b = btn("", "frame", () => viewOne(it.id), T({ hi: "चित्र " + (k + 1), en: "Picture " + (k + 1) }));
          const im = document.createElement("img");
          im.alt = ""; im.src = it.src;
          b.appendChild(im);
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(m);
      }
      function viewOne(id) {
        const it = gallery().find(x => x.id === id);
        if (!it) { galleryView(); return; }
        const w = page("🖼️ " + T({ hi: "मेरा चित्र", en: "My picture", hinglish: "Mera chitra" }), galleryView);
        const v = el("div", "view");
        const fr = el("div", "frame");
        const im = document.createElement("img");
        im.alt = T({ hi: "मेरा चित्र", en: "My picture" }); im.src = it.src;
        fr.appendChild(im);
        v.appendChild(fr);
        let sure = false;
        const del = btn("🗑️ " + T({ hi: "हटाओ", en: "Remove", hinglish: "Hatao" }), "btn", () => {
          if (!sure) {
            sure = true;
            del.textContent = "🗑️ " + T({ hi: "पक्का हटाएँ?", en: "Really remove?", hinglish: "Pakka hatayein?" });
            say({ hi: "पक्का हटाना है? फिर से दबाओ।", en: "Really remove it? Tap again.", hinglish: "Pakka hatana hai? Phir se dabao." });
            later(() => { sure = false; del.textContent = "🗑️ " + T({ hi: "हटाओ", en: "Remove", hinglish: "Hatao" }); }, 4000);
            return;
          }
          ctx.data.set("gallery", gallery().filter(x => x.id !== id));
          galleryView();
        });
        const row = el("div", "row");
        row.append(btn("👍 " + T({ hi: "ठीक है", en: "Okay", hinglish: "Theek hai" }), "btn go", galleryView), del);
        v.appendChild(row);
        w.appendChild(v);
        say({ hi: "कितना सुंदर चित्र है!", en: "What a lovely picture!", hinglish: "Kitna sundar chitra hai!" });
      }

      menu();
      return () => { alive = false; clean(); try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    },
  });
})();
