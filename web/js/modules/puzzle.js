/* नन्हा स्कूल — "पहेली जोड़ो" (jigsaw). A picture (a realistic lesson picture via NS.img, or the
   emoji) in a little scene is cut into pieces; the child drags each piece onto the board and it
   snaps into place when it is close. Pieces by age: 2–3 years 2 → 3 → 4, 4–5 years 4 → 6,
   6+ 6 → 9 (each finished puzzle moves one step up). A faint picture on the board helps the
   younger ones. A finished puzzle is named aloud: "वाह! यह है आम!".
   Works with a finger, a stylus or a mouse (pointer events, touch-action: none on the board).

   Pure logic for tools/test/create.test.mjs: NS.create.puzzle. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.create = NS.create || {};

  const PICS = [
    { e: "🥭", hi: "आम", en: "a mango", hinglish: "aam", sky: "#FFF7C2", ground: "#C5E1A5" },
    { e: "🐘", hi: "हाथी", en: "an elephant", hinglish: "haathi", sky: "#BBDEFB", ground: "#A5D6A7" },
    { e: "🦁", hi: "शेर", en: "a lion", hinglish: "sher", sky: "#FFE0B2", ground: "#DCE775" },
    { e: "🦚", hi: "मोर", en: "a peacock", hinglish: "mor", sky: "#E1F5FE", ground: "#AED581" },
    { e: "🦋", hi: "तितली", en: "a butterfly", hinglish: "titli", sky: "#F8BBD0", ground: "#C5E1A5" },
    { e: "🐟", hi: "मछली", en: "a fish", hinglish: "machhli", sky: "#B3E5FC", ground: "#4FC3F7", water: true },
    { e: "🚂", hi: "रेलगाड़ी", en: "a train", hinglish: "railgaadi", sky: "#D1C4E9", ground: "#BCAAA4" },
    { e: "🍎", hi: "सेब", en: "an apple", hinglish: "seb", sky: "#FFEBEE", ground: "#C8E6C9" },
    { e: "🐄", hi: "गाय", en: "a cow", hinglish: "gaay", sky: "#E3F2FD", ground: "#9CCC65" },
    { e: "🦜", hi: "तोता", en: "a parrot", hinglish: "tota", sky: "#FFF9C4", ground: "#81C784" },
    { e: "🐯", hi: "बाघ", en: "a tiger", hinglish: "baagh", sky: "#FFE0B2", ground: "#AED581" },
    { e: "🚗", hi: "कार", en: "a car", hinglish: "car", sky: "#E0F7FA", ground: "#B0BEC5" },
  ];
  /* decorations make every piece different: [emoji, x %, y %, size % of the board] */
  const DECO = [["☀️", 15, 15, 20], ["☁️", 80, 15, 22], ["🌼", 12, 88, 15], ["🌷", 88, 88, 15]];
  const DECO_WATER = [["🫧", 16, 18, 14], ["🌿", 10, 84, 22], ["🐚", 88, 88, 14], ["🫧", 84, 24, 10]];

  const GRIDS = { 2: [1, 2], 3: [1, 3], 4: [2, 2], 6: [2, 3], 9: [3, 3] };
  const grid = n => { const g = GRIDS[n] || GRIDS[4]; return { rows: g[0], cols: g[1] }; };
  function levels(ageBand) {
    if (ageBand === "2-3") return [2, 3, 4];
    if (ageBand === "6+") return [6, 9];
    return [4, 6];
  }
  /* cut a B × B board into n pieces: [{i, r, c, x, y, w, h}] (x, y = the piece's place on the board) */
  function cut(n, B) {
    const { rows, cols } = grid(n);
    const w = B / cols, h = B / rows, out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ i: out.length, r, c, x: c * w, y: r * h, w, h });
    return out;
  }
  /* how close (as a share of the piece's smaller side) a piece must be dropped to snap */
  const snapTol = ageBand => (ageBand === "2-3" ? 0.45 : ageBand === "6+" ? 0.25 : 0.35);
  /* does a piece dropped with its top-left at board position (x, y) snap into its place? */
  function snaps(piece, x, y, tolFrac) {
    return Math.hypot(x - piece.x, y - piece.y) <= tolFrac * Math.min(piece.w, piece.h);
  }
  /* spread n pieces (pw × ph) over a tray rect {x, y, w, h}: [{x, y, s}] top-left + display
     scale, in a shuffled order so that no piece waits right next to its place */
  function trayLayout(n, pw, ph, rect, rand) {
    rand = rand || Math.random;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const cw = rect.w / cols, ch = rect.h / rows;
      const s = Math.min(1, (cw * 0.92) / pw, (ch * 0.92) / ph);
      if (!best || s > best.s + 1e-9) best = { cols, rows, cw, ch, s };
    }
    const order = Array.from({ length: n }, (_, k) => k);
    for (let k = n - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); const t = order[k]; order[k] = order[j]; order[j] = t; }
    if (n > 1 && order.every((v, k) => v === k)) order.push(order.shift());
    const out = new Array(n);
    order.forEach((piece, cell) => {
      const cx = rect.x + (cell % best.cols + 0.5) * best.cw, cy = rect.y + (Math.floor(cell / best.cols) + 0.5) * best.ch;
      const jx = (rand() - 0.5) * Math.max(0, best.cw - pw * best.s) * 0.5, jy = (rand() - 0.5) * Math.max(0, best.ch - ph * best.s) * 0.5;
      out[piece] = { x: cx - (pw * best.s) / 2 + jx, y: cy - (ph * best.s) / 2 + jy, s: best.s };
    });
    return out;
  }
  NS.create.puzzle = { PICS, grid, levels, cut, snapTol, snaps, trayLayout };

  /* ---------------- UI ---------------- */
  const CSS = `
.puzzle-wrap{display:flex;flex-direction:column;gap:10px;flex:1 1 auto;min-height:0;width:100%;max-width:1040px;margin:0 auto}
.puzzle-bar{display:flex;align-items:center;gap:8px}
.puzzle-rb{width:56px;height:56px;flex:0 0 auto;border:none;border-radius:50%;padding:0;background:var(--surface);color:var(--ink);font-size:24px;line-height:1;display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.12);touch-action:manipulation}
.puzzle-bt{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(19px,5vw,28px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.puzzle-cap{margin:0;text-align:center;font-weight:700;font-size:clamp(16px,4.3vw,22px);line-height:1.35;min-height:1.35em;text-wrap:balance}
.puzzle-pics{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:12px}
.puzzle-thumb{position:relative;border:none;border-radius:22px;aspect-ratio:1;padding:6px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-weight:800;font-size:clamp(15px,4vw,18px);color:#2D2A32;box-shadow:0 4px 0 rgba(0,0,0,.1);touch-action:manipulation}
.puzzle-thumb .puzzle-tp{font-size:clamp(40px,11vw,56px);line-height:1;display:flex}
.puzzle-thumb .puzzle-tp img{width:clamp(48px,14vw,72px);height:clamp(48px,14vw,72px);object-fit:contain}
.puzzle-thumb .puzzle-star{position:absolute;top:6px;right:8px;font-size:16px}
.puzzle-work{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto minmax(300px,1fr) auto;grid-template-areas:"bar" "mute" "cap" "stage" "side"}
.puzzle-work>.puzzle-bar{grid-area:bar}.puzzle-work>.puzzle-mute{grid-area:mute}.puzzle-work>.puzzle-cap{grid-area:cap}.puzzle-work>.puzzle-stage{grid-area:stage}.puzzle-work>.puzzle-side{grid-area:side}
@media (orientation:landscape) and (min-aspect-ratio:5/4){
  .puzzle-work{grid-template-columns:minmax(0,1fr) minmax(230px,34%);grid-template-rows:auto auto auto minmax(0,1fr);grid-template-areas:"stage bar" "stage mute" "stage cap" "stage side"}
  .puzzle-work>.puzzle-side{align-self:start}
}
.puzzle-play{position:relative;flex:1 1 auto;min-height:0;min-width:0;touch-action:none;-webkit-user-select:none;user-select:none}
.puzzle-board{position:absolute;border-radius:16px;background:#fff;box-shadow:var(--shadow);overflow:hidden}
.puzzle-ghost{position:absolute;inset:0;pointer-events:none}
.puzzle-cell{position:absolute;border:2px dashed rgba(0,0,0,.18);box-sizing:border-box;pointer-events:none}
.puzzle-piece{position:absolute;left:0;top:0;overflow:hidden;border-radius:6px;box-shadow:0 3px 8px rgba(0,0,0,.28);transform-origin:0 0;touch-action:none;cursor:grab;outline:2px solid #fff;outline-offset:-2px}
.puzzle-piece.puzzle-drag{box-shadow:0 12px 24px rgba(0,0,0,.35);cursor:grabbing}
.puzzle-piece.puzzle-fixed{box-shadow:none;outline:none;border-radius:0;cursor:default}
.puzzle-piece:focus-visible{outline:4px solid var(--focus)}
.puzzle-scene{position:absolute;left:0;top:0;overflow:hidden;pointer-events:none}
.puzzle-it{position:absolute;display:flex;align-items:center;justify-content:center;line-height:1;transform:translate(-50%,-50%)}
.puzzle-it img{width:100%;height:100%;object-fit:contain;display:block}
.puzzle-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.puzzle-btn{border:none;border-radius:999px;min-height:56px;padding:8px 18px;font-weight:800;font-size:clamp(16px,4.2vw,20px);background:var(--surface);color:var(--ink);box-shadow:0 4px 0 rgba(0,0,0,.12);touch-action:manipulation}
.puzzle-btn.puzzle-go{background:#00897B;color:#fff;box-shadow:0 4px 0 #00695C}
.puzzle-won .puzzle-board{animation:puzzle-pop .7s ease-out}
@keyframes puzzle-pop{40%{transform:scale(1.05)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.puzzle-won .puzzle-board{animation:none}}
@media (max-height:560px) and (orientation:landscape){
  .puzzle-wrap{gap:8px}.puzzle-rb{width:50px;height:50px}.puzzle-bt{font-size:20px}.puzzle-cap{font-size:16px}
  .puzzle-btn{min-height:50px;padding:5px 14px;font-size:16px}
}`;

  NS.registerActivity({
    id: "puzzle",
    icon: "🧩",
    title: { hi: "पहेली जोड़ो", en: "Jigsaw puzzles", hinglish: "Paheli jodo" },
    color: "#00897B",
    section: "play",
    free: false,
    order: 50,
    open(ctx) {
      if (!document.getElementById("puzzle-style")) {
        const st = document.createElement("style");
        st.id = "puzzle-style";
        st.textContent = CSS;
        document.head.appendChild(st);
      }
      const P = "puzzle";
      const timers = new Set();
      let alive = true, lastSay = null, ro = null, onWin = null, rewarded = false;
      const T = o => (o == null ? "" : typeof o === "string" ? o : ctx.t(o));
      const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map(x => P + "-" + x).join(" ") : null, text == null ? null : String(text));
      const btn = (label, c, fn, aria) => { const b = ctx.button(label, c.split(" ").map(x => P + "-" + x).join(" "), fn); if (aria) b.setAttribute("aria-label", aria); return b; };
      const sfx = n => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* quiet */ } };
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
      const say = o => { const s = T(o); lastSay = s; return Promise.resolve(ctx.say(s)).catch(() => {}); };
      const age = (ctx.profile && ctx.profile.ageBand) || "4-5";
      const LV = levels(age);
      const reduced = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
      const imgUrl = e => {
        try {
          if (typeof NS.imgUrl === "function") return NS.imgUrl(e);
          const u = typeof NS.img === "function" ? NS.img(e) : null;
          return typeof u === "string" && /^[\w\-./]+\.(?:webp|png|jpe?g|avif|svg)$/.test(u) && u.indexOf("..") < 0 ? u : null;
        } catch (x) { return null; }
      };
      /* one picture (img or emoji) centred at (x %, y %) with a box of `size` px */
      const item = (e, x, y, size) => {
        const it = el("span", "it");
        it.style.left = x + "%"; it.style.top = y + "%";
        it.style.width = it.style.height = size + "px";
        it.style.fontSize = Math.round(size * 0.86) + "px";
        const url = imgUrl(e);
        if (url) {
          const im = document.createElement("img");
          im.alt = ""; im.draggable = false; im.decoding = "async"; im.src = url;
          im.addEventListener("error", () => { im.remove(); it.textContent = e; }, { once: true });
          it.appendChild(im);
        } else it.textContent = e;
        return it;
      };
      function scene(pic, B) {
        const s = el("div", "scene");
        s.style.width = s.style.height = B + "px";
        s.style.background = "linear-gradient(" + pic.sky + " 0 62%, " + pic.ground + " 62% 100%)";
        (pic.water ? DECO_WATER : DECO).forEach(([e, x, y, z]) => s.appendChild(item(e, x, y, B * z / 100)));
        s.appendChild(item(pic.e, 50, 54, B * 0.6));
        return s;
      }
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
      const name = pic => T({ hi: pic.hi, en: pic.en, hinglish: pic.hinglish });

      /* ---------- picture picker ---------- */
      function menu() {
        const w = page(null);
        const intro = { hi: "कौन-सी पहेली जोड़ें? किसी तस्वीर पर दबाओ!", en: "Which puzzle shall we make? Tap a picture!", hinglish: "Kaun si paheli jodein? Kisi tasveer par dabao!" };
        w.appendChild(el("p", "cap", T(intro)));
        const gridEl = el("div", "pics");
        const solved = ctx.data.get("solved", {}) || {};
        PICS.forEach((pic, i) => {
          const b = btn("", "thumb", () => play(i), name(pic));
          b.style.background = "linear-gradient(" + pic.sky + " 0 62%, " + pic.ground + " 62% 100%)";
          const tp = el("span", "tp");
          tp.setAttribute("aria-hidden", "true");
          const url = imgUrl(pic.e);
          if (url) { const im = document.createElement("img"); im.alt = ""; im.src = url; im.draggable = false; im.addEventListener("error", () => { im.remove(); tp.textContent = pic.e; }, { once: true }); tp.appendChild(im); }
          else tp.textContent = pic.e;
          b.append(tp, el("span", null, T({ hi: pic.hi, en: pic.en.replace(/^an? /, ""), hinglish: pic.hinglish })));
          if (solved[pic.e]) b.appendChild(el("span", "star", "⭐"));
          gridEl.appendChild(b);
        });
        w.appendChild(gridEl);
        say(intro);
      }

      /* ---------- one puzzle ---------- */
      function play(idx) {
        idx = ((idx % PICS.length) + PICS.length) % PICS.length;
        const pic = PICS[idx];
        const lvl = Math.min(LV.length - 1, Math.max(0, ctx.data.get("level", 0) | 0));
        const n = LV[lvl];
        const w = page("🧩 " + n + " " + T({ hi: "टुकड़े", en: "pieces", hinglish: "tukde" }), menu, true);
        const cap = el("p", "cap", "");
        w.appendChild(cap);
        const area = el("div", "play stage");
        w.appendChild(area);
        const row = el("div", "row side");
        w.appendChild(row);
        const board = el("div", "board");
        area.appendChild(board);
        const tol = snapTol(age);
        const state = Array.from({ length: n }, () => ({ fixed: false, x: 0, y: 0, s: 1, node: null }));
        let geo = null, top = 10, warned = false, won = false;
        const pieces = Array.from({ length: n }, (_, i) => {
          const p = el("div", "piece");
          p.tabIndex = 0;
          p.setAttribute("aria-label", T({ hi: "टुकड़ा " + (i + 1) + " — खींचो, या Enter दबाओ", en: "Piece " + (i + 1) + " — drag it, or press Enter", hinglish: "Tukda " + (i + 1) }));
          p.dataset.sfx = "none";
          state[i].node = p;
          area.appendChild(p);
          return p;
        });
        const place = i => {
          const st = state[i];
          st.node.style.transform = "translate(" + st.x + "px," + st.y + "px) scale(" + st.s + ")";
        };
        /* (re)build board, pieces and tray for the current size */
        function layout() {
          if (!alive || !area.isConnected) return;
          const W = area.clientWidth, H = area.clientHeight;
          if (!W || !H) return;
          if (geo && geo.W === W && geo.H === H) return;
          const portrait = H >= W * 0.9;
          const B = Math.floor(portrait ? Math.min(W - 8, H * 0.56) : Math.min(H - 8, W * 0.56));
          const bx = portrait ? Math.round((W - B) / 2) : 4, by = portrait ? 4 : Math.round((H - B) / 2);
          const tray = portrait ? { x: 0, y: by + B + 10, w: W, h: Math.max(60, H - by - B - 10) } : { x: bx + B + 12, y: 0, w: Math.max(60, W - bx - B - 12), h: H };
          const cuts = cut(n, B);
          const spots = trayLayout(n, cuts[0].w, cuts[0].h, tray);
          geo = { W, H, B, bx, by, cuts, spots };
          board.style.left = bx + "px"; board.style.top = by + "px";
          board.style.width = board.style.height = B + "px";
          board.replaceChildren();
          if (age !== "6+") {
            const g = el("div", "ghost");
            g.style.opacity = age === "2-3" ? "0.3" : "0.18";
            g.appendChild(scene(pic, B));
            board.appendChild(g);
          }
          cuts.forEach(c => {
            const cell = el("div", "cell");
            cell.style.left = c.x + "px"; cell.style.top = c.y + "px"; cell.style.width = c.w + "px"; cell.style.height = c.h + "px";
            board.appendChild(cell);
          });
          cuts.forEach((c, i) => {
            const p = pieces[i];
            p.style.width = c.w + "px"; p.style.height = c.h + "px";
            const sc = scene(pic, B);
            sc.style.left = -c.x + "px"; sc.style.top = -c.y + "px";
            p.replaceChildren(sc);
            const st = state[i];
            if (st.fixed) { st.x = bx + c.x; st.y = by + c.y; st.s = 1; }
            else { st.x = spots[i].x; st.y = spots[i].y; st.s = spots[i].s; }
            place(i);
          });
        }
        if (typeof ResizeObserver === "function") { ro = new ResizeObserver(layout); ro.observe(area); }
        onWin = layout;
        window.addEventListener("resize", onWin);

        /* dragging */
        let drag = null;
        pieces.forEach((p, i) => {
          p.addEventListener("pointerdown", e => {
            const st = state[i];
            if (st.fixed || drag || !geo || won) return;
            e.preventDefault();
            try { p.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
            const a = area.getBoundingClientRect();
            const px = e.clientX - a.left, py = e.clientY - a.top;
            /* grow to full size around the finger */
            const ox = (px - st.x) / st.s, oy = (py - st.y) / st.s;
            st.s = 1; st.x = px - ox; st.y = py - oy;
            p.style.zIndex = String(++top);
            p.classList.add("puzzle-drag");
            place(i);
            drag = { i, id: e.pointerId, ox, oy };
            sfx("tap");
          });
          p.addEventListener("pointermove", e => {
            if (!drag || drag.id !== e.pointerId || drag.i !== i) return;
            e.preventDefault();
            const a = area.getBoundingClientRect();
            const st = state[i];
            st.x = Math.max(-geo.cuts[i].w / 2, Math.min(geo.W - geo.cuts[i].w / 2, e.clientX - a.left - drag.ox));
            st.y = Math.max(-geo.cuts[i].h / 2, Math.min(geo.H - geo.cuts[i].h / 2, e.clientY - a.top - drag.oy));
            place(i);
          });
          const up = e => {
            if (!drag || drag.id !== e.pointerId || drag.i !== i) return;
            drag = null;
            p.classList.remove("puzzle-drag");
            drop(i);
          };
          p.addEventListener("pointerup", up);
          p.addEventListener("pointercancel", up);
          p.addEventListener("contextmenu", e => e.preventDefault());
          /* keyboard: Enter puts the piece in its place (for switch/keyboard users) */
          p.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && !state[i].fixed && geo) { e.preventDefault(); fix(i); } });
        });
        function animateTo(i, x, y, s, after) {
          const st = state[i];
          st.x = x; st.y = y; st.s = s;
          if (reduced || !st.node.animate) { place(i); if (after) after(); return; }
          st.node.style.transition = "transform .22s ease-out";
          place(i);
          later(() => { st.node.style.transition = ""; if (after) after(); }, 240);
        }
        function fix(i) {
          const st = state[i], c = geo.cuts[i];
          st.fixed = true;
          st.node.classList.add("puzzle-fixed");
          st.node.style.zIndex = "1";
          st.node.removeAttribute("tabindex");
          animateTo(i, geo.bx + c.x, geo.by + c.y, 1);
          sfx("pop");
          if (state.every(s => s.fixed)) later(win, 260);
        }
        function drop(i) {
          const st = state[i], c = geo.cuts[i];
          if (snaps(c, st.x - geo.bx, st.y - geo.by, tol)) { fix(i); return; }
          /* not its place: back to the tray, gently */
          const spot = geo.spots[i];
          const onBoard = st.x + c.w / 2 > geo.bx && st.x + c.w / 2 < geo.bx + geo.B && st.y + c.h / 2 > geo.by && st.y + c.h / 2 < geo.by + geo.B;
          if (onBoard) {
            sfx("tryagain");
            animateTo(i, spot.x, spot.y, spot.s);
            if (!warned) {
              warned = true;
              const o = { hi: "यह टुकड़ा कहीं और जाएगा — तस्वीर ध्यान से देखो!", en: "This piece goes somewhere else — look at the picture carefully!", hinglish: "Ye tukda kahin aur jayega — dhyan se dekho!" };
              cap.textContent = T(o);
              say(o);
            }
          } else { st.s = spot.s; place(i); }
        }
        function win() {
          if (won || !alive) return;
          won = true;
          w.classList.add(P + "-won");
          sfx("sparkle");
          const solved = ctx.data.get("solved", {}) || {};
          solved[pic.e] = (solved[pic.e] || 0) + 1;
          ctx.data.set("solved", solved);
          if (lvl < LV.length - 1) ctx.data.set("level", lvl + 1);
          const o = { hi: "वाह! पहेली पूरी! यह है " + pic.hi + "!", en: "Yay! Puzzle done! It's " + pic.en + "!", hinglish: "Waah! Paheli poori! Ye hai " + pic.hinglish + "!" };
          cap.textContent = T(o);
          const p = say(o);
          if (!rewarded) { rewarded = true; p.then(() => { if (alive) ctx.reward({ sticker: "🧩", reason: { hi: "पहेली जोड़ी!", en: "Finished a puzzle!" } }); }); }
          row.replaceChildren(
            btn("🔁 " + T({ hi: "फिर से", en: "Again", hinglish: "Phir se" }), "btn", () => play(idx)),
            btn("➡️ " + T({ hi: "अगली पहेली", en: "Next puzzle", hinglish: "Agli paheli" }), "btn go", () => play(idx + 1)));
        }
        const intro = { hi: "टुकड़ों को खींचकर बोर्ड पर सही जगह रखो!", en: "Drag the pieces onto the board, each to its place!", hinglish: "Tukdon ko kheench kar sahi jagah rakho!" };
        cap.textContent = T(intro);
        row.appendChild(btn("🖼️ " + T({ hi: "दूसरी तस्वीर", en: "Another picture", hinglish: "Doosri tasveer" }), "btn", menu));
        layout();
        later(layout, 60);
        say(intro);
      }

      menu();
      return () => { alive = false; clean(); try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    },
  });
})();
