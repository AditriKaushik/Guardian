// Tests for मिट्ठू's offline knowledge (web/js/brain/knowledge.js). Run: node --test "tools/test/**/*.test.mjs"
// knowledge.js is a classic browser script; it is loaded here with node:vm exactly as the page loads it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("../../web/js/brain/knowledge.js", import.meta.url));
const CODE = readFileSync(SRC, "utf8");
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(CODE, sandbox, { filename: "knowledge.js" });
const K = sandbox.NS.Knowledge;

function seeded(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  const next = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 5; i++) next();
  return next;
}
const plain = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const ask = (text, lang = "hi", ageBand = "4-5", seed = 1) => plain(K.answer(text, { lang, ageBand, random: seeded(seed) }));
const compose = (id, lang, ageBand, seed, text) => plain(K._compose(id, { lang, ageBand, random: seeded(seed) }, text));
const LANGS = ["hi", "en", "hinglish"];
const AGES = ["2-3", "4-5", "6+"];
const DEV = /[\u0900-\u097F]/;
const LATIN = /[A-Za-z]/;
/* Sentences end with . ! ? । followed by a space or the end (an emoji may follow the space). */
const sentenceCount = t => (t.match(/[.!?।]+(?=\s|$)/g) || []).length || 1;
/* Sample text for the computed answers (what comes after a day, month or number). */
const COMPUTED_TEXT = {
  day_after: "सोमवार के बाद कौन सा दिन", day_before: "सोमवार से पहले कौन सा दिन",
  month_after: "मार्च के बाद कौन सा महीना", month_before: "मार्च से पहले कौन सा महीना", mix_colours: "लाल और नीला मिलाकर क्या बनता है",
  num_after: "7 के बाद क्या आता है", num_before: "7 से पहले क्या आता है",
};
/* Every intent × language × age × a few seeds (covers every phrasing, lead-in and follow-up). */
function* everyReply(seeds = [1, 2, 3, 4, 5, 6, 7, 8]) {
  for (const id of K.intents()) {
    const raw = K._raw(id);
    for (const lang of LANGS) for (const age of AGES) for (const seed of seeds) {
      const r = compose(id, lang, age, seed, raw.computed ? COMPUTED_TEXT[id] : undefined);
      assert.ok(r, `no reply for ${id}`);
      yield { id, lang, age, seed, r, raw };
    }
  }
}

/* ---------------- shape & size ---------------- */

test("API: answer() returns {text, topic, intent, category, lang, followUp?} or null", () => {
  assert.equal(typeof K.answer, "function");
  const r = ask("आसमान नीला क्यों है?");
  assert.equal(typeof r.text, "string");
  assert.equal(r.topic, "know:sky_blue");
  assert.equal(r.intent, "sky_blue");
  assert.equal(r.category, "nature");
  assert.equal(r.lang, "hi");
  assert.equal(typeof r.followUp, "string");
  assert.equal(ask("blah blah"), null);
});

test("at least 400 question intents, across every required area", () => {
  assert.ok(K.count >= 400, `only ${K.count} intents`);
  assert.equal(K.intents().length, K.count);
  assert.equal(new Set(K.intents()).size, K.count, "intent ids are unique");
  for (const cat of ["nature", "animals", "plants", "body", "feelings", "family", "safety", "time", "numbers", "india",
    "science", "jobs", "fun", "buddy", "privacy", "sensitive"]) {
    assert.ok((K.categories[cat] || 0) >= 4, `category ${cat} has ${K.categories[cat] || 0} intents`);
  }
  for (const cat of ["nature", "plants", "body", "india", "science"]) assert.ok(K.categories[cat] >= 20, `${cat} is thin`);
});

