/* नन्हा स्कूल — voice: speech out and speech in, as human as the device allows.

   SPEECH OUT, in this order:
   1. Recorded / neural voice clips, if web/audio/manifest.json exists:
        {
          "version": 1,
          "clips": {
            "female": { "hi|अ से अनार": "audio/female/hi/0001.mp3", "en|A for Apple": "audio/female/en/0001.mp3" },
            "male":   { "hi|अ से अनार": "audio/male/hi/0001.mp3" }
          }
        }
      Key = <lang> + "|" + <normalized text>
        lang: the SPEECH language, "hi" or "en" (Hinglish UI text is spoken with the Hindi voice,
              so its key starts with "hi|").
        normalized text: the exact string the app speaks, with emoji removed, whitespace runs
              collapsed to one space, and trimmed:
                text.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{FE0E}\u{200D}\u{20E3}]/gu, " ")
                    .replace(/\s+/g, " ").trim()
              Punctuation and letter case are kept as they are.
        Paths are relative to index.html (same origin only). A clip is looked up for the whole
        text first, then for each phrase (the text split after । . ! ? , ; : and line breaks,
        each phrase normalized the same way). Clips are played with an <audio> element and cached
        by the service worker on first play (never precached).
   2. Android shell: window.NanhaNative (see docs/ARCHITECTURE.md "Native bridge"); the voice is
      chosen by gender and language from NanhaNative.voices(), on-device voices first.
   3. Web Speech API: the most natural voice for the language and gender (on-device first, then
      names known to sound natural); if no voice of the wanted gender exists, the best voice is
      used with a gentle pitch shift (male 0.85, female 1.1).
   Delivery: short phrases with natural pauses (works around Chrome's long-utterance cutoff),
   a slower rate for 2–3 year olds, never reads emoji.

   SPEECH IN (only after a grown-up turns the mic on in settings; off by default):
   Android shell → NanhaNative.listen (on-device). Browser → Web Speech recognition with
   processLocally = true where supported; some browsers send the audio to their speech service.

   API: NS.voice.say(text, {lang, rate, onStart}) → Promise, sayLines(lines, lang, {onLine}),
        stop(), listen({lang}) → Promise<string|null>, canListen(), voiceList(lang),
        pick(lang, gender, voices) (web voice choice; exposed for tests), clipKey(lang, text). */
