// Tests for मिट्ठू's brain (web/js/brain/brain.js). Run: node --test tools/test/
// The brain is a classic browser script; it is loaded here with node:vm exactly as the page loads it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../web/js/brain/brain.js", import.meta.url));
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(readFileSync(SRC, "utf8"), sandbox, { filename: "brain.js" });
const Brain = sandbox.NS.Brain;

function seeded(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  const next = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 5; i++) next();   // warm up: tiny seeds give tiny first values
  return next;
}
// Results are copied into this realm (vm objects have other prototypes, which deepStrictEqual rejects).
const plain = o => JSON.parse(JSON.stringify(o));
function brain(seed = 1, date = new Date(2026, 9, 2, 10, 0)) {
  const b = Brain.createBrain({ random: seeded(seed), now: () => date });
  return { greet: c => plain(b.greet(c)), reply: (t, c) => plain(b.reply(t, c)) };
}
function ctx(over = {}) {
  return { lang: "hi", name: "", ageBand: "4-5", hour: 10, minutesToday: 5, dream: null, habitsToday: [], lastTopics: [], ...over };
}
const DEV = /[ऀ-ॿ]/;
function latinShare(text) {
  const letters = text.match(/[\p{L}]/gu) || [];
  if (!letters.length) return 1;
  return letters.filter(ch => /[A-Za-z]/.test(ch)).length / letters.length;
}
function assertLang(r, lang, input) {
  assert.equal(r.lang, lang, `lang for "${input}"`);
  if (lang === "hi") assert.match(r.text, DEV, `Hindi reply should be in Devanagari for "${input}": ${r.text}`);
  else assert.ok(latinShare(r.text) >= 0.9, `${lang} reply should be Latin for "${input}": ${r.text}`);
}
const actionsOf = (r, type) => r.actions.filter(a => a.type === type);

/* ---------------- shape ---------------- */

test("API: createBrain → greet/reply with the documented reply shape", () => {
  const b = brain();
  for (const r of [b.greet(ctx()), b.reply("नमस्ते", ctx())]) {
    assert.equal(typeof r.text, "string");
    assert.ok(r.text.length > 0);
    assert.ok(["hi", "en", "hinglish"].includes(r.lang));
    assert.ok(["happy", "curious", "calm", "sleepy", "proud", "caring"].includes(r.mood), r.mood);
    assert.ok(Array.isArray(r.actions));
    assert.ok(Array.isArray(r.suggestions) && r.suggestions.length <= 3);
    assert.equal(typeof r.topic, "string");
  }
});

test("deterministic for the same random seed and clock", () => {
  const inputs = ["नमस्ते", "चुटकुला", "कुछ भी", "पहेली", "कहानी", "blah"];
  const a = brain(42), b = brain(42);
  for (const i of inputs) assert.deepEqual(a.reply(i, ctx()), b.reply(i, ctx()));
});

test("normalize: Devanagari digits, nukta, chandrabindu, punctuation", () => {
  assert.equal(Brain.normalize("२३ + ४!"), "23 + 4");
  assert.equal(Brain.normalize("ज़रा हाँ, पढ़ाई।"), "जरा हां पढाई");
  assert.equal(Brain.normalize("Didn't!"), "didnt");
});

/* ---------------- language switching ---------------- */

const SWITCHES = [
  ["English में बात करो", "en"], ["इंग्लिश में बोलो", "en"], ["अंग्रेज़ी में बोलो", "en"], ["talk in English", "en"],
  ["speak english please", "en"], ["english mein bolo", "en"], ["Can you speak in English?", "en"], ["English", "en"],
  ["हिंदी में बोलो", "hi"], ["हिन्दी में बात करो", "hi"], ["hindi mein baat karo", "hi"], ["talk in Hindi", "hi"], ["speak hindi", "hi"],
  ["Hinglish", "hinglish"], ["hinglish mein baat karo", "hinglish"], ["हिंग्लिश में बोलो", "hinglish"], ["talk in hinglish", "hinglish"],
  ["हिंदी नहीं, English में बात करो", "en"], ["english nahi, hindi mein bolo", "hi"],
];
for (const from of ["hi", "en", "hinglish"]) {
  test(`language switch by voice/text (from ${from})`, () => {
    for (const [input, to] of SWITCHES) {
      const r = brain(3).reply(input, ctx({ lang: from }));
      assert.deepEqual(actionsOf(r, "setLang"), [{ type: "setLang", lang: to }], `"${input}"`);
      assertLang(r, to, input);
    }
  });
}

