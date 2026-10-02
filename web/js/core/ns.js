/* नन्हा स्कूल — core namespace (window.NS): config, activity registry, event bus, helpers,
   UI strings and the Android bridge entry point. Loaded right after config.js.

   Public API used by every module (see docs/ARCHITECTURE.md):
     NS.registerActivity(def)        add a home tile + screen (contract in ARCHITECTURE.md)
     NS.activities()                 registered activities, sorted by section/order
     NS.activity(id)                 one activity definition (or null)
     NS.on(name, fn) -> off()        subscribe; NS.off(name, fn); NS.emit(name, payload)
     NS.el(tag, cls, text)           element builder (text via textContent only)
     NS.button(label, cls, onClick, ariaLabel?)
     NS.t(obj, lang?)                pick {hi, en, hinglish} (falls back hi → en)
     NS.tr(key, vars?)               core UI string in the current language
     NS.daypart(date?)               "morning" | "noon" | "evening" | "night"
     NS.now()                        Date.now() (one place, so tests can fake the clock)
     NS.lang()                       current UI language ("hi" | "en" | "hinglish")
     NS.setLang(lang)                change the current profile's language, persist, re-render,
                                     emit "lang:changed" {lang}
     NS.speechLang(lang)             "hi" | "en" — the voice language for a UI language
     NS.stripEmoji(text)             remove emoji (never read aloud; also used for clip keys)
     NS.open(id), NS.home()          navigation (set by ui.js)
     NS.native                       Android bridge: NS.native.available, NS.native.onEvent(json)
   Filled in by later core files: NS.store, NS.voice, NS.rewards, NS.billing, NS.ui, NS.mascot. */
