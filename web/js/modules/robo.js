/* नन्हा स्कूल — "रोबो दोस्त" (Robot Friend), section "future" (कल की दुनिया).

   Three games with चिंटू रोबो that quietly prepare children for a world with AI:
     (a) रोबो को सिखाओ  — the child sorts pictures into two baskets; the robot learns from these
         examples (a tiny feature-count model) and guesses new pictures. With few examples it
         makes a mistake ("रोबो ने गलती की! चलो उसे सही करें"); with more it gets better.
         Covert: computers learn from examples; more/better examples → better guesses; AI can be
         wrong or unsure; people check it. 4+ also get "उल्टा-पुल्टा": teach it backwards on purpose
         and watch it learn exactly that (mixed-up examples → wrong answers).
     (b) रास्ता बताओ     — arrow cards make a program that moves the robot on a grid; ▶ runs it
         step by step; a wrong card is found and fixed; 6+ get turns and "2 बार" repeats.
         Covert: instructions, sequences, debugging, loops.
     (c) रोबो से पूछो    — clear vs. vague requests, a robot that miscounts, "robot or grown-up?".
         Covert: good questions, AI is a tool, people come first.
   Content: web/js/content/robo.js (NS.content.robo). Pure logic: NS.future.robo (unit-tested in
   tools/test/future.test.mjs). No timers that pressure, no scores to lose. */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;
  NS.future = NS.future || {};

  /* ---------------- pure logic (no DOM) ---------------- */
  const BANDS = ["2-3", "4-5", "6+"];
  const bandRank = (b) => Math.max(0, BANDS.indexOf(b));

  /* The robot's "brain": for each basket, how often each feature appeared among its examples.
     examples: [{f: [feature…], label}] */
  function train(examples) {
    const m = {};
    (examples || []).forEach((x) => {
      if (!x || !x.label || !Array.isArray(x.f)) return;
      const L = m[x.label] || (m[x.label] = { n: 0, c: {} });
      L.n++;
      x.f.forEach((k) => { L.c[k] = (L.c[k] || 0) + 1; });
    });
    return m;
  }
  /* score(label) = Σ over the picture's features of (examples of label having it) / (examples of label).
     A tie (or nothing learned yet) means "I'm not sure" → label null. */
  function predict(model, f, labels) {
    const scores = {};
    labels.forEach((l) => {
      const L = model[l];
      scores[l] = L && L.n ? (f || []).reduce((a, k) => a + (L.c[k] || 0) / L.n, 0) : 0;
    });
    const order = labels.slice().sort((a, b) => scores[b] - scores[a]);
    const best = order[0], second = order[1];
    const margin = scores[best] - (second == null ? 0 : scores[second]);
    const unsure = !(scores[best] > 0) || margin < 1e-9;
    return { label: unsure ? null : best, scores, margin, sure: !unsure && margin >= 0.5 };
  }
  /* Which feature pushed the guess most (for "…क्योंकि ये मीठा है!"); null if none. */
  function explain(model, f, label, labels) {
    const ratio = (l, k) => { const L = model[l]; return L && L.n ? (L.c[k] || 0) / L.n : 0; };
    let best = null, bestGain = 0;
    (f || []).forEach((k) => {
      const others = labels.filter((l) => l !== label).map((l) => ratio(l, k));
      const gain = ratio(label, k) - (others.length ? Math.max.apply(null, others) : 0);
      if (gain > bestGain + 1e-9) { best = k; bestGain = gain; }
    });
    return best;
  }
  /* Rounds of a teach set for an age band (4+ also get the set's `extra` pictures). */
  function teachPlan(set, band) {
    const older = bandRank(band) >= 1;
    return (set.rounds || []).map((r, i) => {
      const x = older && set.extra && set.extra[i] ? set.extra[i] : { teach: [], test: [] };
      return { teach: r.teach.concat(x.teach || []), test: r.test.concat(x.test || []) };
    });
  }
  /* The set a child meets first: the one made for their band, else the closest easier one. */
  function teachSetFor(sets, band) {
    let pick = null;
    (sets || []).forEach((s) => { if (bandRank(s.level) <= bandRank(band) && (!pick || bandRank(s.level) > bandRank(pick.level))) pick = s; });
    return pick || (sets || [])[0] || null;
  }

  /* Grid: heading 0 = up, 1 = right, 2 = down, 3 = left. */
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const ABS = { up: 0, right: 1, down: 2, left: 3 };
  const MODES = { abs: ["left", "up", "down", "right"], rel: ["tl", "fwd", "tr"] };
  const key = (x, y) => x + "," + y;
  function wallSet(level) { const s = new Set(); (level.walls || []).forEach((w) => s.add(key(w[0], w[1]))); return s; }

  /* program = [{c, n}] (n = repeat 1–3). Checks the cards fit the mode and the limits. */
  function validateProgram(program, mode, opt) {
    opt = opt || {};
    if (!Array.isArray(program) || !program.length) return { ok: false, why: "empty" };
    if (opt.max && program.length > opt.max) return { ok: false, why: "long" };
    const allowed = MODES[mode] || [];
    for (let i = 0; i < program.length; i++) {
      const p = program[i];
      if (!p || allowed.indexOf(p.c) < 0) return { ok: false, why: "card", at: i };
      const n = p.n == null ? 1 : p.n;
      if (!(n === 1 || ((opt.loops) && (n === 2 || n === 3)))) return { ok: false, why: "repeat", at: i };
    }
    return { ok: true };
  }

  /* Runs a program from the level's start. Stops at the goal, at a wall ("bump"), at the edge,
     or when the cards run out ("short"). steps: [{x, y, h, i, ev}] where i = card index. */
  function runProgram(level, size, mode, program) {
    let x = level.start[0], y = level.start[1], h = level.start[2] || 0;
    const walls = wallSet(level);
    const steps = [];
    const atGoal = () => x === level.goal[0] && y === level.goal[1];
    for (let i = 0; i < program.length; i++) {
      const c = program[i].c, n = program[i].n || 1;
      for (let r = 0; r < n; r++) {
        let move = true;
        if (mode === "abs") { if (!(c in ABS)) return { result: "bad", steps, at: i }; h = ABS[c]; }
        else if (c === "tl") { h = (h + 3) % 4; move = false; }
        else if (c === "tr") { h = (h + 1) % 4; move = false; }
        else if (c !== "fwd") return { result: "bad", steps, at: i };
        if (!move) { steps.push({ x, y, h, i, ev: "turn" }); continue; }
        const nx = x + DX[h], ny = y + DY[h];
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) { steps.push({ x, y, h, i, ev: "edge" }); return { result: "edge", steps, at: i }; }
        if (walls.has(key(nx, ny))) { steps.push({ x, y, h, i, ev: "bump", tx: nx, ty: ny }); return { result: "bump", steps, at: i }; }
        x = nx; y = ny;
        steps.push({ x, y, h, i, ev: "move" });
        if (atGoal()) return { result: "goal", steps, at: i, left: program.length - 1 - i };
      }
    }
    return { result: "short", steps, at: program.length, x, y, h };
  }

  /* Shortest list of single cards from a state to the goal (breadth-first search). */
  function solveFrom(level, size, mode, x0, y0, h0) {
    const walls = wallSet(level);
    const cmds = MODES[mode];
    const sk = (x, y, h) => x + "," + y + "," + (mode === "abs" ? 0 : h);
    const seen = new Set([sk(x0, y0, h0)]);
    const q = [{ x: x0, y: y0, h: h0, path: [] }];
    while (q.length) {
      const s = q.shift();
      if (s.x === level.goal[0] && s.y === level.goal[1]) return s.path;
      for (const c of cmds) {
        let { x, y, h } = s;
        if (mode === "abs") h = ABS[c];
        else if (c === "tl") h = (h + 3) % 4;
        else if (c === "tr") h = (h + 1) % 4;
        if (mode === "abs" || c === "fwd") {
          const nx = x + DX[h], ny = y + DY[h];
          if (nx < 0 || ny < 0 || nx >= size || ny >= size || walls.has(key(nx, ny))) continue;
          x = nx; y = ny;
        }
        const k2 = sk(x, y, h);
        if (seen.has(k2)) continue;
        seen.add(k2);
        q.push({ x, y, h, path: s.path.concat(c) });
      }
    }
    return null;
  }
  function solve(level, size, mode) { return solveFrom(level, size, mode, level.start[0], level.start[1], level.start[2] || 0); }
  /* Same cards in a row become one card with a repeat (2–3) when loops are allowed. */
  function compress(cmds, loops) {
    const out = [];
    (cmds || []).forEach((c) => {
      const last = out[out.length - 1];
      if (loops && last && last.c === c && last.n < 3) last.n++;
      else out.push({ c, n: 1 });
    });
    return out;
  }
  /* A gentle next step: {fix: i} (this card makes the robot bump) or {add: cmd} (one more card). */
  function hint(level, size, mode, program) {
    const run = runProgram(level, size, mode, program || []);
    if (run.result === "goal") return null;
    if (run.result !== "short") return { fix: run.at };
    const sol = solveFrom(level, size, mode, run.x, run.y, run.h);
    return sol && sol.length ? { add: sol[0] } : null;
  }
  /* "रोबो से पूछो" rounds for an age band, in content order. */
  function askRounds(list, band) { return (list || []).filter((r) => bandRank(r.level || "2-3") <= bandRank(band)); }

  NS.future.robo = { train, predict, explain, teachPlan, teachSetFor, validateProgram, runProgram, solve, solveFrom, compress, hint, askRounds, MODES, bandRank };

  /* ---------------- fixed spoken lines (also listed for the voice recording script) ---------------- */
  const L = {
    hello: { hi: "नमस्ते! मैं चिंटू हूँ — एक रोबो। मैं मशीन हूँ, पर तुमसे नई चीज़ें सीख सकता हूँ! क्या खेलें — रोबो को सिखाओ, रास्ता बताओ, या रोबो से पूछो?", en: "Hello! I'm Chintu — a robot. I'm a machine, but I can learn new things from you! What shall we play — teach the robot, show the way, or ask the robot?" },
    helloAgain: { hi: "फिर से नमस्ते, दोस्त! आज क्या खेलें — रोबो को सिखाओ, रास्ता बताओ, या रोबो से पूछो?", en: "Hello again, friend! What shall we play today — teach the robot, show the way, or ask the robot?" },
    gTeach: { hi: "रोबो को सिखाओ", en: "Teach the robot" },
    gPath: { hi: "रास्ता बताओ", en: "Show the way" },
    gAsk: { hi: "रोबो से पूछो", en: "Ask the robot" },
    teachIntro: { hi: "मुझे अभी कुछ नहीं पता! तुम मुझे सिखाओगे? हर चीज़ को सही टोकरी में डालो — मैं देखकर सीखूँगा।", en: "I don't know anything yet! Will you teach me? Put each thing in the right basket — I'll learn by watching." },
    which: { hi: "किस टोकरी में?", en: "Which basket?" },
    gotIt: { hi: "बीप! याद कर लिया।", en: "Beep! Got it." },
    thinkAgain: { hi: "हम्म… पक्का? ध्यान से देखो और फिर से सोचो!", en: "Hmm… are you sure? Look carefully and think again!" },
    learning: { hi: "अब मैं सीख रहा हूँ… बीप बूप बीप!", en: "Now I'm learning… beep boop beep!" },
    learned: { hi: "सीख लिया! अब मैं नई चीज़ों का अंदाज़ा लगाऊँगा। तुम जाँचना — मैं सही हूँ या नहीं!", en: "I learned! Now I'll guess new things. You check if I'm right!" },
    thinking: { hi: "हम्म… सोच रहा हूँ…", en: "Hmm… thinking…" },
    unsure: { hi: "हम्म… मुझे पक्का नहीं पता! तुम बताओ, ये किस टोकरी में जाएगा?", en: "Hmm… I'm not sure! You tell me — which basket does it go in?" },
    thanksTold: { hi: "धन्यवाद! अब मुझे पता चल गया।", en: "Thank you! Now I know." },
    judge: { hi: "क्या रोबो ने सही किया?", en: "Did the robot get it right?" },
    yes: { hi: "सही", en: "Right" },
    no: { hi: "गलत", en: "Wrong" },
    botRight: { hi: "हाँ! रोबो ने सही पहचाना।", en: "Yes! The robot got it right." },
    botRightNo: { hi: "ध्यान से देखो — इस बार रोबो सही है! टोकरी ठीक है।", en: "Look carefully — this time the robot is right! The basket is correct." },
    botWrong: { hi: "हाँ! रोबो ने गलती की! चलो उसे सही करें — सही टोकरी दबाओ।", en: "Yes! The robot made a mistake! Let's fix it — tap the right basket." },
    botWrongYes: { hi: "ध्यान से देखो… ये उस टोकरी का नहीं है। रोबो ने गलती की! चलो उसे सही करें — सही टोकरी दबाओ।", en: "Look carefully… it doesn't belong in that basket. The robot made a mistake! Let's fix it — tap the right basket." },
    fixed: { hi: "धन्यवाद! गलती ठीक करने से मैं और अच्छा सीखता हूँ।", en: "Thank you! When you fix my mistakes, I learn better." },
    teachMore: { hi: "और सिखाओ", en: "Teach me more" },
    teachMoreAsk: { hi: "मुझे और चीज़ें दिखाओगे? ज़्यादा देखूँगा, तो ज़्यादा सीखूँगा!", en: "Will you show me more things? The more I see, the more I learn!" },
    better: { hi: "देखा? तुमने ज़्यादा चीज़ें दिखाईं, तो रोबो ने ज़्यादा सही पहचाना!", en: "See? You showed more things, so the robot guessed better!" },
    lesson: { hi: "याद रखो: रोबो चीज़ें देखकर सीखता है — पर वो गलती भी कर सकता है। इसलिए हम हमेशा जाँचते हैं!", en: "Remember: a robot learns by looking at examples — but it can make mistakes too. That's why we always check!" },
    newGame: { hi: "नया खेल", en: "New game" },
    mixBtn: { hi: "उल्टा-पुल्टा खेल", en: "Mix-up game" },
    mixIntro: { hi: "चलो, एक शरारत करें! इस बार रोबो को उल्टा सिखाओ — हर चीज़ को दूसरी टोकरी में डालो!", en: "Let's play a trick! This time teach the robot backwards — put each thing in the other basket!" },
    mixWhich: { hi: "उल्टी टोकरी में डालो!", en: "Put it in the wrong basket!" },
    mixNo: { hi: "अरे, आज तो उल्टा खेल है! दूसरी टोकरी दबाओ!", en: "Oh, today is mix-up day! Tap the other basket!" },
    mixLesson: { hi: "देखा? रोबो ने वही सीखा जो हमने सिखाया — उल्टा! गलत सिखाओगे, तो रोबो भी गलत सीखेगा। इसलिए रोबो को सही-सही सिखाना ज़रूरी है।", en: "See? The robot learned exactly what we taught it — backwards! Teach it wrong, and it learns wrong. That's why we must teach robots carefully." },
    games: { hi: "रोबो के खेल", en: "Robot games" },
    pathIntro: { hi: "तीर वाले कार्ड चुनो, फिर हरा बटन दबाओ। रोबो वही करेगा जो तुम बताओगे!", en: "Pick arrow cards, then press the green button. The robot will do exactly what you say!" },
    pathIntroRel: { hi: "रोबो जिधर देख रहा है, आगे उधर ही जाता है। मुड़ने वाले कार्ड से वो घूमता है।", en: "Forward means the way the robot is facing. The turn cards make it turn." },
    run: { hi: "चलाओ", en: "Go" },
    undo: { hi: "आखिरी कार्ड हटाओ", en: "Remove last card" },
    clear: { hi: "सारे कार्ड हटाओ", en: "Remove all cards" },
    hintBtn: { hi: "मदद", en: "Help" },
    repeat: { hi: "दोहराओ", en: "Repeat" },
    repeatSay: { hi: "आखिरी कार्ड अब ज़्यादा बार चलेगा!", en: "The last card will now repeat!" },
    needCard: { hi: "पहले कोई तीर वाला कार्ड चुनो!", en: "First pick an arrow card!" },
    tooMany: { hi: "बस! इतने कार्ड काफ़ी हैं। अब चलाकर देखो।", en: "That's enough cards! Now press go and see." },
    removed: { hi: "कार्ड हटा दिया।", en: "Card removed." },
    bump: { hi: "ओह! रोबो पेड़ से टकरा गया! कोई बात नहीं — लाल कार्ड को छूकर हटाओ और फिर से चलाओ।", en: "Oops! The robot bumped into a tree! No problem — tap the red card to remove it, then try again." },
    edge: { hi: "ओह! आगे रास्ता ही नहीं है! लाल कार्ड को छूकर हटाओ और फिर से चलाओ।", en: "Oops! There's no path that way! Tap the red card to remove it, then try again." },
    short: { hi: "रोबो रुक गया — पर अभी पहुँचा नहीं! और कार्ड जोड़ो, फिर चलाओ।", en: "The robot stopped — but it isn't there yet! Add more cards, then press go." },
    goal: { hi: "पहुँच गया! शाबाश! तुमने रोबो को एक-एक करके सही रास्ता बताया।", en: "It got there! Well done! You told the robot the way, step by step." },
    fixIt: { hi: "ये कार्ड रोबो को गलत ले जाता है। इसे छूकर हटाओ!", en: "This card takes the robot the wrong way. Tap it to remove it!" },
    nextLevel: { hi: "अगला रास्ता", en: "Next path" },
    again: { hi: "फिर से", en: "Again" },
    allPaths: { hi: "वाह! तुमने सारे रास्ते बता दिए! गलती ढूँढकर ठीक करना — ये बहुत बड़ा काम है।", en: "Wow! You solved every path! Finding and fixing mistakes is a very big skill." },
    askThanks: { hi: "धन्यवाद! तुमने साफ़-साफ़ बताया, तो मैंने सही चीज़ दी।", en: "Thank you! You asked clearly, so I gave you the right thing." },
    askVague: { hi: "उफ़! मैं समझ नहीं पाया, तो मैंने गलत चीज़ दे दी। साफ़-साफ़ बोलो — कौन-सी चीज़, कैसी चीज़!", en: "Oops! I didn't understand, so I gave the wrong thing. Say it clearly — which thing, what kind!" },
    drawVague: { hi: "मैंने कुछ बना दिया… पर क्या ये तुम्हें चाहिए था? साफ़ बताओ क्या बनाना है!", en: "I drew something… but is it what you wanted? Tell me clearly what to draw!" },
    drawClear: { hi: "ये लो! तुमने साफ़ बताया, तो सही चित्र बना!", en: "Here you go! You said it clearly, so the picture came out right!" },
    howAsk: { hi: "कैसे बोलोगे? दबाओ!", en: "How will you say it? Tap!" },
    notPerson: { hi: "मैं तो मशीन हूँ! चोट, डर या उदासी की बात बड़ों से कहो — वो सच में मदद करते हैं।", en: "I'm just a machine! Tell a grown-up when you're hurt, scared or sad — they can really help." },
    robotWrongPick: { hi: "नहीं-नहीं! मुझे खाना नहीं चाहिए। मैं मशीन हूँ, बिजली से चलता हूँ!", en: "No, no! I don't eat food. I'm a machine — I run on electricity!" },
    next: { hi: "आगे", en: "Next" },
    askEnd: { hi: "आज तुमने सीखा: साफ़-साफ़ पूछो, रोबो की बात जाँचो, और दिल की बात बड़ों से कहो!", en: "Today you learned: ask clearly, check what the robot says, and share your feelings with grown-ups!" },
    askClear: { hi: "साफ़ पूछो", en: "Ask clearly" },
    askCheck: { hi: "जाँचो", en: "Check" },
    askGrown: { hi: "बड़ों से कहो", en: "Tell grown-ups" },
    stTeach: { hi: "रोबो को सिखाया!", en: "Taught the robot!" },
    stPath: { hi: "रोबो को रास्ता बताया!", en: "Showed the robot the way!" },
    stAsk: { hi: "साफ़-साफ़ पूछा!", en: "Asked clearly!" },
    or: { hi: "या", en: "or" },
    back: { hi: "वापस", en: "Back" },
    hear: { hi: "फिर से सुनो", en: "Hear again" },
  };
  const LABEL_ONLY = ["gTeach", "gPath", "gAsk", "yes", "no", "teachMore", "newGame", "mixBtn", "games", "run", "undo", "clear", "hintBtn", "repeat", "nextLevel", "again", "next", "askClear", "askCheck", "askGrown", "stTeach", "stPath", "stAsk", "back", "hear"];
  NS.voiceLines = (NS.voiceLines || []).concat(Object.keys(L).filter((k) => LABEL_ONLY.indexOf(k) < 0).reduce((a, k) => a.concat([
    { lang: "hi", text: L[k].hi, section: "robo" }, { lang: "en", text: L[k].en, section: "robo" }]), []));

  /* ---------------- look: one injected stylesheet, every class prefixed "robo-" ---------------- */
  const CSS = `
.robo-wrap{display:flex;flex-direction:column;gap:12px;width:100%;max-width:760px;margin:0 auto;box-sizing:border-box}
.robo-bar{display:flex;align-items:center;gap:8px}
.robo-rb{width:56px;height:56px;border-radius:50%;border:none;background:#fff;color:#2D2A32;box-shadow:0 3px 0 rgba(0,0,0,.12);font-size:24px;display:grid;place-items:center;flex:0 0 auto;padding:0;cursor:pointer;touch-action:manipulation}
.robo-bartitle{flex:1;min-width:0;text-align:center;font-weight:800;font-size:clamp(18px,5vw,24px);line-height:1.2;color:var(--ink,#2D2A32)}
.robo-hero{display:flex;align-items:center;gap:10px}
.robo-bot{width:clamp(78px,22vw,124px);height:auto;flex:0 0 auto;overflow:visible}
.robo-big .robo-bot{width:clamp(120px,36vw,180px)}
.robo-small .robo-bot{width:clamp(54px,15vw,76px)}
.robo-small .robo-bubble{font-size:clamp(15px,4vw,19px);padding:8px 12px}
.robo-bubble{position:relative;flex:1;min-width:0;background:#fff;color:#2D2A32;border-radius:20px;padding:10px 14px;margin-left:8px;font-weight:700;font-size:clamp(16px,4.4vw,21px);line-height:1.35;box-shadow:0 3px 0 rgba(0,0,0,.08)}
.robo-bubble::before{content:"";position:absolute;left:-12px;top:50%;margin-top:-10px;border-style:solid;border-width:10px 12px 10px 0;border-color:transparent #fff transparent transparent}
.robo-bulb{fill:#FFD54F;transition:fill .3s}
.robo-m{display:none}
.robo-mood-happy .robo-m-happy,.robo-mood-proud .robo-m-happy,.robo-mood-wow .robo-m-oh,.robo-mood-learn .robo-m-oh,.robo-mood-think .robo-m-think,.robo-mood-oops .robo-m-oops{display:inline}
.robo-drop,.robo-gear,.robo-q{display:none}
.robo-mood-oops .robo-drop,.robo-mood-learn .robo-gear,.robo-mood-think .robo-q{display:inline}
.robo-mood-think .robo-bulb{animation:robo-blink .5s ease-in-out infinite alternate}
.robo-mood-learn .robo-bulb{fill:#69F0AE;animation:robo-blink .3s ease-in-out infinite alternate}
.robo-mood-oops .robo-bulb{fill:#FF8A80}
.robo-mood-learn .robo-dot{animation:robo-blink .4s ease-in-out infinite alternate}
.robo-mood-learn .robo-dot:nth-child(2){animation-delay:.13s}.robo-mood-learn .robo-dot:nth-child(3){animation-delay:.26s}
.robo-gear{transform-box:fill-box;transform-origin:center;animation:robo-spin 1.4s linear infinite}
.robo-eyes{transform-box:fill-box;transform-origin:center;animation:robo-eyeblink 4.5s infinite}
.robo-mood-happy .robo-arm-r,.robo-mood-proud .robo-arm-r{transform-box:fill-box;transform-origin:0% 100%;animation:robo-wave .6s ease-in-out 4 alternate}
.robo-talk .robo-mouths{transform-box:fill-box;transform-origin:center;animation:robo-talk .2s ease-in-out infinite alternate}
@keyframes robo-blink{from{opacity:1}to{opacity:.35}}
@keyframes robo-spin{to{transform:rotate(360deg)}}
@keyframes robo-eyeblink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes robo-wave{from{transform:rotate(0)}to{transform:rotate(-24deg)}}
@keyframes robo-talk{from{transform:scaleY(1)}to{transform:scaleY(.55)}}
.robo-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.robo-tile{border:none;border-radius:24px;min-height:130px;padding:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font:inherit;color:#2D2A32;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.10);touch-action:manipulation}
.robo-tile-e{font-size:clamp(42px,12vw,58px);line-height:1}
.robo-tile-t{font-size:clamp(17px,4.8vw,21px);font-weight:800;text-align:center}
.robo-btn{border:none;border-radius:18px;padding:12px 18px;min-height:56px;font:inherit;font-weight:800;font-size:clamp(17px,4.6vw,22px);color:#fff;background:#2EAD6B;box-shadow:0 4px 0 rgba(0,0,0,.15);cursor:pointer;touch-action:manipulation}
.robo-btn:disabled{opacity:.45;cursor:default}
.robo-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}
.robo-row>.robo-btn{flex:1 1 140px}
.robo-item{align-self:center;display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff;color:#2D2A32;border-radius:24px;padding:10px 26px;min-width:150px;box-shadow:0 4px 0 rgba(0,0,0,.08);position:relative}
.robo-item-e{font-size:clamp(56px,17vw,84px);line-height:1.1}
.robo-item-n{font-size:clamp(17px,4.6vw,21px);font-weight:800}
.robo-chip{margin-top:4px;background:#EDE7F6;color:#4527A0;border-radius:999px;padding:2px 12px;font-size:clamp(20px,6vw,26px);font-weight:800}
.robo-qmark{position:absolute;top:-10px;right:-10px;background:#7E57C2;color:#fff;border-radius:50%;width:36px;height:36px;display:grid;place-items:center;font-weight:800;font-size:22px}
.robo-baskets{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.robo-basket{border:4px solid transparent;border-radius:22px;padding:8px;min-height:130px;display:flex;flex-direction:column;align-items:center;gap:6px;font:inherit;cursor:pointer;color:#2D2A32;box-shadow:0 4px 0 rgba(0,0,0,.10);touch-action:manipulation;min-width:0}
.robo-basket-h{display:flex;align-items:center;gap:6px;font-weight:800;font-size:clamp(15px,4.2vw,20px);text-align:center;line-height:1.15}
.robo-basket-h span:first-child{font-size:clamp(24px,7vw,32px)}
.robo-pile{display:flex;flex-wrap:wrap;justify-content:center;gap:2px;font-size:clamp(22px,6.5vw,30px);line-height:1.1;min-height:34px}
.robo-pile span{display:inline-block}
.robo-guess{outline:5px dashed #7E57C2;outline-offset:2px}
.robo-tries{display:flex;justify-content:center;gap:6px;font-size:26px;min-height:32px;flex-wrap:wrap}
.robo-sum{background:#fff;color:#2D2A32;border-radius:20px;padding:12px;display:flex;flex-direction:column;gap:6px;align-items:center;box-shadow:0 3px 0 rgba(0,0,0,.08)}
.robo-sum-row{display:flex;align-items:center;gap:8px;font-weight:800;font-size:clamp(16px,4.4vw,20px)}
.robo-board{position:relative;align-self:center;width:min(100%,var(--robo-bw,380px),max(230px,calc(100vh - 470px)));width:min(100%,var(--robo-bw,380px),max(230px,calc(100dvh - 470px)));aspect-ratio:1/1;display:grid;gap:4px;padding:6px;background:#C8E6C9;border-radius:18px;box-shadow:inset 0 0 0 3px #A5D6A7;box-sizing:border-box}
.robo-cell{background:#F1F8E9;border-radius:10px;display:grid;place-items:center;font-size:var(--robo-cf,30px);line-height:1;min-width:0;min-height:0}
.robo-mini{position:absolute;display:grid;place-items:center;transition:left .42s ease,top .42s ease;pointer-events:none;z-index:2}
.robo-got{position:absolute;right:-8%;top:-14%;font-size:var(--robo-cf,30px);line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}
.robo-mini svg{width:78%;height:78%;transition:transform .35s ease}
.robo-prog{display:flex;flex-wrap:wrap;gap:10px;min-height:66px;padding:6px;border:3px dashed #B0BEC5;border-radius:18px;background:rgba(255,255,255,.6);align-items:center}
.robo-prog-empty{color:#78909C;font-weight:700;font-size:clamp(15px,4vw,18px);padding:0 6px}
.robo-card{position:relative;border:none;border-radius:14px;width:56px;height:56px;padding:0;display:grid;place-items:center;color:#fff;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.18);touch-action:manipulation;flex:0 0 auto}
.robo-card svg{width:34px;height:34px}
.robo-card-now{outline:4px solid #FFD54F;outline-offset:2px;transform:translateY(-3px)}
.robo-card-bad{outline:4px solid #E53935;outline-offset:2px}
.robo-card-hint{animation:robo-hint .9s ease-out 4}
@keyframes robo-hint{from{box-shadow:0 3px 0 rgba(0,0,0,.18),0 0 0 0 rgba(255,213,79,.95)}to{box-shadow:0 3px 0 rgba(0,0,0,.18),0 0 0 14px rgba(255,213,79,0)}}
.robo-badge{position:absolute;right:-6px;top:-8px;background:#FFD54F;color:#2D2A32;border-radius:10px;font-weight:800;font-size:14px;padding:0 5px;line-height:20px}
@keyframes robo-pulse{from{transform:scale(1)}to{transform:scale(1.15)}}
.robo-pal{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
.robo-pal .robo-card{width:clamp(58px,17vw,74px);height:clamp(64px,18vw,82px);flex-direction:column;display:flex;align-items:center;justify-content:center;gap:0}
.robo-pal .robo-card svg{width:clamp(30px,9vw,40px);height:clamp(30px,9vw,40px)}
.robo-cardlbl{font-size:13px;font-weight:800;line-height:1.1;text-align:center;padding:0 2px}
.robo-ctl{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.robo-ctl .robo-rb{width:56px;height:56px}
.robo-go{min-width:120px}
.robo-scene{background:#fff;color:#2D2A32;border-radius:22px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 3px 0 rgba(0,0,0,.08)}
.robo-shelf{display:flex;gap:10px;align-items:center;justify-content:center;font-size:clamp(40px,12vw,56px);line-height:1.1;background:#FFF3E0;border-radius:16px;padding:6px 14px;border-bottom:6px solid #BCAAA4}
.robo-shelf span{display:inline-block;border-radius:12px;padding:2px}
.robo-shelf .robo-picked{background:#C8E6C9;outline:3px solid #2EAD6B}
.robo-shelf .robo-wrong{background:#FFCDD2;outline:3px solid #E53935}
.robo-need{font-size:clamp(17px,4.6vw,21px);font-weight:800;display:flex;align-items:center;gap:6px}
.robo-need b{font-size:clamp(34px,10vw,46px)}
.robo-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.robo-opt{border:3px solid #E0E0E0;border-radius:22px;background:#fff;color:#2D2A32;padding:10px;min-height:110px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;font:inherit;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.08);touch-action:manipulation}
.robo-opt-p{font-size:clamp(34px,10vw,46px);line-height:1.1}
.robo-opt-t{font-size:clamp(15px,4.2vw,19px);font-weight:800;text-align:center;line-height:1.25}
.robo-opt-ok{border-color:#2EAD6B;background:#E8F5E9}
.robo-opt-no{border-color:#E57373;background:#FFEBEE;opacity:.75}
.robo-canvas{width:min(100%,280px);aspect-ratio:4/3;background:#1F2A44;border-radius:16px;border:6px solid #5EC8F2;position:relative;overflow:hidden}
.robo-canvas span{position:absolute;line-height:1;transform:translate(-50%,-50%)}
.robo-show{font-size:clamp(48px,15vw,72px);line-height:1.1;letter-spacing:4px}
.robo-fly{position:fixed;z-index:50;pointer-events:none;line-height:1}
.robo-tile-e,.robo-item-e,.robo-pile,.robo-basket-h span:first-child,.robo-shelf,.robo-need b,.robo-opt-p,.robo-canvas span,.robo-show,.robo-cell,.robo-fly,.robo-got,.robo-tries{font-family:"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",var(--font,sans-serif)}
.robo-pile .pic-img,.robo-shelf .pic-img,.robo-cell .pic-img,.robo-got .pic-img{width:1.15em}
.robo-basket-h .pic-img{width:1.1em}
@media (prefers-reduced-motion: reduce){.robo-bot *,.robo-card-hint{animation:none!important}.robo-mini,.robo-got{position:absolute;right:-8%;top:-14%;font-size:var(--robo-cf,30px);line-height:1;filter:drop-shadow(0 2px 2px rgba(0,0,0,.25))}
.robo-mini svg{transition:none}}
`;
  function injectCSS() {
    if (document.getElementById("robo-css")) return;
    const s = document.createElement("style");
    s.id = "robo-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------------- चिंटू रोबो (inline SVG) ---------------- */
  const S = (tag, attrs, kids) => NS.svg(tag, attrs, kids);
  function robot(mood) {
    const eye = (cx) => S("g", {}, [S("circle", { cx, cy: 52, r: 8.5, fill: "#1F2A44" }), S("circle", { cx: cx - 2.6, cy: 49.4, r: 2.6, fill: "#fff" })]);
    const svg = S("svg", { viewBox: "0 0 120 142", class: "robo-bot robo-mood-" + (mood || "happy"), "aria-hidden": "true", focusable: "false" }, [
      S("line", { x1: 60, y1: 21, x2: 60, y2: 10, stroke: "#2B8BC6", "stroke-width": 4, "stroke-linecap": "round" }),
      S("circle", { cx: 60, cy: 8, r: 7, class: "robo-bulb" }),
      S("rect", { x: 7, y: 42, width: 12, height: 22, rx: 5, fill: "#FFB74D" }),
      S("rect", { x: 101, y: 42, width: 12, height: 22, rx: 5, fill: "#FFB74D" }),
      S("rect", { x: 16, y: 20, width: 88, height: 66, rx: 24, fill: "#5EC8F2", stroke: "#2B8BC6", "stroke-width": 3 }),
      S("rect", { x: 27, y: 31, width: 66, height: 45, rx: 17, fill: "#EAF8FF" }),
      S("g", { class: "robo-eyes" }, [eye(46), eye(74)]),
      S("circle", { cx: 35, cy: 64, r: 4.5, fill: "#FF9EB5", opacity: ".75" }),
      S("circle", { cx: 85, cy: 64, r: 4.5, fill: "#FF9EB5", opacity: ".75" }),
      S("g", { class: "robo-mouths" }, [
        S("path", { class: "robo-m robo-m-happy", d: "M49 63 Q60 74 71 63", stroke: "#1F2A44", "stroke-width": 3.5, fill: "none", "stroke-linecap": "round" }),
        S("ellipse", { class: "robo-m robo-m-oh", cx: 60, cy: 67, rx: 5, ry: 6, fill: "#1F2A44" }),
        S("path", { class: "robo-m robo-m-oops", d: "M48 68 Q54 62 60 68 Q66 74 72 68", stroke: "#1F2A44", "stroke-width": 3.5, fill: "none", "stroke-linecap": "round" }),
        S("path", { class: "robo-m robo-m-think", d: "M51 67 L69 65", stroke: "#1F2A44", "stroke-width": 3.5, fill: "none", "stroke-linecap": "round" }),
      ]),
      S("path", { class: "robo-drop", d: "M100 26 Q106 36 100 40 Q94 36 100 26 Z", fill: "#64B5F6" }),
      S("text", { class: "robo-q", x: 98, y: 20, "font-size": 22, "font-weight": 800, fill: "#7E57C2" }),
      S("path", { class: "robo-arm robo-arm-l", d: "M34 100 Q21 105 18 118", stroke: "#2B8BC6", "stroke-width": 7, fill: "none", "stroke-linecap": "round" }),
      S("path", { class: "robo-arm robo-arm-r", d: "M86 100 Q99 95 103 83", stroke: "#2B8BC6", "stroke-width": 7, fill: "none", "stroke-linecap": "round" }),
      S("rect", { x: 32, y: 89, width: 56, height: 40, rx: 14, fill: "#5EC8F2", stroke: "#2B8BC6", "stroke-width": 3 }),
      S("rect", { x: 43, y: 97, width: 34, height: 21, rx: 6, fill: "#1F2A44" }),
      S("g", {}, [S("circle", { class: "robo-dot", cx: 51, cy: 107.5, r: 3, fill: "#69F0AE" }), S("circle", { class: "robo-dot", cx: 60, cy: 107.5, r: 3, fill: "#FFD54F" }), S("circle", { class: "robo-dot", cx: 69, cy: 107.5, r: 3, fill: "#FF8A80" })]),
      S("ellipse", { cx: 46, cy: 134, rx: 10, ry: 6.5, fill: "#37474F" }),
      S("ellipse", { cx: 74, cy: 134, rx: 10, ry: 6.5, fill: "#37474F" }),
      S("g", { class: "robo-gear" }, [S("circle", { cx: 98, cy: 16, r: 8, fill: "none", stroke: "#7E57C2", "stroke-width": 5, "stroke-dasharray": "4 3" }), S("circle", { cx: 98, cy: 16, r: 3, fill: "#7E57C2" })]),
    ]);
    svg.querySelector(".robo-q").textContent = "?";
    return svg;
  }
  function mood(svg, m) { if (svg) svg.setAttribute("class", "robo-bot robo-mood-" + m); }
  /* the small top-down robot on the grid; its nose points the way it faces */
  function miniBot() {
    return S("svg", { viewBox: "0 0 40 40", "aria-hidden": "true", focusable: "false" }, [
      S("rect", { x: 2, y: 11, width: 6, height: 19, rx: 3, fill: "#37474F" }),
      S("rect", { x: 32, y: 11, width: 6, height: 19, rx: 3, fill: "#37474F" }),
      S("rect", { x: 7, y: 7, width: 26, height: 28, rx: 10, fill: "#5EC8F2", stroke: "#2B8BC6", "stroke-width": 2.5 }),
      S("path", { d: "M20 0 L26 7 H14 Z", fill: "#FF7043" }),
      S("circle", { cx: 15, cy: 15, r: 3.6, fill: "#1F2A44" }),
      S("circle", { cx: 25, cy: 15, r: 3.6, fill: "#1F2A44" }),
      S("circle", { cx: 14, cy: 14, r: 1.2, fill: "#fff" }),
      S("circle", { cx: 24, cy: 14, r: 1.2, fill: "#fff" }),
      S("path", { d: "M15 24 Q20 28 25 24", stroke: "#1F2A44", "stroke-width": 2, fill: "none", "stroke-linecap": "round" }),
    ]);
  }
  const CARD_COLOR = { up: "#1E88E5", down: "#8E24AA", left: "#F4511E", right: "#2E9D4A", fwd: "#1E88E5", tl: "#F4511E", tr: "#2E9D4A" };
  function cardIcon(c) {
    const st = { stroke: "currentColor", "stroke-width": 3, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" };
    const rot = { up: 0, right: 90, down: 180, left: 270, fwd: 0 };
    let d;
    if (c === "tl") d = "M16 21 V13 Q16 8 11 8 H5 M9 4 L5 8 L9 12";
    else if (c === "tr") d = "M8 21 V13 Q8 8 13 8 H19 M15 4 L19 8 L15 12";
    else d = "M12 20 V5 M6 11 L12 5 L18 11";
    const p = S("path", Object.assign({ d }, st));
    if (rot[c]) p.setAttribute("transform", "rotate(" + rot[c] + " 12 12)");
    return S("svg", { viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" }, [p]);
  }

  /* ---------------- small UI kit ---------------- */
  function kit(ctx) {
    const timers = new Set();
    let gen = 0, last = "";
    const T = (o) => (o == null ? "" : typeof o === "string" ? o : (ctx.t(o) || o.hi || o.en || ""));
    const el = (tag, c, text) => ctx.el(tag, c ? c.split(" ").map((x) => "robo-" + x).join(" ") : "", text == null ? null : String(text));
    /* o: {hi, en} or a list of them — a list is spoken line by line, so each fixed line can
       use its recorded clip */
    const say = (o) => {
      const list = (Array.isArray(o) ? o : [o]).map(T).filter(Boolean);
      last = list;
      try { ctx.stopVoice(); } catch (e) { /* ignore */ }
      return Promise.resolve().then(() => (list.length > 1 ? ctx.sayLines(list) : ctx.say(list[0] || ""))).catch(() => {});
    };
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    const wait = (ms) => new Promise((res) => later(res, ms));
    const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const anim = (e, frames, opt) => { if (reduced || !e || !e.animate) return null; try { return e.animate(frames, opt); } catch (er) { return null; } };
    const pop = (e, big) => anim(e, [{ transform: "scale(1)" }, { transform: "scale(" + (big ? 1.25 : 1.12) + ")" }, { transform: "scale(1)" }], { duration: 420, easing: "ease-out" });
    const wiggle = (e) => anim(e, [{ transform: "rotate(0)" }, { transform: "rotate(-5deg)" }, { transform: "rotate(5deg)" }, { transform: "rotate(0)" }], { duration: 360 });
    const sfx = (n) => { try { if (NS.sfx && typeof NS.sfx.play === "function") NS.sfx.play(n); } catch (e) { /* ignore */ } };
    const buzz = (k) => { try { if (NS.native && NS.native.available) NS.native.call("vibrate", k); } catch (e) { /* ignore */ } };
    /* a realistic picture of an emoji when the core has one (NS.picture), else the emoji itself */
    const pic = (e, alt) => (typeof NS.picture === "function" ? NS.picture(e, { alt: alt || "", size: 96, eager: true }) : document.createTextNode(e));
    const picEl = (tag, c, e, alt) => { const x = el(tag, c); x.appendChild(pic(e, alt)); return x; };
    const age = () => ((ctx.profile && ctx.profile.ageBand) || "4-5");
    const btn = (label, c, onTap, aria) => {
      const b = ctx.button(label, "robo-btn" + (c ? " " + c.split(" ").map((x) => "robo-" + x).join(" ") : ""), onTap, aria);
      return b;
    };
    const round = (icon, label, onTap) => {
      const b = el("button", "rb", icon);
      b.type = "button";
      b.setAttribute("aria-label", T(label));
      b.addEventListener("click", onTap);
      return b;
    };
    /* each screen: clears pending timers, bumps the generation (stale async steps stop) */
    const page = (title, onBack) => {
      for (const id of timers) clearTimeout(id);
      timers.clear();
      gen++;
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
    const live = () => { const g = gen; return () => g === gen && ctx.screen.isConnected; };
    /* robot + speech bubble; talk(text) shows, speaks and moves the mouth */
    const hero = (m, size) => {
      const row = el("div", "hero" + (size === true ? " big" : size === "small" ? " small" : ""));
      const bot = robot(m || "happy");
      const bubble = el("div", "bubble");
      bubble.setAttribute("aria-live", "polite");
      row.append(bot, bubble);
      /* shown: optional text for the bubble when it should differ from the spoken lines */
      const talk = (o, mo, shown) => {
        if (mo) mood(bot, mo);
        bubble.textContent = shown != null ? shown : (Array.isArray(o) ? o : [o]).map(T).join(" ");
        bot.classList.add("robo-talk");
        const p = say(o);
        p.then(() => bot.classList.remove("robo-talk"));
        return p;
      };
      return { row, bot, bubble, talk, mood: (x) => mood(bot, x) };
    };
    /* an emoji flying from one element to another (pure decoration) */
    const fly = (text, from, to, ms) => {
      if (reduced || !from || !to || !from.getBoundingClientRect) return Promise.resolve();
      const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
      const f = el("span", "fly", text);
      f.style.left = a.left + a.width / 2 + "px";
      f.style.top = a.top + a.height / 2 + "px";
      f.style.fontSize = "40px";
      f.style.transform = "translate(-50%,-50%)";
      ctx.screen.appendChild(f);
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      const an = anim(f, [{ transform: "translate(-50%,-50%) scale(1)" }, { transform: "translate(calc(-50% + " + dx + "px), calc(-50% + " + dy + "px)) scale(.5)", opacity: 0.6 }], { duration: ms || 520, easing: "ease-in" });
      return new Promise((res) => { const done = () => { f.remove(); res(); }; if (an) an.onfinish = done; else done(); later(done, (ms || 520) + 200); });
    };
    const cleanup = () => { for (const id of timers) clearTimeout(id); timers.clear(); gen++; try { ctx.stopVoice(); } catch (e) { /* ignore */ } };
    return { T, el, say, later, wait, pop, wiggle, sfx, buzz, pic, picEl, age, btn, round, page, live, hero, fly, cleanup, reduced, anim };
  }

  /* ---------------- the activity ---------------- */
  NS.registerActivity({
    id: "robo",
    icon: "🤖",
    title: { hi: "रोबो दोस्त", en: "Robot Friend", hinglish: "Robo Dost" },
    color: "#2F80ED",
    section: "future",
    free: false,
    order: 10,
    open(ctx) {
      injectCSS();
      const R = (NS.content && NS.content.robo) || { teach: [], paths: {}, ask: [], cards: {}, features: {}, prizes: {} };
      const k = kit(ctx);
      const { T, el, say, wait, pop, wiggle, sfx, buzz, pic, picEl, age, btn, page, live, hero, fly } = k;
      const once = (key, sticker, reason, after) => {
        const got = ctx.data.get("stickers", {}) || {};
        if (got[key]) return;
        got[key] = true;
        ctx.data.set("stickers", got);
        const go = () => ctx.reward({ sticker, reason: T(reason) });
        if (after && after.then) after.then(go); else go();
      };
      const nameOf = (o) => T(o);

      /* ---------- menu ---------- */
      function menu() {
        const w = page(null);
        const h = hero("happy", true);
        w.appendChild(h.row);
        const tiles = el("div", "tiles");
        [
          { e: "🧺", t: L.gTeach, c: "#FFE0B2", go: () => teachGame() },
          { e: "🗺️", t: L.gPath, c: "#C8E6C9", go: () => pathGame() },
          { e: "💬", t: L.gAsk, c: "#BBDEFB", go: () => askGame(0) },
        ].forEach((g) => {
          const b = el("button", "tile");
          b.type = "button";
          b.style.background = g.c;
          b.setAttribute("aria-label", T(g.t));
          b.append(picEl("span", "tile-e", g.e), el("span", "tile-t", T(g.t)));
          b.addEventListener("click", () => g.go());
          tiles.appendChild(b);
        });
        w.appendChild(tiles);
        const met = ctx.data.get("met", false);
        if (!met) ctx.data.set("met", true);
        h.talk(met ? L.helloAgain : L.hello);
      }

      /* ---------- (a) teach the robot ---------- */
      function teachGame(setId) {
        const sets = R.teach || [];
        if (!sets.length) return menu();
        let set = setId ? sets.find((s) => s.id === setId) : null;
        if (!set) {
          const played = ctx.data.get("teachPlayed", []) || [];
          const first = teachSetFor(sets, age());
          set = first && played.indexOf(first.id) < 0 ? first : sets.filter((s) => bandRank(s.level) <= bandRank(age()) + 1).find((s) => played.indexOf(s.id) < 0) || first;
        }
        const plan = teachPlan(set, age());
        const items = {};
        set.items.forEach((it) => { items[it.id] = it; });
        const labels = set.baskets.map((b) => b.id);
        const older = bandRank(age()) >= 1;
        const w = page(set.icon + " " + T(set.title), menu);
        const ok = live();
        const h = hero("happy");
        w.appendChild(h.row);
        const stage = el("div", "item");
        stage.style.visibility = "hidden";
        const stE = el("div", "item-e", "");
        const stN = el("div", "item-n", "");
        const qm = el("div", "qmark", "?");
        qm.hidden = true;
        const chip = el("div", "chip", "");
        chip.hidden = true;
        stage.append(stE, stN, chip, qm);
        w.appendChild(stage);
        const ctrl = el("div", "row");
        w.appendChild(ctrl);
        const bwrap = el("div", "baskets");
        const bEls = {}, piles = {};
        let pickBasket = null;
        set.baskets.forEach((b) => {
          const bt = el("button", "basket");
          bt.type = "button";
          bt.style.background = b.soft;
          bt.style.borderColor = b.color;
          bt.setAttribute("aria-label", T(b));
          bt.dataset.sfx = "none";            /* it answers with its own pop / tryagain */
          const hd = el("div", "basket-h");
          hd.append(picEl("span", null, b.e), el("span", null, T(b)));
          hd.style.color = b.color;
          const pile = el("div", "pile");
          bt.append(hd, pile);
          bt.addEventListener("click", () => { if (pickBasket) pickBasket(b.id); });
          bEls[b.id] = bt;
          piles[b.id] = pile;
          bwrap.appendChild(bt);
        });
        w.appendChild(bwrap);
        const tries = el("div", "tries");
        w.appendChild(tries);

        const examples = [];
        const results = [];
        const show = (it, q) => {
          stage.style.visibility = "visible";
          stE.replaceChildren(pic(it.e, nameOf(it)));
          stE.style.fontSize = "";
          stN.textContent = nameOf(it);
          qm.hidden = !q;
          chip.hidden = true;
          pop(stage);
        };
        const askBasket = () => new Promise((res) => { pickBasket = (id) => { pickBasket = null; res(id); }; });
        const addToPile = (it, label) => { const s = picEl("span", null, it.e, nameOf(it)); piles[label].appendChild(s); pop(s, true); };
        const clearCtrl = () => { while (ctrl.firstChild) ctrl.removeChild(ctrl.firstChild); };
        const judge = () => new Promise((res) => {
          clearCtrl();
          const y = btn("👍 " + T(L.yes), "yes", () => { clearCtrl(); res(true); });
          const n = btn("👎 " + T(L.no), "no", () => { clearCtrl(); res(false); });
          y.dataset.sfx = n.dataset.sfx = "none";
          n.style.background = "#E57373";
          ctrl.append(y, n);
        });
        const basketName = (id) => T(set.baskets.find((b) => b.id === id));

        async function teachPhase(ids, first) {
          for (let i = 0; i < ids.length; i++) {
            const it = items[ids[i]];
            show(it, false);
            h.mood("wow");
            h.talk([it, first && i === 0 ? set.ask : L.which], null, nameOf(it) + "! " + T(first && i === 0 ? set.ask : L.which));
            for (;;) {
              const got = await askBasket();
              if (!ok()) return false;
              if (got === it.is) break;
              wiggle(bEls[got]);
              sfx("tryagain");
              h.talk(L.thinkAgain, "think");
            }
            await fly(it.e, stage, bEls[it.is]);
            if (!ok()) return false;
            sfx("pop");
            buzz("tap");
            addToPile(it, it.is);
            examples.push({ id: it.id, f: it.f, label: it.is });
            h.mood("happy");
            if (i === 0) await h.talk(L.gotIt); else await wait(250);
            if (!ok()) return false;
          }
          return true;
        }
        async function learnAnim() {
          stage.style.visibility = "hidden";
          h.talk(L.learning, "learn");
          const srcs = examples.slice(-8);
          for (const x of srcs) {
            const pile = piles[x.label];
            fly(items[x.id].e, pile, h.bot, 600);
            await wait(160);
            if (!ok()) return false;
          }
          await wait(1100);
          if (!ok()) return false;
          sfx("sparkle");
          await h.talk(L.learned, "proud");
          return ok();
        }
        async function guessPhase(ids, ri) {
          results[ri] = [];
          for (let i = 0; i < ids.length; i++) {
            const it = items[ids[i]];
            show(it, true);
            h.talk(L.thinking, "think");
            await wait(1100);
            if (!ok()) return false;
            const model = train(examples);
            const p = predict(model, it.f, labels);
            let kind;
            if (p.label == null) {
              await h.talk(L.unsure, "think");
              if (!ok()) return false;
              for (;;) {
                const got = await askBasket();
                if (!ok()) return false;
                if (got === it.is) break;
                wiggle(bEls[got]);
                sfx("tryagain");
                h.talk(L.thinkAgain, "think");
              }
              kind = "help";
              h.talk(L.thanksTold, "happy");
            } else {
              const why = older ? explain(model, it.f, p.label, labels) : null;
              const fw = why && R.features[why] ? R.features[why].why : null;
              const g = set.baskets.find((b) => b.id === p.label);
              bEls[p.label].classList.add("robo-guess");
              chip.textContent = "🤖 👉 " + g.e;
              chip.hidden = false;
              pop(chip, true);
              sfx("whoosh");
              await h.talk(fw ? { hi: "मुझे लगता है… " + g.hi + "! क्योंकि " + fw.hi + "।", en: "I think… " + g.en + "! Because " + fw.en + "." }
                : { hi: "मुझे लगता है… " + g.hi + "!", en: "I think… " + g.en + "!" }, "happy");
              if (!ok()) return false;
              h.bubble.textContent = T(L.judge);
              say(L.judge);
              const yes = await judge();
              if (!ok()) return false;
              const right = p.label === it.is;
              bEls[p.label].classList.remove("robo-guess");
              if (right) {
                kind = "ok";
                sfx("correct");
                await h.talk(yes ? L.botRight : L.botRightNo, "proud");
              } else {
                h.mood("oops");
                sfx("tryagain");
                await h.talk(yes ? L.botWrongYes : L.botWrong, "oops");
                if (!ok()) return false;
                for (;;) {
                  const got = await askBasket();
                  if (!ok()) return false;
                  if (got === it.is) break;
                  wiggle(bEls[got]);
                  h.talk(L.thinkAgain, "think");
                }
                kind = "fixed";
                sfx("correct");
                buzz("soft");
                h.talk(L.fixed, "happy");
              }
            }
            if (!ok()) return false;
            await fly(it.e, stage, bEls[it.is]);
            if (!ok()) return false;
            addToPile(it, it.is);
            examples.push({ id: it.id, f: it.f, label: it.is });
            results[ri].push(kind);
            tries.textContent = results.map((r) => r.map((x) => (x === "ok" ? "✅" : x === "help" ? "🙋" : "🔧")).join("")).join("  ·  ");
            await wait(700);
            if (!ok()) return false;
          }
          stage.style.visibility = "hidden";
          return true;
        }
        const right = (ri) => (results[ri] || []).filter((x) => x === "ok").length;
        const report = (ri) => {
          stage.style.visibility = "visible";
          stE.textContent = (results[ri] || []).map((x) => (x === "ok" ? "✅" : x === "help" ? "🙋" : "🔧")).join("");
          stE.style.fontSize = "clamp(34px, 11vw, 52px)";
          stN.textContent = T({ hi: "रोबो के अंदाज़े", en: "The robot's guesses" });
          qm.hidden = true;
          chip.hidden = true;
          tries.textContent = "";
        };
        async function between(ri) {
          report(ri);
          const n = (results[ri] || []).length;
          const line = [{ hi: "पहली बार में रोबो ने " + n + " में से " + right(ri) + " सही पहचाने।", en: "The first time, the robot got " + right(ri) + " of " + n + " right." }, L.teachMoreAsk];
          h.talk(line, "happy");
          return new Promise((res) => {
            clearCtrl();
            ctrl.appendChild(btn("➕ " + T(L.teachMore), "more", () => { clearCtrl(); res(true); }));
          });
        }
        async function finale() {
          clearCtrl();
          const sum = el("div", "sum");
          results.forEach((r, i) => {
            const row = el("div", "sum-row");
            row.append(el("span", null, T(i === 0 ? { hi: "पहले:", en: "First:" } : { hi: "और सिखाने के बाद:", en: "After more teaching:" })), el("span", null, r.map((x) => (x === "ok" ? "✅" : x === "help" ? "🙋" : "🔧")).join(" ")));
            sum.appendChild(row);
          });
          stage.replaceWith(sum);
          tries.textContent = "";
          const last = results.length - 1;
          const better = last > 0 && right(last) > right(0);
          const p = h.talk(better ? [L.better, L.lesson] : [L.lesson], "proud");
          sfx("sparkle");
          const played = ctx.data.get("teachPlayed", []) || [];
          if (played.indexOf(set.id) < 0) { played.push(set.id); ctx.data.set("teachPlayed", played); }
          once("teach-" + set.id, "🤖", L.stTeach, p);
          const idx = sets.indexOf(set);
          const nextSet = sets[(idx + 1) % sets.length];
          ctrl.append(
            btn("🔁 " + T(L.newGame), "new", () => teachGame(nextSet.id)),
            btn("🤖 " + T(L.games), "games", menu)
          );
          ctrl.lastChild.style.background = "#5C6BC0";
          if (set.mix && bandRank(age()) >= 1) {
            const mx = btn("🔀 " + T(L.mixBtn), "mix", () => mixGame(set.id));
            mx.style.background = "#8E24AA";
            ctrl.appendChild(mx);
          }
        }
        (async () => {
          await h.talk(L.teachIntro, "happy");
          if (!ok()) return;
          for (let ri = 0; ri < plan.length; ri++) {
            if (!(await teachPhase(plan[ri].teach, ri === 0))) return;
            if (!(await learnAnim())) return;
            if (!(await guessPhase(plan[ri].test, ri))) return;
            if (ri < plan.length - 1) { await between(ri); if (!ok()) return; }
          }
          finale();
        })();
      }

      /* ---------- (a2) उल्टा-पुल्टा: teach it backwards, see it learn exactly that ---------- */
      function mixGame(setId) {
        const set = (R.teach || []).find((s) => s.id === setId);
        if (!set || !set.mix) return menu();
        const items = {};
        set.items.forEach((it) => { items[it.id] = it; });
        const labels = set.baskets.map((b) => b.id);
        const other = (l) => labels.find((x) => x !== l);
        const w = page("🔀 " + T(L.mixBtn), () => teachGame(set.id));
        const ok = live();
        const h = hero("happy");
        w.appendChild(h.row);
        const stage = el("div", "item");
        stage.style.visibility = "hidden";
        const stE = el("div", "item-e", ""), stN = el("div", "item-n", ""), chip = el("div", "chip", "");
        chip.hidden = true;
        stage.append(stE, stN, chip);
        w.appendChild(stage);
        const ctrl = el("div", "row");
        w.appendChild(ctrl);
        const bwrap = el("div", "baskets");
        const bEls = {}, piles = {};
        let pick = null;
        set.baskets.forEach((b) => {
          const bt = el("button", "basket");
          bt.type = "button";
          bt.dataset.sfx = "none";
          bt.style.background = b.soft;
          bt.style.borderColor = b.color;
          bt.setAttribute("aria-label", T(b));
          const hd = el("div", "basket-h");
          hd.append(picEl("span", null, b.e), el("span", null, T(b)));
          hd.style.color = b.color;
          const pile = el("div", "pile");
          bt.append(hd, pile);
          bt.addEventListener("click", () => { if (pick) pick(b.id); });
          bEls[b.id] = bt;
          piles[b.id] = pile;
          bwrap.appendChild(bt);
        });
        w.appendChild(bwrap);
        const show = (it) => { stage.style.visibility = "visible"; stE.replaceChildren(pic(it.e, nameOf(it))); stN.textContent = nameOf(it); chip.hidden = true; pop(stage); };
        const ask = () => new Promise((res) => { pick = (id) => { pick = null; res(id); }; });
        const examples = [];
        (async () => {
          await h.talk(L.mixIntro, "happy");
          if (!ok()) return;
          for (const id of set.mix.teach) {
            const it = items[id];
            show(it);
            h.talk([it, L.mixWhich], "wow", nameOf(it) + "! " + T(L.mixWhich));
            for (;;) {
              const got = await ask();
              if (!ok()) return;
              if (got === other(it.is)) break;
              wiggle(bEls[got]);
              sfx("tryagain");
              h.talk(L.mixNo, "think");
            }
            sfx("pop");
            await fly(it.e, stage, bEls[other(it.is)]);
            if (!ok()) return;
            const s2 = picEl("span", null, it.e, nameOf(it));
            piles[other(it.is)].appendChild(s2);
            pop(s2, true);
            examples.push({ f: it.f, label: other(it.is) });
          }
          stage.style.visibility = "hidden";
          h.talk(L.learning, "learn");
          await wait(1600);
          if (!ok()) return;
          sfx("sparkle");
          await h.talk(L.learned, "proud");
          if (!ok()) return;
          for (const id of set.mix.test) {
            const it = items[id];
            show(it);
            h.talk(L.thinking, "think");
            await wait(1000);
            if (!ok()) return;
            const p = predict(train(examples), it.f, labels);
            const g = set.baskets.find((b) => b.id === p.label);
            if (!g) continue;
            chip.textContent = "🤖 👉 " + g.e;
            chip.hidden = false;
            bEls[g.id].classList.add("robo-guess");
            sfx("whoosh");
            await h.talk({ hi: "मुझे लगता है… " + g.hi + "!", en: "I think… " + g.en + "!" }, "happy");
            if (!ok()) return;
            await wait(900);
            bEls[g.id].classList.remove("robo-guess");
            if (!ok()) return;
          }
          stage.hidden = true;            /* collapse the empty picture so the lesson sits by the buttons */
          h.talk(L.mixLesson, "oops");
          const nextSet = (R.teach || [])[((R.teach || []).indexOf(set) + 1) % R.teach.length];
          ctrl.append(btn("🔁 " + T(L.newGame), "new", () => teachGame(nextSet.id)), btn("🤖 " + T(L.games), "games", menu));
          ctrl.lastChild.style.background = "#5C6BC0";
        })();
      }

      /* ---------- (b) show the robot the way ---------- */
      function pathGame(startAt) {
        const band = age();
        const cfg = (R.paths && R.paths[band]) || (R.paths && R.paths["4-5"]);
        if (!cfg || !cfg.levels || !cfg.levels.length) return menu();
        const saved = ctx.data.get("path", {}) || {};
        let li = startAt != null ? startAt : Math.min(saved[band] || 0, cfg.levels.length - 1);
        if (li >= cfg.levels.length) li = 0;
        const lv = cfg.levels[li];
        const size = cfg.size, mode = cfg.mode;
        const prize = (R.prizes && R.prizes[lv.prize]) || { hi: "इनाम", en: "the prize" };
        const w = page("🗺️ " + T(L.gPath) + " " + (li + 1) + "/" + cfg.levels.length, menu);
        const ok = live();
        const h = hero("happy", "small");
        w.appendChild(h.row);
        /* board */
        const board = el("div", "board");
        const cellPx = Math.max(54, Math.min(84, Math.floor(400 / size)));
        board.style.setProperty("--robo-bw", (cellPx * size + 12 + 4 * (size - 1)) + "px");
        board.style.setProperty("--robo-cf", "clamp(20px, " + Math.round(60 / size) + "vw, " + Math.round(cellPx * 0.6) + "px)");
        board.style.gridTemplateColumns = "repeat(" + size + ", 1fr)";
        board.style.gridTemplateRows = "repeat(" + size + ", 1fr)";
        const walls = new Set((lv.walls || []).map((p) => p[0] + "," + p[1]));
        const cells = [];
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const c = el("div", "cell");
            const what = walls.has(x + "," + y) ? ((x + y) % 2 ? "🌵" : "🌳") : (x === lv.goal[0] && y === lv.goal[1] ? lv.prize : "");
            if (what) c.appendChild(pic(what));
            cells.push(c);
            board.appendChild(c);
          }
        }
        const mini = el("div", "mini");
        const mb = miniBot();
        mini.appendChild(mb);
        const pct = 100 / size;
        mini.style.width = "calc((100% - 12px) / " + size + ")";
        mini.style.height = "calc((100% - 12px) / " + size + ")";
        const place = (x, y, hd) => {
          mini.style.left = "calc(6px + (100% - 12px) * " + (x * pct / 100) + ")";
          mini.style.top = "calc(6px + (100% - 12px) * " + (y * pct / 100) + ")";
          mb.style.transform = "rotate(" + (hd * 90) + "deg)";
        };
        place(lv.start[0], lv.start[1], lv.start[2] || 0);
        board.appendChild(mini);
        board.setAttribute("role", "img");
        board.setAttribute("aria-label", T({ hi: "रोबो का रास्ता", en: "The robot's grid" }));
        w.appendChild(board);
        /* program strip */
        const prog = [];
        const strip = el("div", "prog");
        strip.setAttribute("aria-label", T({ hi: "रोबो के कार्ड", en: "The robot's cards" }));
        w.appendChild(strip);
        let running = false, fails = 0, badAt = -1;
        const cardName = (c) => T(R.cards[c] || { hi: c, en: c });
        const makeCard = (c, n, onTap, extraCls) => {
          const b = el("button", "card" + (extraCls ? " " + extraCls : ""));
          b.type = "button";
          b.style.background = CARD_COLOR[c] || "#607D8B";
          b.appendChild(cardIcon(c));
          if (n > 1) b.appendChild(el("span", "badge", "×" + n));
          b.setAttribute("aria-label", cardName(c) + (n > 1 ? " ×" + n : ""));
          b.addEventListener("click", onTap);
          return b;
        };
        function drawStrip(now) {
          while (strip.firstChild) strip.removeChild(strip.firstChild);
          if (!prog.length) { strip.appendChild(el("span", "prog-empty", "👇 " + T({ hi: "कार्ड यहाँ आएँगे", en: "Cards go here" }))); return; }
          prog.forEach((p, i) => {
            const b = makeCard(p.c, p.n, () => {
              if (running) return;
              prog.splice(i, 1);
              badAt = -1;
              drawStrip();
              say(L.removed);
            }, i === now ? "card-now" : i === badAt ? "card-bad" : "");
            strip.appendChild(b);
          });
        }
        drawStrip();
        /* palette */
        const pal = el("div", "pal");
        const palBtns = {};
        (mode === "rel" ? ["tl", "fwd", "tr"] : ["left", "up", "down", "right"]).forEach((c) => {
          const b = makeCard(c, 1, () => {
            if (running) return;
            if (prog.length >= cfg.max) { wiggle(strip); say(L.tooMany); return; }
            prog.push({ c, n: 1 });
            badAt = -1;
            drawStrip();
            pop(strip.lastChild);
            say(R.cards[c] || c);
          });
          b.appendChild(el("span", "cardlbl", cardName(c)));
          palBtns[c] = b;
          pal.appendChild(b);
        });
        if (cfg.loops) {
          const rep = el("button", "card");
          rep.type = "button";
          rep.style.background = "#FFB300";
          rep.style.color = "#2D2A32";
          rep.append(el("span", null, "🔁"), el("span", "cardlbl", T(L.repeat)));
          rep.style.fontSize = "26px";
          rep.setAttribute("aria-label", T(L.repeat));
          rep.addEventListener("click", () => {
            if (running) return;
            if (!prog.length) { say(L.needCard); return; }
            const lastC = prog[prog.length - 1];
            lastC.n = lastC.n >= 3 ? 1 : lastC.n + 1;
            drawStrip();
            pop(strip.lastChild, true);
            say(lastC.n > 1 ? { hi: cardName(lastC.c) + ", " + lastC.n + " बार!", en: cardName(lastC.c) + ", " + lastC.n + " times!" } : R.cards[lastC.c]);
          });
          pal.appendChild(rep);
        }
        w.appendChild(pal);
        /* controls */
        const ctl = el("div", "ctl");
        const go = btn("▶ " + T(L.run), "go", () => runIt());
        go.dataset.sfx = "none";              /* runIt plays whoosh */
        const undo = k.round("⌫", L.undo, () => { if (running || !prog.length) return; prog.pop(); badAt = -1; drawStrip(); say(L.removed); });
        undo.dataset.sfx = "pop";
        const clr = k.round("🧹", L.clear, () => { if (running) return; prog.length = 0; badAt = -1; drawStrip(); });
        clr.dataset.sfx = "whoosh";
        const hb = k.round("💡", L.hintBtn, () => { if (!running) showHint(); });
        ctl.append(undo, clr, go, hb);
        w.appendChild(ctl);
        const endRow = el("div", "row");
        w.appendChild(endRow);

        function showHint() {
          const hn = hint(lv, size, mode, prog);
          if (!hn) return;
          if (hn.fix != null) {
            badAt = hn.fix;
            drawStrip();
            const b = strip.children[hn.fix];
            if (b) b.classList.add("robo-card-hint");
            h.talk(L.fixIt, "think");
          } else if (palBtns[hn.add]) {
            const b = palBtns[hn.add];
            b.classList.remove("robo-card-hint");
            void b.offsetWidth;
            b.classList.add("robo-card-hint");
            h.talk({ hi: "अगला कार्ड: " + R.cards[hn.add].hi, en: "Next card: " + R.cards[hn.add].en }, "think");
          }
        }
        async function runIt() {
          if (running) return;
          const v = validateProgram(prog, mode, { max: cfg.max, loops: cfg.loops });
          if (!v.ok) { if (v.why === "empty") { wiggle(strip); h.talk(L.needCard, "think"); } return; }
          running = true;
          go.disabled = true;
          badAt = -1;
          sfx("whoosh");
          const res = runProgram(lv, size, mode, prog);
          place(lv.start[0], lv.start[1], lv.start[2] || 0);
          h.mood("think");
          for (const st of res.steps) {
            drawStrip(st.i);
            if (st.ev === "move" || st.ev === "turn") {
              place(st.x, st.y, st.h);
              sfx(st.ev === "move" ? "tap" : "flip");
            } else {
              mb.style.transform = "rotate(" + (st.h * 90) + "deg)";
            }
            await wait(st.ev === "turn" ? 420 : 560);
            if (!ok()) return;
          }
          if (res.result === "goal") {
            drawStrip();
            h.mood("proud");
            sfx("correct");
            buzz("success");
            pop(mini, true);
            const goalCell = cells[lv.goal[1] * size + lv.goal[0]];
            goalCell.textContent = "✨";
            const got = picEl("span", "got", lv.prize);
            mini.appendChild(got);
            pop(got, true);
            const p = h.talk(L.goal, "proud");
            const s = ctx.data.get("path", {}) || {};
            const nextI = li + 1;
            s[band] = Math.max(s[band] || 0, nextI >= cfg.levels.length ? 0 : nextI);
            ctx.data.set("path", s);
            if (nextI >= cfg.levels.length) {
              p.then(() => { if (ok()) h.talk(L.allPaths, "proud"); });
              once("path-" + band, "🗺️", L.stPath, p);
            }
            while (endRow.firstChild) endRow.removeChild(endRow.firstChild);
            ctl.hidden = true;
            pal.hidden = true;
            endRow.append(
              btn("🔁 " + T(L.again), "again", () => pathGame(li)),
              btn("➡️ " + T(L.nextLevel), "next", () => pathGame(nextI >= cfg.levels.length ? 0 : nextI))
            );
            endRow.firstChild.style.background = "#5C6BC0";
            return;
          }
          fails++;
          h.mood("oops");
          drawStrip();
          if (res.result === "short") {
            sfx("tryagain");
            await h.talk(L.short, "oops");
          } else {
            badAt = res.at;
            drawStrip();
            k.wiggle(mini);
            sfx("tryagain");
            buzz("soft");
            await h.talk(res.result === "bump" ? L.bump : L.edge, "oops");
          }
          if (!ok()) return;
          await wait(300);
          if (!ok()) return;
          place(lv.start[0], lv.start[1], lv.start[2] || 0);
          running = false;
          go.disabled = false;
          if (fails >= (band === "2-3" ? 1 : 2)) showHint();
        }
        const introLine = [prize.go || { hi: "रोबो को इनाम तक पहुँचाओ!", en: "Take the robot to the prize!" }, L.pathIntro].concat(mode === "rel" && li === 0 ? [L.pathIntroRel] : []);
        h.talk(introLine, "happy");
      }

      /* ---------- (c) ask the robot ---------- */
      function askGame(i) {
        const rounds = askRounds(R.ask, age());
        if (!rounds.length) return menu();
        if (i >= rounds.length) return askEnd();
        const r = rounds[i];
        const w = page("💬 " + T(L.gAsk) + " " + (i + 1) + "/" + rounds.length, menu);
        const ok = live();
        const h = hero("happy");
        w.appendChild(h.row);
        const scene = el("div", "scene");
        w.appendChild(scene);
        const opts = el("div", "opts");
        w.appendChild(opts);
        const endRow = el("div", "row");
        w.appendChild(endRow);
        let done = false;
        const nextBtn = () => {
          if (endRow.firstChild) return;
          endRow.appendChild(btn("➡️ " + T(L.next), "next", () => askGame(i + 1)));
        };
        const optBtn = (o, onTap) => {
          const b = el("button", "opt");
          b.type = "button";
          b.setAttribute("aria-label", T(o.say));
          b.dataset.sfx = "none";             /* answers sound correct / tryagain */
          b.append(picEl("span", "opt-p", o.pic), el("span", "opt-t", T(o.say)));
          b.addEventListener("click", () => { if (!done && !b.disabled) onTap(b); });
          opts.appendChild(b);
          return b;
        };
        const intro = () => h.talk([r.intro].concat((r.options || []).reduce((a, o, j) => a.concat(j ? [L.or, o.say] : [o.say]), [])), "happy");

        if (r.type === "ask") {
          const need = el("div", "need");
          need.append(picEl("span", null, "🧒💭"), picEl("b", null, r.need.e), el("span", null, T(r.need)));
          const shelf = el("div", "shelf");
          const shelfEls = r.shelf.map((e) => { const s = picEl("span", null, e); shelf.appendChild(s); return s; });
          scene.append(need, shelf);
          r.options.forEach((o) => optBtn(o, async (b) => {
            shelfEls.forEach((s) => { s.classList.remove("robo-picked", "robo-wrong"); });
            const got = shelfEls[r.shelf.indexOf(o.gets)];
            await h.talk(o.say, "think");
            if (!ok()) return;
            if (o.clear) {
              done = true;
              b.classList.add("robo-opt-ok");
              if (got) { got.classList.add("robo-picked"); pop(got, true); }
              sfx("correct");
              buzz("success");
              await h.talk(L.askThanks, "proud");
              if (ok()) nextBtn();
            } else {
              b.classList.add("robo-opt-no");
              b.disabled = true;
              if (got) { got.classList.add("robo-wrong"); wiggle(got); }
              sfx("tryagain");
              h.talk(L.askVague, "oops");
            }
          }));
          intro();
        } else if (r.type === "draw") {
          const canvas = el("div", "canvas");
          canvas.setAttribute("role", "img");
          canvas.setAttribute("aria-label", T({ hi: "रोबो का चित्र", en: "The robot's drawing" }));
          scene.appendChild(canvas);
          const idle = el("span", null, "✏️");
          idle.style.left = "50%"; idle.style.top = "50%"; idle.style.fontSize = "44px"; idle.style.opacity = ".5";
          canvas.appendChild(idle);
          const paint = (list, clear) => {
            while (canvas.firstChild) canvas.removeChild(canvas.firstChild);
            const spots = clear ? [[34, 62, 70], [44, 40, 30], [80, 22, 34]] : [[28, 40, 40], [62, 60, 46], [74, 28, 30]];
            list.forEach((e, j) => {
              const s = picEl("span", null, e);
              const sp = spots[j % spots.length];
              s.style.left = sp[0] + "%";
              s.style.top = sp[1] + "%";
              s.style.fontSize = "calc(" + sp[2] + "px + 4vw)";
              canvas.appendChild(s);
              k.later(() => pop(s, true), 200 * j);
            });
          };
          r.options.forEach((o) => optBtn(o, async (b) => {
            await h.talk(o.say, "learn");
            if (!ok()) return;
            sfx("sparkle");
            paint(o.draw, o.clear);
            if (o.clear) {
              done = true;
              b.classList.add("robo-opt-ok");
              buzz("success");
              await h.talk(L.drawClear, "proud");
              if (ok()) nextBtn();
            } else {
              b.classList.add("robo-opt-no");
              b.disabled = true;
              h.talk(L.drawVague, "oops");
            }
          }));
          intro();
        } else if (r.type === "check") {
          scene.appendChild(picEl("div", "show", r.show));
          if (r.claim) scene.appendChild(el("div", "chip", "🤖💬 " + r.claim + " ?"));
          const ans = (yes) => async (b) => {
            done = true;
            Array.from(opts.children).forEach((x) => { x.disabled = true; });
            if (!yes) { b.classList.add("robo-opt-ok"); sfx("correct"); buzz("success"); await h.talk(r.right, "oops"); }
            else { b.classList.add("robo-opt-no"); opts.lastChild.classList.add("robo-opt-ok"); await h.talk(r.wrong, "oops"); }
            if (ok()) nextBtn();
          };
          optBtn({ pic: "👍", say: L.yes }, ans(true));
          optBtn({ pic: "👎", say: L.no }, ans(false));
          h.talk({ hi: r.intro.hi, en: r.intro.en }, "happy");
        } else {
          /* who / robot: one right answer; a wrong pick gets a gentle explanation */
          if (r.show) scene.appendChild(picEl("div", "show", r.show));
          else scene.appendChild(robot("think"));
          const btns = [];
          r.options.forEach((o) => btns.push(optBtn(o, async (b) => {
            done = true;
            btns.forEach((x) => { x.disabled = true; });
            const good = btns[r.options.findIndex((x) => x.right)];
            if (o.right) { b.classList.add("robo-opt-ok"); sfx("correct"); buzz("success"); }
            else {
              b.classList.add("robo-opt-no");
              if (good) good.classList.add("robo-opt-ok");
              await h.talk(r.type === "robot" ? L.robotWrongPick : L.notPerson, "oops");
              if (!ok()) return;
            }
            await h.talk(r.answer, "happy");
            if (ok()) nextBtn();
          })));
          if (!r.show) scene.firstChild.style.width = "90px";
          intro();
        }
      }
      function askEnd() {
        const w = page("💬 " + T(L.gAsk), menu);
        const h = hero("proud", true);
        w.appendChild(h.row);
        const sum = el("div", "sum");
        [["🗣️", L.askClear], ["🔍", L.askCheck], ["👨‍👩‍👧", L.askGrown]].forEach((x) => {
          const row = el("div", "sum-row");
          row.append(picEl("span", null, x[0]), el("span", null, T(x[1])));
          sum.appendChild(row);
        });
        w.appendChild(sum);
        const p = h.talk(L.askEnd, "proud");
        sfx("sparkle");
        once("ask", "💬", L.stAsk, p);
        const row = el("div", "row");
        row.append(btn("🔁 " + T(L.again), "again", () => askGame(0)), btn("🤖 " + T(L.games), "games", menu));
        row.lastChild.style.background = "#5C6BC0";
        w.appendChild(row);
      }

      menu();
      return k.cleanup;
    },
  });
})();