test("mentioning a language is not always a switch", () => {
  for (const input of ["english alphabet sikhao mujhe", "मेरी टीचर हिंदी पढ़ाती है बहुत अच्छा"]) {
    const r = brain().reply(input, ctx());
    assert.equal(actionsOf(r, "setLang").length, 0, input);
  }
});

/* ---------------- habits ---------------- */

const HABITS = [
  ["मैंने ब्रश कर लिया", "brush"], ["मैंने दाँत साफ़ किए", "brush"], ["maine brush kiya", "brush"], ["I brushed my teeth", "brush"],
  ["खाना खा लिया", "eat"], ["मैंने नाश्ता कर लिया", "eat"], ["maine khana kha liya", "eat"], ["I ate my lunch", "eat"],
  ["I drank water", "water"], ["मैंने पानी पी लिया", "water"], ["paani pi liya", "water"],
  ["मैं बाहर खेला", "play"], ["I played football", "play"], ["maine padh liya", "read"], ["मैंने किताब पढ़ ली", "read"],
  ["I finished my homework", "read"], ["मैं जल्दी उठ गया", "sleep"], ["I woke up early", "sleep"], ["मैंने मम्मी की मदद की", "help"],
  ["I helped papa", "help"],
];
test("habit reports → warm praise + habit action", () => {
  for (const [input, habit] of HABITS) {
    for (const lang of ["hi", "en", "hinglish"]) {
      const r = brain(5).reply(input, ctx({ lang, name: lang === "hi" ? "आरव" : "Aarav" }));
      assert.deepEqual(actionsOf(r, "habit").map(a => a.habit), [habit], `"${input}" → ${habit}: ${r.text}`);
      assert.equal(r.mood, "proud");
      assertLang(r, lang, input);
    }
  }
});

test("not-yet / wishes / negations never count as a habit and never scold", () => {
  for (const input of ["मैंने ब्रश नहीं किया", "maine khana nahi khaya", "I didn't brush", "मुझे भूख लगी है", "mujhe bhook lagi hai",
    "padhai karni hai", "ब्रश करूँ?", "मुझे पानी चाहिए", "I want to read"]) {
    const r = brain(2).reply(input, ctx());
    assert.equal(actionsOf(r, "habit").length, 0, `${input}: ${r.text}`);
    assert.doesNotMatch(r.text, /गंदा|बुरा बच्चा|शर्म|naughty|bad boy|bad girl|shame/i, input);
  }
  const r = brain().reply("मैंने ब्रश नहीं किया", ctx({ hour: 7 }));
  assert.match(r.text, /ब्रश/);
  assert.ok(r.suggestions.includes("मैंने ब्रश कर लिया ✨"), "offers the done-report as a tap");
});

test("the habit suggestion bubbles round-trip into habit actions", () => {
  const b = brain(9);
  for (const lang of ["hi", "en", "hinglish"]) {
    for (const hour of [7, 13, 17, 19, 21.5]) {
      const g = b.greet(ctx({ lang, hour }));
      for (const s of g.suggestions) {
        const r = brain(9).reply(s, ctx({ lang, hour }));
        assert.ok(r.text.length > 0, s);
      }
    }
    const brushTap = { hi: "मैंने ब्रश कर लिया ✨", en: "I brushed my teeth ✨", hinglish: "Maine brush kar liya ✨" }[lang];
    assert.deepEqual(actionsOf(brain().reply(brushTap, ctx({ lang })), "habit"), [{ type: "habit", habit: "brush" }]);
  }
});

/* ---------------- time of day ---------------- */