(function () {
  "use strict";

  const CFG = Object.assign({
    API_BASE: "", PUBLIC_KEY_JWK: null, TRIAL_DAYS: 7, PRICE_TEXT: "",
    PLANS: null, PAY_PAGE_URL: "",
    FREE: ["ABC", "अक्षर", "गिनती"], FREE_RHYMES: 2,
    SESSION_MINUTES: 15, BEDTIME_HOUR: 20,
  }, window.NS_CONFIG || {});

  const NS = window.NS = window.NS || {};
  NS.version = 2;
  NS.config = CFG;
  NS.content = NS.content || {};

  /* ---------------- Activity registry ---------------- */
  const SECTIONS = ["learn", "grow", "play"];
  const registry = new Map();
  NS.SECTIONS = SECTIONS;
  NS.registerActivity = function (def) {
    if (!def || typeof def.id !== "string" || !/^[a-z][a-z0-9]*$/.test(def.id) || typeof def.open !== "function") {
      console.warn("NS.registerActivity: ignored an invalid activity", def && def.id);
      return;
    }
    const a = Object.assign({ icon: "⭐", title: { hi: def.id }, color: "#7E57C2", section: "play", free: false, order: 100 }, def);
    if (!SECTIONS.includes(a.section)) a.section = "play";
    registry.set(a.id, a);
    NS.emit("activity:registered", { id: a.id });
  };
  NS.activity = id => registry.get(id) || null;
  NS.activities = function () {
    return [...registry.values()].sort((x, y) =>
      SECTIONS.indexOf(x.section) - SECTIONS.indexOf(y.section) || (x.order - y.order) || (x.id < y.id ? -1 : 1));
  };

  /* ---------------- Event bus ---------------- */
  const handlers = new Map();
  NS.on = function (name, fn) {
    if (!handlers.has(name)) handlers.set(name, new Set());
    handlers.get(name).add(fn);
    return () => NS.off(name, fn);
  };
  NS.off = (name, fn) => { const s = handlers.get(name); if (s) s.delete(fn); };
  NS.emit = function (name, payload) {
    const s = handlers.get(name);
    if (!s) return;
    [...s].forEach(fn => { try { fn(payload); } catch (e) { console.error("NS event " + name, e); } });
  };

  /* ---------------- DOM helpers (text only — nothing here ever parses HTML) ---------------- */
  NS.el = function (tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  /* True when a label is only emoji/symbols, so it needs an aria-label to be understood. */
  NS.isEmojiOnly = s => !NS.stripEmoji(String(s || "")).replace(/[\s◀▶⏹⬅➡✓✕×+\-]/g, "");
  NS.button = function (label, cls, onClick, ariaLabel) {
    const b = NS.el("button", "btn" + (cls ? " " + cls : ""), label);
    b.type = "button";
    if (ariaLabel) b.setAttribute("aria-label", ariaLabel);
    if (onClick) b.addEventListener("click", onClick);
    return b;
  };
  const SVGNS = "http://www.w3.org/2000/svg";
  NS.svg = function (tag, attrs, children) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    (children || []).forEach(c => e.appendChild(c));
    return e;
  };

  /* ---------------- Language ---------------- */
  NS.LANGS = ["hi", "en", "hinglish"];
  NS.lang = () => {
    const p = NS.store && NS.store.current();
    return (p && NS.LANGS.includes(p.lang)) ? p.lang : "hi";
  };
  NS.t = function (obj, lang) {
    if (obj == null) return "";
    if (typeof obj === "string") return obj;
    const l = lang || NS.lang();
    if (obj[l] != null) return obj[l];
    return obj.hi != null ? obj.hi : (obj.en != null ? obj.en : "");
  };
  /* Hinglish is Hindi written casually in Latin letters: it is spoken with the Hindi voice. */
  NS.speechLang = lang => (lang === "en" ? "en" : "hi");
  /* BCP-47 tag for <html lang> / lang attributes. */
  NS.langTag = lang => (lang === "en" ? "en" : lang === "hinglish" ? "hi-Latn" : "hi");
  NS.setLang = function (lang) {
    if (!NS.LANGS.includes(lang)) return false;
    const p = NS.store && NS.store.current();
    if (!p) return false;
    if (p.lang === lang) return true;
    NS.store.updateProfile(p.id, { lang });
    NS.emit("lang:changed", { lang });
    return true;
  };

  /* Emoji are never read aloud. Same rule is used for the voice-clip keys (see voice.js). */
  const EMOJI_RE = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}]/gu;
  NS.stripEmoji = text => String(text == null ? "" : text).replace(EMOJI_RE, " ").replace(/\s+/g, " ").trim();

  /* ---------------- Time ---------------- */
  NS.now = () => Date.now();
  NS.daypart = function (date) {
    const h = (date || new Date(NS.now())).getHours();
    if (h >= 5 && h < 11) return "morning";
    if (h >= 11 && h < 15) return "noon";
    if (h >= 15 && h < 19) return "evening";
    return "night";
  };
  NS.dayKey = function (date) {
    const d = date || new Date(NS.now());
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };

  /* ---------------- Android shell bridge ---------------- */
  NS.native = {
    available: !!window.NanhaNative,
    /* The shell calls window.NS.native.onEvent(jsonString); each event is re-emitted as
       "native:<type>" (e.g. "native:speak-done", "native:listen-result", "native:resume"). */
    onEvent(json) {
      let ev;
      try { ev = typeof json === "string" ? JSON.parse(json) : json; } catch (e) { return; }
      if (!ev || typeof ev.type !== "string") return;
      NS.emit("native:" + ev.type, ev);
    },
    call(method, ...args) {
      try { const N = window.NanhaNative; return N && typeof N[method] === "function" ? N[method](...args.map(String)) : null; }
      catch (e) { return null; }
    },
  };

  /* ---------------- Core UI strings ---------------- */
  const S = {
    appName: { hi: "नन्हा स्कूल", en: "Nanha School", hinglish: "Nanha School" },
    home: { hi: "घर", en: "Home", hinglish: "Ghar" },
    back: { hi: "वापस", en: "Back", hinglish: "Wapas" },
    sound: { hi: "आवाज़", en: "Sound", hinglish: "Awaaz" },
    grownups: { hi: "बड़ों के लिए", en: "For grown-ups", hinglish: "Bado ke liye" },
    mascotName: { hi: "मिट्ठू", en: "Mitthu", hinglish: "Mitthu" },
    morning: { hi: "सुप्रभात", en: "Good morning", hinglish: "Good morning" },
    noon: { hi: "नमस्ते", en: "Hello", hinglish: "Namaste" },
    evening: { hi: "शुभ संध्या", en: "Good evening", hinglish: "Good evening" },
    night: { hi: "शुभ रात्रि", en: "Good night", hinglish: "Shubh ratri" },
    greetMorning: { hi: "सुप्रभात{name}! चलो, आज कुछ नया सीखें!", en: "Good morning{name}! Let's learn something new today!", hinglish: "Good morning{name}! Chalo, aaj kuch naya seekhein!" },
    greetNoon: { hi: "नमस्ते{name}! किसी भी तस्वीर पर दबाओ।", en: "Hello{name}! Tap any picture.", hinglish: "Namaste{name}! Kisi bhi picture pe dabao." },
    greetEvening: { hi: "शुभ संध्या{name}! क्या खेलें?", en: "Good evening{name}! What shall we play?", hinglish: "Good evening{name}! Kya khelein?" },
    greetNight: { hi: "शुभ रात्रि{name}! अब सोने की तैयारी करें?", en: "Good night{name}! Shall we get ready for bed?", hinglish: "Shubh ratri{name}! Ab sone ki taiyari karein?" },
    secLearn: { hi: "सीखो", en: "Learn", hinglish: "Seekho" },
    secGrow: { hi: "अच्छी आदतें", en: "Good habits", hinglish: "Achhi aadatein" },
    secPlay: { hi: "खेलो", en: "Play", hinglish: "Khelo" },
    bedtime: { hi: "सोने की तैयारी", en: "Bedtime", hinglish: "Sone ki taiyari" },
    bedtimeSub: { hi: "लोरी सुनो और सो जाओ", en: "A lullaby, then sleep", hinglish: "Lori suno aur so jao" },
    locked: { hi: "बंद है", en: "locked", hinglish: "band hai" },
    askGrownUp: { hi: "ये खोलने के लिए मम्मी या पापा को बुलाओ", en: "Ask Mummy or Papa to open this", hinglish: "Ye kholne ke liye Mummy ya Papa ko bulao" },
    shabash: { hi: "शाबाश!", en: "Well done!", hinglish: "Shabash!" },
    newSticker: { hi: "नया स्टिकर!", en: "A new sticker!", hinglish: "Naya sticker!" },
    stickerBook: { hi: "मेरी स्टिकर किताब", en: "My sticker book", hinglish: "Meri sticker kitaab" },
    stickerEmpty: { hi: "अभी कोई स्टिकर नहीं। खेलो और सीखो — स्टिकर यहाँ आएँगे!", en: "No stickers yet. Play and learn — they will appear here!", hinglish: "Abhi koi sticker nahi. Khelo aur seekho — stickers yahan aayenge!" },
    stickerCount: { hi: "तुम्हारे पास {n} स्टिकर हैं!", en: "You have {n} stickers!", hinglish: "Tumhare paas {n} stickers hain!" },
    whoPlays: { hi: "कौन खेल रहा है?", en: "Who is playing?", hinglish: "Kaun khel raha hai?" },
    switchPlayer: { hi: "खिलाड़ी बदलो", en: "Change player", hinglish: "Player badlo" },
    addChild: { hi: "नया बच्चा", en: "New child", hinglish: "Naya bachcha" },
    friend: { hi: "दोस्त", en: "friend", hinglish: "dost" },
    // first run
    hello: { hi: "नमस्ते! मैं मिट्ठू हूँ। चलो, दोस्ती करें!", en: "Hello! I am Mitthu. Let's be friends!", hinglish: "Namaste! Main Mitthu hoon. Chalo, dosti karein!" },
    letsGo: { hi: "चलो!", en: "Let's go!", hinglish: "Chalo!" },
    pickAvatar: { hi: "अपनी तस्वीर चुनो!", en: "Pick your picture!", hinglish: "Apni picture chuno!" },
    askName: { hi: "तुम्हारा नाम क्या है? मम्मी-पापा लिख सकते हैं।", en: "What is your name? A grown-up can type it.", hinglish: "Tumhara naam kya hai? Mummy-Papa likh sakte hain." },
    namePlaceholder: { hi: "नाम (ज़रूरी नहीं)", en: "Name (optional)", hinglish: "Naam (optional)" },
    skip: { hi: "छोड़ो", en: "Skip", hinglish: "Chhodo" },
    next: { hi: "आगे", en: "Next", hinglish: "Aage" },
    askAge: { hi: "तुम कितने साल के हो?", en: "How old are you?", hinglish: "Tum kitne saal ke ho?" },
    age23: { hi: "2–3 साल", en: "2–3 years", hinglish: "2–3 saal" },
    age45: { hi: "4–5 साल", en: "4–5 years", hinglish: "4–5 saal" },
    age6: { hi: "6+ साल", en: "6+ years", hinglish: "6+ saal" },
    askVoice: { hi: "किसकी आवाज़ सुनोगे? दीदी या भैया?", en: "Whose voice do you like? Didi or Bhaiya?", hinglish: "Kiski awaaz sunoge? Didi ya Bhaiya?" },
    didi: { hi: "दीदी", en: "Didi", hinglish: "Didi" },
    bhaiya: { hi: "भैया", en: "Bhaiya", hinglish: "Bhaiya" },
    sampleFemale: { hi: "नमस्ते! मैं तुम्हारी दीदी हूँ। चलो साथ में सीखें!", en: "Hello! I am your Didi. Let's learn together!", hinglish: "Namaste! Main tumhari Didi hoon. Chalo saath mein seekhein!" },
    sampleMale: { hi: "नमस्ते! मैं तुम्हारा भैया हूँ। चलो साथ में सीखें!", en: "Hello! I am your Bhaiya. Let's learn together!", hinglish: "Namaste! Main tumhara Bhaiya hoon. Chalo saath mein seekhein!" },
    askLang: { hi: "कौन सी भाषा?", en: "Which language?", hinglish: "Kaun si bhasha?" },
    ready: { hi: "बहुत बढ़िया! चलो, शुरू करें!", en: "Wonderful! Let's start!", hinglish: "Bahut badhiya! Chalo, shuru karein!" },
    // wind-down
    restTitle: { hi: "चलो, अब थोड़ा आराम और खेल!", en: "Time for a little break!", hinglish: "Chalo, ab thoda aaram aur khel!" },
    restSay: { hi: "आज हमने बहुत कुछ सीखा! अब फ़ोन को आराम करने दो। चलो, {idea}", en: "We learned so much today! Let the phone rest now. Let's {idea}", hinglish: "Aaj humne bahut kuch seekha! Ab phone ko aaram karne do. Chalo, {idea}" },
    restMore: { hi: "बड़ों के लिए: थोड़ा और?", en: "Grown-ups: a little more?", hinglish: "Bado ke liye: thoda aur?" },
    // generic
    again: { hi: "फिर से", en: "Again", hinglish: "Phir se" },
    listen: { hi: "सुनो", en: "Listen", hinglish: "Suno" },
    stop: { hi: "रुको", en: "Stop", hinglish: "Ruko" },
    oops: { hi: "ओह! कुछ गड़बड़ हुई। चलो घर चलें।", en: "Oops! Something went wrong. Let's go home.", hinglish: "Oh! Kuch gadbad hui. Chalo ghar chalein." },
    install: { hi: "ऐप इंस्टॉल करें", en: "Install the app", hinglish: "App install karein" },
  };
  NS.strings = S;
  NS.tr = function (key, vars, lang) {
    let s = NS.t(S[key] || key, lang);
    for (const k in vars || {}) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  };
})();
