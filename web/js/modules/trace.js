/* नन्हा स्कूल — "लिखना सीखो" (tracing). Hindi स्वर and व्यंजन, English capitals and digits on a
   big dotted guide: numbered green start dots and arrows show the stroke order, the child's
   finger draws a coloured line, and each stroke is checked on its own (gentle for 2–3 year
   olds, stricter for 6+). After two tries an animated hand shows the stroke; after four the
   stroke is drawn together, so nobody gets stuck. A finished letter is celebrated with its
   sound and example word + picture ("क — कमल"). "खुला लिखो" is free tracing with no checking.

   Stroke data: every character is a list of strokes in teaching order, each a tiny path in a
   100 × 100 box (y grows downwards; Devanagari शिरोरेखा at y = 21):
     M x y          move (start of the stroke)       L x y               line
     Q cx cy x y    quadratic curve                  C x1 y1 x2 y2 x y   cubic curve
     E cx cy rx ry from to   elliptic arc, angles in degrees (0 = right, 90 = down); runs from
                    `from` to `to`, so a decreasing angle goes anticlockwise on screen.
   A stroke that is only "M x y" is a dot (अं). Devanagari: body first, then the खड़ी पाई, then
   the शिरोरेखा; marks above the line (ई ऐ ओ औ अं) come after it, as children are taught.

   Pure logic is exposed as NS.create.trace for tools/test/create.test.mjs. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.create = NS.create || {};

  /* ---------------- stroke data ---------------- */
  const A3 = "M18 29 C26 19 46 19 48 32 C50 42 40 48 22 48 C42 52 52 58 52 70 C52 80 42 86 30 86 C22 86 16 82 12 76"; // the "3" of अ
  const SWAR = [
    ["अ", "अनानास", "Pineapple", "🍍", [A3, "M46 54 L70 54", "M70 21 L70 86", "M14 21 L86 21"]],
    ["आ", "आम", "Mango", "🥭", [A3, "M46 54 L66 54", "M66 21 L66 86", "M84 21 L84 86", "M14 21 L90 21"]],
    ["इ", "इंजन", "Engine", "🚂", ["M64 21 L64 42 L40 42 C30 42 30 56 40 58 C56 56 72 62 72 72 C72 82 60 86 48 86 C40 86 32 82 28 74", "M38 84 L54 98", "M18 21 L84 21"]],
    ["ई", "ईंट", "Brick", "🧱", ["M64 21 L64 42 L40 42 C30 42 30 56 40 58 C56 56 72 62 72 72 C72 82 60 86 48 86 C40 86 32 82 28 74", "M38 84 L54 98", "M18 21 L84 21", "M64 21 C56 14 58 5 70 1"]],
    ["उ", "उल्लू", "Owl", "🦉", ["M56 21 L56 28 C66 30 68 44 58 48 C52 50 44 50 34 50 C56 52 70 60 70 72 C70 82 60 88 46 88 C38 88 32 84 28 78", "M20 21 L82 21"]],
    ["ऊ", "ऊन", "Wool", "🧶", ["M42 21 L42 28 C52 30 54 44 44 48 C38 50 30 50 20 50 C42 52 56 60 56 72 C56 82 46 88 34 88 C26 88 20 84 16 78",
      "M54 62 C60 52 72 46 82 52 C90 58 92 74 84 84 C80 88 74 88 70 84", "M12 21 L90 21"]],
    ["ऋ", "ऋषि", "Sage", "🧘", ["M14 44 C26 42 38 46 52 54 L18 78", "M54 21 L54 86",
      "M80 40 C78 48 70 54 58 54 C76 56 86 62 84 72 C82 80 74 82 68 80", "M10 21 L92 21"]],
    ["ए", "एम्बुलेंस", "Ambulance", "🚑", ["M38 21 L38 60 L72 90", "M64 21 C74 32 74 52 64 62", "M24 21 L80 21"]],
    ["ऐ", "ऐनक", "Glasses", "👓", ["M38 21 L38 60 L72 90", "M64 21 C74 32 74 52 64 62", "M24 21 L80 21", "M42 3 C50 8 54 14 58 21"]],
    ["ओ", "ओस", "Dew", "💧", [A3, "M46 54 L66 54", "M66 21 L66 86", "M84 21 L84 86", "M14 21 L90 21", "M60 3 C70 5 80 11 84 21"]],
    ["औ", "औरत", "Woman", "👩", [A3, "M46 54 L66 54", "M66 21 L66 86", "M84 21 L84 86", "M14 21 L90 21", "M50 8 C60 10 68 14 74 21", "M62 2 C72 4 82 11 84 21"]],
    ["अं", "अंगूर", "Grapes", "🍇", [A3, "M46 54 L70 54", "M70 21 L70 86", "M14 21 L86 21", "M70 7"]],
  ];
  const VYANJAN = [
    ["क", "कमल", "Lotus", "🪷", ["M44 42 C34 34 14 40 14 56 C14 72 34 78 50 64", "M50 21 L50 86", "M50 50 C58 38 80 38 86 52 C90 64 80 74 64 72", "M8 21 L92 21"]],
    ["ख", "खरगोश", "Rabbit", "🐇", ["M28 30 C36 21 48 26 46 38 C44 46 34 50 16 52 C26 54 32 68 52 82", "M76 44 C68 36 54 40 52 52 C52 62 66 64 82 58", "M82 21 L82 86", "M8 21 L92 21"]],
    ["ग", "गमला", "Flower pot", "🪴", ["M34 21 L34 52 C34 60 28 64 22 62", "M68 21 L68 86", "M16 21 L84 21"]],
    ["घ", "घड़ी", "Clock", "⌚", ["M34 21 L34 44 L50 44", "M34 46 C26 52 26 70 38 76 C48 80 62 78 74 70", "M74 21 L74 86", "M16 21 L88 21"]],
    ["च", "चम्मच", "Spoon", "🥄", ["M24 43 C22 62 32 72 46 72 C58 72 66 68 72 62", "M16 43 L56 43", "M72 21 L72 86", "M10 21 L88 21"]],
    ["ज", "जहाज़", "Ship", "🚢", ["M24 43 L70 43", "M50 43 C52 62 48 76 34 78 C26 79 20 76 16 70", "M70 21 L70 86", "M14 21 L86 21"]],
    ["ट", "टमाटर", "Tomato", "🍅", ["M54 21 L54 40 C40 40 30 52 30 64 C30 80 48 84 58 82 C66 80 70 78 74 72", "M18 21 L82 21"]],
    ["ठ", "ठेला", "Cart", "🛒", ["M50 21 L50 40 E50 62 26 22 -90 -450", "M16 21 L84 21"]],
    ["ड", "डिब्बा", "Box", "📦", ["M54 21 L54 38 C42 38 34 44 36 52 C38 58 46 58 52 58 C66 58 72 66 70 74 C68 82 56 84 44 82 C34 80 28 78 24 72", "M18 21 L82 21"]],
    ["ढ", "ढोल", "Dhol", "🥁", ["M66 21 L66 42 C50 42 30 48 28 64 C26 80 40 86 54 86 C68 86 78 78 78 68 C78 60 70 56 62 58 C54 62 54 72 60 78", "M16 21 L84 21"]],
    ["त", "तितली", "Butterfly", "🦋", ["M72 44 L54 44 C36 44 28 58 28 70 C28 80 34 86 40 86", "M72 21 L72 86", "M12 21 L88 21"]],
    ["थ", "थाली", "Plate", "🍽️", ["M32 42 C24 38 22 26 32 21 C42 18 52 24 52 34 C52 44 42 50 18 52 C18 66 28 78 44 78 C54 78 62 74 70 68", "M70 21 L70 86", "M54 21 L88 21"]],
    ["द", "दूध", "Milk", "🥛", ["M54 21 L54 42 C36 42 24 52 24 64 C24 78 38 84 50 80 C60 76 62 68 56 64", "M54 76 C60 84 64 90 70 96", "M16 21 L84 21"]],
    ["ध", "धनुष", "Bow", "🏹", ["M44 36 C44 24 34 20 26 22 C16 26 14 42 24 48 C30 52 40 52 50 52", "M18 52 C16 66 24 80 42 80 C54 80 64 76 72 70", "M72 21 L72 86", "M56 21 L90 21"]],
    ["न", "नाव", "Boat", "⛵", ["M38 48 L38 58 C38 64 32 66 26 64", "M38 48 L68 48", "M68 21 L68 86", "M16 21 L84 21"]],
    ["प", "पतंग", "Kite", "🪁", ["M32 21 L32 50 C32 60 40 64 50 62 C58 60 64 56 68 52", "M68 21 L68 86", "M14 21 L86 21"]],
    ["फ", "फूल", "Flower", "🌺", ["M20 21 L20 54 C20 62 28 66 38 64 C44 63 48 61 52 58", "M52 21 L52 86", "M52 50 C60 38 84 38 88 54 C90 70 74 76 64 70", "M6 21 L92 21"]],
    ["ब", "बकरी", "Goat", "🐐", ["M30 30 L28 52 C28 70 40 78 52 76 C60 74 64 70 68 66", "M34 42 L62 64", "M68 21 L68 86", "M14 21 L84 21"]],
    ["भ", "भालू", "Bear", "🐻", ["M24 42 C18 30 24 20 34 20 C44 20 46 30 42 40 L42 58 C42 66 34 70 26 66", "M42 54 L68 54", "M68 21 L68 86", "M50 21 L88 21"]],
    ["म", "मछली", "Fish", "🐟", ["M34 21 L34 56 C34 64 28 66 22 62", "M34 50 L68 50", "M68 21 L68 86", "M14 21 L86 21"]],
    ["य", "योग", "Yoga", "🧘", ["M30 21 C42 24 46 36 40 44 C36 48 28 50 18 50 C20 60 26 72 42 74 C54 76 62 70 68 64", "M68 21 L68 86", "M10 21 L86 21"]],
    ["र", "रोटी", "Roti", "🫓", ["M40 21 C56 24 60 44 46 50 C40 52 32 54 24 50 C34 56 42 68 52 76 C58 80 62 82 66 84", "M16 21 L84 21"]],
    ["ल", "लकड़ी", "Wood", "🪵", ["M52 46 C40 34 14 40 14 60 C14 78 28 86 42 84", "M76 42 C66 38 56 40 56 48 L56 62 C56 68 52 70 48 68", "M76 21 L76 86", "M6 21 L88 21"]],
    ["व", "वन", "Forest", "🌳", ["M62 42 C50 32 26 38 24 58 C24 72 36 78 48 76 C56 74 64 72 70 68", "M70 21 L70 86", "M16 21 L86 21"]],
    ["श", "शेर", "Lion", "🦁", ["M30 46 C22 40 22 26 34 22 C46 20 54 28 54 40 C54 50 44 56 30 57 C24 57 18 56 14 55 C26 60 36 74 52 84", "M76 21 L76 86", "M60 21 L92 21"]],
    ["स", "सेब", "Apple", "🍎", ["M36 26 C48 26 52 40 44 48 C38 52 28 52 18 52 C28 56 32 70 46 82", "M44 50 L72 50", "M72 21 L72 86", "M6 21 L90 21"]],
    ["ह", "हाथी", "Elephant", "🐘", ["M64 21 L64 44 C50 44 36 46 36 54 C36 60 42 62 50 62 C64 62 74 68 72 78 C71 82 68 82 66 80", "M44 62 C32 66 30 80 36 88 C42 94 58 94 72 90", "M18 21 L84 21"]],
    ["त्र", "त्रिशूल", "Trident", "🔱", ["M14 44 C30 42 44 48 60 56 L16 78", "M62 21 L62 86", "M12 21 L86 21"]],
  ];
  const OVAL = "E50 50 32 38 -90 -450";
  const ABC = [
    ["A", "Apple", "🍎", ["M50 12 L24 88", "M50 12 L76 88", "M34 60 L66 60"]],
    ["B", "Ball", "⚽", ["M30 12 L30 88", "M30 12 L48 12 C68 12 68 50 48 50 L30 50", "M30 50 L52 50 C74 50 74 88 52 88 L30 88"]],
    ["C", "Cat", "🐈", ["E54 50 32 38 -40 -320"]],
    ["D", "Dog", "🐕", ["M28 12 L28 88", "M28 12 L42 12 E42 50 34 38 -90 90 L28 88"]],
    ["E", "Elephant", "🐘", ["M30 12 L30 88", "M30 12 L72 12", "M30 50 L64 50", "M30 88 L72 88"]],
    ["F", "Fish", "🐟", ["M30 12 L30 88", "M30 12 L72 12", "M30 50 L64 50"]],
    ["G", "Grapes", "🍇", ["E54 50 32 38 -40 -360 L64 50"]],
    ["H", "Hat", "🎩", ["M26 12 L26 88", "M74 12 L74 88", "M26 50 L74 50"]],
    ["I", "Ice cream", "🍦", ["M50 12 L50 88", "M30 12 L70 12", "M30 88 L70 88"]],
    ["J", "Juice", "🧃", ["M64 12 L64 66 C64 92 30 94 26 70", "M44 12 L82 12"]],
    ["K", "Kite", "🪁", ["M30 12 L30 88", "M72 12 L30 56", "M44 42 L74 88"]],
    ["L", "Lion", "🦁", ["M30 12 L30 88", "M30 88 L72 88"]],
    ["M", "Monkey", "🐒", ["M20 12 L20 88", "M20 12 L50 64 L80 12", "M80 12 L80 88"]],
    ["N", "Nest", "🪺", ["M26 12 L26 88", "M26 12 L74 88", "M74 88 L74 12"]],
    ["O", "Orange", "🍊", [OVAL]],
    ["P", "Parrot", "🦜", ["M30 12 L30 88", "M30 12 L48 12 C70 12 70 54 48 54 L30 54"]],
    ["Q", "Queen", "👸", [OVAL, "M58 66 L80 90"]],
    ["R", "Rabbit", "🐇", ["M30 12 L30 88", "M30 12 L48 12 C70 12 70 52 48 52 L30 52", "M46 52 L74 88"]],
    ["S", "Sun", "☀️", ["M74 24 C68 12 34 8 30 28 C26 46 74 46 74 68 C74 92 32 94 24 76"]],
    ["T", "Tiger", "🐯", ["M50 12 L50 88", "M24 12 L76 12"]],
    ["U", "Umbrella", "☂️", ["M26 12 L26 62 C26 94 74 94 74 62 L74 12"]],
    ["V", "Van", "🚐", ["M22 12 L50 88 L78 12"]],
    ["W", "Watch", "⌚", ["M14 12 L32 88 L50 30 L68 88 L86 12"]],
    ["X", "X-mas tree", "🎄", ["M24 12 L76 88", "M76 12 L24 88"]],
    ["Y", "Yo-yo", "🪀", ["M24 12 L50 50", "M76 12 L50 50", "M50 50 L50 88"]],
    ["Z", "Zebra", "🦓", ["M24 12 L76 12 L24 88 L76 88"]],
  ];
  const NUM_HI = ["शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ"];
  const NUM_EN = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const NUM_PICS = ["", "🍎", "🍌", "🐥", "🎈", "⭐", "🍓", "🐟", "🌸", "🦋"];
  const DIGITS = [
    ["0", ["E50 50 26 38 -90 -450"]],
    ["1", ["M36 26 L52 12 L52 88"]],
    ["2", ["M28 32 C28 8 74 6 72 32 C70 52 40 66 26 88 L76 88"]],
    ["3", ["M28 22 C38 8 72 8 70 30 C68 44 56 48 44 48 C60 48 76 54 74 70 C72 92 36 94 26 78"]],
    ["4", ["M62 12 L24 64 L80 64", "M62 12 L62 88"]],
    ["5", ["M34 12 L32 46 C46 36 74 40 74 64 C74 92 36 94 26 78", "M34 12 L72 12"]],
    ["6", ["M70 16 C52 6 26 22 26 60 E50 64 24 24 180 -180"]],
    ["7", ["M24 12 L76 12 L42 88"]],
    ["8", ["M70 24 C66 6 30 6 30 26 C30 42 72 46 74 68 C76 92 24 92 26 68 C28 46 70 42 70 24"]],
    ["9", ["E48 32 22 20 0 -360 L70 88"]],
  ];

  const SETS = [
    { id: "swar", icon: "अ", lang: "hi", title: { hi: "स्वर", en: "Hindi vowels", hinglish: "Swar" },
      items: SWAR.map(([ch, hi, en, pic, s]) => ({ ch, s, pic, word: { hi, en }, say: ch + " से " + hi })) },
    { id: "vyanjan", icon: "क", lang: "hi", title: { hi: "व्यंजन", en: "Hindi consonants", hinglish: "Vyanjan" },
      items: VYANJAN.map(([ch, hi, en, pic, s]) => ({ ch, s, pic, word: { hi, en }, say: ch + " से " + hi })) },
    { id: "abc", icon: "A", lang: "en", title: { hi: "ABC", en: "ABC", hinglish: "ABC" },
      items: ABC.map(([ch, w, pic, s]) => ({ ch, s, pic, word: { hi: w, en: w }, say: ch + " for " + w })) },
    { id: "num", icon: "1", lang: "ui", title: { hi: "अंक", en: "Numbers", hinglish: "Ank" },
      items: DIGITS.map(([ch, s], i) => ({ ch, s, pic: i ? NUM_PICS[i] : "⭕", word: { hi: NUM_HI[i], en: NUM_EN[i] }, say: null, n: i })) },
  ];

  /* The example word + picture come from the अक्षर / ABC flashcards (NS.content.lessons), so a
     letter shows the same word and picture everywhere; the table above is only the fallback.
     A Hindi word keeps its English meaning only while it is the same word as in the table. */
  function example(set, it) {
    const fall = { word: it.word, pic: it.pic, say: it.say };
    if (set.lang === "ui") return fall;
    let card = null;
    try {
      const L = NS.content && NS.content.lessons;
      const deck = L && typeof L.deck === "function" ? L.deck(set.lang === "hi" ? "varn" : "abc") : null;
      card = deck && Array.isArray(deck.cards) ? deck.cards.find(c => c && c.big === it.ch) : null;
    } catch (e) { card = null; }
    if (!card || !card.name) return fall;
    if (set.lang === "hi") {
      const w = String(card.name.hi || "");
      if (!w) return fall;
      return { word: { hi: w, en: w === it.word.hi ? it.word.en : w }, pic: card.pic || it.pic, say: it.ch + " से " + w };
    }
    const w = String(card.name.en || card.name.hi || "");
    if (!w) return fall;
    return { word: { hi: w, en: w }, pic: card.pic || it.pic, say: it.ch + " for " + w };
  }

  /* ---------------- geometry (pure) ---------------- */
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  /* A stroke path → polyline (points about `step` units apart). */
  function parse(d, step) {
    step = step || 2;
    const tok = String(d).match(/[MLQCE]|-?\d*\.?\d+/g) || [];
    const pts = [];
    let i = 0, cmd = null, cx = 0, cy = 0;
    const num = () => { const v = parseFloat(tok[i++]); return isFinite(v) ? v : 0; };
    const push = (x, y) => { const l = pts[pts.length - 1]; if (!l || Math.hypot(l[0] - x, l[1] - y) > 0.01) pts.push([x, y]); };
    const lineTo = (x, y) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x - cx, y - cy) / step));
      for (let k = 1; k <= n; k++) push(cx + (x - cx) * k / n, cy + (y - cy) * k / n);
      cx = x; cy = y;
    };
    const curve = (ctrl, x, y) => {
      const P = [[cx, cy]].concat(ctrl, [[x, y]]);
      let len = 0;
      for (let k = 1; k < P.length; k++) len += dist(P[k - 1], P[k]);
      const n = Math.max(2, Math.ceil(len / step));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        let px, py;
        if (P.length === 3) { px = u * u * P[0][0] + 2 * u * t * P[1][0] + t * t * P[2][0]; py = u * u * P[0][1] + 2 * u * t * P[1][1] + t * t * P[2][1]; }
        else { px = u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0]; py = u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]; }
        push(px, py);
      }
      cx = x; cy = y;
    };
    while (i < tok.length) {
      if (/^[MLQCE]$/.test(tok[i])) cmd = tok[i++];
      else if (!cmd) break;
      const need = { M: 2, L: 2, Q: 4, C: 6, E: 6 }[cmd];
      let whole = true;
      for (let k = 0; k < need; k++) if (!(i + k < tok.length) || /^[A-Z]$/.test(tok[i + k])) whole = false;
      if (!whole) break;                // a command without all its numbers ends the path
      const before = i;
      if (cmd === "M") { cx = num(); cy = num(); push(cx, cy); cmd = "L"; }
      else if (cmd === "L") lineTo(num(), num());
      else if (cmd === "Q") { const a = [num(), num()]; curve([a], num(), num()); }
      else if (cmd === "C") { const a = [num(), num()], b = [num(), num()]; curve([a, b], num(), num()); }
      else if (cmd === "E") {
        const ex = num(), ey = num(), rx = num(), ry = num(), a0 = num() * Math.PI / 180, a1 = num() * Math.PI / 180;
        const sx = ex + rx * Math.cos(a0), sy = ey + ry * Math.sin(a0);
        if (pts.length) lineTo(sx, sy); else { cx = sx; cy = sy; push(sx, sy); }
        const n = Math.max(4, Math.ceil(Math.abs(a1 - a0) * (rx + ry) / 2 / step));
        for (let k = 1; k <= n; k++) { const a = a0 + (a1 - a0) * k / n; push(ex + rx * Math.cos(a), ey + ry * Math.sin(a)); }
        cx = ex + rx * Math.cos(a1); cy = ey + ry * Math.sin(a1);
      }
      if (i === before) break;          // malformed: never loop forever
    }
    return pts;
  }
  function pathLen(p) { let l = 0; for (let k = 1; k < p.length; k++) l += dist(p[k - 1], p[k]); return l; }
  /* n points evenly spaced along a polyline */
  function resample(p, n) {
    if (!p.length) return [];
    if (p.length === 1 || n < 2) return [p[0].slice()];
    const L = pathLen(p);
    if (L === 0) return [p[0].slice()];
    const out = [p[0].slice()];
    const stepL = L / (n - 1);
    let k = 1, acc = 0, prev = p[0];
    for (let j = 1; j < n - 1; j++) {
      const want = j * stepL;
      while (k < p.length) {
        const seg = dist(prev, p[k]);
        if (acc + seg >= want) { const t = seg ? (want - acc) / seg : 0; out.push([prev[0] + (p[k][0] - prev[0]) * t, prev[1] + (p[k][1] - prev[1]) * t]); break; }
        acc += seg; prev = p[k]; k++;
      }
    }
    out.push(p[p.length - 1].slice());
    return out;
  }
  /* the point at fraction t (0..1) of a polyline's length, and the direction there */
  function pointAt(p, t) {
    const L = pathLen(p) * Math.max(0, Math.min(1, t));
    let acc = 0;
    for (let k = 1; k < p.length; k++) {
      const seg = dist(p[k - 1], p[k]);
      if (acc + seg >= L && seg > 0) {
        const u = (L - acc) / seg;
        return { x: p[k - 1][0] + (p[k][0] - p[k - 1][0]) * u, y: p[k - 1][1] + (p[k][1] - p[k - 1][1]) * u, a: Math.atan2(p[k][1] - p[k - 1][1], p[k][0] - p[k - 1][0]) };
      }
      acc += seg;
    }
    const a = p[p.length - 1], b = p.length > 1 ? p[p.length - 2] : a;
    return { x: a[0], y: a[1], a: Math.atan2(a[1] - b[1], a[0] - b[0]) };
  }
  function segDist(q, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    let t = l2 ? ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
  }
  function distToPoly(q, p) {
    if (p.length === 1) return dist(q, p[0]);
    let m = Infinity;
    for (let k = 1; k < p.length; k++) m = Math.min(m, segDist(q, p[k - 1], p[k]));
    return m;
  }
  const distToPolys = (q, polys) => polys.reduce((m, p) => (p.length ? Math.min(m, distToPoly(q, p)) : m), Infinity);

  /* How tolerant the checking is (distances are in units of the 100-unit box). */
  function level(ageBand) {
    if (ageBand === "2-3") return { tol: 15, cover: 0.55, acc: 0.5, dir: false };
    if (ageBand === "6+") return { tol: 9, cover: 0.8, acc: 0.75, dir: true };
    return { tol: 12, cover: 0.68, acc: 0.65, dir: true };
  }
  /* Checks one stroke. `user` = a polyline [[x,y]…] or a list of polylines (the child may lift
     the finger and carry on). Returns {ok, partial, cover, acc, reversed, reason}:
       cover    share of the guide stroke the child went along
       acc      share of the child's line that stayed near the guide stroke
       reason   "ok" | "short" (on track, not finished: keep going) | "reverse" | "off" | "empty" */
  function score(user, target, lvl) {
    lvl = lvl || level("4-5");
    const segs = (user && user.length && Array.isArray(user[0]) && Array.isArray(user[0][0])) ? user : [user || []];
    const all = segs.filter(s => s && s.length);
    if (!all.length || !target || !target.length) return { ok: false, partial: false, cover: 0, acc: 0, reversed: false, reason: "empty" };
    const tl = pathLen(target);
    if (tl < 4) {             // a dot: a tap (or a tiny scribble) near it
      const c = target[0];
      const near = all.some(s => s.some(p => dist(p, c) <= lvl.tol * 1.6));
      const small = all.reduce((m, s) => m + pathLen(s), 0) < 40;
      const ok = near && small;
      return { ok, partial: false, cover: ok ? 1 : 0, acc: ok ? 1 : 0, reversed: false, reason: ok ? "ok" : "off" };
    }
    const T = resample(target, Math.max(16, Math.round(tl / 2.5)));
    const cover = T.filter(p => distToPolys(p, all) <= lvl.tol).length / T.length;
    const U = [];
    all.forEach(s => resample(s, Math.max(2, Math.round(pathLen(s) / 2.5) + 1)).forEach(p => U.push(p)));
    const acc = U.filter(p => distToPoly(p, target) <= lvl.tol).length / U.length;
    /* direction: does the child's first line move forwards along the guide? */
    const first = resample(all[0], Math.max(2, Math.round(pathLen(all[0]) / 2.5) + 1));
    const near = q => { let bi = 0, bd = Infinity; T.forEach((p, k) => { const d = dist(p, q); if (d < bd) { bd = d; bi = k; } }); return bi / (T.length - 1); };
    let fwd = 0, back = 0, prev = null;
    first.forEach(q => { const t = near(q); if (prev != null) { const d = t - prev; if (Math.abs(d) < 0.5) { if (d > 0) fwd += d; else back -= d; } } prev = t; });
    const reversed = fwd + back > 0.15 && back > fwd * 1.5;
    const wrongWay = lvl.dir && reversed;
    const ok = cover >= lvl.cover && acc >= lvl.acc && !wrongWay;
    const partial = !ok && !wrongWay && acc >= lvl.acc;
    return { ok, partial, cover, acc, reversed, reason: ok ? "ok" : wrongWay ? "reverse" : partial ? "short" : "off" };
  }
  const polyCache = new Map();
  function polys(item) {
    if (!polyCache.has(item.ch)) polyCache.set(item.ch, item.s.map(d => parse(d, 1.5)));
    return polyCache.get(item.ch);
  }
  /* the shirorekha: a long horizontal stroke on the head line of a Devanagari letter */
  const isHead = p => p.length > 1 && pathLen(p) > 25 && p.every(q => Math.abs(q[1] - 21) < 2.5);
  /* the glyph box (in units) that the canvas shows: the letter's extent plus a margin */
  function frame(ps) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ps.forEach(p => p.forEach(q => { x0 = Math.min(x0, q[0]); y0 = Math.min(y0, q[1]); x1 = Math.max(x1, q[0]); y1 = Math.max(y1, q[1]); }));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const size = Math.max(x1 - x0, y1 - y0, 60) + 22;
    return { x: cx - size / 2, y: cy - size / 2, size };
  }

  NS.create.trace = { SETS, example, parse, pathLen, resample, pointAt, distToPoly, level, score, polys, isHead, frame };

  /* ---------------- UI ---------------- */
  const CSS = `
.trace-wrap{display:flex;flex-direction:column;gap:10px;flex:1 1 auto;min-height:0;width:100%;max-width:1000px;margin:0 auto}
.trace-bar{display:flex;align-items:center;gap:8px}
.trace-rb{width:56px;height:56px;flex:0 0 auto;border:none;border-radius:50%;padding:0;background:var(--surface);color:var(--ink);font-size:24px;line-height:1;display:grid;place-items:center;box-shadow:0 3px 0 rgba(0,0,0,.12);touch-action:manipulation}
.trace-bt{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(19px,5vw,28px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.trace-cap{margin:0;text-align:center;font-weight:700;font-size:clamp(16px,4.3vw,22px);line-height:1.35;min-height:1.35em;text-wrap:balance}
.trace-tabs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center}
.trace-tab{border:none;border-radius:999px;padding:8px 16px;min-height:56px;font-weight:800;font-size:clamp(16px,4.2vw,20px);background:var(--surface);color:var(--ink);box-shadow:0 3px 0 rgba(0,0,0,.1);touch-action:manipulation}
.trace-tab[aria-pressed="true"]{background:#5E35B1;color:#fff}
.trace-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:10px}
.trace-tile{position:relative;border:none;border-radius:20px;aspect-ratio:1;min-height:64px;min-width:56px;background:var(--surface);color:var(--ink);font-size:clamp(34px,10vw,46px);font-weight:700;line-height:1;box-shadow:0 4px 0 rgba(94,53,177,.18);touch-action:manipulation}
.trace-tile .trace-star{position:absolute;top:4px;right:6px;font-size:16px}
.trace-work{display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto minmax(250px,1fr) auto;grid-template-areas:"bar" "mute" "cap" "stage" "side"}
.trace-work>.trace-bar{grid-area:bar}.trace-work>.trace-mute{grid-area:mute}.trace-work>.trace-cap{grid-area:cap}.trace-work>.trace-stage{grid-area:stage}.trace-work>.trace-side{grid-area:side}
@media (orientation:landscape) and (min-aspect-ratio:5/4){
  .trace-work{grid-template-columns:minmax(0,1fr) minmax(230px,38%);grid-template-rows:auto auto auto minmax(0,1fr);grid-template-areas:"stage bar" "stage mute" "stage cap" "stage side"}
  .trace-work>.trace-side{align-self:start}
}
.trace-stage{position:relative;min-height:0;min-width:0}
.trace-paper{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:#fff;border-radius:26px;box-shadow:var(--shadow);touch-action:none;overflow:hidden}
.trace-paper canvas{position:absolute;left:0;top:0;width:100%;height:100%;touch-action:none;-webkit-user-select:none;user-select:none}
.trace-hand{position:absolute;left:0;top:0;font-size:46px;line-height:1;pointer-events:none;opacity:0;transition:opacity .2s;filter:drop-shadow(0 3px 3px rgba(0,0,0,.25))}
.trace-side{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}
.trace-acts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;width:100%}
.trace-acts>.trace-btn{flex:1 1 auto}
.trace-card{display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:20px;padding:6px 14px;box-shadow:var(--shadow);min-height:56px;max-width:100%}
.trace-pic{font-size:40px;line-height:1;display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px}
.trace-pic img{width:48px;height:48px;object-fit:contain}
.trace-pic.trace-many{display:inline-grid;grid-template-columns:repeat(5,auto);gap:2px;font-size:20px}.trace-many img{width:24px;height:24px}
.trace-word{font-weight:800;font-size:clamp(18px,4.6vw,24px);white-space:nowrap}
.trace-btn{border:none;border-radius:999px;min-height:56px;padding:8px 16px;font-weight:800;font-size:clamp(16px,4.2vw,20px);background:var(--surface);color:var(--ink);box-shadow:0 4px 0 rgba(0,0,0,.12);touch-action:manipulation}
.trace-btn.trace-go{background:#2EAD6B;color:#fff;box-shadow:0 4px 0 #1E8A51}
.trace-dots{display:flex;gap:6px;justify-content:center}
.trace-dot{width:16px;height:16px;border-radius:50%;background:var(--line);transition:background .2s}
.trace-dot.trace-on{background:#5E35B1}
.trace-pal{flex-wrap:wrap;justify-content:center}
.trace-sw{width:44px;height:44px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 2px var(--line);padding:0}
.trace-sw[aria-pressed="true"]{box-shadow:0 0 0 4px #5E35B1}
.trace-done .trace-card{animation:trace-pop .6s ease-out}
@keyframes trace-pop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.trace-done .trace-card{animation:none}}
@media (max-height:560px) and (orientation:landscape){
  .trace-wrap{gap:8px}.trace-cap{font-size:16px}.trace-rb{width:50px;height:50px}.trace-bt{font-size:20px}
  .trace-side{gap:8px}.trace-card{min-height:50px;padding:4px 12px}.trace-sw{width:36px;height:36px}.trace-pal{flex-wrap:nowrap;gap:6px}.trace-pic{font-size:30px;min-width:36px;min-height:36px}.trace-pic:not(.trace-many) img{width:38px;height:38px}
  .trace-btn{min-height:52px;padding:6px 12px;font-size:16px}.trace-dot{width:12px;height:12px}
}
}`;
  function injectStyle(id, css) {
    if (document.getElementById(id)) return;
    const s = document.createElement("style");
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }
  const RAINBOW = ["#E53935", "#FB8C00", "#43A047", "#1E88E5", "#8E24AA", "#00ACC1", "#F4511E"];

  NS.registerActivity({
    id: "trace",
    icon: "✏️",
    title: { hi: "लिखना सीखो", en: "Let's write", hinglish: "Likhna seekho" },
    color: "#5E35B1",
    section: "learn",
    free: false,
    order: 35,
    open(ctx) {
      injectStyle("trace-style", CSS);
      const P = "trace";
      const timers = new Set(), frames = new Set();
      let alive = true, lastSay = null, resizeObs = null, onWinResize = null;
      const T = o => (o == null ? "" : typeof o === "string" ? o : ctx.t(o));
      const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map(x => P + "-" + x).join(" ") : null, text == null ? null : String(text));
      const sfx = n => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* no sound effects */ } };
      const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); if (alive) fn(); }, ms); timers.add(id); return id; };
      const say = (o, lang) => {
        const s = T(o);
        lastSay = { s, lang };
        return Promise.resolve(ctx.say(s, lang)).catch(() => {});
      };
      /* letter name, then words in the UI language */
      const sayThen = (first, firstLang, then) => say(first, firstLang).then(() => { if (alive && then) return say(then); });
      const age = (ctx.profile && ctx.profile.ageBand) || "4-5";
      const LV = level(age);
      const dpr = () => Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      /* a realistic picture for an emoji (NS.imgUrl/NS.img), the emoji itself as the fallback;
         n > 1 shows that many (counting pictures for the digits) */
      const imgUrl = e => {
        try {
          if (typeof NS.imgUrl === "function") return NS.imgUrl(e);
          const u = typeof NS.img === "function" ? NS.img(e) : null;
          return typeof u === "string" && /^[\w\-./]+\.(?:webp|png|jpe?g|avif|svg)$/.test(u) && u.indexOf("..") < 0 ? u : null;
        } catch (x) { return null; }
      };
      const pic = (emoji, n) => {
        const box = el("span", "pic" + (n > 1 ? " many" : ""));
        box.setAttribute("aria-hidden", "true");
        const url = imgUrl(emoji);
        for (let j = 0; j < Math.max(1, n || 1); j++) {
          if (!url) { box.appendChild(document.createTextNode(emoji)); continue; }
          const im = document.createElement("img");
          im.alt = ""; im.draggable = false; im.decoding = "async";
          im.addEventListener("error", () => im.replaceWith(document.createTextNode(emoji)), { once: true });
          im.src = url;
          box.appendChild(im);
        }
        return box;
      };
      const stopAll = () => {
        for (const id of timers) clearTimeout(id);
        timers.clear();
        for (const id of frames) cancelAnimationFrame(id);
        frames.clear();
        if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
        if (onWinResize) { window.removeEventListener("resize", onWinResize); onWinResize = null; }
      };
      function page(title, onBack, work) {
        stopAll();
        const root = ctx.screen;
        while (root.firstChild) root.removeChild(root.firstChild);
        const w = el("div", work ? "wrap work" : "wrap");
        if (title != null) {
          const bar = el("div", "bar");
          const back = ctx.button("⬅️", P + "-rb", onBack);
          back.setAttribute("aria-label", T({ hi: "वापस", en: "Back", hinglish: "Wapas" }));
          const again = ctx.button("🔊", P + "-rb", () => { if (lastSay) say(lastSay.s, lastSay.lang); });
          again.setAttribute("aria-label", T({ hi: "फिर से सुनो", en: "Hear again", hinglish: "Phir se suno" }));
          bar.append(back, el("div", "bt", title), again);
          w.appendChild(bar);
        }
        root.appendChild(w);
        return w;
      }
      const doneMap = () => ctx.data.get("done", {}) || {};
      const setById = id => SETS.find(s => s.id === id) || SETS[0];
      const nameOf = (set, it) => (set.lang === "ui" ? T(it.word) : it.ch);

      /* ---------- menu ---------- */
      function menu(setId) {
        const last = ctx.data.get("last", null);
        const set = setById(setId || (last && last.set) || (ctx.lang === "en" ? "abc" : "swar"));
        const w = page(null);
        const intro = { hi: "कौन-सा अक्षर लिखें? किसी पर भी दबाओ!", en: "Which letter shall we write? Tap any one!", hinglish: "Kaun sa akshar likhein? Kisi par bhi dabao!" };
        w.appendChild(el("p", "cap", T(intro)));
        const tabs = el("div", "tabs");
        SETS.forEach(s => {
          const b = ctx.button(s.icon + " " + T(s.title), P + "-tab", () => { if (s.id !== set.id) { menu(s.id); say(s.title); } });
          b.setAttribute("aria-pressed", String(s.id === set.id));
          tabs.appendChild(b);
        });
        const free = ctx.button("🖍️ " + T({ hi: "खुला लिखो", en: "Free writing", hinglish: "Khula likho" }), P + "-tab", () => freeMode(set.id, null));
        tabs.appendChild(free);
        w.appendChild(tabs);
        const grid = el("div", "grid");
        const dm = doneMap();
        set.items.forEach((it, i) => {
          const b = ctx.button(it.ch, P + "-tile", () => trace(set.id, i));
          b.lang = set.lang === "en" ? "en" : "hi";
          b.setAttribute("aria-label", nameOf(set, it));
          if (dm[it.ch]) b.appendChild(el("span", "star", "⭐"));
          grid.appendChild(b);
        });
        w.appendChild(grid);
        say(intro);
      }

      /* ---------- the drawing surface shared by tracing and free writing ---------- */
      function surface(stage, onLayout) {
        const paper = el("div", "paper");
        const guide = document.createElement("canvas");
        const ink = document.createElement("canvas");
        guide.setAttribute("aria-hidden", "true");
        ink.setAttribute("role", "img");
        const hand = el("span", "hand", "👆");
        hand.setAttribute("aria-hidden", "true");
        paper.append(guide, ink, hand);
        stage.appendChild(paper);
        const S = { paper, guide, ink, hand, size: 0, map: null, box: null };
        S.toUnits = (cx, cy) => { const r = ink.getBoundingClientRect(); const m = S.map; return [(cx - r.left - m.ox) / m.k, (cy - r.top - m.oy) / m.k]; };
        S.toPx = (x, y) => [x * S.map.k + S.map.ox, y * S.map.k + S.map.oy];
        S.setBox = box => { S.box = box; if (S.size) S.map = { k: S.size / box.size, ox: -box.x * S.size / box.size, oy: -box.y * S.size / box.size }; };
        const layout = () => {
          if (!alive || !stage.isConnected) return;
          const r = stage.getBoundingClientRect();
          const size = Math.max(160, Math.floor(Math.min(r.width, r.height)));
          if (size === S.size) return;
          S.size = size;
          paper.style.width = size + "px";
          paper.style.height = size + "px";
          const d = dpr();
          [guide, ink].forEach(c => { c.width = Math.round(size * d); c.height = Math.round(size * d); c.getContext("2d").setTransform(d, 0, 0, d, 0, 0); });
          if (S.box) S.setBox(S.box);
          onLayout();
        };
        if (typeof ResizeObserver === "function") { resizeObs = new ResizeObserver(() => layout()); resizeObs.observe(stage); }
        onWinResize = () => layout();
        window.addEventListener("resize", onWinResize);
        S.layout = layout;
        return S;
      }
      function line(g, S, poly, width, color, dash) {
        if (!poly.length) return;
        g.save();
        g.lineCap = "round"; g.lineJoin = "round";
        g.lineWidth = width; g.strokeStyle = color;
        if (dash) g.setLineDash(dash);
        g.beginPath();
        poly.forEach((q, k) => { const [x, y] = S.toPx(q[0], q[1]); if (k) g.lineTo(x, y); else g.moveTo(x, y); });
        if (poly.length === 1) { const [x, y] = S.toPx(poly[0][0], poly[0][1]); g.lineTo(x + 0.01, y); }
        g.stroke();
        g.restore();
      }
      function badge(g, S, q, n, r, fill, ring) {
        const [x, y] = S.toPx(q[0], q[1]);
        g.save();
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = fill; g.fill();
        if (ring) { g.lineWidth = Math.max(2, r * 0.18); g.strokeStyle = "#fff"; g.stroke(); }
        g.fillStyle = "#fff"; g.font = "800 " + Math.round(r * 1.25) + "px " + getComputedStyle(document.body).fontFamily;
        g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText(String(n), x, y + r * 0.08);
        g.restore();
      }
      function arrows(g, S, poly, color, size) {
        const L = pathLen(poly) * S.map.k;
        if (L < size * 3) return;
        const n = Math.max(1, Math.floor(L / (size * 4.2)));
        for (let j = 1; j <= n; j++) {
          const at = pointAt(poly, j / (n + 1));
          const [x, y] = S.toPx(at.x, at.y);
          g.save();
          g.translate(x, y); g.rotate(at.a);
          g.beginPath(); g.moveTo(size * 0.55, 0); g.lineTo(-size * 0.45, -size * 0.5); g.lineTo(-size * 0.2, 0); g.lineTo(-size * 0.45, size * 0.5); g.closePath();
          g.fillStyle = color; g.fill();
          g.restore();
        }
      }

      /* ---------- tracing one character ---------- */
      function trace(setId, idx) {
        const set = setById(setId);
        idx = ((idx % set.items.length) + set.items.length) % set.items.length;
        const it = set.items[idx];
        ctx.data.set("last", { set: set.id, i: idx });
        const ps = polys(it);
        const isHindi = set.lang === "hi";
        const headIdx = isHindi ? ps.findIndex(isHead) : -1;
        const ex = example(set, it);
        const word = T(ex.word);
        const w = page(it.ch + " — " + word, () => menu(set.id), true);
        w.lang = isHindi ? "hi" : NS.langTag ? NS.langTag(ctx.lang) : "hi";
        const cap = el("p", "cap", "");
        const stage = el("div", "stage");
        const side = el("div", "side");
        w.append(cap, stage, side);
        const card = el("div", "card");
        card.append(pic(ex.pic, it.n), el("span", "word", it.ch + " — " + word));
        const dots = el("div", "dots");
        const dotEls = ps.map(() => { const d = el("span", "dot"); dots.appendChild(d); return d; });
        const showBtn = ctx.button("👀 " + T({ hi: "दिखाओ", en: "Show me", hinglish: "Dikhao" }), P + "-btn", () => { if (!busy && !finished) { say({ hi: "देखो, ऐसे!", en: "Watch, like this!", hinglish: "Dekho, aise!" }); demo(k, () => {}); } });
        const againBtn = ctx.button("🔁 " + T({ hi: "फिर से", en: "Again", hinglish: "Phir se" }), P + "-btn", () => trace(set.id, idx));
        againBtn.dataset.sfx = "whoosh";
        const nextBtn = ctx.button("➡️ " + T({ hi: "अगला", en: "Next", hinglish: "Agla" }), P + "-btn " + P + "-go", () => trace(set.id, idx + 1));
        const acts = el("div", "acts");
        acts.append(showBtn, againBtn, nextBtn);
        side.append(card, dots, acts);

        let k = 0, fails = 0, busy = false, finished = false;
        let segs = [], cur = null, pid = null;
        const doneStrokes = ps.map(() => false);
        const S = surface(stage, () => { drawGuide(); drawInk(); });
        S.ink.setAttribute("aria-label", T({ hi: it.ch + " लिखने की जगह", en: "Space to write " + it.ch }));
        S.setBox(frame(ps));

        const colorOf = j => RAINBOW[j % RAINBOW.length];
        function drawGuide() {
          if (!S.map) return;
          const g = S.guide.getContext("2d");
          g.clearRect(0, 0, S.size, S.size);
          const road = Math.max(14, S.size * 0.085);
          ps.forEach(p => line(g, S, p, road, "#EEE8F7"));
          ps.forEach((p, j) => { if (doneStrokes[j]) line(g, S, p, road * 0.78, colorOf(j)); });
          if (!finished && ps[k]) {
            line(g, S, ps[k], road, "#DCD0F2");
            line(g, S, ps[k], Math.max(2.5, S.size * 0.012), "#7E57C2", [Math.max(3, S.size * 0.012), Math.max(7, S.size * 0.028)]);
            arrows(g, S, ps[k], "#7E57C2", Math.max(10, S.size * 0.036));
          }
          const r = Math.max(11, S.size * 0.04);
          ps.forEach((p, j) => { if (!doneStrokes[j] && j !== k) badge(g, S, p[0], j + 1, r * 0.75, "#B39DDB", false); });
          if (!finished && ps[k]) badge(g, S, ps[k][0], k + 1, r, "#2EAD6B", true);
          dotEls.forEach((d, j) => d.classList.toggle("trace-on", doneStrokes[j]));
        }
        function drawInk() {
          if (!S.map) return;
          const g = S.ink.getContext("2d");
          g.clearRect(0, 0, S.size, S.size);
          const wdt = Math.max(8, S.size * 0.05);
          segs.forEach(s => line(g, S, s, wdt, colorOf(k)));
          if (cur) line(g, S, cur, wdt, colorOf(k));
        }
        const setCap = o => { cap.textContent = T(o); };
        function instruct() {
          const n = k + 1;
          let o;
          if (ps[k].length === 1 || pathLen(ps[k]) < 4) o = { hi: "अब बिंदी लगाओ — बस " + n + " को छू दो!", en: "Now the dot — just touch " + n + "!", hinglish: "Ab bindi lagao — bas " + n + " ko chhoo do!" };
          else if (k === headIdx) o = { hi: "अब ऊपर की लकीर — शिरोरेखा! " + n + " से शुरू करो।", en: "Now the line on top — the shirorekha! Start at " + n + ".", hinglish: "Ab upar ki lakeer — shirorekha! " + n + " se shuru karo." };
          else if (headIdx >= 0 && k > headIdx) o = { hi: "अब ऊपर वाला निशान, " + n + " से।", en: "Now the mark on top, from " + n + ".", hinglish: "Ab upar wala nishaan, " + n + " se." };
          else o = { hi: "शाबाश! अब " + n + " से, तीर के साथ।", en: "Good! Now from " + n + ", along the arrows.", hinglish: "Shabash! Ab " + n + " se, teer ke saath." };
          setCap(o);
          say(o);
        }
        function acceptStroke(helped) {
          doneStrokes[k] = true;
          segs = []; cur = null; fails = 0;
          sfx(helped ? "pop" : "correct");
          k++;
          if (k >= ps.length) { finish(); return; }
          drawGuide(); drawInk();
          instruct();
        }
        function failStroke(reason) {
          fails++;
          segs = []; cur = null;
          drawInk();
          sfx("tryagain");
          if (fails >= 4) {
            const o = { hi: "चलो, यह लकीर साथ में बनाते हैं!", en: "Let's draw this one together!", hinglish: "Chalo, ye lakeer saath mein banate hain!" };
            setCap(o); say(o);
            demo(k, () => acceptStroke(true));
            return;
          }
          if (fails === 2) {
            const o = { hi: "देखो, ऐसे लिखते हैं! फिर तुम करो।", en: "Watch, like this! Then you try.", hinglish: "Dekho, aise likhte hain! Phir tum karo." };
            setCap(o); say(o);
            demo(k, () => { const t = { hi: "अब तुम्हारी बारी! " + (k + 1) + " से शुरू करो।", en: "Your turn! Start at " + (k + 1) + ".", hinglish: "Ab tumhari baari! " + (k + 1) + " se shuru karo." }; setCap(t); say(t); });
            return;
          }
          const o = reason === "reverse"
            ? { hi: "अरे, उल्टी तरफ़ से! हरे बिंदु " + (k + 1) + " से शुरू करो।", en: "Oops, the other way! Start at the green dot " + (k + 1) + ".", hinglish: "Arre, ulti taraf se! Hare bindu " + (k + 1) + " se shuru karo." }
            : [{ hi: "अच्छी कोशिश! हरे बिंदु से, तीर के साथ-साथ चलो।", en: "Good try! From the green dot, follow the arrows.", hinglish: "Achhi koshish! Hare bindu se, teer ke saath chalo." },
              { hi: "कोई बात नहीं! धीरे-धीरे, बिंदु वाली लकीर पर चलो।", en: "That's okay! Slowly, walk on the dotted line.", hinglish: "Koi baat nahi! Dheere-dheere, dotted line par chalo." }][fails % 2];
          setCap(o); say(o);
        }
        /* the animated hand draws stroke j, then calls back */
        function demo(j, then) {
          if (!S.map || !ps[j]) { then(); return; }
          busy = true;
          const p = ps[j];
          const len = pathLen(p);
          const dur = len < 4 ? 700 : Math.min(2600, 700 + len * 16);
          const g = S.ink.getContext("2d");
          const hs = Math.max(34, S.size * 0.13);
          S.hand.style.fontSize = hs + "px";
          S.hand.style.opacity = "1";
          const t0 = performance.now();
          const step = now => {
            frames.delete(id);
            if (!alive) return;
            const t = Math.min(1, (now - t0) / dur);
            const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const at = pointAt(p, e);
            const [x, y] = S.toPx(at.x, at.y);
            S.hand.style.transform = "translate(" + (x - hs * 0.42) + "px," + (y - hs * 0.06) + "px)";
            drawInk();
            const upto = [];
            const L = len * e;
            let acc = 0;
            upto.push(p[0]);
            for (let q = 1; q < p.length; q++) { acc += dist(p[q - 1], p[q]); if (acc > L) break; upto.push(p[q]); }
            upto.push([at.x, at.y]);
            line(g, S, upto, Math.max(8, S.size * 0.05), "rgba(255,179,0,.85)");
            if (t < 1) { id = requestAnimationFrame(step); frames.add(id); }
            else later(() => { S.hand.style.opacity = "0"; busy = false; drawInk(); then(); }, 350);
          };
          let id = requestAnimationFrame(step);
          frames.add(id);
        }
        function finish() {
          finished = true;
          busy = true;
          showBtn.hidden = true;
          drawGuide(); drawInk();
          w.classList.add(P + "-done");
          sfx("sparkle");
          const dm = doneMap();
          const firstTime = !dm[it.ch];
          dm[it.ch] = (dm[it.ch] || 0) + 1;
          ctx.data.set("done", dm);
          const count = Object.keys(dm).length;
          const praise = { hi: "वाह! तुमने " + nameOf(set, it) + " लिखा! बहुत मेहनत की।", en: "Wow! You wrote " + (isHindi ? "it" : nameOf(set, it)) + "! Great effort.", hinglish: "Waah! Tumne likh liya! Bahut mehnat ki." };
          setCap(isHindi ? { hi: "वाह! " + ex.say + "।", en: "Wow! " + it.ch + " — " + ex.word.hi + (ex.word.en !== ex.word.hi ? " (" + ex.word.en + ")" : "") } : set.lang === "ui" ? praise : { hi: "वाह! " + ex.say + "!", en: "Wow! " + ex.say + "!" });
          let p;
          if (set.lang === "ui") p = say(praise);
          else p = say(praise).then(() => { if (alive) return say(ex.say, set.lang); });
          if (firstTime && (count === 1 || count % 5 === 0)) {
            p.then(() => { if (alive) ctx.reward({ sticker: "✏️", reason: { hi: count + " अक्षर लिखना सीखा!", en: "Learnt to write " + count + " letters!" } }); });
          }
          later(() => { busy = false; }, 400);
        }
        /* pointer input */
        const ink = S.ink;
        ink.addEventListener("pointerdown", e => {
          if (busy || finished || pid != null || !S.map) return;
          e.preventDefault();
          try { ink.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
          pid = e.pointerId;
          cur = [S.toUnits(e.clientX, e.clientY)];
          drawInk();
        });
        ink.addEventListener("pointermove", e => {
          if (e.pointerId !== pid || !cur) return;
          e.preventDefault();
          const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
          (evs.length ? evs : [e]).forEach(ev => cur.push(S.toUnits(ev.clientX, ev.clientY)));
          drawInk();
        });
        const up = e => {
          if (e.pointerId !== pid) return;
          pid = null;
          if (!cur) return;
          segs.push(cur);
          cur = null;
          const res = score(segs, ps[k], LV);
          if (res.ok) acceptStroke(false);
          else if (res.reason === "short" && segs.length < 6) drawInk();      // on track: carry on
          else failStroke(res.reason);
        };
        ink.addEventListener("pointerup", up);
        ink.addEventListener("pointercancel", up);
        ink.addEventListener("contextmenu", e => e.preventDefault());

        S.layout();
        later(() => S.layout(), 60);
        const first = { hi: "हरे बिंदु 1 से शुरू करो और तीर के साथ चलो।", en: "Start at the green dot 1 and follow the arrows.", hinglish: "Hare bindu 1 se shuru karo aur teer ke saath chalo." };
        setCap(first);
        if (set.lang === "ui") say({ hi: "चलो " + it.word.hi + " लिखें! " + first.hi, en: "Let's write " + it.word.en + "! " + first.en, hinglish: "Chalo " + it.word.hi + " likhein! " + first.hinglish });
        else sayThen(it.ch, set.lang, first);
      }

      /* ---------- free writing (no checking) ---------- */
      function freeMode(setId, idx) {
        const set = setById(setId);
        const it = idx == null ? null : set.items[((idx % set.items.length) + set.items.length) % set.items.length];
        const w = page("🖍️ " + T({ hi: "खुला लिखो", en: "Free writing", hinglish: "Khula likho" }), () => menu(set.id), true);
        const intro = it
          ? { hi: "जैसे मन करे, " + it.ch + " पर लिखो। कोई जाँच नहीं — बस मज़ा!", en: "Write over " + it.ch + " any way you like. No checking — just fun!", hinglish: "Jaise mann kare, likho. Koi jaanch nahi — bas maza!" }
          : { hi: "खाली स्लेट! जो मन करे, लिखो या बनाओ।", en: "A blank slate! Write or draw anything.", hinglish: "Khaali slate! Jo mann kare, likho ya banao." };
        const stage = el("div", "stage");
        const side = el("div", "side");
        w.append(el("p", "cap", T(intro)), stage, side);
        let color = RAINBOW[3];
        const lines = [];
        let cur = null, pid = null;
        const ps = it ? polys(it) : [];
        const S = surface(stage, () => { drawGuide(); drawInk(); });
        S.ink.setAttribute("aria-label", T({ hi: "लिखने की स्लेट", en: "Writing slate" }));
        S.setBox(it ? frame(ps) : { x: 0, y: 0, size: 100 });
        function drawGuide() {
          if (!S.map) return;
          const g = S.guide.getContext("2d");
          g.clearRect(0, 0, S.size, S.size);
          if (!it) {
            g.save(); g.strokeStyle = "#E3EEF9"; g.lineWidth = 2;
            for (let y = 25; y < 100; y += 25) { const [, py] = S.toPx(0, y); g.beginPath(); g.moveTo(0, py); g.lineTo(S.size, py); g.stroke(); }
            g.restore();
            return;
          }
          ps.forEach(p => line(g, S, p, Math.max(14, S.size * 0.085), "#EEE8F7"));
          ps.forEach(p => line(g, S, p, Math.max(2.5, S.size * 0.012), "#B39DDB", [Math.max(3, S.size * 0.012), Math.max(7, S.size * 0.028)]));
          ps.forEach((p, j) => badge(g, S, p[0], j + 1, Math.max(9, S.size * 0.03), "#B39DDB", false));
        }
        function drawInk() {
          if (!S.map) return;
          const g = S.ink.getContext("2d");
          g.clearRect(0, 0, S.size, S.size);
          const wd = Math.max(7, S.size * 0.045);
          lines.forEach(l => line(g, S, l.p, wd, l.c));
          if (cur) line(g, S, cur.p, wd, cur.c);
        }
        const ink = S.ink;
        ink.addEventListener("pointerdown", e => {
          if (pid != null || !S.map) return;
          e.preventDefault();
          try { ink.setPointerCapture(e.pointerId); } catch (er) { /* fine */ }
          pid = e.pointerId;
          cur = { c: color, p: [S.toUnits(e.clientX, e.clientY)] };
          drawInk();
        });
        ink.addEventListener("pointermove", e => {
          if (e.pointerId !== pid || !cur) return;
          e.preventDefault();
          const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
          (evs.length ? evs : [e]).forEach(ev => cur.p.push(S.toUnits(ev.clientX, ev.clientY)));
          drawInk();
        });
        const up = e => { if (e.pointerId !== pid) return; pid = null; if (cur) { lines.push(cur); if (lines.length > 300) lines.shift(); } cur = null; drawInk(); };
        ink.addEventListener("pointerup", up);
        ink.addEventListener("pointercancel", up);
        ink.addEventListener("contextmenu", e => e.preventDefault());
        /* side: colours, letter picker, clear */
        const sw = el("div", "card pal");
        const swatches = RAINBOW.slice(0, 6).map(c => {
          const b = ctx.button("", P + "-sw", () => { color = c; swatches.forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
          b.style.background = c;
          b.setAttribute("aria-label", T({ hi: "रंग", en: "Colour" }));
          b.setAttribute("aria-pressed", String(c === color));
          return b;
        });
        swatches.forEach(b => sw.appendChild(b));
        const pick = el("div", "card");
        const prev = ctx.button("◀", P + "-rb", () => freeMode(set.id, it ? idx - 1 : set.items.length - 1));
        prev.setAttribute("aria-label", T({ hi: "पिछला अक्षर", en: "Previous letter" }));
        const nxt = ctx.button("▶", P + "-rb", () => freeMode(set.id, it ? idx + 1 : 0));
        nxt.setAttribute("aria-label", T({ hi: "अगला अक्षर", en: "Next letter" }));
        pick.append(prev, el("span", "word", it ? it.ch : "⬜"), nxt);
        const blank = ctx.button("⬜ " + T({ hi: "खाली स्लेट", en: "Blank slate", hinglish: "Khaali slate" }), P + "-btn", () => freeMode(set.id, null));
        const clear = ctx.button("🧽 " + T({ hi: "मिटाओ", en: "Wipe", hinglish: "Mitao" }), P + "-btn", () => { lines.length = 0; drawInk(); });
        clear.dataset.sfx = "whoosh";
        const acts = el("div", "acts");
        acts.append(blank, clear);
        side.append(sw, pick, acts);
        S.layout();
        later(() => S.layout(), 60);
        say(intro);
      }

      const last = ctx.data.get("last", null);
      menu(last && last.set);
      return () => { alive = false; stopAll(); try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    },
  });
})();