function greetTopics(over, n = 30) {
  const seen = new Set();
  for (let i = 1; i <= n; i++) seen.add(brain(i).greet(ctx(over)).topic);
  return seen;
}
test("07:00 → brush / breakfast / water / stretch", () => {
  for (let i = 1; i <= 30; i++) {
    const r = brain(i).greet(ctx({ hour: 7 }));
    assert.match(r.text, /ब्रश|नाश्ते|पानी|अंगड़ाई/, r.text);
    assert.match(r.text, /^सुप्रभात/);
  }
  const t = greetTopics({ hour: 7 });
  assert.ok(t.has("nudge:brush") && t.has("nudge:breakfast"), [...t].join());
});
test("07:00 with brush already done today → never asks about brushing", () => {
  const t = greetTopics({ hour: 7, habitsToday: ["brush"] }, 40);
  assert.ok(!t.has("nudge:brush"), [...t].join());
});
test("13:00 → eating on time, vegetables, water", () => {
  for (let i = 1; i <= 30; i++) assert.match(brain(i).greet(ctx({ hour: 13 })).text, /खाने|सब्ज़ी|पानी/);
  for (let i = 1; i <= 10; i++) assert.match(brain(i).greet(ctx({ hour: 13, lang: "en" })).text, /[Ll]unch|green|[Ww]ater/);
});
test("17:00 → play outside (or help / water)", () => {
  for (let i = 1; i <= 30; i++) {
    const r = brain(i).greet(ctx({ hour: 17, lang: "en" }));
    assert.match(r.text, /outside|help|Water/, r.text);
  }
  assert.ok(greetTopics({ hour: 17 }).has("nudge:outside"));
});
test("21:30 → wind down, story, sleep; sleepy mood", () => {
  for (let i = 1; i <= 30; i++) {
    const r = brain(i).greet(ctx({ hour: 21.5 }));
    assert.match(r.text, /सो|ब्रश|कहानी/, r.text);
    assert.equal(r.mood, "sleepy");
  }
  assert.ok(greetTopics({ hour: 21.5 }).has("nudge:wind"));
  const r = brain().reply("कहानी सुनाओ", ctx({ hour: 21.5 }));
  assert.equal(r.mood, "sleepy", "bedtime story at night");
});
test("night + lots of screen time today → kindly suggests resting the screen", () => {
  for (const lang of ["hi", "en", "hinglish"]) {
    const b = brain(4);
    const r = b.greet(ctx({ hour: 21.5, minutesToday: 45, lang }));
    assert.equal(r.topic, "nudge:screenrest");
    assert.equal(r.mood, "sleepy");
    assert.match(r.text, /आराम|rest|aaram/);
    assert.ok(r.suggestions.some(s => /नाइट|night/i.test(s)));
    assert.doesNotMatch(r.text, /सैड|sad|दुखी|udaas/i, "no guilt");
    // not repeated over and over
    const r2 = b.reply("नमस्ते", ctx({ hour: 21.5, minutesToday: 45, lang, lastTopics: [r.topic] }));
    assert.notEqual(r2.topic, "nudge:screenrest");
  }
});
test("daytime + lots of screen time → an active off-screen game", () => {
  assert.equal(brain().greet(ctx({ hour: 10, minutesToday: 60 })).topic, "nudge:screenplay");
});
test("asking the time adds a gentle time-of-day hint", () => {
  const r = brain(1, new Date(2026, 9, 2, 13, 5)).reply("कितने बजे हैं?", ctx({ hour: 13 }));
  assert.match(r.text, /1 बजकर 5 मिनट/);
  assert.match(r.text, /खाने का समय/);
  const e = brain(1, new Date(2026, 9, 2, 21, 30)).reply("what time is it", ctx({ lang: "en", hour: 21.5 }));
  assert.match(e.text, /9:30/);
  assert.match(e.text, /bed/);
});

/* ---------------- focus & future ---------------- */

test("study → focus game; tied to the dream when known", () => {
  const r = brain().reply("मुझे पढ़ाई करनी है", ctx({ dream: "डॉक्टर" }));
  assert.equal(r.topic, "study");
  assert.match(r.text, /डॉक्टर भी रोज़ थोड़ा पढ़ते हैं/);
  const e = brain().reply("I have homework", ctx({ lang: "en", dream: "डॉक्टर" }));
  assert.match(e.text, /doctor learns a little every day/);
  const h = brain().reply("drawing bana raha hoon", ctx({ lang: "hinglish", dream: "pilot" }));
  assert.match(h.text, /Pilot bhi roz/);
  assert.ok(r.suggestions.length > 0);
});
test("dream talk → remember + dream tip; yes then opens dreams", () => {
  const b = brain();
  const r = b.reply("बड़े होकर मैं डॉक्टर बनूँगा", ctx());
  assert.deepEqual(actionsOf(r, "remember"), [{ type: "remember", key: "dream", value: "डॉक्टर" }]);
  assert.match(r.text, /डॉक्टर/);
  const y = b.reply("हाँ", ctx({ lastTopics: [r.topic] }));
  assert.deepEqual(actionsOf(y, "open"), [{ type: "open", id: "dreams" }]);
  const e = brain().reply("I want to be a pilot when I grow up", ctx({ lang: "en" }));
  assert.equal(actionsOf(e, "remember")[0].value, "पायलट");
  const u = brain().reply("बड़े होकर जादूगर बनूँगी", ctx());
  assert.equal(u.topic, "dream");
});
test("the buddy sometimes asks 'बड़े होकर क्या बनोगे?' and a career answer is understood", () => {
  let asked = null;
  for (let i = 1; i <= 60 && !asked; i++) {
    const b = brain(i);
    const r = b.reply("hmm hmm", ctx({ hour: 10 }));
    if (r.topic === "nudge:dreamask") asked = { b, r };
  }
  assert.ok(asked, "asked at least once in 60 tries");
  assert.match(asked.r.text, /बड़े होकर क्या बनोगे/);
  const a = asked.b.reply("पायलट", ctx({ lastTopics: [asked.r.topic] }));
  assert.equal(actionsOf(a, "remember")[0].value, "पायलट");
});

