/* नन्हा स्कूल — the learning activities: flashcards (ABC, अक्षर, गिनती and the "दुनिया देखो"
   picture decks), the "पहचानो" quiz, rhymes, and the bedtime lullaby ("सोने की तैयारी").
   Content lives in js/content/lessons.js and js/content/rhymes.js. Pictures: NS.picture (core)
   shows the realistic image for an emoji (js/content/images.js) and falls back to the emoji. */
(function () {
  "use strict";
  const NS = window.NS;
  const L = NS.content.lessons;
  const RHYMES = NS.content.rhymes;
  const CFG = NS.config;
  const freeList = Array.isArray(CFG.FREE) ? CFG.FREE : [];
  const isFreeName = d => freeList.includes(d.id) || freeList.includes(NS.t(d.title, "hi"));

  const TXT = {
    tapToFlip: { hi: "दबाओ और देखो!", en: "Tap to see!", hinglish: "Dabao aur dekho!" },
    sayWithMe: { hi: "मेरे साथ बोलो", en: "Say it with me", hinglish: "Mere saath bolo" },
    sayWithMeLead: { hi: "मेरे साथ बोलो:", en: "Say it with me:", hinglish: "Mere saath bolo:" },
    yourTurn: { hi: "अब तुम्हारी बारी!", en: "Now your turn!", hinglish: "Ab tumhari baari!" },
    goodTry: { hi: "शाबाश! बहुत अच्छा बोला!", en: "Well done! You said it so well!", hinglish: "Shabash! Bahut achha bola!" },
    tryAgainSay: { hi: "कोई बात नहीं, फिर से बोलो!", en: "That's okay, say it again!", hinglish: "Koi baat nahi, phir se bolo!" },
    prev: { hi: "पीछे", en: "Back", hinglish: "Peeche" },
    next: { hi: "आगे", en: "Next", hinglish: "Aage" },
    done: { hi: "शाबाश! तुमने पूरा कर लिया!", en: "Well done! You finished them all!", hinglish: "Shabash! Tumne poora kar liya!" },
    again: { hi: "फिर से", en: "Again", hinglish: "Phir se" },
    home: { hi: "घर", en: "Home", hinglish: "Ghar" },
    world: { hi: "दुनिया देखो", en: "Our world", hinglish: "Duniya dekho" },
    worldSay: { hi: "क्या देखें? कोई तस्वीर दबाओ!", en: "What shall we see? Tap a picture!", hinglish: "Kya dekhein? Koi picture dabao!" },
    quiz: { hi: "पहचानो", en: "Find it!", hinglish: "Pehchano" },
    where: { hi: "{n} कहाँ है?", en: "Where is the {n}?", hinglish: "{n} kahan hai?" },
    whereGlyph: { hi: "{n} कहाँ है?", en: "Where is {n}?", hinglish: "{n} kahan hai?" },
    tryAgain: { hi: "फिर से कोशिश करो!", en: "Try again!", hinglish: "Phir se try karo!" },
    cheers: [{ hi: "शाबाश!", en: "Well done!", hinglish: "Shabash!" }, { hi: "बहुत बढ़िया!", en: "Great job!", hinglish: "Bahut badhiya!" },
      { hi: "एकदम सही!", en: "Exactly right!", hinglish: "Ekdum sahi!" }, { hi: "वाह!", en: "Wow!", hinglish: "Waah!" }],
    hearAgain: { hi: "फिर से सुनो", en: "Hear again", hinglish: "Phir se suno" },
    rhymes: { hi: "कविताएँ", en: "Rhymes", hinglish: "Kavitayein" },
    rhymesSay: { hi: "कौन सी कविता सुनोगे?", en: "Which rhyme shall we sing?", hinglish: "Kaun si kavita sunoge?" },
    moreRhymes: { hi: "और कविताएँ", en: "More rhymes", hinglish: "Aur kavitayein" },
    listen: { hi: "सुनो", en: "Listen", hinglish: "Suno" },
    stop: { hi: "रुको", en: "Stop", hinglish: "Ruko" },
    sleep: { hi: "सोने की तैयारी", en: "Bedtime", hinglish: "Sone ki taiyari" },
    sleepIntro: { hi: "चलो, सोने की तैयारी करें। एक प्यारी सी लोरी सुनो।", en: "Let's get ready for bed. Listen to a sweet lullaby.", hinglish: "Chalo, sone ki taiyari karein. Ek pyaari si lori suno." },
    goodnight: { hi: "शुभ रात्रि{name}! आज तुमने बहुत अच्छा किया। अब आँखें बंद करो, और मीठे-मीठे सपने देखो।", en: "Good night{name}! You did so well today. Now close your eyes, and have sweet dreams.", hinglish: "Shubh ratri{name}! Aaj tumne bahut achha kiya. Ab aankhein band karo, aur meethe-meethe sapne dekho." },
    lullabyAgain: { hi: "फिर से लोरी", en: "Lullaby again", hinglish: "Phir se lori" },
  };
  const tt = (ctx, k, vars) => { let s = ctx.t(TXT[k]); for (const v in vars || {}) s = s.split("{" + v + "}").join(vars[v]); return s; };
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function isDark(hex) {
    const n = parseInt(String(hex).slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  }
  const iconBtn = (ctx, label, cls, aria, fn) => { const b = ctx.button(label, cls, fn); b.setAttribute("aria-label", aria); return b; };
  const speechText = (ctx, deck, obj) => (deck.speakLang ? NS.t(obj, deck.speakLang === "en" ? "en" : "hi") : ctx.t(obj));
  const speechLang = (ctx, deck) => deck.speakLang || ctx.lang;
  const caption = card => (card.name.hi === card.name.en ? card.name.hi : card.name.hi + " · " + card.name.en);
  /* Letters and numbers stay text; emoji become realistic pictures when there is one. */
  function fill(target, key, alt) {
    target.replaceChildren();
    if (key && (NS.imgUrl(key) || (NS.img && NS.img.parts && NS.img.parts(key).some(x => x.url)))) target.appendChild(NS.picture(key, { alt, size: 192 }));
    else target.textContent = key || "";
  }
  const sfx = name => (NS.sfx ? NS.sfx.play(name) : false);
  const react = (m, kind) => { if (NS.mascot && NS.mascot.react) NS.mascot.react(m, kind); };

  /* Colour cards show a painted blob of the colour itself and shape cards a soft, toy-like shape:
     emoji circles and squares look different on every phone (and ⚪ is almost invisible). */
  function swatch(color, label) {
    const s = NS.el("span", "swatch");
    s.style.setProperty("--sw", color);
    s.setAttribute("role", "img");
    if (label) s.setAttribute("aria-label", label);
    return s;
  }
  const STAR = (() => {
    const p = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 19 : 44, a = -Math.PI / 2 + i * Math.PI / 5;
      p.push((50 + r * Math.cos(a)).toFixed(1) + "," + (54 + r * Math.sin(a)).toFixed(1));
    }
    return p.join(" ");
  })();
  /* [outline, highlight centre, colour] for the shapes deck's emoji (lessons.js may reorder them). */
  const SHAPES = {
    "⭕": [["circle", { cx: 50, cy: 50, r: 40 }], [34, 32], "#FF7A45"],
    "🟥": [["rect", { x: 13, y: 13, width: 74, height: 74, rx: 8 }], [32, 30], "#3D9BE9"],
    "🔺": [["polygon", { points: "50,14 88,84 12,84" }], [44, 50], "#3DB86A"],
    "⭐": [["polygon", { points: STAR }], [42, 42], "#FFBE2E"],
    "❤": [["path", { d: "M50 86 C22 66 10 52 10 35 C10 22 20 13 31 13 C40 13 46 18 50 26 C54 18 60 13 69 13 C80 13 90 22 90 35 C90 52 78 66 50 86 Z" }], [29, 32], "#F0577A"],
    "🔷": [["polygon", { points: "50,9 87,50 50,91 13,50" }], [40, 36], "#9B6BE0"],
  };
  const shapeOf = key => SHAPES[String(key || "").replace(/[︎️]/g, "")] || null;
  function shapeArt(def, label) {
    const [[tag, attrs], [hx, hy], col] = def;
    const s = NS.svg;
    const round = { "stroke-width": 8, "stroke-linejoin": "round" };
    const svg = s("svg", { viewBox: "-2 -2 104 108", class: "shape", role: "img", "aria-label": label || "" }, [
      s(tag, Object.assign({ fill: "#000", stroke: "#000", opacity: ".16", transform: "translate(0 5)" }, round, attrs)),
      s(tag, Object.assign({ fill: col, stroke: col }, round, attrs)),
      s("ellipse", { cx: hx, cy: hy, rx: 11, ry: 6.5, fill: "#fff", opacity: ".42", transform: `rotate(-32 ${hx} ${hy})` }),
    ]);
    return svg;
  }
  /* The picture of a card or quiz choice: swatch, shape, realistic picture, or the letter/number. */
  function art(target, item, alt) {
    target.replaceChildren();
    const sh = item.deck === "shapes" ? shapeOf(item.big) : null;
    if (item.deck === "colors" && item.bg) target.appendChild(swatch(item.bg, alt));
    else if (sh) target.appendChild(shapeArt(sh, alt));
    else { fill(target, item.big, alt); return false; }
    return true;
  }

  /* ---------------- Flashcards ---------------- */
  function flashcards(ctx, deck, opts) {
    opts = opts || {};
    const screen = opts.into || ctx.screen;
    let alive = true;
    const cards = deck.cards;
    let idx = Math.min(Math.max(0, ctx.data.get("pos_" + deck.id, 0)), cards.length - 1);
    if (idx >= cards.length - 1) idx = 0;
    let flipped = false;

    screen.replaceChildren();
    const wrap = ctx.el("div", "fc");
    wrap.style.setProperty("--deck", deck.color);
    const stage = ctx.el("div", "fc-stage");
    const card = ctx.el("div", "card" + (deck.flip ? " flippable" : ""));
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    const inner = ctx.el("div", "card-inner");
    const front = ctx.el("div", "face front");
    const big = ctx.el("div", "big");
    const pair = ctx.el("div", "pair");
    const cap = ctx.el("div", "cap");
    const hint = ctx.el("div", "taphint");
    hint.setAttribute("aria-hidden", "true");
    const show_ = ctx.el("div", "fc-show");
    show_.append(big, pair);
    front.append(show_, cap, hint);
    const back = ctx.el("div", "face back");
    const pic = ctx.el("div", "pic");
    const cap2 = ctx.el("div", "cap");
    back.append(pic, cap2);
    inner.append(front, back);
    card.appendChild(inner);
    stage.appendChild(card);

    const side = ctx.el("div", "fc-side");
    const dots = ctx.el("div", "fc-dots");
    dots.setAttribute("aria-hidden", "true");
    const m = NS.mascot("idle", "mascot-fc");
    const sayWith = ctx.button("🗣️  " + tt(ctx, "sayWithMe"), "chip saywith", sayWithMe);
    const nav = ctx.el("div", "navrow");
    const prev = iconBtn(ctx, "◀", "navbtn prev", tt(ctx, "prev"), () => show(idx - 1, -1));
    const next = iconBtn(ctx, "▶", "navbtn next", tt(ctx, "next"), () => show(idx + 1, 1));
    nav.append(prev, next);
    const mrow = ctx.el("div", "fc-mrow");
    mrow.append(m, sayWith);
    side.append(dots, mrow, nav);
    wrap.append(stage, side);
    screen.appendChild(wrap);

    function speakCard(which) {
      const c = cards[idx];
      const text = which === "front" && c.front ? speechText(ctx, deck, c.front)
        : which === "back" && c.back ? speechText(ctx, deck, c.back) : speechText(ctx, deck, c.say);
      return NS.ui.talk(m, text, { lang: speechLang(ctx, deck) });
    }
    function bounce() { card.classList.remove("bounce"); void card.offsetWidth; card.classList.add("bounce"); }
    function tapCard() {
      if (!alive || idx >= cards.length) return;
      if (deck.flip) {
        flipped = !flipped;
        card.classList.toggle("flipped", flipped);
        sfx("flip");
        speakCard(flipped ? "back" : "front");
      } else { bounce(); speakCard(); }
    }
    card.addEventListener("click", tapCard);
    card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapCard(); } });

    // Swipe left / right.
    let sx = null, sy = null;
    stage.addEventListener("pointerdown", e => { sx = e.clientX; sy = e.clientY; });
    stage.addEventListener("pointerup", e => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy; sx = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) { show(idx + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); card.dataset.swiped = "1"; }
    });
    card.addEventListener("click", e => { if (card.dataset.swiped) { delete card.dataset.swiped; e.stopImmediatePropagation(); } }, true);
    const onKey = e => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") show(idx + 1, 1);
      if (e.key === "ArrowLeft") show(idx - 1, -1);
    };
    document.addEventListener("keydown", onKey);

    async function sayWithMe() {
      if (idx >= cards.length) return;
      const c = cards[idx];
      const lang = speechLang(ctx, deck);
      sayWith.disabled = true;
      await NS.ui.talk(m, tt(ctx, "sayWithMeLead"));
      if (!alive) return;
      await NS.ui.talk(m, speechText(ctx, deck, c.say), { lang, rate: 0.72 });
      if (!alive) return;
      sayWith.classList.add("listening");
      sayWith.textContent = "🎤  " + tt(ctx, "yourTurn");
      let heard = null;
      if (NS.voice.canListen()) heard = await ctx.listen({ lang });
      else await new Promise(r => setTimeout(r, 2600));
      if (!alive) return;
      sayWith.classList.remove("listening");
      sayWith.textContent = "🗣️  " + tt(ctx, "sayWithMe");
      sayWith.disabled = false;
      if (NS.voice.canListen() && !heard) { NS.ui.talk(m, tt(ctx, "tryAgainSay")); return; }
      m.classList.add("happy"); setTimeout(() => m.classList.remove("happy"), 900);
      react(m, "nod");
      sfx("correct");
      NS.ui.talk(m, tt(ctx, "goodTry"));
    }

    function renderDots() {
      dots.replaceChildren();
      const n = cards.length;
      const max = 12;
      if (n <= max) for (let i = 0; i < n; i++) dots.appendChild(ctx.el("i", i < idx ? "seen" : i === idx ? "on" : ""));
      else {
        const bar = ctx.el("div", "fc-bar");
        const f = ctx.el("i");
        f.style.setProperty("--p", Math.round(((idx + 1) / n) * 100) + "%");
        bar.appendChild(f);
        dots.appendChild(bar);
      }
    }
    function show(i, dir, silent) {
      if (!alive) return;
      if (i < 0) return;
      if (i >= cards.length) { finish(); return; }
      idx = i;
      ctx.data.set("pos_" + deck.id, i);
      flipped = false;
      card.classList.remove("flipped", "enter-r", "enter-l", "bounce");
      void card.offsetWidth;
      if (dir) card.classList.add(dir > 0 ? "enter-r" : "enter-l");
      const c = cards[i];
      const bg = c.bg || null;
      card.style.setProperty("--card", bg || "#FFFFFF");
      card.classList.toggle("dark", !!(bg && isDark(bg)));
      const drawn = art(big, { big: c.big, bg: c.bg, deck: deck.id }, caption(c));
      big.className = "big" + ([...c.big].length <= 2 || /^\d+$/.test(c.big) ? "" : " small") + (drawn ? " has-art" : big.querySelector("img") ? " has-img" : "");
      // Colour and shape cards: a real thing of that colour / shape next to the swatch (लाल → 🍅).
      const withPair = !deck.flip && !!c.pic;
      pair.hidden = !withPair;
      if (withPair) fill(pair, c.pic, ctx.t(c.name));
      show_.classList.toggle("paired", withPair);
      cap.textContent = deck.flip ? (deck.id === "count" ? caption(c) : "") : caption(c);
      cap.hidden = !cap.textContent;
      hint.textContent = deck.flip ? "👆 " + tt(ctx, "tapToFlip") : "🔊";
      fill(pic, c.pic || c.big, deck.id === "count" ? caption(c) : ctx.t(c.name));
      pic.className = "pic" + ([...(c.pic || "")].length > 6 ? " many" : "") + (pic.querySelector("img") ? " has-img" : "");
      cap2.textContent = deck.id === "abc" ? c.big + " for " + c.name.en : deck.id === "varn" ? c.big + " से " + c.name.hi : caption(c);
      card.setAttribute("aria-label", caption(c) + (deck.flip ? " — " + tt(ctx, "tapToFlip") : ""));
      prev.disabled = i === 0;
      NS.ui.setProg((i + 1) + " / " + cards.length);
      renderDots();
      if (silent) return;
      speakCard(deck.flip ? "front" : "say").then(() => {
        if (alive && i === 0 && deck.flip && idx === 0 && !flipped) card.classList.add("nudge");
      });
    }
    function finish() {
      ctx.data.set("pos_" + deck.id, 0);
      NS.ui.setProg("");
      const today = NS.dayKey();
      const doneOn = ctx.data.get("done", {});
      const firstToday = doneOn[deck.id] !== today;
      doneOn[deck.id] = today;
      ctx.data.set("done", doneOn);
      const end = ctx.el("div", "fc-end");
      const mm = NS.mascot("happy", "mascot-end");
      end.append(mm, ctx.el("p", "fc-end-t", "🎉 " + tt(ctx, "done")));
      const row = ctx.el("div", "row2");
      row.append(ctx.button("🔁  " + tt(ctx, "again"), "big secondary", () => { alive = false; document.removeEventListener("keydown", onKey); flashcards(ctx, deck, opts); }),
        ctx.button("🏠  " + tt(ctx, "home"), "big primary", () => (opts.back ? opts.back() : ctx.home())));
      end.appendChild(row);
      wrap.replaceChildren(end);
      if (firstToday) ctx.reward({ sticker: deck.sticker || "🌟", reason: NS.t(deck.title, "hi") });
      else NS.ui.talk(mm, tt(ctx, "done"));
    }

    show(idx, 0, true);
    const startIdx = idx;
    let interrupted = false;
    card.addEventListener("click", () => { interrupted = true; }, { once: true });
    NS.ui.talk(m, ctx.t(deck.intro)).then(() => { if (alive && !interrupted && idx === startIdx) speakCard(deck.flip ? "front" : "say"); });
    return () => { alive = false; document.removeEventListener("keydown", onKey); };
  }

  /* ---------------- "दुनिया देखो": picture decks ---------------- */
  function world(ctx) {
    let stopDeck = null;
    let alive = true;
    function list() {
      if (stopDeck) { stopDeck(); stopDeck = null; }
      NS.ui.setProg("");
      const s = ctx.screen;
      s.replaceChildren();
      const grid = ctx.el("div", "deckgrid");
      L.worldDecks.map(L.deck).filter(Boolean).forEach(d => {
        const locked = !NS.billing.hasAccess() && !isFreeName(d);
        const b = ctx.button("", "deck" + (locked ? " locked" : ""), () => {
          if (!NS.billing.hasAccess() && !isFreeName(d)) { NS.billing.askGrownUp(); return; }
          ctx.say(ctx.t(d.title));
          stopDeck = flashcards(ctx, d, { back: list });
        });
        b.setAttribute("aria-label", ctx.t(d.title));
        b.style.setProperty("--c", d.color);
        const ic = ctx.el("span", "deck-ic"); art(ic, { big: d.icon, deck: d.id }, ""); ic.setAttribute("aria-hidden", "true");
        b.append(ic, ctx.el("span", "deck-lb", ctx.t(d.title)));
        if (locked) b.appendChild(ctx.el("span", "lock", "🔒"));
        grid.appendChild(b);
      });
      s.appendChild(grid);
      if (alive) ctx.say(tt(ctx, "worldSay"));
    }
    list();
    return () => { alive = false; if (stopDeck) stopDeck(); };
  }

  /* ---------------- Quiz: three steps by age ---------------- */
  const QUIZ_LEVELS = {
    "2-3": { choices: 2, decks: ["animals", "fruits", "colors"] },
    "4-5": { choices: 3, decks: ["animals", "fruits", "vehicles", "colors", "shapes", "body"] },
    "6+": { choices: 4, decks: ["animals", "fruits", "vehicles", "colors", "shapes", "body", "abc", "count"] },
  };
  function quizPool(level) {
    const pool = [];
    level.decks.forEach(id => {
      const d = L.deck(id);
      if (!d) return;
      d.cards.forEach(c => pool.push({ big: c.big, name: c.name, glyph: d.id === "abc" || d.id === "count", deck: d.id, bg: c.bg || null }));
    });
    return pool;
  }
  function quiz(ctx) {
    let alive = true;
    const level = QUIZ_LEVELS[ctx.profile.ageBand] || QUIZ_LEVELS["4-5"];
    const pool = quizPool(level);
    let stars = 0, answer = null, last = [];
    const s = ctx.screen;
    const wrap = ctx.el("div", "quiz q" + level.choices);
    const head = ctx.el("div", "qhead");
    const m = NS.mascot("idle", "mascot-q");
    const qt = ctx.el("div", "qtext");
    qt.setAttribute("aria-live", "polite");
    const again = iconBtn(ctx, "🔊", "roundbtn qagain", tt(ctx, "hearAgain"), () => ask());
    head.append(m, qt, again);
    const opts = ctx.el("div", "opts");
    wrap.append(head, opts);
    s.appendChild(wrap);
    const nameOf = item => (ctx.lang === "en" ? item.name.en : ctx.lang === "hinglish" ? item.name.en : item.name.hi);
    const question = item => tt(ctx, item.glyph && item.deck === "abc" ? "whereGlyph" : "where", { n: item.glyph && item.deck === "abc" ? item.big : nameOf(item) });
    function ask() { return NS.ui.talk(m, question(answer)); }
    function next() {
      if (!alive) return;
      NS.ui.setProg("⭐ " + stars);
      let a, guard = 0;
      do { a = pickOne(pool); } while (last.includes(a.big) && guard++ < 30);
      answer = a;
      last = [a.big].concat(last).slice(0, 4);
      const choices = [a];
      guard = 0;
      // Wrong answers come from the same kind of card: a colour question only shows colours (never
      // a red apple next to "लाल कहाँ है?"), shapes only shapes, letters only letters.
      const kind = x => (["colors", "shapes", "abc", "count"].includes(x.deck) ? x.deck : "things");
      while (choices.length < level.choices && guard++ < 120) {
        const c = pickOne(pool);
        if (!choices.some(x => x.big === c.big) && kind(a) === kind(c)) choices.push(c);
      }
      shuffle(choices);
      qt.textContent = question(a) + " 👆";
      opts.replaceChildren();
      choices.forEach(c => {
        const b = ctx.button("", "opt" + (c.glyph ? " glyph" : ""), () => pick(b, c));
        if (art(b, c, nameOf(c))) b.classList.add("has-art");
        b.dataset.big = c.big;
        b.dataset.sfx = "none";
        b.setAttribute("aria-label", nameOf(c));
        opts.appendChild(b);
      });
      opts.classList.remove("in"); void opts.offsetWidth; opts.classList.add("in");
      ask();
    }
    function pick(b, c) {
      if (!alive || b.disabled) return;
      if (c.big === answer.big) {
        stars++;
        NS.ui.setProg("⭐ " + stars);
        [...opts.children].forEach(o => { o.disabled = true; });
        b.classList.add("right");
        m.classList.add("happy");
        react(m, "nod");
        sfx("correct");
        const ch = ctx.t(pickOne(TXT.cheers));
        qt.textContent = ch + " 🌟";
        const p = NS.ui.talk(m, ch + " " + nameOf(answer));
        const rewarded = stars % 5 === 0;
        if (rewarded) ctx.reward({ sticker: pickOne(["🏆", "🎖️", "🌟", "🍭", "🎈"]), reason: "quiz" });
        // After a sticker, wait for its little "शाबाश!" before the next question.
        Promise.race([p, new Promise(r => setTimeout(r, 2600))]).then(() => setTimeout(() => { m.classList.remove("happy"); next(); }, rewarded ? 2400 : 350));
      } else {
        b.classList.add("wrong");
        b.disabled = true;
        react(m, "tilt");
        sfx("tryagain");
        qt.textContent = tt(ctx, "tryAgain") + " 🙂";
        NS.ui.talk(m, tt(ctx, "tryAgain") + " " + question(answer));
      }
    }
    NS.learn.quiz = { get answer() { return answer; }, level };
    next();
    return () => { alive = false; };
  }

  /* ---------------- Rhymes: line-by-line highlighting ---------------- */
  function rhymes(ctx) {
    let alive = true;
    const s = ctx.screen;
    function list() {
      NS.voice.stop();
      NS.ui.setProg("");
      s.replaceChildren();
      const grid = ctx.el("div", "rlist");
      RHYMES.forEach((r, i) => {
        const locked = NS.billing.rhymeLocked(i);
        const b = ctx.button("", "rbtn" + (locked ? " locked" : ""), () => (NS.billing.rhymeLocked(i) ? NS.billing.askGrownUp() : play(r, i)));
        b.style.setProperty("--c", r.color || "#7E57C2");
        const ic = ctx.el("span", "r-ic"); fill(ic, r.icon, ""); ic.setAttribute("aria-hidden", "true");
        const t = ctx.el("span", "r-t", r.title); t.lang = r.lang === "en" ? "en" : "hi";
        b.append(ic, t);
        if (locked) { const l = ctx.el("span", "lock", "🔒"); l.setAttribute("aria-hidden", "true"); b.appendChild(l); }
        b.setAttribute("aria-label", r.title + (locked ? " · " + NS.tr("locked") : ""));
        grid.appendChild(b);
      });
      s.appendChild(grid);
      ctx.say(tt(ctx, "rhymesSay"));
    }
    function play(r, i) {
      s.replaceChildren();
      const p = ctx.el("div", "rplayer");
      p.style.setProperty("--c", r.color || "#7E57C2");
      const top = ctx.el("div", "r-top");
      const m = NS.mascot("idle", "mascot-r");
      const notes = ctx.el("div", "notes");
      notes.setAttribute("aria-hidden", "true");
      ["♪", "♫", "♪"].forEach(n => notes.appendChild(ctx.el("i", null, n)));
      const h = ctx.el("h2", "r-title");
      const hic = NS.picture(r.icon, { cls: "r-title-ic", size: 96, eager: true });
      hic.setAttribute("aria-hidden", "true");
      h.append(hic, ctx.el("span", null, r.title));
      h.lang = r.lang === "en" ? "en" : "hi";
      top.append(m, notes, h);
      const words = ctx.el("div", "rwords");
      words.lang = h.lang;
      const lines = r.lines.map(t => { const l = ctx.el("p", "rline", t); words.appendChild(l); return l; });
      const nav = ctx.el("div", "navrow");
      const playBtn = ctx.button("▶  " + tt(ctx, "listen"), "navbtn go", () => sing());
      const stopBtn = ctx.button("⏹  " + tt(ctx, "stop"), "navbtn stop", () => { NS.voice.stop(); clear(); });
      nav.append(playBtn, stopBtn);
      const back = ctx.button("📜  " + tt(ctx, "moreRhymes"), "big secondary", list);
      p.append(top, words, nav, back);
      s.appendChild(p);
      const clear = () => { lines.forEach(l => l.classList.remove("on", "sung")); p.classList.remove("singing"); m.classList.remove("talking"); };
      async function sing() {
        clear();
        p.classList.add("singing");
        m.classList.add("talking");
        const ok = await NS.voice.sayLines(r.lines, r.lang, {
          onLine: k => { if (!alive) return; lines.forEach((l, j) => { l.classList.toggle("on", j === k); l.classList.toggle("sung", j < k); }); },
        });
        if (!alive) return;
        p.classList.remove("singing");
        m.classList.remove("talking");
        if (ok) {
          lines.forEach(l => { l.classList.remove("on"); l.classList.add("sung"); });
          const heard = ctx.data.get("heard", {});
          if (heard[i] !== NS.dayKey()) { heard[i] = NS.dayKey(); ctx.data.set("heard", heard); ctx.reward({ sticker: "🎵", reason: r.title }); }
        }
      }
      sing();
    }
    list();
    return () => { alive = false; };
  }

  /* ---------------- Bedtime: lullaby, then goodnight ---------------- */
  function sleep(ctx) {
    let alive = true;
    const r = RHYMES.find(x => x.lullaby) || RHYMES[0];
    const s = ctx.screen;
    const wrap = ctx.el("div", "sleep");
    const stars = ctx.el("div", "stars");
    stars.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 30; i++) {
      const st = ctx.el("i");
      st.style.setProperty("--x", ((i * 37.7) % 100).toFixed(1) + "%");
      st.style.setProperty("--y", ((i * 29.3) % 70).toFixed(1) + "%");
      st.style.setProperty("--d", (i % 7) * 0.5 + "s");
      stars.appendChild(st);
    }
    const moon = ctx.el("div", "moon big-moon"); moon.setAttribute("aria-hidden", "true");
    const m = NS.mascot("sleepy", "mascot-sleep");
    const words = ctx.el("div", "rwords lullaby");
    words.lang = "hi";
    const lines = r.lines.map(t => { const l = ctx.el("p", "rline", t); words.appendChild(l); return l; });
    const night = ctx.el("p", "goodnight");
    night.lang = NS.langTag(ctx.lang);
    const again = ctx.button("🌙  " + tt(ctx, "lullabyAgain"), "big secondary", () => run());
    again.hidden = true;
    wrap.append(stars, moon, m, words, night, again);
    s.appendChild(wrap);
    async function run() {
      again.hidden = true;
      wrap.classList.remove("asleep");
      night.textContent = "";
      lines.forEach(l => l.classList.remove("on", "sung"));
      await NS.ui.talk(m, tt(ctx, "sleepIntro"));
      if (!alive) return;
      const ok = await NS.voice.sayLines(r.lines, "hi", {
        rate: 0.72, gap: 650,
        onLine: k => { if (alive) lines.forEach((l, j) => { l.classList.toggle("on", j === k); l.classList.toggle("sung", j < k); }); },
      });
      if (!alive || !ok) { again.hidden = !alive; return; }
      lines.forEach(l => { l.classList.remove("on"); l.classList.add("sung"); });
      const name = ctx.profile.name ? ", " + ctx.profile.name : "";
      const gn = tt(ctx, "goodnight", { name });
      night.textContent = "😴 " + gn;
      await NS.ui.talk(m, gn, { rate: 0.75 });
      if (!alive) return;
      wrap.classList.add("asleep");
      again.hidden = false;
    }
    run();
    return () => { alive = false; };
  }

  /* ---------------- Register ---------------- */
  NS.learn = { decks: L.decks, quizLevels: QUIZ_LEVELS, quizPool, quiz: null };
  ["abc", "varn", "count"].forEach((id, i) => {
    const d = L.deck(id);
    NS.registerActivity({
      id, icon: d.icon, title: d.title, color: d.color, section: "learn", order: 10 + i * 10,
      free: isFreeName(d), relang: true,
      open: ctx => flashcards(ctx, d),
    });
  });
  NS.registerActivity({
    id: "world", icon: "🌍", title: TXT.world, color: "#26A69A", section: "learn", order: 40,
    free: L.worldDecks.map(L.deck).some(d => d && isFreeName(d)), relang: true,
    open: world,
  });
  NS.registerActivity({ id: "rhymes", icon: "🎵", title: TXT.rhymes, color: "#EC407A", section: "play", order: 10, free: true, relang: true, open: rhymes });
  NS.registerActivity({ id: "quiz", icon: "🎮", title: TXT.quiz, color: "#7E57C2", section: "play", order: 20, free: false, relang: true, open: quiz });
  NS.registerActivity({ id: "sleep", icon: "🌙", title: TXT.sleep, color: "#3949AB", section: "grow", order: 99, free: true, hidden: true, open: sleep });
})();
