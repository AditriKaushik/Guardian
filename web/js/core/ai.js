/* नन्हा स्कूल — optional AI conversation for मिट्ठू (docs/AI_BUDDY.md).

   OFF on every device until a grown-up turns it on (behind the grown-ups' question) after a consent
   screen. When it is on, and only when the offline brain and the knowledge base have no good answer,
   the buddy sends the last few lines of the chat to our server (POST API_BASE/api/chat). The server
   screens the words, asks the AI provider the owner configured, screens the answer, and stores nothing.

   Sent: the last ≤ 8 lines (each ≤ 300 characters) of the chat with मिट्ठू, the language, the age band,
   the time of day and a random per-install id (only for the server's daily limit; new after every
   on/off, never linked to a profile). Never: names, voice recordings, profiles, progress or anything
   else. Numbers of 6+ digits, e-mail addresses, "my name is …" and the child's own names are removed
   on the device first. Small children (age band "2-3") never use the online AI.

   NS.ai = {
     configured()              → the app has a server (config API_BASE) and config AI.ENABLED is not false
     enabled(), setEnabled(on) → the grown-up's choice for this device (ns_settings.aiChat)
     allowedFor(ageBand)       → false for "2-3"
     available(ctx?)           → configured, enabled, online and not paused (+ allowedFor(ctx.ageBand))
     chat(history, ctx)        → Promise<{text, mood, kind} | null>; null means "answer offline"
                                  history: [{role: "child"|"buddy", text}] or the buddy's [{who: "k"|"b", text}]
                                  ctx: {lang, ageBand, daypart, names: [the child's names, removed before sending]}
                                  kind: "ai" | "redirect" | "safety" | "limit" (daily limit reached, said once)
                                        | "break" (a gentle off-screen break after every AI.SESSION_TURNS answers)
     screen(text)              → "help"|"secret"|"private"|"stranger"|"grownup"|"medical"|"rude"|null
     redact(text, names)       → text without long numbers, e-mails, "my name is …" or the given names
     settingsCard()            → a card for the grown-ups' settings screen (ui.js), with the on/off switch
     consent(onDone)           → the consent / settings screen; open it behind NS.billing.gate
   } */