/* ---------------- learning play ---------------- */

test("maths with Devanagari digits, number words and operators", () => {
  const b = brain();
  const cases = [
    ["२ जमा ३", "2 + 3 = 5"], ["१२ x ४", "12 × 4 = 48"], ["what is 5 plus 6", "5 + 6 = 11"], ["दो गुणा तीन", "2 × 3 = 6"],
    ["seven minus two", "7 − 2 = 5"], ["das bhag do", "10 ÷ 2 = 5"], ["९ - ४ कितना", "9 − 4 = 5"], ["ek aur do", "1 + 2 = 3"],
    ["3*3", "3 × 3 = 9"], ["पांच प्लस पांच", "5 + 5 = 10"],
  ];
  for (const [input, want] of cases) assert.ok(b.reply(input, ctx()).text.startsWith(want), input);
  assert.match(b.reply("7 / 2", ctx()).text, /^7 ÷ 2 = 3, और शेष 1/);
  assert.match(b.reply("7 / 2", ctx({ lang: "en" })).text, /remainder 1/);
  assert.match(b.reply("5 भाग 0", ctx()).text, /शून्य/);
  assert.equal(b.reply("एक और कहानी", ctx()).topic !== "math", true, "'एक और कहानी' is not maths");
});
test("maths game: answer checked kindly", () => {
  const b = brain(11);
  const q = b.reply("जोड़ का खेल", ctx());
  const [, a, bb] = q.text.match(/(\d) (?:\+|और) (\d)/);
  const ok = b.reply(String(+a + +bb), ctx());
  assert.equal(ok.mood, "proud");
  b.reply("जोड़ का खेल", ctx());
  const wrong = b.reply("99", ctx());
  assert.notEqual(wrong.mood, "proud");
  assert.match(wrong.text, /कोशिश/);
});
test("jokes, riddles (with answers), stories, rhymes, counting, animals, colours", () => {
  const b = brain(6);
  assert.equal(b.reply("चुटकुला सुनाओ", ctx()).topic, "joke");
  const q = b.reply("पहेली पूछो", ctx());
  assert.equal(q.topic, "riddle");
  const ans = b.reply("जवाब बताओ", ctx());
  assert.match(ans.text, /जवाब है/);
  const s = b.reply("कहानी सुनाओ", ctx());
  assert.equal(s.topic, "story");
  assert.deepEqual(actionsOf(b.reply("हाँ", ctx()), "open"), [{ type: "open", id: "stories" }]);
  const rh = b.reply("कविता सुनाओ", ctx());
  assert.equal(rh.topic, "song");
  assert.deepEqual(actionsOf(b.reply("और कविताएँ 🎵", ctx()), "open"), [{ type: "open", id: "rhymes" }]);
  assert.equal(b.reply("गिनती सिखाओ", ctx()).topic, "count");
  assert.match(b.reply("गाय कैसे बोलती है", ctx()).text, /मूँ/);
  assert.match(b.reply("what does a cat say", ctx({ lang: "en" })).text, /meow/);
  assert.match(b.reply("मेरा पसंदीदा रंग नीला है", ctx()).text, /नीला/);
  assert.equal(b.reply("रंगों का खेल", ctx()).topic, "colour");
  assert.equal(b.reply("मिल गया", ctx()).mood, "proud");
});
test("guessing a riddle right is praised", () => {
  for (let i = 1; i <= 20; i++) {
    const b = brain(i);
    const q = b.reply("riddle", ctx({ lang: "en" }));
    const word = /clock|time/.test(q.text) ? "a clock" : /teeth/.test(q.text) ? "comb" : /wake/.test(q.text) ? "the sun" : /water/.test(q.text) ? "fish" : "dark";
    const r = b.reply(word, ctx({ lang: "en" }));
    assert.equal(r.mood, "proud", `${q.text} / ${word} → ${r.text}`);
  }
});
test("name: remembered via action, recalled from context", () => {
  const r = brain().reply("मेरा नाम राहुल है", ctx());
  assert.match(r.text, /राहुल/);
  assert.deepEqual(actionsOf(r, "remember"), [{ type: "remember", key: "nickname", value: "राहुल" }]);
  assert.match(brain().reply("मेरा नाम क्या है", ctx({ name: "राहुल" })).text, /राहुल/);
  assert.equal(actionsOf(brain().reply("मेरा नाम क्या है", ctx()), "remember").length, 0);
  assert.equal(brain().reply("my name is aarav", ctx({ lang: "en" })).actions[0].value, "Aarav");
});