(function () {
  "use strict";
  const NS = window.NS;
  const synth = window.speechSynthesis || null;
  let gen = 0;                 // bumps on every new say()/stop(): stale speech chains end quietly
  let audio = null;            // the one <audio> element for clips
  let currentUtter = null;     // keep a reference (Chrome garbage-collects utterances mid-speech)

  /* ---------------- Clips ---------------- */
  let clips = null, clipsPromise = null;
  function loadClips() {
    if (!clipsPromise) {
      clipsPromise = fetch("audio/manifest.json", { credentials: "same-origin", cache: "no-cache" })
        .then(r => (r.ok ? r.json() : null))
        .then(j => { if (j && j.version === 1 && j.clips && typeof j.clips === "object") clips = j.clips; })
        .catch(() => {});
    }
    return clipsPromise;
  }
  const clipKey = (lang, text) => NS.speechLang(lang) + "|" + NS.stripEmoji(text);
  function clipFor(gender, lang, text) {
    if (!clips) return null;
    const key = clipKey(lang, text);
    const g = clips[gender] && clips[gender][key];
    const other = clips[gender === "male" ? "female" : "male"];
    const src = g || (other && other[key]) || null;   // any human clip beats a robot voice
    return typeof src === "string" && /^audio\/[\w\-./]+$/.test(src) && !src.includes("..") ? src : null;
  }
  function playClip(src, myGen) {
    return new Promise(resolve => {
      if (myGen !== gen) return resolve();
      if (!audio) audio = new Audio();
      let done = false;
      const finish = () => { if (done) return; done = true; audio.onended = audio.onerror = null; resolve(); };
      audio.onended = finish;
      audio.onerror = finish;
      audio.src = src;
      audio.playbackRate = 1;
      const p = audio.play();
      if (p && p.catch) p.catch(finish);
      setTimeout(finish, 30000);
    });
  }

  /* ---------------- Text → phrases ---------------- */
  function cleanForSpeech(text) {
    return NS.stripEmoji(String(text || "").replace(/[·•|]/g, ", ").replace(/[“”"«»]/g, "").replace(/\n+/g, "। "))
      .replace(/\s+([,।.!?])/g, "$1").replace(/(,\s*){2,}/g, ", ").replace(/^[,\s]+|[,\s]+$/g, "");
  }
  /* Short phrases sound more natural and avoid Chrome cutting off long utterances (~15 s). */
  function phrases(text) {
    const parts = String(text).split(/(?<=[।॥.!?;:,\n])\s+/).map(s => s.trim()).filter(Boolean);
    const out = [];
    parts.forEach(p => {
      while (p.length > 160) {
        const cut = p.lastIndexOf(" ", 150);
        const at = cut > 40 ? cut : 150;
        out.push(p.slice(0, at)); p = p.slice(at).trim();
      }
      if (p) out.push(p);
    });
    return out;
  }
  const pauseAfter = p => (/[।॥.!?]$/.test(p) ? 260 : /[,;:]$/.test(p) ? 90 : 120);
  const wait = (ms, myGen) => new Promise(r => setTimeout(r, myGen === gen ? ms : 0));

  /* ---------------- Voice choice ---------------- */
  const FEMALE = /female|\bwoman\b|swara|kalpana|lekha|heera|aditi|neerja|veena|kajal|ananya|aarohi|zira|\baria\b|jenny|samantha|karen|moira|tessa|fiona|victoria|susan|hazel|libby|sonia|natasha|salli|joanna|kendra|kimberly|ivy|raveena|isha|priya|shruti|sapna|pallavi|google हिन्दी|google us english|x-hia|x-hic/i;
  const MALE = /\bmale\b|\bman\b|madhur|hemant|rishi|\bravi\b|prabhat|aarav|kunal|david|\bmark\b|\bguy\b|\balex\b|daniel|\bfred\b|george|ryan|thomas|arthur|matthew|joey|justin|brian|aaron|prakash|x-hid|x-hie/i;
  const NATURAL = /natural|neural|premium|enhanced|wavenet|google|swara|madhur|kalpana|hemant|lekha|rishi|heera|ravi|aditi|neerja|prabhat/i;
  function genderOf(name) {
    const n = String(name || "");
    if (/female/i.test(n)) return "female";
    if (MALE.test(n) && !FEMALE.test(n)) return "male";
    if (FEMALE.test(n)) return "female";
    return "unknown";
  }
  const norm = l => String(l || "").toLowerCase().replace("_", "-");
  function langMatches(v, lang) {
    const l = norm(v.lang);
    if (lang === "hi") return l.startsWith("hi") || /hindi|हिन्दी|हिंदी/i.test(v.name || v.label || "");
    return l.startsWith("en");
  }
  /* Scores voices for a language and gender. On-device voices always come first: with a network
     voice the browser sends the text (which can include the child's name) to an online service. */
  function score(v, lang, gender) {
    const name = v.name || v.label || "";
    const g = v.gender && v.gender !== "unknown" ? v.gender : genderOf(name);
    let s = 0;
    if (v.localService === true || v.local === true) s += 100;
    if (g === gender) s += 40; else if (g !== "unknown") s -= 20;
    if (NATURAL.test(name)) s += 20;
    const l = norm(v.lang);
    if (lang === "en") s += l === "en-in" ? 8 : l === "en-gb" ? 5 : l === "en-us" ? 4 : 0;
    if (lang === "hi" && l === "hi-in") s += 3;
    if (v.default) s += 1;
    return s;
  }
  /* Web Speech voice for (lang, gender) → {voice, pitchShift} or null when no voice fits. */
  function pick(lang, gender, list) {
    const all = list || webVoices();
    const cands = all.filter(v => langMatches(v, lang));
    if (!cands.length) return null;
    const want = NS.store ? NS.store.settings().voicePick[lang + "|" + gender] : null;
    let best = want ? cands.find(v => (v.voiceURI || v.name || v.id) === want) : null;
    if (!best) best = cands.slice().sort((a, b) => score(b, lang, gender) - score(a, lang, gender))[0];
    const g = best.gender && best.gender !== "unknown" ? best.gender : genderOf(best.name || best.label);
    let pitchShift = 1;
    if (gender === "male" && g !== "male") pitchShift = 0.85;
    if (gender === "female" && g === "male") pitchShift = 1.1;
    return { voice: best, pitchShift };
  }

  let webList = [];
  function webVoices() {
    if (!synth) return [];
    try { const v = synth.getVoices(); if (v && v.length) webList = v; } catch (e) {}
    return webList;
  }
  /* getVoices() is empty until the browser has loaded them (Chrome, Safari): wait a moment once. */
  let voicesReady = null;
  function whenVoices() {
    if (!synth) return Promise.resolve();
    if (webVoices().length) return Promise.resolve();
    if (!voicesReady) {
      voicesReady = new Promise(res => {
        const done = () => { webVoices(); res(); };
        try { synth.addEventListener("voiceschanged", done, { once: true }); } catch (e) {}
        setTimeout(done, 1200);
      });
    }
    return voicesReady;
  }
  if (synth) { webVoices(); try { synth.addEventListener("voiceschanged", webVoices); } catch (e) {} }

  /* The shell returns [] until its engine is ready, then sends {"type":"voices"}. */
  let nativeList = null;
  function nativeVoices() {
    if (nativeList) return nativeList;
    let list;
    try { list = JSON.parse(NS.native.call("voices") || "[]"); } catch (e) { list = []; }
    if (!Array.isArray(list)) list = [];
    if (list.length) nativeList = list;
    return list;
  }
  function pickNative(lang, gender) {
    const cands = nativeVoices().filter(v => v && langMatches({ lang: v.lang, name: v.label }, lang));
    if (!cands.length) return { voice: null, pitchShift: gender === "male" ? 0.85 : 1 };
    const want = NS.store ? NS.store.settings().voicePick[lang + "|" + gender] : null;
    let best = want ? cands.find(v => v.id === want) : null;
    if (!best) best = cands.slice().sort((a, b) => score(b, lang, gender) - score(a, lang, gender))[0];
    let pitchShift = 1;
    if (gender === "male" && best.gender !== "male") pitchShift = 0.85;
    if (gender === "female" && best.gender === "male") pitchShift = 1.1;
    return { voice: best, pitchShift };
  }

  /* ---------------- Delivery ---------------- */
  function delivery(gender) {
    const p = NS.store && NS.store.current();
    const s = NS.store ? NS.store.settings() : { speed: "normal" };
    const age = p ? p.ageBand : "4-5";
    let rate = age === "2-3" ? 0.84 : age === "4-5" ? 0.9 : 0.96;
    if (s.speed === "slow") rate *= 0.85;
    const pitch = gender === "male" ? 1.0 : 1.06;   // a little warmer for Didi
    return { rate, pitch };
  }
  const langTag = l => (l === "en" ? "en-IN" : "hi-IN");

  let nativeSeq = 0;
  function speakNative(text, lang, gender, opt, myGen) {
    return new Promise(resolve => {
      const { voice, pitchShift } = pickNative(lang, gender);
      const d = delivery(gender);
      const id = "s" + (++nativeSeq);
      let done = false;
      const finish = () => { if (done) return; done = true; off(); resolve(); };
      const off = NS.on("native:speak-done", ev => { if (ev.id === id) finish(); });
      NS.native.call("speak", id, text, langTag(lang), voice ? voice.id : "", (opt.rate || d.rate).toFixed(2), (d.pitch * pitchShift).toFixed(2));
      setTimeout(finish, 4000 + text.length * 200);
      const check = setInterval(() => { if (myGen !== gen) { clearInterval(check); finish(); } else if (done) clearInterval(check); }, 250);
    });
  }
  function speakWeb(text, lang, gender, opt, myGen) {
    return new Promise(resolve => {
      if (!synth) return resolve();
      const d = delivery(gender);
      const choice = pick(lang, gender);
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(guard); resolve(); };
      let guard;
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = choice && choice.voice.lang ? choice.voice.lang : langTag(lang);
        if (choice) u.voice = choice.voice;
        u.rate = opt.rate || d.rate;
        u.pitch = Math.min(2, d.pitch * (choice ? choice.pitchShift : (gender === "male" ? 0.85 : 1)));
        u.onend = finish;
        u.onerror = finish;
        currentUtter = u;
        if (synth.paused) synth.resume();
        synth.speak(u);
        // Safety net: some engines never fire onend.
        guard = setTimeout(() => { if (myGen === gen) { try { synth.cancel(); } catch (e) {} } finish(); }, 3500 + text.length * 170 / u.rate);
      } catch (e) { finish(); }
    });
  }

  function stopEngines() {
    if (synth) { try { synth.cancel(); } catch (e) {} }
    if (NS.native.available) NS.native.call("stop");
    if (audio) { try { audio.pause(); audio.removeAttribute("src"); audio.load(); } catch (e) {} }
  }

  /* Speaks after whatever is being said now has finished (unless something else starts first).
     Used for celebrations, so "शाबाश!" never cuts off an activity's own sentence. */
  let active = Promise.resolve();
  function sayAfter(text, opt) {
    const g = gen;
    return active.then(() => (gen === g ? say(text, opt) : undefined));
  }

  function say(text, opt) {
    const p = sayNow(text, opt);
    active = p.catch(() => {});
    return p;
  }
  async function sayNow(text, opt) {
    opt = opt || {};
    const myGen = ++gen;
    stopEngines();
    const settings = NS.store ? NS.store.settings() : { sound: true };
    if (!settings.sound) return;
    const lang = NS.speechLang(opt.lang || NS.lang());
    const p = NS.store && NS.store.current();
    const gender = opt.gender || (p ? p.voice : "female");
    const spoken = cleanForSpeech(text);
    if (!spoken) return;
    if (opt.onStart) { try { opt.onStart(); } catch (e) {} }
    if (!clips) await Promise.race([loadClips(), new Promise(r => setTimeout(r, 700))]);
    if (myGen !== gen) return;
    const whole = clipFor(gender, lang, text);
    if (whole) { await playClip(whole, myGen); return; }
    if (!NS.native.available) await whenVoices();
    for (const ph of phrases(spoken)) {
      if (myGen !== gen) return;
      const c = clipFor(gender, lang, ph);
      if (c) await playClip(c, myGen);
      else if (NS.native.available) await speakNative(ph, lang, gender, opt, myGen);
      else await speakWeb(ph, lang, gender, opt, myGen);
      if (myGen !== gen) return;
      await wait(pauseAfter(ph), myGen);
    }
  }

  /* Lines in order; onLine(i) fires as each line starts (used to highlight rhyme lines). */
  async function sayLines(lines, lang, opt) {
    opt = opt || {};
    const list = (lines || []).slice();
    for (let i = 0; i < list.length; i++) {
      if (opt.onLine) { try { opt.onLine(i); } catch (e) {} }
      const p = say(list[i], { lang, rate: opt.rate });   // say() bumps gen synchronously
      const mine = gen;
      await p;
      if (gen !== mine) return false;                       // stopped or interrupted
      await new Promise(r => setTimeout(r, opt.gap != null ? opt.gap : 280));
      if (gen !== mine) return false;
    }
    return true;
  }

  function stop() { gen++; stopEngines(); stopListening(); }

  /* ---------------- Speech in ---------------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  let activeRec = null;
  function canListen() {
    const s = NS.store ? NS.store.settings() : { mic: false };
    return !!(s.mic && (NS.native.available || SR));
  }
  function stopListening() {
    if (activeRec) { try { activeRec.abort(); } catch (e) {} activeRec = null; }
  }
  let listenSeq = 0;
  function listen(opt) {
    opt = opt || {};
    if (!canListen()) return Promise.resolve(null);
    const lang = NS.speechLang(opt.lang || NS.lang());
    if (NS.native.available) {
      return new Promise(resolve => {
        const id = "l" + (++listenSeq);
        let done = false;
        const finish = t => { if (done) return; done = true; off(); resolve(typeof t === "string" && t.trim() ? t.trim() : null); };
        const off = NS.on("native:listen-result", ev => { if (ev.id === id) finish(ev.text); });
        NS.native.call("listen", id, langTag(lang));
        setTimeout(() => finish(null), 15000);
      });
    }
    const attempt = local => new Promise(resolve => {
      let rec;
      try { rec = new SR(); } catch (e) { return resolve({ text: null }); }
      stopListening();
      activeRec = rec;
      rec.lang = langTag(lang);
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      if (local && "processLocally" in rec) { try { rec.processLocally = true; } catch (e) {} }
      let text = null, err = null, done = false;
      const finish = () => { if (done) return; done = true; if (activeRec === rec) activeRec = null; resolve({ text, err }); };
      rec.onresult = e => { try { text = e.results[0][0].transcript; } catch (x) {} };
      rec.onerror = e => { err = e.error; finish(); };
      rec.onend = finish;
      try { rec.start(); } catch (e) { err = "start"; finish(); }
      setTimeout(() => { try { rec.abort(); } catch (e) {} finish(); }, 10000);
    });
    return attempt(true).then(r => {
      if (!r.text && (r.err === "language-not-supported" || r.err === "service-not-allowed") ) return attempt(false).then(x => x.text);
      return r.text;
    }).then(t => (t && t.trim() ? t.trim() : null));
  }

  /* For the grown-ups' advanced voice list. */
  function voiceList(lang) {
    const l = NS.speechLang(lang);
    if (NS.native.available) {
      return nativeVoices().filter(v => langMatches({ lang: v.lang, name: v.label }, l))
        .map(v => ({ id: v.id, label: v.label || v.id, gender: v.gender || "unknown", local: !!v.local }));
    }
    return webVoices().filter(v => langMatches(v, l))
      .map(v => ({ id: v.voiceURI || v.name, label: v.name + " (" + v.lang + ")", gender: genderOf(v.name), local: v.localService === true }));
  }

  NS.voice = {
    say: (text, opt) => say(text, typeof opt === "string" ? { lang: opt } : opt),
    sayAfter: (text, opt) => sayAfter(text, typeof opt === "string" ? { lang: opt } : opt),
    sayLines, stop, listen, canListen, voiceList, pick, genderOf, clipKey, phrases, cleanForSpeech,
    whenVoices, hasEngine: () => !!(synth || NS.native.available),
    loadClips,
  };
  loadClips();
  /* Pick up the clips list early, and re-read native voices when the app comes back. */
  NS.on("native:resume", () => { nativeList = null; });
  NS.on("native:voices", () => { nativeList = null; });
})();