(function () {
  "use strict";
  const NS = window.NS;
  if (!NS) return;

  const CFG = Object.assign({ ENABLED: true, DAILY_LIMIT: 30, SESSION_TURNS: 10, TIMEOUT_MS: 8000 },
    (NS.config && NS.config.AI && typeof NS.config.AI === "object") ? NS.config.AI : {});
  const CONSENT_VERSION = 1;
  const MAX_TURNS = 8, MAX_CHARS = 300, MAX_BODY_BYTES = 8000, REPLY_MAX = 220;
  const SESSION_GAP_MS = 30 * 60 * 1000;     // a new sitting after 30 quiet minutes
  const PAUSE_MS = 30 * 60 * 1000;           // server says "no AI here": try again in 30 minutes
  const FAIL_PAUSE_MS = 5 * 60 * 1000;       // two failures in a row: rest 5 minutes
  const LANGS = ["hi", "en", "hinglish"];
  const MOODS = ["happy", "curious", "calm", "sleepy", "proud", "caring"];
  const DAYPARTS = ["morning", "noon", "evening", "night"];
  const now = () => (typeof NS.now === "function" ? NS.now() : Date.now());
  const today = () => (typeof NS.dayKey === "function" ? NS.dayKey() : new Date(now()).toISOString().slice(0, 10));
  const L = (hi, en, hinglish) => ({ hi, en, hinglish });

  let pausedUntil = 0, failures = 0;
  let sitting = { at: 0, answers: 0, nextBreak: 0 };

  /* ---------------- Fixed lines (the server uses the same safety replies) ---------------- */
  const SAFE = {
    help: L("तुमने बताया, ये बहुत बहादुरी है 💛 ये तुम्हारी गलती नहीं है। अभी किसी भरोसेमंद बड़े को बताओ, या 1098 या 112 पर फ़ोन करो — मुफ़्त है।",
      "You were very brave to tell me 💛 It is not your fault. Please tell a grown-up you trust right now, or call 1098 or 112 — it is free.",
      "Tumne bataya, yeh bahut bahaduri hai 💛 Yeh tumhari galti nahi hai. Abhi kisi bharosemand bade ko batao, ya 1098 ya 112 par phone karo — free hai."),
    secret: L("सरप्राइज़ वाले राज़ मज़ेदार होते हैं 🎁 पर जो बात अजीब या बुरी लगे, वो हमेशा किसी भरोसेमंद बड़े को बताओ — या 1098 या 112 पर।",
      "Surprise secrets can be fun 🎁 But if something feels strange or bad, always tell a grown-up you trust — or call 1098 or 112.",
      "Surprise wale raaz mazedaar hote hain 🎁 Par jo baat ajeeb ya buri lage, woh hamesha kisi bharosemand bade ko batao — ya 1098 ya 112 par."),
    private: L("याद रखो 🛡️ नाम, पता, फ़ोन नंबर या पासवर्ड जैसी बातें सिर्फ़ घर वालों के लिए हैं — मुझे भी मत बताना! चलो कुछ और खेलें?",
      "Remember 🛡️ names, addresses, phone numbers and passwords are just for your family — don't tell me either! Shall we play something else?",
      "Yaad rakho 🛡️ naam, pata, phone number ya password jaisi baatein sirf ghar walon ke liye hain — mujhe bhi mat batana! Chalo kuch aur khelein?"),
    stranger: L("अनजान लोगों से कुछ मत लेना और उनके साथ कहीं मत जाना 🛡️ सीधे अपने बड़ों के पास जाओ और उन्हें बताओ।",
      "Never take things from strangers or go anywhere with them 🛡️ Go straight to your grown-ups and tell them.",
      "Anjaan logon se kuch mat lena aur unke saath kahin mat jaana 🛡️ Seedhe apne bado ke paas jaao aur unhe batao."),
    grownup: L("ये बात किसी भरोसेमंद बड़े से पूछना सबसे अच्छा है 💛 कुछ अजीब या डरावना लगे, तो मम्मी-पापा या टीचर को ज़रूर बताओ। चलो, कुछ प्यारा खेलें?",
      "That's a question for a grown-up you trust 💛 If anything feels strange or scary, tell Mummy, Papa or your teacher. Shall we play something nice?",
      "Yeh baat kisi bharosemand bade se poochhna sabse achha hai 💛 Kuch ajeeb ya daravna lage, toh Mummy-Papa ya teacher ko zaroor batao. Chalo, kuch pyaara khelein?"),
    medical: L("अरे! 💛 ये बात अभी मम्मी-पापा या किसी बड़े को बताओ — वो तुम्हारा ध्यान रखेंगे। दवाई सिर्फ़ बड़े ही देते हैं।",
      "Oh! 💛 Please tell Mummy, Papa or a grown-up right now — they will take care of you. Only grown-ups give medicine.",
      "Arre! 💛 Yeh baat abhi Mummy-Papa ya kisi bade ko batao — woh tumhara dhyan rakhenge. Dawai sirf bade hi dete hain."),
    rude: L("ओह, ये शब्द प्यारा नहीं है 🙊 चलो कोई मीठा शब्द बोलें — जैसे \"फूल\" या \"धन्यवाद\"!",
      "Oops, that's not a kind word 🙊 Let's say a sweet word instead — like \"flower\" or \"thank you\"!",
      "Oh, yeh shabd pyaara nahi hai 🙊 Chalo koi meetha shabd bolein — jaise \"phool\" ya \"dhanyavaad\"!"),
  };
  const LIMIT = L("आज हमने बहुत सारी बातें कीं! 🦜 अब मैं अपने खेल, कहानियों और पहेलियों से बात करूँगा — चलो, एक पहेली?",
    "We've had lots of chats today! 🦜 Now I'll talk with my own games, stories and riddles — shall we do a riddle?",
    "Aaj humne bahut saari baatein kin! 🦜 Ab main apne khel, kahaniyon aur paheliyon se baat karunga — chalo, ek paheli?");
  const BREAK = {
    day: [L("हमने बहुत बातें कीं! 🌳 अब थोड़ा ब्रेक — बाहर खेलो, या घर में किसी को आज की सबसे मज़ेदार बात सुनाओ!",
      "We've talked a lot! 🌳 Time for a little break — play outside, or tell someone at home the funniest thing about today!",
      "Humne bahut baatein kin! 🌳 Ab thoda break — bahar khelo, ya ghar mein kisi ko aaj ki sabse mazedaar baat sunao!"),
    L("बातें करके दिमाग़ चमक गया! ✨ चलो अब पानी पियो और घर वालों के साथ कोई उछल-कूद वाला खेल खेलो!",
      "All this talking made your brain shine! ✨ Now drink some water and play a jumping game with your family!",
      "Baatein karke dimaag chamak gaya! ✨ Chalo ab paani piyo aur ghar walon ke saath koi uchhal-kood wala khel khelo!")],
    night: [L("रात हो गई है 🌙 चलो अब स्क्रीन को भी आराम दें — बड़ों से एक कहानी सुनो और मीठे सपने देखो!",
      "It's night time 🌙 Let's give the screen a rest too — hear a story from a grown-up and have sweet dreams!",
      "Raat ho gayi hai 🌙 Chalo ab screen ko bhi aaram dein — bado se ek kahani suno aur meethe sapne dekho!")],
  };

  /* ---------------- Screening (kept in step with server/worker.js) ---------------- */
  const SCREEN = [
    ["help", ["suicide", "kill myself", "killing myself", "want to die", "wanna die", "hurt myself", "cut myself",
      "मरना चाहता", "मरना चाहती", "मर जाना चाहता", "मर जाना चाहती", "मर जाऊंगा", "मर जाऊंगी", "खुद को मार", "खुद को चोट",
      "अपने आप को मार", "जान दे दूं", "marna chahta", "marna chahti", "mar jaunga", "mar jaungi", "khud ko maar", "khud ko chot",
      "hits me", "hit me", "beats me", "beat me", "hurts me", "hurt me", "touches me", "touched me", "touch me", "bad touch",
      "मुझे मारता", "मुझे मारती", "मुझे मारते", "मुझे मारा", "मुझको मारा", "पीटता", "पीटती", "पीटते", "पिटाई", "गंदा स्पर्श", "बैड टच",
      "गलत तरीके से छू", "mujhe maarta", "mujhe marta", "mujhe maarti", "mujhe marti", "mujhe mara", "mujhe maara", "pitai"]],
    ["secret", ["dont tell anyone", "dont tell your", "dont tell mummy", "dont tell mom", "dont tell papa", "dont tell dad",
      "keep it a secret", "keep a secret", "our secret", "किसी को मत बताना", "किसी को मत बोलना", "मम्मी को मत बताना", "पापा को मत बताना",
      "मां को मत बताना", "हमारा राज", "kisi ko mat batana", "mummy ko mat batana", "papa ko mat batana", "humara raaz", "hamara raaz"]],
    ["private", ["address", "addres", "घर का पता", "मेरा पता", "पता बता", "पता लिख", "ghar ka pata", "mera pata", "house number",
      "house no", "flat number", "flat no", "मकान नंबर", "makan number", "गली नंबर", "gali number", "pin code", "pincode", "पिन कोड",
      "zip code", "phone number", "phone no", "mobile number", "mobile no", "फोन नंबर", "मोबाइल नंबर", "मेरा नंबर", "mera number",
      "my number", "whatsapp", "व्हाट्सएप", "password", "पासवर्ड", "=otp", "=ओटीपी", "=pin", "=upi", "aadhaar", "aadhar", "आधार",
      "card number", "email", "ईमेल", "gmail", "जीमेल", "yahoo", "hotmail", "at the rate", "एट द रेट", "dot com", "डॉट कॉम",
      "स्कूल का नाम", "school ka naam", "school name", "name of my school"]],
    ["stranger", ["stranger", "अजनबी", "अनजान", "anjaan", "anjan", "ajnabi"]],
    ["grownup", ["=sex", "sexy", "=porn", "porno", "nude", "naked", "boobs", "penis", "vagina", "private part", "सेक्स", "पॉर्न",
      "नंगा", "नंगी", "प्राइवेट पार्ट", "kiss me", "kissing", "चुम्मी", "chummi", "girlfriend", "boyfriend", "गर्लफ्रेंड", "बॉयफ्रेंड",
      "marry me", "शादी करोगे", "शादी करोगी", "shaadi karoge", "shadi karoge", "shaadi karogi", "date me",
      "=gun", "=guns", "pistol", "पिस्तौल", "बंदूक", "bandook", "bandooq", "=bomb", "=bombs", "=बम", "चाकू", "chaku", "chaaku",
      "knife", "=kill", "killed", "killing", "मार डाल", "मार दूंगा", "मार दूंगी", "maar daal", "mar daal", "maar dunga", "=shoot",
      "गोली मार", "horror", "zombie", "चुड़ैल", "चुडैल", "chudail", "शैतान", "devil", "dead body", "लाश",
      "drugs", "शराब", "sharab", "daaru", "दारू", "beer", "cigarette", "सिगरेट"]],
    ["medical", ["medicine", "दवा", "दवाई", "dawai", "dawa", "बुखार", "bukhar", "fever", "खून", "khoon", "blood", "bleeding",
      "उल्टी", "ulti", "vomit", "injection", "इंजेक्शन", "poison", "ज़हर", "जहर", "zeher", "zahar"]],
    ["rude", ["chutiya", "chutiye", "चूतिया", "madarchod", "मादरचोद", "bhenchod", "behenchod", "बहनचोद", "भेनचोद", "=bc", "=mc",
      "bsdk", "bhosdi", "भोसडी", "harami", "हरामी", "kamina", "कमीना", "कमीने", "=saala", "=साला", "gandu", "गांडू", "=fuck",
      "fucking", "=shit", "bitch", "bastard", "asshole", "stupid", "=idiot", "बेवकूफ", "bewakoof"]],
  ];
  const NUKTA_RE = new RegExp(String.fromCharCode(0x093C), "g");
  const CANDRABINDU_RE = new RegExp(String.fromCharCode(0x0901), "g");
  const ANUSVARA = String.fromCharCode(0x0902);
  const JOINERS_RE = new RegExp("[" + String.fromCharCode(0x200C, 0x200D) + "]", "g");
  const DEV_DIGIT_RE = /[०-९]/g;
  /* Same folding as the server: lower case, nukta and chandrabindu folded, Devanagari digits as 0-9. */
  function norm(s) {
    return String(s == null ? "" : s).normalize("NFD").toLowerCase()
      .replace(NUKTA_RE, "").replace(CANDRABINDU_RE, ANUSVARA).replace(JOINERS_RE, "")
      .replace(DEV_DIGIT_RE, d => String(d.charCodeAt(0) - 0x0966))
      .replace(/[’'`]/g, "")
      .replace(/[^\p{L}\p{M}\p{N}@+]+/gu, " ")
      .replace(/\s+/g, " ").trim();
  }
  const LETTER = "[\\p{L}\\p{M}\\p{N}]";
  function listRe(words) {
    return new RegExp("(?<!" + LETTER + ")(?:" + words.map(w => {
      const whole = w.charAt(0) === "=";
      const n = norm(whole ? w.slice(1) : w);
      const end = whole || (/^[a-z0-9 ]+$/.test(n) ? n.length <= 4 : n.length <= 2);
      return n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (end ? "(?!" + LETTER + ")" : "");
    }).join("|") + ")", "u");
  }
  const SCREEN_RE = SCREEN.map(([kind, words]) => [kind, listRe(words)]);
  const NUMBER_WORDS = {
    "शून्य": 0, "एक": 1, "दो": 2, "तीन": 3, "चार": 4, "पांच": 5, "छह": 6, "छः": 6, "छे": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10,
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    shunya: 0, ek: 1, do: 2, teen: 3, char: 4, chaar: 4, paanch: 5, panch: 5, chhe: 6, chhah: 6, saat: 7, aath: 8, nau: 9, das: 10,
  };
  const NUMBER_WORD_KEYS = Object.keys(NUMBER_WORDS).reduce((m, k) => { m[norm(k)] = NUMBER_WORDS[k]; return m; }, {});
  /* A run of numbers is private when it has 6+ digits, unless it is a child counting "1 2 3 4 5 6". */
  function badRun(run) {
    const digits = run.reduce((n, x) => n + x.digits, 0);
    const counting = run.length >= 3 && run.every((x, i) => i === 0 || (x.value === run[i - 1].value + 1 && x.digits <= 2));
    return digits >= 6 && !counting;
  }
  function hasPrivateNumber(text) {
    const t = norm(text);
    if (t.indexOf("@") >= 0) return true;
    let run = [];
    for (const tok of t.split(" ")) {
      const clean = tok.replace(/^\++/, "");
      if (/^\d+$/.test(clean)) {
        if (clean.length >= 6) return true;
        run.push({ digits: clean.length, value: Number(clean) });
      } else if (Object.prototype.hasOwnProperty.call(NUMBER_WORD_KEYS, tok)) {
        const v = NUMBER_WORD_KEYS[tok];
        run.push({ digits: String(v).length, value: v });
      } else {
        if (badRun(run)) return true;
        run = [];
      }
    }
    return badRun(run);
  }
  function screen(text) {
    if (hasPrivateNumber(text)) return "private";
    const t = norm(text);
    for (const [kind, re] of SCREEN_RE) if (re.test(t)) return kind;
    return null;
  }

  /* ---------------- Removing private details before anything leaves the phone ---------------- */
  const EMAIL_RE = /[^\s@]+@[^\s@]+/g;
  const NUMBER_RUN_RE = /\+?[0-9०-९](?:[\s\-().\/]*[0-9०-९]){5,}/g;
  const NAME_INTRO = /((?:मेरा|मेरी|हमारा)\s+नाम|(?:mera|meri)\s+(?:naam|nam)|my\s+name\s+is|my\s+name's|i\s+am\s+called|call\s+me)\s+[^\s,.!?।]+/giu;
  const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function redact(text, names) {
    let t = String(text == null ? "" : text).replace(EMAIL_RE, "…")
      .replace(NUMBER_RUN_RE, m => (hasPrivateNumber(m) ? "…" : m))
      .replace(NAME_INTRO, "$1 …");
    (Array.isArray(names) ? names : []).forEach(n => {
      n = String(n == null ? "" : n).trim();
      if (n.length < 2) return;
      t = t.replace(new RegExp("(^|[^\\p{L}\\p{M}\\p{N}])" + escapeRe(n) + "(?![\\p{L}\\p{M}\\p{N}])", "giu"), "$1");
    });
    return t.replace(/\s+([,!?।.])/g, "$1").replace(/\s+/g, " ").replace(/^[,\s]+/, "").trim();
  }
  function shorten(text) {
    if (text.length <= MAX_CHARS) return text;
    const cut = text.slice(0, MAX_CHARS - 1);
    const sp = cut.lastIndexOf(" ");
    return (sp > 100 ? cut.slice(0, sp) : cut) + "…";
  }
  function capReply(text) {
    const t = String(text).replace(/\s+/g, " ").trim();
    return t.length <= REPLY_MAX ? t : t.slice(0, REPLY_MAX - 1) + "…";
  }

  /* ---------------- Settings (grown-up's choice) and per-device state ---------------- */
  const raw = () => (NS.store && NS.store.raw) || null;
  function choice() {
    try {
      const s = NS.store.settings().aiChat;
      return s && typeof s === "object" ? s : null;
    } catch (e) { return null; }
  }
  function configured() {
    const base = NS.config && NS.config.API_BASE;
    return CFG.ENABLED !== false && typeof base === "string" &&
      /^(https:\/\/[^\s/?#]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)(\/[^\s?#]*)?$/.test(base.trim());
  }
  function enabled() {
    const c = choice();
    return !!(c && c.on === true && c.v === CONSENT_VERSION && configured());
  }
  function setEnabled(on) {
    on = on === true && configured();
    if (NS.store && typeof NS.store.setSetting === "function") NS.store.setSetting("aiChat", { on, v: CONSENT_VERSION, at: now() });
    const r = raw();
    if (r) r.del("ns_ai");                 // a new random id after every change
    pausedUntil = 0; failures = 0;
    sitting = { at: 0, answers: 0, nextBreak: 0 };
    return on;
  }
  const allowedFor = ageBand => ageBand === "4-5" || ageBand === "6+";
  function available(ctx) {
    if (!configured() || !enabled()) return false;
    if (ctx && !allowedFor(ctx.ageBand)) return false;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
    return now() >= pausedUntil;
  }
  /* 24 random characters (144 bits) — says nothing about the child or the phone. */
  function newId() {
    const a = new Uint8Array(24);
    try { crypto.getRandomValues(a); } catch (e) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); }
    let s = "";
    a.forEach(b => { s += "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".charAt(b & 63); });
    return s;
  }
  /* {device, day, n (AI answers today), limited (server said so), told (limit line said)} */
  function state() {
    let s = null;
    const r = raw();
    try { s = JSON.parse((r && r.get("ns_ai")) || "null"); } catch (e) { s = null; }
    if (!s || typeof s !== "object" || typeof s.device !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(s.device)) s = { device: newId() };
    if (s.day !== today()) { s.day = today(); s.n = 0; s.limited = false; s.told = false; }
    s.n = Number(s.n) || 0;
    return s;
  }
  function save(s) { const r = raw(); if (r) r.set("ns_ai", JSON.stringify(s)); }

  /* ---------------- The request ---------------- */
  function turnsOf(history) {
    return (Array.isArray(history) ? history : []).map(m => {
      if (!m || typeof m.text !== "string") return null;
      const role = m.role === "child" || m.who === "k" ? "child" : m.role === "buddy" || m.who === "b" ? "buddy" : null;
      return role ? { role, text: m.text } : null;
    }).filter(Boolean);
  }
  /* Drops screened child lines (and the buddy's answer to them), removes private details, keeps the
     last 8 lines and stays under the server's 8 KB limit. */
  function messagesFor(turns, names) {
    const out = [];
    let skip = false;
    turns.forEach(t => {
      if (t.role === "child") {
        skip = screen(t.text) !== null;
        if (skip) return;
      } else if (skip) { skip = false; return; }
      const text = shorten(redact(t.text, names));
      if (text) out.push({ role: t.role, text });
    });
    const msgs = out.slice(-MAX_TURNS);
    return msgs.length && msgs[msgs.length - 1].role === "child" ? msgs : [];
  }
  function bodyFor(msgs, ctx, device) {
    const body = { messages: msgs.slice(), lang: LANGS.includes(ctx.lang) ? ctx.lang : "hi", ageBand: ctx.ageBand, device };
    if (DAYPARTS.includes(ctx.daypart)) body.daypart = ctx.daypart;
    const size = () => (typeof TextEncoder === "function" ? new TextEncoder().encode(JSON.stringify(body)).length : JSON.stringify(body).length * 3);
    while (size() > MAX_BODY_BYTES && body.messages.length > 1) body.messages.shift();
    return size() > MAX_BODY_BYTES ? null : body;
  }
  function post(body) {
    const url = String(NS.config.API_BASE).trim().replace(/\/+$/, "") + "/api/chat";
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    let timer = null;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => { if (ctl) ctl.abort(); reject(new Error("timeout")); }, Number(CFG.TIMEOUT_MS) || 8000);
    });
    const req = fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer", signal: ctl ? ctl.signal : undefined,
    });
    return Promise.race([req, timeout]).finally(() => clearTimeout(timer));
  }
  function failed() {
    failures += 1;
    if (failures >= 2) { pausedUntil = now() + FAIL_PAUSE_MS; failures = 0; }
    return null;
  }
  function limitLine(s, lang) {
    if (s.told) return null;
    s.told = true;
    save(s);
    return { text: LIMIT[lang], mood: "sleepy", kind: "limit" };
  }
  function pickBreak(lang, daypart) {
    const pool = daypart === "night" ? BREAK.night : BREAK.day;
    return pool[sitting.answers / Math.max(1, CFG.SESSION_TURNS) % pool.length | 0][lang];
  }

  async function chat(history, ctx) {
    ctx = ctx || {};
    if (!available(ctx)) return null;
    const lang = LANGS.includes(ctx.lang) ? ctx.lang : "hi";
    const turns = turnsOf(history);
    if (!turns.length || turns[turns.length - 1].role !== "child") return null;
    const flagged = screen(turns[turns.length - 1].text);
    if (flagged) return { text: SAFE[flagged][lang], mood: flagged === "rude" ? "curious" : "caring", kind: "safety" };

    // A gentle break after every SESSION_TURNS AI answers in one sitting (no countdown, no guilt).
    const t = now();
    if (t - sitting.at > SESSION_GAP_MS) sitting = { at: t, answers: 0, nextBreak: Math.max(1, Number(CFG.SESSION_TURNS) || 10) };
    sitting.at = t;
    if (sitting.answers >= sitting.nextBreak) {
      sitting.nextBreak += Math.max(1, Number(CFG.SESSION_TURNS) || 10);
      return { text: pickBreak(lang, ctx.daypart), mood: "calm", kind: "break" };
    }

    const s = state();
    if (s.limited || s.n >= (Number(CFG.DAILY_LIMIT) || 30)) return limitLine(s, lang);
    const msgs = messagesFor(turns, ctx.names);
    const body = msgs.length ? bodyFor(msgs, ctx, s.device) : null;
    if (!body) return null;
    save(s);

    let res;
    try { res = await post(body); } catch (e) { return failed(); }
    if (res.status === 429) { s.limited = true; save(s); return limitLine(s, lang); }
    if (res.status === 503 || res.status === 403) { pausedUntil = now() + PAUSE_MS; return null; }
    if (!res.ok) return failed();
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!data || typeof data.text !== "string" || !data.text.trim() || data.text.length > 1000) return failed();
    failures = 0;
    const kind = ["ai", "redirect", "safety"].includes(data.kind) ? data.kind : "ai";
    if (kind !== "safety") {                       // the model was asked: it counts
      const fresh = state();
      fresh.n += 1;
      save(fresh);
      sitting.answers += 1;
    }
    return { text: capReply(data.text), mood: MOODS.includes(data.mood) ? data.mood : "happy", kind };
  }

  /* ---------------- Grown-ups' screens ---------------- */
  const G = o => NS.t(o, NS.lang && NS.lang() === "en" ? "en" : "hi");
  const T = {
    title: { hi: "मिट्ठू से खुली बातचीत (AI)", en: "Open chat with Mitthu (AI)" },
    on: { hi: "चालू", en: "On" }, off: { hi: "बंद", en: "Off" },
    cardNote: {
      hi: "शुरू में बंद। चालू करने पर, जब मिट्ठू के पास ऐप में लिखा जवाब नहीं होता, वह इंटरनेट से एक AI से छोटा जवाब लेता है। बच्चे का नाम या आवाज़ कभी नहीं भेजी जाती। 2–3 साल के बच्चों के लिए हमेशा बंद।",
      en: "Off at first. When on, and मिट्ठू has no answer of its own, it asks an AI over the internet for a short reply. Your child's name or voice is never sent. Always off for 2–3 year olds.",
    },
    notConfigured: {
      hi: "अभी उपलब्ध नहीं — ऐप के सर्वर पर AI सेट नहीं है।",
      en: "Not available yet — AI is not set up on the app's server.",
    },
  };
  const CONSENT = {
    hi: [
      "जब मिट्ठू के पास ऐप में पहले से लिखा कोई जवाब नहीं होता, तब वह एक AI (कंप्यूटर भाषा मॉडल) से एक-दो छोटे वाक्य बनवाता है, ताकि बातचीत चलती रहे। सुरक्षा, आदतें, गिनती और खेल पहले की तरह फ़ोन पर ही चलते हैं।",
      "क्या भेजा जाता है: सिर्फ़ मिट्ठू से हुई बातचीत की आख़िरी कुछ लाइनें (ज़्यादा से ज़्यादा 8), भाषा, उम्र-समूह (जैसे 4–5), दिन का समय, और रोज़ की सीमा गिनने के लिए इस फ़ोन का एक random नंबर। बच्चे का नाम, आवाज़ की रिकॉर्डिंग, फ़ोटो, प्रोफ़ाइल या प्रगति कभी नहीं। 6 या ज़्यादा अंकों वाले नंबर, ईमेल और बच्चे का नाम भेजने से पहले फ़ोन पर ही हटा दिए जाते हैं।",
      "किसे: हमारे सर्वर (Cloudflare Worker) को, जो इसे ऐप के मालिक की चुनी AI सेवा (Cloudflare Workers AI या Anthropic का Claude) को भेजता है।",
      "हम कुछ जमा नहीं करते: हमारा सर्वर बातचीत न सेव करता है, न लॉग करता है। AI सेवाएँ इसे सिर्फ़ जवाब बनाने के लिए प्रोसेस करती हैं और इससे अपने AI को ट्रेन नहीं करतीं (ब्योरा गोपनीयता नीति में)।",
      "सुरक्षा: निजी बातें और डराने या गलत बातें AI तक नहीं जातीं; AI के हर जवाब की भी जाँच होती है। फिर भी AI गलती कर सकता है — कभी-कभी साथ बैठकर सुनें।",
      "मिट्ठू एक कंप्यूटर प्रोग्राम है, इंसान नहीं — पूछने पर वह बच्चे को भी यही बताता है, और उसे घर वालों और दोस्तों के साथ खेलने भेजता है।",
      "सीमाएँ: 2–3 साल के बच्चों के लिए AI हमेशा बंद रहता है (वे ऐप वाले मिट्ठू से ही बात करते हैं)। 4–6 साल वालों के लिए: इस फ़ोन पर दिन में ज़्यादा से ज़्यादा {n} AI जवाब, और हर {s} जवाब के बाद मिट्ठू ब्रेक या बाहर खेलने का सुझाव देता है। इंटरनेट चाहिए।",
      "आप इसे कभी भी यहीं से बंद कर सकते हैं। चालू करके आप पुष्टि करते हैं कि आप बच्चे के माता-पिता या अभिभावक हैं और इसकी सहमति देते हैं।",
    ],
    en: [
      "When मिट्ठू has no answer written in the app, it asks an AI (a computer language model) for one or two short sentences, so the chat can go on. Safety, habits, counting and games still run on the phone as before.",
      "What is sent: only the last few lines of the chat with मिट्ठू (at most 8), the language, the age band (e.g. 4–5), the time of day, and a random number for this phone to count the daily limit. Never your child's name, voice recordings, photos, profile or progress. Numbers of 6 or more digits, e-mail addresses and your child's name are removed on the phone before sending.",
      "To whom: our server (a Cloudflare Worker), which passes it to the AI service chosen by the app's owner (Cloudflare Workers AI or Anthropic's Claude).",
      "We keep nothing: our server neither saves nor logs the chat. The AI services process it only to answer and do not train their AI on it (details in the privacy policy).",
      "Safety: private details and scary or harmful words never reach the AI, and every AI answer is checked too. AI can still make mistakes — listen in now and then.",
      "मिट्ठू is a computer program, not a person — it tells your child so when asked, and sends them off to play with family and friends.",
      "Limits: always off for 2–3 year olds (they talk to the built-in मिट्ठू only). For 4–6 year olds: at most {n} AI answers a day on this phone, and after every {s} answers मिट्ठू suggests a break or outdoor play. Needs the internet.",
      "You can turn it off here at any time. By turning it on you confirm that you are the child's parent or guardian and give your consent.",
    ],
  };
  const fill = s => s.replace("{n}", String(Number(CFG.DAILY_LIMIT) || 30)).replace("{s}", String(Number(CFG.SESSION_TURNS) || 10));

  function settingsCard() {
    const el = NS.el;
    const c = el("section", "pcard");
    c.id = "aiCard";
    const h = el("h3", "pcard-h");
    const icon = el("span", null, "✨");
    icon.setAttribute("aria-hidden", "true");
    h.append(icon, el("span", null, G(T.title)));
    const on = enabled();
    const stateText = el("span", "switch-state", on ? G(T.on) : G(T.off));
    const sw = NS.button("", "switch", () => {
      if (enabled()) {
        setEnabled(false);
        sw.setAttribute("aria-checked", "false");
        stateText.textContent = G(T.off);
      } else {
        consent(() => (NS.ui && typeof NS.ui.parents === "function" ? NS.ui.parents() : NS.home && NS.home()));
      }
    }, G(T.title));
    sw.id = "aiSwitch";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-checked", String(on));
    if (!configured()) sw.disabled = true;
    const row = el("div", "row-inline");
    row.append(sw, stateText);
    c.append(h, row, el("p", "psmall", configured() ? G(T.cardNote) : G(T.notConfigured)));
    return c;
  }

  /* The consent screen (also the place to turn it off). Show it only behind NS.billing.gate. */
  function consent(onDone) {
    const el = NS.el;
    const done = () => { if (typeof onDone === "function") onDone(); else if (NS.home) NS.home(); };
    if (!NS.ui || typeof NS.ui.panel !== "function") return;
    const box = NS.ui.panel(G(T.title));
    if (typeof NS.ui.setTop === "function") NS.ui.setTop("✨ " + G(T.title), true);
    box.classList.add("ai-consent");
    const on = enabled();
    box.appendChild(el("p", "plead", on
      ? G({ hi: "अभी चालू है। नीचे से बंद कर सकते हैं।", en: "It is on now. You can turn it off below." })
      : G({ hi: "चालू करने से पहले कृपया पढ़ें:", en: "Please read before turning it on:" })));
    const hi = el("ul", "facts");
    hi.setAttribute("lang", "hi");
    CONSENT.hi.forEach(s => hi.appendChild(el("li", null, fill(s))));
    const en = el("ul", "facts");
    en.setAttribute("lang", "en");
    CONSENT.en.forEach(s => en.appendChild(el("li", null, fill(s))));
    box.append(hi, el("p", "plabel", "English"), en);
    if (!configured()) box.appendChild(el("p", "pmsg", G(T.notConfigured)));
    const msg = el("p", "pmsg", "");
    msg.setAttribute("role", "status");
    if (on) {
      const off = NS.button(G({ hi: "बंद करें", en: "Turn off" }) + " · " + G({ hi: "Turn off", en: "बंद करें" }), "pbtn danger", () => { setEnabled(false); done(); });
      off.id = "aiOff";
      box.append(off, NS.button(G({ hi: "वापस", en: "Back" }), "pbtn secondary", done));
    } else {
      const yes = NS.button(G({ hi: "हाँ, मैं माता-पिता / अभिभावक हूँ — चालू करें", en: "Yes, I am the parent / guardian — turn it on" }), "pbtn", () => {
        if (!setEnabled(true)) { msg.textContent = G(T.notConfigured); return; }
        done();
      });
      yes.id = "aiOn";
      if (!configured()) yes.disabled = true;
      const no = NS.button(G({ hi: "नहीं, बंद रखें", en: "No, keep it off" }), "pbtn secondary", () => { setEnabled(false); done(); });
      no.id = "aiKeepOff";
      box.append(yes, no);
    }
    const legal = el("p", "psmall plegal");
    const a = el("a", null, G({ hi: "गोपनीयता नीति: AI बातचीत", en: "Privacy policy: AI chat" }));
    a.href = "legal/privacy.html#ai";
    legal.appendChild(a);
    box.append(msg, legal);
  }

  NS.ai = { configured, enabled, setEnabled, allowedFor, available, chat, screen, redact, settingsCard, consent };
})();