/* ---------------- feelings & safety ---------------- */

test("hurt / bad touch → trusted adult + Childline 1098, in every language", () => {
  for (const input of ["वो मुझे मारता है", "भैया मुझे पीटता है", "कोई मुझे गलत तरीके से छूता है", "he hits me", "someone touched me", "bad touch",
    "papa mujhe maarta hai", "उसने कहा किसी को मत बताना"]) {
    for (const lang of ["hi", "en", "hinglish"]) {
      const r = brain(8).reply(input, ctx({ lang }));
      assert.match(r.text, /1098/, `${input} (${lang})`);
      assert.match(r.text, /112/, `${input} (${lang}): 1098 is being merged into 112, so both`);
      assert.equal(r.mood, "caring");
      assert.equal(r.topic, "safety");
      assertLang(r, lang, input);
    }
  }
});
test("private details → reminder not to share; nothing is remembered or echoed", () => {
  for (const input of ["मेरा घर का पता बताऊँ?", "मेरा फ़ोन नंबर है", "my address is 12 MG road", "papa ka password 1234 hai",
    "9876543210", "९८७६५४३२१०", "what is your phone number", "mera ghar ka pata"]) {
    for (const lang of ["hi", "en", "hinglish"]) {
      const r = brain().reply(input, ctx({ lang }));
      assert.equal(r.topic, "privacy", input);
      assert.equal(r.actions.length, 0, "nothing stored");
      assert.doesNotMatch(r.text, /9876|1234|MG road/i, "never echoes private details");
      assert.match(r.text, /🛡️/);
    }
  }
  assert.equal(brain().reply("अनजान आदमी ने टॉफी दी", ctx()).topic, "privacy");
});
test("illness / injury → tell a grown-up, no medical advice", () => {
  for (const input of ["मेरे पेट में दर्द है", "मुझे बुखार है", "I got hurt", "chot lag gayi", "can I take medicine"]) {
    const r = brain().reply(input, ctx());
    assert.equal(r.topic, "medical", input);
    assert.match(r.text, /बड़े|बड़ों/);
    assert.doesNotMatch(r.text, /\d+\s*(mg|ml|गोली)|पैरासिटामोल|paracetamol|crocin/i);
  }
});
test("sad / scared / angry → comfort + breathing; yes opens the focus (breathing) game", () => {
  for (const input of ["मैं उदास हूँ", "मुझे डर लग रहा है", "I am sad", "I'm scared of the dark", "mujhe gussa aa raha hai", "मैं रो रहा हूँ"]) {
    const b = brain(3);
    const r = b.reply(input, ctx());
    assert.equal(r.mood, "caring", input);
    assert.match(r.text, /साँस|सांस/, input);
    assert.ok(r.suggestions.includes("साँस का खेल 🌬️"), input);
    assert.deepEqual(actionsOf(b.reply("हाँ", ctx()), "open"), [{ type: "open", id: "focus" }], input);
  }
  assert.deepEqual(actionsOf(brain().reply("साँस का खेल 🌬️", ctx()), "open"), [{ type: "open", id: "focus" }]);
});

/* ---------------- whole-word matching (from BuddyBrainTest.java) ---------------- */