test("file stays a reasonable size and is a pure script (no DOM, network or storage)", () => {
  assert.ok(statSync(SRC).size <= 400 * 1024, `knowledge.js is ${statSync(SRC).size} bytes`);
  assert.doesNotMatch(CODE, /innerHTML|outerHTML|document\.|localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|navigator\.|import\(/);
});

test("every intent has all three languages with the same number of phrasings", () => {
  for (const id of K.intents()) {
    const { a, computed } = K._raw(id);
    if (computed) continue;
    assert.ok(a.hi.length >= 1, id);
    assert.equal(a.en.length, a.hi.length, `${id}: en phrasings`);
    assert.equal(a.hinglish.length, a.hi.length, `${id}: hinglish phrasings`);
  }
});

/* ---------------- understanding ---------------- */

const CASES = [
  // nature & sky
  ["आसमान नीला क्यों है?", "sky_blue"], ["why is the sky blue", "sky_blue"], ["aasman neela kyu hai", "sky_blue"],
  ["बारिश क्यों होती है", "rain_why"], ["where does rain come from?", "rain_why"], ["barish kahan se aati hai", "rain_why"],
  ["इंद्रधनुष कैसे बनता है", "rainbow"], ["how is a rainbow made", "rainbow"],
  ["चाँद हमारे साथ क्यों चलता है", "moon_follow"], ["chand hamare saath kyon chalta hai", "moon_follow"],
  ["चाँद छोटा बड़ा क्यों होता है", "moon_shape"], ["why does the moon change shape", "moon_shape"],
  ["तारे क्यों टिमटिमाते हैं", "star_twinkle"], ["रात को सूरज कहाँ जाता है", "sun_night"], ["where does the sun go at night", "sun_night"],
  ["raat kyun hoti hai", "day_night"], ["बादल कैसे चलते हैं", "cloud_move"], ["what is thunder", "thunder"],
  ["समुद्र का पानी खारा क्यों है", "sea_salty"], ["why don't we fall off the earth?", "gravity"],
  // animals
  ["गाय क्या खाती है?", "cow_eat"], ["what do elephants eat", "elephant_eat"], ["sher kahan rehta hai", "lion_home"],
  ["where do penguins live", "penguin_home"], ["बिल्ली के बच्चे को क्या कहते हैं", "cat_baby"], ["what is a baby kangaroo called", "kangaroo_baby"],
  ["मेंढक कैसे बोलता है", "frog_sound"], ["what sound does a duck make", "duck_sound"], ["मुझे हाथी पसंद है", "elephant_about"],
  ["कुत्ते क्यों भौंकते हैं", "dog_bark"], ["how do birds fly", "bird_fly"], ["machhli paani mein saans kaise leti hai", "fish_breathe"],
  ["जिराफ की गर्दन लंबी क्यों है", "giraffe_neck"], ["what is the biggest animal", "biggest_animal"], ["dinosaur kahan gaye", "dinosaur_gone"],
  // plants & food
  ["पत्ते हरे क्यों होते हैं", "leaves_green"], ["how do plants grow", "plant_grow"], ["सब्जी क्यों खानी चाहिए", "veg_why"],
  ["why should I drink milk", "milk_why"], ["doodh kahan se aata hai", "milk_from"], ["mujhe aam pasand hai", "mango"],
  ["प्याज काटने पर आंसू क्यों आते हैं", "onion_tears"], ["where does rice come from", "rice"],
  // body
  ["हम क्यों सोते हैं", "sleep_why"], ["why do we sneeze", "sneeze"], ["दाँत क्यों गिरते हैं", "milk_teeth"],
  ["brush kyun karte hain", "brush_why"], ["why do we have to wash our hands", "handwash"], ["dil dhak dhak kyun karta hai", "heart"],
  ["हिचकी क्यों आती है", "hiccups"], ["how do I grow taller", "grow_tall"],
  // feelings, family, safety, privacy, buddy
  ["मुझे अंधेरे से डर लगता है", "scared_dark"], ["i am sad", "feel_sad"], ["mujhe gussa aa raha hai", "feel_angry"],
  ["मुझे मम्मी की याद आ रही है", "miss_someone"], ["why should we share", "share_why"], ["sorry kyun bolte hain", "sorry_why"],
  ["सड़क कैसे पार करें", "road_cross"], ["can I eat medicine", "medicine"], ["agar main kho jaun toh", "lost"],
  ["what is good touch bad touch", "body_privacy"], ["do you know where i live", "where_i_live"],
  ["तुम कौन हो", "who_are_you"], ["are you real?", "are_you_real"], ["क्या तुम इंसान हो", "are_you_person"], ["are you a robot", "are_you_robot"],
  ["मेरा कुत्ता मर गया", "pet_gone"], ["where do babies come from", "babies_from"],
  // time, numbers, India, science, jobs, fun
  ["हफ्ते में कितने दिन होते हैं", "week_days"], ["सोमवार के बाद कौन सा दिन आता है", "day_after"], ["what comes after 7", "num_after"],
  ["how many months in a year", "months"], ["नीला और पीला मिलाकर कौन सा रंग बनता है", "mix_colours"], ["how do you make green", "mix_green"], ["laal aur safed milake kya banta hai", "mix_colours"], ["what is a triangle", "triangle"],
  ["भारत का राष्ट्रीय पशु कौन सा है", "national_animal"], ["diwali kyun manate hain", "diwali"], ["what is Eid", "eid"],
  ["रॉकेट कैसे उड़ता है", "rocket"], ["what is a computer", "computer"], ["AI kya hai", "ai"], ["बिजली कहाँ से आती है", "electricity"],
  ["why should we save water", "save_water"], ["मंगल ग्रह क्या है", "mars"], ["doctor kya karte hain", "job_doctor"],
  ["what does a farmer do", "job_farmer"], ["एक चुटकुला सुनाओ", "jokes"], ["tell me a riddle", "riddles"], ["tongue twister", "tongue_twister"],
];

test(`${CASES.length} representative questions in Hindi, English and Hinglish find the right topic`, () => {
  assert.ok(CASES.length >= 60);
  for (const [q, id] of CASES) {
    const r = ask(q);
    assert.ok(r, `no answer for "${q}" (wanted ${id})`);
    assert.equal(r.intent, id, `"${q}" → ${r.intent}, wanted ${id}`);
    assert.equal(r.topic, "know:" + id);
  }
});

test("the reply language follows opts.lang, whatever language the child asked in", () => {
  for (const q of ["आसमान नीला क्यों है?", "why is the sky blue", "aasman neela kyu hai"]) {
    assert.match(ask(q, "hi").text, DEV);
    assert.doesNotMatch(ask(q, "en").text, DEV);
    assert.doesNotMatch(ask(q, "hinglish").text, DEV);
  }
});

test("unrelated or unsure text returns null so other layers can answer", () => {
  for (const q of ["", "   ", null, undefined, 42, "blah blah", "asdf qwer", "this is it", "hmm", "ok", "lol", "हाँ", "nahi",
    "नमस्ते", "hello", "bye", "2 + 2", "मेरा नाम आरव है", "i went to the park today", "mujhe khelna hai", "😀😀", "x".repeat(500),
    "मैं आज नानी के घर गया और वहाँ हमने खाना खाया फिर हम बाज़ार गए और फिर पार्क में झूला झूला और फिर घर आकर सो गए"]) {
    assert.equal(K.answer(q, { lang: "hi", ageBand: "4-5", random: seeded(1) }), null, `expected null for ${JSON.stringify(q)}`);
  }
});

test("hurt, emergencies and phone numbers are left to the safety layer (null)", () => {
  for (const q of ["उसने मुझे मारा", "someone touched me", "he hits me", "मुझे बुखार है", "khoon nikal raha hai", "kisi ko mat batana",
    "my number is 9876543210", "मेरा नंबर 98765 43210 है"]) {
    assert.equal(ask(q), null, q);
  }
});

test("whole-word matching: short words never match inside longer ones", () => {
  const notIntent = (q, bad) => { const r = ask(q); assert.ok(!r || !bad.test(r.intent), `"${q}" wrongly matched ${r && r.intent}`); };
  assert.equal(ask("हाथ क्यों होते हैं").intent, "hands");             // हाथ ≠ हाथी
  assert.equal(ask("हाथी क्या खाता है").intent, "elephant_eat");
  assert.equal(ask("बिल्ली कहाँ रहती है").intent, "cat_home");          // कहाँ is not हाँ
  assert.equal(ask("rainbow kaise banta hai").intent, "rainbow");       // rain ≠ rainbow
  assert.equal(ask("how many seasons are there").intent, "seasons");   // sea ≠ season
  assert.equal(ask("what is earth").intent, "earth_what");             // ear ≠ earth
  assert.equal(ask("tell me more about dogs").intent, "dog_about");    // mor ≠ more
  assert.equal(ask("i am happy").intent, "feel_happy");                // am ≠ aam (mango)
  notIntent("sunday kab hai", /^sun_/);                                  // sun ≠ sunday
  notIntent("चांदी क्या है", /^moon_/);                                  // चांद ≠ चांदी
  notIntent("phool suraj ki taraf kyun ghumta hai", /^star_/);           // tara ≠ taraf
  notIntent("i want to play", /^ant_/);                                  // ant ≠ want
  notIntent("why is he a coward", /^cow_/);                              // cow ≠ coward
  notIntent("what is a pet", /^tummy$/);                                 // English "pet" is not पेट
});

test("speech-to-text spellings: nukta, chandrabindu, Devanagari digits and Hinglish variants", () => {
  assert.equal(ask("बारिश क्यूँ होती है").intent, "rain_why");
  assert.equal(ask("बारिश क्यो होती है").intent, "rain_why");
  assert.equal(ask("आसमान नीला कियों है").intent, "sky_blue");
  assert.equal(ask("चान्द हमारे साथ क्यों चलता है").intent, "moon_follow");
  assert.equal(ask("सोमवार के बाद कौनसा दिन").intent, "day_after");
  assert.equal(ask("७ के बाद क्या आता है").text.includes("8"), true);
  assert.equal(ask("doctor kya karte hai").intent, "job_doctor");
  assert.equal(ask("dactar kya karte hain"), null);
  for (const q of ["aasmaan neela kyon hai", "asman nila kyu hai", "aasman neela kiyon hai", "AASMAAN NEELA KYUN HAI?"]) {
    assert.equal(ask(q).intent, "sky_blue", q);
  }
});

/* ---------------- what the child hears ---------------- */

test("every reply ≤ 220 characters; 2–3 year olds get 1–2 short sentences, older children up to 3", () => {
  for (const { id, age, r, raw } of everyReply()) {
    assert.ok(r.text.length <= 220, `${id}/${age}: ${r.text.length} chars: ${r.text}`);
    const n = sentenceCount(r.text);
    const kept = raw.sens || id === "jokes" || id === "riddles" || id === "tongue_twister" || id === "pretend_play" ||
      id === "mitthu_says" || id === "animal_walks" || id === "cow_fly" || id === "would_you_rather";
    if (age === "2-3") {
      assert.ok(n <= 2, `${id}/2-3: ${n} sentences: ${r.text}`);
      if (!kept) assert.ok(r.text.length <= 130, `${id}/2-3 too long (${r.text.length}): ${r.text}`);
    } else {
      assert.ok(n <= 3, `${id}/${age}: ${n} sentences: ${r.text}`);
    }
  }
});

test("older children hear at least as much as toddlers, and usually more", () => {
  let longer = 0, total = 0;
  for (const id of K.intents()) {
    if (K._raw(id).computed) continue;
    for (const lang of LANGS) {
      const young = compose(id, lang, "2-3", 3).text.length, old = compose(id, lang, "6+", 3).text.length;
      total++;
      if (old > young) longer++;
    }
  }
  assert.ok(longer > total * 0.4, `only ${longer} of ${total} replies say more to 6+ than to 2–3`);
});

test("language consistency: Hindi replies are Devanagari, English and Hinglish replies are Latin", () => {
  for (const { id, lang, r } of everyReply([1, 2, 3])) {
    const all = r.text + " " + (r.followUp || "");
    if (lang === "hi") {
      assert.match(r.text, DEV, `${id}/hi: ${r.text}`);
      assert.doesNotMatch(all, LATIN, `${id}/hi has Latin letters: ${all}`);
    } else {
      assert.match(r.text, LATIN, `${id}/${lang}: ${r.text}`);
      assert.doesNotMatch(all, DEV, `${id}/${lang} has Devanagari: ${all}`);
    }
    assert.equal(r.lang, lang);
  }
});

test("follow-ups are short playful questions; sensitive answers have none", () => {
  for (const { id, lang, r, raw } of everyReply([1, 2])) {
    if (raw.sens) { assert.equal(r.followUp, undefined, `${id} is sensitive but has a follow-up`); continue; }
    if (r.followUp == null) continue;
    assert.ok(r.followUp.length <= 120, `${id}: ${r.followUp}`);
    assert.match(r.followUp, /[?？]\s*$/, `${id}/${lang} follow-up is not a question: ${r.followUp}`);
  }
});

/* Hindi words with Unicode word edges ("खून" must not match inside "नाखून"). */
const hiWords = (...w) => new RegExp("(?<![\\p{L}\\p{M}])(?:" + w.join("|") + ")(?![\\p{L}\\p{M}])", "u");
const BANNED = [
  // violence, death words, scary
  /\b(kill|killed|killing|dead|death|die|died|dying|blood|bloody|gun|guns|weapon|bomb|murder|shoot)\b/i,
  hiWords("मार डाल", "मारना", "मरना", "मर गया", "मर गई", "मौत", "खून", "बंदूक", "हथियार", "बम", "हत्या"),
  /\b(maar daal|marna|mar gaya|maut|khoon|bandook|hathiyar)\b/i,
  // shaming, insults
  /\b(stupid|idiot|dumb|ugly|fat|loser|shut up|bad boy|bad girl|pagal|gadha|bewakoof)\b/i,
  hiWords("बेवकूफ", "पागल", "मूर्ख", "गधा", "बदसूरत", "मोटा", "मोटी", "नालायक", "चुप कर"),
  // romance
  /\b(kiss|kissing|sexy|boyfriend|girlfriend|romance|romantic|date night)\b/i, hiWords("किस करो", "चुम्मी", "बॉयफ्रेंड", "गर्लफ्रेंड", "सेक्सी"),
  // medicine doses
  /\b\d+\s*(mg|ml|milligram|tablets? a day)\b/i, /\bdose\b/i, hiWords("खुराक"),
  // brands and companies
  /\b(coca|coke|pepsi|cadbury|maggi|nestle|amul|lego|barbie|disney|youtube|google|amazon|iphone|samsung|mcdonald|kfc|chatgpt|openai|whatsapp|instagram|facebook|netflix|dairy milk|kitkat)\b/i,
  // politics and religion superiority
  /\b(bjp|congress party|aam aadmi party|best religion|true religion|only god)\b/i, hiWords("सबसे अच्छा धर्म", "सच्चा धर्म", "भाजपा", "कांग्रेस"),
];
test("no banned words: violence, death, shaming, romance, doses, brands, politics, religion superiority", () => {
  for (const id of K.intents()) {
    const { a, f, computed } = K._raw(id);
    if (computed) continue;
    const texts = [].concat(a.hi, a.en, a.hinglish, f ? [f.hi, f.en, f.hinglish] : []);
    for (const t of texts) for (const re of BANNED) assert.doesNotMatch(t, re, `${id}: "${t}" matches ${re}`);
  }
  for (const cat of Object.keys(K._follow)) for (const f of K._follow[cat]) for (const lang of LANGS) {
    for (const re of BANNED) assert.doesNotMatch(f[lang], re, `follow-up ${cat}: ${f[lang]}`);
  }
});

test("deterministic with a seeded random, and varied across seeds", () => {
  const qs = ["आसमान नीला क्यों है?", "गाय क्या खाती है", "चुटकुला सुनाओ", "how do birds fly", "मुझे डर लग रहा है"];
  for (const q of qs) for (const lang of LANGS) for (const age of AGES) {
    assert.deepEqual(ask(q, lang, age, 42), ask(q, lang, age, 42), `${q}/${lang}/${age}`);
  }
  const seen = new Set();
  for (let s = 1; s <= 30; s++) seen.add(ask("आसमान नीला क्यों है?", "hi", "6+", s).text);
  assert.ok(seen.size >= 3, `only ${seen.size} different phrasings`);
  const jokes = new Set();
  for (let s = 1; s <= 30; s++) jokes.add(ask("एक चुटकुला सुनाओ", "en", "4-5", s).text);
  assert.ok(jokes.size >= 5, `only ${jokes.size} different jokes`);
  // a bad random() never breaks it
  for (const rnd of [() => 1, () => -1, () => NaN, () => "x"]) {
    assert.ok(K.answer("आसमान नीला क्यों है?", { lang: "hi", ageBand: "2-3", random: rnd }));
  }
});

test("Hinglish defaults, unknown lang/age fall back safely", () => {
  assert.match(K.answer("sky blue kyun hai", {}).text, DEV);   // default Hindi
  assert.ok(K.answer("sky blue kyun hai", { lang: "fr", ageBand: "99" }).text.length <= 220);
});

/* ---------------- care and honesty ---------------- */

test("help referrals always say 1098 or 112 (1098 is being merged into 112)", () => {
  for (const id of ["lost", "body_privacy", "secrets", "helpline"]) {
    for (const age of AGES) {
      assert.match(compose(id, "hi", age, 1).text, /1098 या 112/, `${id}/hi/${age}`);
      assert.match(compose(id, "en", age, 1).text, /1098 or 112/, `${id}/en/${age}`);
      assert.match(compose(id, "hinglish", age, 1).text, /1098 ya 112/, `${id}/hinglish/${age}`);
    }
  }
  // nothing ever mentions 1098 without 112
  for (const id of K.intents()) {
    const { a, computed } = K._raw(id);
    if (computed) continue;
    for (const t of [].concat(a.hi, a.en, a.hinglish)) if (/1098/.test(t)) assert.match(t, /112/, `${id}: ${t}`);
  }
});

test("'who are you / are you real / a person / a robot' get an honest answer: a computer parrot, not a person; family and friends are best", () => {
  const qs = ["तुम कौन हो", "who are you", "tum kaun ho", "are you real?", "क्या तुम असली हो", "kya tum sach mein ho",
    "are you a person", "क्या तुम इंसान हो", "tum insaan ho kya", "are you a human", "are you a robot", "क्या तुम कंप्यूटर हो"];
  for (const q of qs) {
    const id = ask(q).intent;
    assert.ok(["who_are_you", "are_you_real", "are_you_person", "are_you_robot"].includes(id), `"${q}" → ${id}`);
    for (const age of AGES) {
      const hi = ask(q, "hi", age).text, en = ask(q, "en", age).text, hg = ask(q, "hinglish", age).text;
      assert.match(hi, /कंप्यूटर/, hi); assert.match(hi, /इंसान नहीं/, hi); assert.match(hi, /खेलने और सीखने/, hi);
      assert.match(hi, /घर वाले/, hi); assert.match(hi, /दोस्त/, hi);
      assert.match(en, /computer/i, en); assert.match(en, /not a person/, en); assert.match(en, /play/, en); assert.match(en, /learn/, en);
      assert.match(en, /family/, en); assert.match(en, /friends/, en);
      assert.match(hg, /computer/i, hg); assert.match(hg, /insaan nahi/i, hg); assert.match(hg, /ghar wale/i, hg); assert.match(hg, /dost/i, hg);
    }
  }
});

test("sensitive topics: one gentle sentence + talk to a grown-up, never details", () => {
  const grownUp = { hi: /बड़/, en: /grown-up/, hinglish: /bad[eo]/i };
  for (const id of K.intents()) {
    const raw = K._raw(id);
    if (!raw.sens || raw.cat !== "sensitive") continue;
    for (const lang of LANGS) {
      const r = compose(id, lang, "2-3", 1);
      assert.match(r.text, grownUp[lang], `${id}/${lang}: ${r.text}`);
      assert.equal(r.followUp, undefined);
    }
  }
  for (const q of ["मेरा कुत्ता मर गया", "my cat died", "why do people die", "where do we go after we die", "who is god", "which religion is best"]) {
    const r = ask(q, "en");
    assert.ok(r && K._raw(r.intent).sens, `"${q}" should be handled gently, got ${r && r.intent}`);
    assert.match(r.text, /grown-up/, r.text);
  }
});

test("personal details are never asked for or repeated", () => {
  const r = ask("मेरा नाम आरव है, आसमान नीला क्यों है?");
  assert.equal(r.intent, "sky_blue");
  assert.doesNotMatch(r.text + r.followUp, /आरव/);
  const ASKS = /(तुम्हारा|आपका|अपना) (नाम|पता|नंबर|फ़ोन)[^।!?]*(बताओ|बताना|क्या है)\s*\?|what('s| is) your (name|address|phone|number|school)|tell me your (name|address|number|school)|(tumhara|aapka|apna) (naam|pata|number)[^.!?]*(batao|batana|kya hai)\s*\?/i;
  for (const { id, r: x } of everyReply([1])) assert.doesNotMatch((x.followUp || "") + " " + x.text, ASKS, id);
  assert.equal(ask("do you know where i live").intent, "where_i_live");
  assert.match(ask("do you know where i live", "en").text, /never tell it to strangers/);
});

test("safety answers keep children with grown-ups and away from danger", () => {
  assert.match(ask("can I touch fire", "en").text, /never touch/);
  assert.match(ask("क्या मैं दवाई खा सकता हूँ", "hi").text, /सिर्फ़ बड़े/);
  assert.match(ask("how do I cross the road", "en").text, /grown-up's hand/);
  assert.match(ask("घर में आग लगी है", "hi").text, /बड़े/);
  assert.equal(ask("घर में आग लगी है", "hi").followUp, undefined);
});