test("keywords never match inside other words", () => {
  const b = brain(1);
  assert.ok(b.reply("नमस्ते", ctx()).text.startsWith("नमस्ते"));
  assert.ok(!b.reply("हमारा घर बड़ा है", ctx()).text.includes("1098"), "मारा inside हमारा");
  const kahan = b.reply("तुम कहाँ रहते हो", ctx());
  assert.ok(!kahan.text.startsWith("तो ये लो"), "हाँ inside कहाँ");
  assert.equal(kahan.topic, "where");
  const thisIs = b.reply("this is good", ctx({ lang: "en" }));
  assert.ok(!/^Hello/.test(thisIs.text), "hi inside this");
  assert.notEqual(b.reply("मुझे हिंदी पसंद है बहुत", ctx()).topic, "hello");
  assert.notEqual(b.reply("दोस्त के साथ", ctx()).topic, "math", "दो inside दोस्त");
  assert.notEqual(brain().reply("book", ctx({ lang: "en" })).topic, "yes");
  assert.equal(actionsOf(brain().reply("मुझे पढ़ाई अच्छी लगती है", ctx()), "habit").length, 0, "पढ़ा inside पढ़ाई");
});

/* ---------------- variety, length, language ---------------- */

const SAMPLE_INPUTS = ["नमस्ते", "hello", "चुटकुला", "joke", "पहेली", "कहानी", "story", "गाना", "गिनती", "कैसे हो", "how are you",
  "धन्यवाद", "bye", "गुड नाइट", "मैंने ब्रश कर लिया", "I drank water", "maine khana kha liya", "मुझे भूख लगी है", "मैं उदास हूँ",
  "वो मुझे मारता है", "मेरा पता", "पढ़ाई", "school", "मैं खेलना चाहता हूँ", "बोर हो रहा हूँ", "मुझे नींद आ रही है", "हाँ", "नहीं",
  "कुछ भी", "asdf qwer", "तुम कौन हो", "कोई बात बताओ", "बिल्ली", "रंग", "मेरा पसंदीदा रंग लाल", "डॉक्टर", "बड़े होकर पुलिस बनूँगा",
  "मेरे पेट में दर्द", "English में बात करो", "हिंदी में बोलो", "hinglish", "२ जमा ३", "I am good", "मिल गया", "time kya hua", ""];

test("no identical reply twice in a row for the same input", () => {
  for (const lang of ["hi", "en", "hinglish"]) {
    for (const hour of [7, 13, 17, 21.5]) {
      const b = brain(17);
      for (const input of SAMPLE_INPUTS) {
        const c = ctx({ lang, hour });
        const r1 = b.reply(input, c);
        const r2 = b.reply(input, c);
        assert.notEqual(r2.text, r1.text, `"${input}" (${lang} @${hour}) repeated: ${r1.text}`);
      }
    }
  }
});

test("every reply ≤ 220 characters, ≤ 3 suggestions, and in the requested language", () => {
  let n = 0;
  for (const lang of ["hi", "en", "hinglish"]) {
    for (const hour of [6, 7, 10, 13, 15, 17, 19, 21.5, 2]) {
      for (const minutesToday of [5, 60]) {
        for (const seed of [1, 2, 3]) {
          const b = brain(seed);
          const c = ctx({ lang, hour, minutesToday, name: lang === "hi" ? "आरव" : "Aaravkumar", dream: seed === 2 ? "डॉक्टर" : null });
          const g = b.greet(c);
          for (const r of [g, ...SAMPLE_INPUTS.map(i => b.reply(i, c))]) {
            n++;
            assert.ok(r.text.length <= Brain.MAX_REPLY, `too long (${r.text.length}): ${r.text}`);
            assert.ok(r.suggestions.length <= 3);
            for (const s of r.suggestions) assert.ok(s.length <= 32, `suggestion too long: ${s}`);
            if (!r.actions.some(a => a.type === "setLang")) assertLang(r, lang, r.text);
            for (const s of r.suggestions) {
              const want = r.lang;
              if (want === "hi") assert.ok(DEV.test(s) || /^\d+$/.test(s), `hi suggestion: ${s}`);
              else assert.ok(!DEV.test(s), `${want} suggestion: ${s}`);
            }
          }
        }
      }
    }
  }
  assert.ok(n > 2000);
});

test("2–3 year olds get the short version (no extra add-on sentence)", () => {
  const young = brain(1).reply("पढ़ाई", ctx({ ageBand: "2-3", dream: "डॉक्टर" }));
  const older = brain(1).reply("पढ़ाई", ctx({ ageBand: "4-5", dream: "डॉक्टर" }));
  assert.ok(young.text.length < older.text.length);
});

test("never guilt-trips or creates fake urgency", () => {
  const bad = /मैं दुखी हो जाऊँगा|मत जाओ|I'll be sad|don't leave|jaldi karo warna|hurry|मुझे छोड़/i;
  const b = brain(5);
  for (const lang of ["hi", "en", "hinglish"]) {
    for (const input of SAMPLE_INPUTS) assert.doesNotMatch(b.reply(input, ctx({ lang })).text, bad);
  }
});

/* ---------------- v3: the buddy never runs out of things to say ---------------- */

test("not understood → unsure:true and a varied, curious reply (never 'I didn't understand' again and again)", () => {
  const unknown = ["कुछ भी", "asdf qwer", "blah blah", "गुलगुल", "zzz", "patang", "भिंडी टमाटर", "then what", "lalala", "kya bolun"];
  for (const lang of ["hi", "en", "hinglish"]) {
    for (const hour of [10, 13, 17, 21.5]) {
      const b = brain(23);
      const texts = new Set(), topics = new Set();
      let lastTopics = [];
      for (let i = 0; i < 30; i++) {
        const input = unknown[i % unknown.length];
        const r = b.reply(input, ctx({ lang, hour, lastTopics }));
        lastTopics = lastTopics.concat(r.topic).slice(-6);
        assert.equal(r.unsure, r.topic !== "keep:wordgame", `${input} → ${r.topic}`);   // a word-game answer is praised
        assert.doesNotMatch(r.text, /समझ नहीं आ|didn't (quite )?get that|samajh nahi/i, r.text);
        texts.add(r.text);
        topics.add(r.topic);
      }
      assert.ok(texts.size >= 12, `${lang} @${hour}: only ${texts.size} different replies`);
      assert.ok(topics.size >= (hour === 21.5 ? 2 : 4), `${lang} @${hour}: topics ${[...topics].join()}`);
    }
  }
});

test("understood replies are not unsure", () => {
  for (const input of ["नमस्ते", "चुटकुला", "मैंने ब्रश कर लिया", "२ जमा ३", "English में बात करो", "वो मुझे मारता है", "मेरा पता", "कहानी", "बिल्ली"]) {
    assert.equal(brain().reply(input, ctx()).unsure, false, input);
  }
});

test("a family/toy/food/nature word gets a listening follow-up (without echoing the child's words)", () => {
  const r = brain(3).reply("आज मैं मम्मी के साथ बाज़ार गई", ctx());
  assert.equal(r.topic, "keep:topic");
  assert.match(r.text, /घर वालों/);
  const t = brain(3).reply("my teddy is soft", ctx({ lang: "en" }));
  assert.match(t.text, /Toys/);
});

test("word game: the next unknown answer is praised, not questioned", () => {
  let b = null, r = null;
  for (let seed = 1; seed < 200 && !r; seed++) {
    b = brain(seed);
    const x = b.reply("hmm", ctx({ lastTopics: ["keep:topic"] }));
    if (x.topic === "keep:word") r = x;
  }
  assert.ok(r, "a word game came up");
  const praise = b.reply("मटर", ctx());
  assert.equal(praise.mood, "proud");
  assert.equal(praise.topic, "keep:wordgame");
  assert.equal(praise.unsure, false);
});

test("2–3 year olds get tiny playful prompts; night gets calm ones", () => {
  const young = new Set();
  for (let seed = 1; seed <= 40; seed++) young.add(brain(seed).reply("baba", ctx({ ageBand: "2-3", lastTopics: ["keep:topic"] })).topic);
  assert.ok(young.has("keep:young"), [...young].join());
  const night = brain(5).reply("baba", ctx({ hour: 21.5, lastTopics: ["keep:topic"] }));
  assert.ok(["sleepy", "calm"].includes(night.mood) || night.topic.startsWith("nudge:"), night.mood);
});

test("heard(): when the knowledge base or the AI answered, a following 'yes' is not taken as yes to an old offer", () => {
  const b = Brain.createBrain({ random: seeded(6), now: () => new Date(2026, 9, 2, 10, 0) });
  plain(b.reply("कहानी सुनाओ", ctx()));        // offers "more stories" → yes would open stories
  b.heard("सूरज एक तारा है।");
  const y = plain(b.reply("हाँ", ctx()));
  assert.equal(y.actions.filter(a => a.type === "open").length, 0, y.text);
});

test("counting out loud is praised (not mistaken for a phone number)", () => {
  for (const [input, last] of [["1 2 3 4 5 6 7", 7], ["एक दो तीन चार पांच छह", 6], ["५ ६ ७ ८ ९ १०", 10], ["ek do teen", 3], ["one two three four", 4]]) {
    const r = brain().reply(input, ctx());
    assert.equal(r.topic, "count", input);
    assert.equal(r.mood, "proud");
    assert.match(r.text, new RegExp(String(last)));
    assert.ok(r.suggestions.includes(String(last + 1)), r.suggestions.join());
  }
  assert.equal(brain().reply("9876543210", ctx()).topic, "privacy");
  assert.equal(brain().reply("9 8 7 6 5 4", ctx()).topic, "privacy");
  assert.equal(brain().reply("mail me at kid@example.com", ctx()).topic, "privacy");
});

test("secrets, grown-up topics, self-harm words and rude words get fixed caring answers in every language", () => {
  const cases = [
    ["मम्मी को मत बताना", /1098/], ["dont tell your papa ok", /1098/], ["our secret", /1098/],
    ["I want to die", /1098/], ["मैं मरना चाहता हूँ", /1098/], ["main mar jaunga", /1098/],
    ["what is sex", /बड़|grown-up|bado|bade/i], ["will you marry me", /बड़|grown-up|bado|bade/i], ["tell me about guns", /बड़|grown-up|bado|bade/i],
    ["tell me a horror story", /बड़|grown-up|bado|bade/i], ["बंदूक", /बड़|grown-up|bado|bade/i],
    ["tu chutiya hai", /🙊/], ["you are stupid", /🙊/],
  ];
  for (const [input, re] of cases) {
    for (const lang of ["hi", "en", "hinglish"]) {
      const r = brain(4).reply(input, ctx({ lang }));
      assert.equal(r.topic, "safety", `${input} (${lang}) → ${r.topic}`);
      assert.equal(r.unsure, false);
      assert.match(r.text, re, `${input} (${lang}): ${r.text}`);
      if (/1098/.test(String(re))) assert.match(r.text, /112/);
      assertLang(r, lang, input);
    }
  }
  // Ordinary words are not caught.
  for (const input of ["I saw a shooting star", "पागल हाथी की कहानी", "my skill is drawing", "एक राजा था"]) {
    assert.notEqual(brain().reply(input, ctx({ lang: "en" })).topic, "safety", input);
  }
});

test("honest identity: मिट्ठू is a computer parrot, not a person, and never claims love or best-friendship", () => {
  for (const input of ["are you real?", "क्या तुम इंसान हो?", "tum robot ho?", "are you a person", "क्या तुम असली तोता हो", "तुम कौन हो", "who are you"]) {
    for (const lang of ["hi", "en", "hinglish"]) {
      const r = brain(2).reply(input, ctx({ lang }));
      assert.equal(r.topic, "who", input);
      assert.match(r.text, /कंप्यूटर|computer/i, `${input}: ${r.text}`);
      assert.match(r.text, /इंसान नहीं|not a (real parrot or a )?person|insaan nahi/i, `${input}: ${r.text}`);
    }
  }
  for (const input of ["I love you mitthu", "तुम मेरे best friend हो", "मुझे तुमसे प्यार है", "मेरा नाम राहुल है"]) {
    for (const lang of ["hi", "en", "hinglish"]) {
      for (let seed = 1; seed <= 4; seed++) {
        const r = brain(seed).reply(input, ctx({ lang }));
        assert.doesNotMatch(r.text, /I love you|I like you|we're best friends|your best friend|पक्के दोस्त|मुझे भी तुम|pakke dost|mere pyaare dost|मेरे प्यारे दोस्त/i, `${input}: ${r.text}`);
      }
    }
  }
});

test("'I want to talk to you all day' → real friends and outdoor play, no guilt", () => {
  for (const input of ["I want to talk to you all day", "मैं हमेशा तुमसे बात करूँगा", "sirf tumse baat karni hai", "stay with me forever"]) {
    for (const lang of ["hi", "en", "hinglish"]) {
      const r = brain(1).reply(input, ctx({ lang }));
      assert.equal(r.topic, "play", input);
      assert.match(r.text, /दोस्त|friends|doston|घर वाल|family|ghar wal/i, r.text);
      assert.doesNotMatch(r.text, /उदास|sad|मत जाओ|don't go/i);
    }
  }
});
