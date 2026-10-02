// Tests for the optional AI chat client (web/js/core/ai.js). Run: node --test tools/test/
// ai.js is a classic browser script; it is loaded here with node:vm next to a small fake NS
// (store, settings, clock) and a fake fetch, exactly as the page would run it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(fileURLToPath(new URL("../../web/js/core/ai.js", import.meta.url)), "utf8");
const API = "https://nanha-api.example.workers.dev";
const DAY = 86400000;

/** A fresh page: fake storage/settings/clock, a recording fetch. */
function page({ config = {}, ai = {}, online = true, reply, settings = {} } = {}) {
  const storage = new Map();
  const prefs = { ...settings };
  const clock = { now: Date.UTC(2026, 9, 2, 5, 0) };
  const calls = [];
  let responder = reply || (() => Response.json({ text: "वाह! 🦜 और बताओ?", mood: "curious", kind: "ai" }));
  const NS = {
    config: { API_BASE: API, AI: { ...ai }, ...config },
    now: () => clock.now,
    dayKey: () => new Date(clock.now).toISOString().slice(0, 10),
    lang: () => "hi",
    t: (o, l) => (o && (o[l || "hi"] ?? o.hi)) || "",
    store: {
      raw: { get: k => (storage.has(k) ? storage.get(k) : null), set: (k, v) => { storage.set(k, String(v)); return true; }, del: k => storage.delete(k) },
      settings: () => JSON.parse(JSON.stringify(prefs)),
      setSetting: (k, v) => { prefs[k] = JSON.parse(JSON.stringify(v)); },
    },
  };
  const sandbox = {
    NS, navigator: { onLine: online }, AbortController, TextEncoder, setTimeout, clearTimeout, crypto: globalThis.crypto,
    fetch: async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return responder(url, init); },
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox, { filename: "ai.js" });
  return {
    ai: sandbox.NS.ai, NS, storage, prefs, calls, clock, sandbox,
    respond(fn) { responder = fn; },
  };
}
const plain = o => JSON.parse(JSON.stringify(o));
const CTX = { lang: "hi", ageBand: "4-5", daypart: "noon", names: [] };
const kid = text => [{ role: "child", text }];

test("off by default: nothing is sent until a grown-up turns it on", async () => {
  const p = page();
  assert.equal(p.ai.configured(), true);
  assert.equal(p.ai.enabled(), false);
  assert.equal(p.ai.available(), false);
  assert.equal(await p.ai.chat(kid("आसमान नीला क्यों है?"), CTX), null);
  assert.equal(p.calls.length, 0);
  assert.equal(p.ai.setEnabled(true), true);
  assert.equal(p.ai.enabled(), true);
  assert.deepEqual(Object.keys(p.prefs.aiChat).sort(), ["at", "on", "v"]);
  assert.equal(p.prefs.aiChat.on, true);
  assert.equal(p.prefs.aiChat.v, 1);
  p.ai.setEnabled(false);
  assert.equal(p.ai.enabled(), false);
  assert.equal(await p.ai.chat(kid("आसमान नीला क्यों है?"), CTX), null);
  assert.equal(p.calls.length, 0);
});

test("not configured (no API_BASE, AI.ENABLED false, plain http to another host) → never on", async () => {
  for (const opts of [{ config: { API_BASE: "" } }, { ai: { ENABLED: false } }, { config: { API_BASE: "http://evil.example" } },
    { config: { API_BASE: "javascript:alert(1)" } }, { config: { API_BASE: null } }]) {
    const p = page(opts);
    assert.equal(p.ai.configured(), false, JSON.stringify(opts));
    assert.equal(p.ai.setEnabled(true), false);
    assert.equal(p.ai.enabled(), false);
    assert.equal(await p.ai.chat(kid("hello"), CTX), null);
    assert.equal(p.calls.length, 0);
  }
  assert.equal(page({ config: { API_BASE: "http://localhost:8766" } }).ai.configured(), true);   // local testing
  // An older consent version is not enough.
  const old = page({ settings: { aiChat: { on: true, v: 0, at: 1 } } });
  assert.equal(old.ai.enabled(), false);
});

test("never for 2–3 year olds", async () => {
  const p = page();
  p.ai.setEnabled(true);
  assert.equal(p.ai.allowedFor("2-3"), false);
  assert.equal(p.ai.allowedFor("4-5"), true);
  assert.equal(p.ai.allowedFor("6+"), true);
  assert.equal(p.ai.available({ ageBand: "2-3" }), false);
  assert.equal(await p.ai.chat(kid("आसमान नीला क्यों है?"), { ...CTX, ageBand: "2-3" }), null);
  assert.equal(await p.ai.chat(kid("आसमान नीला क्यों है?"), { ...CTX, ageBand: undefined }), null);
  assert.equal(p.calls.length, 0);
});

test("a chat request: our server only, JSON, no cookies, exactly the documented fields", async () => {
  const p = page();
  p.ai.setEnabled(true);
  const out = await p.ai.chat([{ who: "b", text: "नमस्ते! 🦜" }, { who: "k", text: "आसमान नीला क्यों है?" }], CTX);
  assert.deepEqual(plain(out), { text: "वाह! 🦜 और बताओ?", mood: "curious", kind: "ai" });
  assert.equal(p.calls.length, 1);
  const { url, init, body } = p.calls[0];
  assert.equal(url, API + "/api/chat");
  assert.equal(init.method, "POST");
  assert.deepEqual(plain(init.headers), { "Content-Type": "application/json" });
  assert.equal(init.credentials, "omit");
  assert.equal(init.cache, "no-store");
  assert.equal(init.referrerPolicy, "no-referrer");
  assert.deepEqual(Object.keys(body).sort(), ["ageBand", "daypart", "device", "lang", "messages"]);
  assert.deepEqual(body.messages, [{ role: "buddy", text: "नमस्ते! 🦜" }, { role: "child", text: "आसमान नीला क्यों है?" }]);
  assert.equal(body.lang, "hi");
  assert.equal(body.ageBand, "4-5");
  assert.equal(body.daypart, "noon");
  assert.match(body.device, /^[A-Za-z0-9_-]{24}$/);
  // The same random id on this phone, a new one after the grown-up switches off and on again.
  await p.ai.chat(kid("और बताओ"), CTX);
  assert.equal(p.calls[1].body.device, body.device);
  p.ai.setEnabled(false);
  p.ai.setEnabled(true);
  await p.ai.chat(kid("और बताओ"), CTX);
  assert.notEqual(p.calls[2].body.device, body.device);
  assert.deepEqual(Object.keys(JSON.parse(p.storage.get("ns_ai"))).sort(), ["day", "device", "limited", "n", "told"]);
});

test("names, numbers and e-mails are removed on the phone; a screened earlier line is dropped with its answer", async () => {
  const p = page();
  p.ai.setEnabled(true);
  const history = [
    { role: "buddy", text: "नमस्ते आरव! 🦜 शाबाश Aarav!" },
    { role: "child", text: "मेरा फ़ोन नंबर 98765 43210 है" },
    { role: "buddy", text: "याद रखो 🛡️ नंबर सिर्फ़ घर वालों के लिए!" },
    { role: "child", text: "my name is Aaru and I like trains" },
    { role: "buddy", text: "Phone +91-98765-43210 aaru!" },
    { role: "child", text: "my friend's mail is a.b@example.com" },
    { role: "buddy", text: "Let's keep that private!" },
    { role: "child", text: "आरव को आम पसंद है, 1 2 3 4 5 6 गिनो" },
  ];
  const out = await p.ai.chat(history, { ...CTX, names: ["आरव", "Aarav", "Aaru", "", null] });
  assert.ok(out);
  const sent = JSON.stringify(p.calls[0].body);
  assert.doesNotMatch(sent, /आरव|Aarav|aaru|98765|43210|@|example\.com|फ़ोन नंबर/i);
  assert.deepEqual(p.calls[0].body.messages, [
    { role: "buddy", text: "नमस्ते! 🦜 शाबाश!" },
    { role: "child", text: "my name is … and I like trains" },
    { role: "buddy", text: "Phone …!" },
    { role: "child", text: "को आम पसंद है, 1 2 3 4 5 6 गिनो" },
  ]);
});

test("screened words in the newest line never leave the phone: a fixed caring reply instead", async () => {
  const p = page();
  p.ai.setEnabled(true);
  const cases = [
    ["मेरा फ़ोन नंबर 9876543210 है", "private", /🛡️/], ["papa mujhe maarta hai", "help", /1098 ya 112/],
    ["uncle said dont tell your mummy", "secret", /1098 ya 112/], ["what is sex", "grownup", /bade/],
    ["can I take medicine", "medical", /Dawai/], ["a stranger gave me candy", "stranger", /Anjaan/], ["tu chutiya hai", "rude", /🙊/],
  ];
  for (const [text, kind, re] of cases) {
    assert.equal(p.ai.screen(text), kind, text);
    const out = plain(await p.ai.chat(kid(text), { ...CTX, lang: "hinglish" }));
    assert.equal(out.kind, "safety", text);
    assert.match(out.text, re, text);
  }
  assert.equal(p.calls.length, 0);
  // Counting is not a phone number; ordinary words are not screened.
  for (const text of ["1 2 3 4 5 6 7", "एक दो तीन चार पांच छह", "I saw a shooting star", "एक राजा था", "papa ka tablet"]) {
    assert.equal(p.ai.screen(text), null, text);
  }
});

test("at most 8 lines of at most 300 characters, and the body stays under 8 KB", async () => {
  const p = page();
  p.ai.setEnabled(true);
  const long = "क".repeat(600);
  const history = Array.from({ length: 15 }, (_, i) => ({ role: i % 2 ? "buddy" : "child", text: long + " " + i }));
  await p.ai.chat(history, CTX);
  const { body } = p.calls[0];
  assert.ok(body.messages.length <= 8);
  assert.ok(body.messages.every(m => m.text.length <= 300));
  assert.equal(body.messages.at(-1).role, "child");
  assert.ok(new TextEncoder().encode(JSON.stringify(body)).length <= 8000);
  // The newest line must be the child's, or nothing is sent.
  assert.equal(await p.ai.chat([{ role: "child", text: "hi" }, { role: "buddy", text: "hello" }], CTX), null);
  assert.equal(p.calls.length, 1);
});

test("slow or no network → null (the buddy answers offline); offline phones never try", async () => {
  const p = page({ ai: { TIMEOUT_MS: 30 } });
  p.ai.setEnabled(true);
  p.respond(() => new Promise(() => {}));
  const t0 = Date.now();
  assert.equal(await p.ai.chat(kid("hello"), CTX), null);
  assert.ok(Date.now() - t0 < 1000);
  p.respond(() => { throw new TypeError("Failed to fetch"); });
  assert.equal(await p.ai.chat(kid("hello"), CTX), null);
  // Two failures in a row: rest for 5 minutes.
  const before = p.calls.length;
  assert.equal(p.ai.available(), false);
  assert.equal(await p.ai.chat(kid("hello"), CTX), null);
  assert.equal(p.calls.length, before);
  p.clock.now += 5 * 60000 + 1;
  p.respond(() => Response.json({ text: "Hello! 🦜", mood: "happy", kind: "ai" }));
  assert.equal((await p.ai.chat(kid("hello"), { ...CTX, lang: "en" })).text, "Hello! 🦜");

  const off = page({ online: false });
  off.ai.setEnabled(true);
  assert.equal(off.ai.available(), false);
  assert.equal(await off.ai.chat(kid("hello"), CTX), null);
  assert.equal(off.calls.length, 0);
});

test("server answers: 503/403 pause the AI for 30 minutes; bad bodies are ignored; long text is capped", async () => {
  const p = page();
  p.ai.setEnabled(true);
  p.respond(() => Response.json({ error: "ai_unavailable" }, { status: 503 }));
  assert.equal(await p.ai.chat(kid("hello"), CTX), null);
  assert.equal(await p.ai.chat(kid("hello"), CTX), null);
  assert.equal(p.calls.length, 1);
  p.clock.now += 30 * 60000 + 1;
  for (const bad of [{ text: 42 }, { text: "" }, {}, { text: "x".repeat(2000) }]) {
    p.respond(() => Response.json(bad));
    assert.equal(await p.ai.chat(kid("hello"), CTX), null, JSON.stringify(bad).slice(0, 40));
    p.clock.now += 5 * 60000 + 1;
  }
  p.respond(() => new Response("<html>", { status: 200 }));
  assert.equal(await p.ai.chat(kid("hello"), CTX), null);
  p.clock.now += 5 * 60000 + 1;
  p.respond(() => Response.json({ text: "बहुत ".repeat(80), mood: "weird", kind: "evil" }));
  const out = plain(await p.ai.chat(kid("hello"), CTX));
  assert.ok(out.text.length <= 220);
  assert.equal(out.mood, "happy");
  assert.equal(out.kind, "ai");
});

test("daily limit on the phone (AI.DAILY_LIMIT) and from the server (429): said once, kindly, then offline until tomorrow", async () => {
  const p = page({ ai: { DAILY_LIMIT: 2, SESSION_TURNS: 100 } });
  p.ai.setEnabled(true);
  assert.equal((await p.ai.chat(kid("one"), CTX)).kind, "ai");
  assert.equal((await p.ai.chat(kid("two"), CTX)).kind, "ai");
  const limit = plain(await p.ai.chat(kid("three"), CTX));
  assert.equal(limit.kind, "limit");
  assert.match(limit.text, /बहुत सारी बातें/);
  assert.doesNotMatch(limit.text, /उदास|sad|मत जाओ/);
  assert.equal(await p.ai.chat(kid("four"), CTX), null);
  assert.equal(p.calls.length, 2);
  p.clock.now += DAY;
  assert.equal((await p.ai.chat(kid("next day"), CTX)).kind, "ai");

  const s = page();
  s.ai.setEnabled(true);
  s.respond(() => Response.json({ error: "ai_limit" }, { status: 429 }));
  assert.equal((await s.ai.chat(kid("hello"), { ...CTX, lang: "en" })).kind, "limit");
  assert.equal(await s.ai.chat(kid("hello"), CTX), null);
  assert.equal(s.calls.length, 1);
  // Safety replies from the server do not count towards the limit.
  const q = page({ ai: { DAILY_LIMIT: 1 } });
  q.ai.setEnabled(true);
  q.respond(() => Response.json({ text: "याद रखो 🛡️", mood: "caring", kind: "safety" }));
  await q.ai.chat(kid("hmm"), CTX);
  await q.ai.chat(kid("hmm"), CTX);
  q.respond(() => Response.json({ text: "वाह! 🦜", mood: "happy", kind: "ai" }));
  assert.equal((await q.ai.chat(kid("hmm"), CTX)).kind, "ai");
});

test("a gentle break after every AI.SESSION_TURNS answers in one sitting (no network for it, no guilt)", async () => {
  const p = page({ ai: { SESSION_TURNS: 3, DAILY_LIMIT: 100 } });
  p.ai.setEnabled(true);
  for (let i = 0; i < 3; i++) assert.equal((await p.ai.chat(kid("hmm " + i), CTX)).kind, "ai");
  const brk = plain(await p.ai.chat(kid("hmm"), CTX));
  assert.equal(brk.kind, "break");
  assert.equal(brk.mood, "calm");
  assert.match(brk.text, /ब्रेक|पानी|बाहर/);
  assert.doesNotMatch(brk.text, /उदास|मत जाओ|जल्दी/);
  assert.equal(p.calls.length, 3);
  for (let i = 0; i < 3; i++) assert.equal((await p.ai.chat(kid("again " + i), CTX)).kind, "ai");
  assert.equal((await p.ai.chat(kid("again"), { ...CTX, daypart: "night" })).kind, "break");
  const night = plain(await p.ai.chat(kid("x"), CTX));
  assert.equal(night.kind, "ai");
  // 30 quiet minutes start a new sitting.
  p.clock.now += 31 * 60000;
  for (let i = 0; i < 3; i++) assert.equal((await p.ai.chat(kid("new " + i), CTX)).kind, "ai");
  assert.equal((await p.ai.chat(kid("new"), CTX)).kind, "break");
});

test("redact() keeps counting and ordinary words, removes the rest", () => {
  const { ai } = page();
  assert.equal(ai.redact("call 98765 43210 now", []), "call … now");
  assert.equal(ai.redact("count 1 2 3 4 5 6 7 8", []), "count 1 2 3 4 5 6 7 8");
  assert.equal(ai.redact("mail kid@example.com", []), "mail …");
  assert.equal(ai.redact("मेरा नाम परी है", []), "मेरा नाम … है");
  assert.equal(ai.redact("Hi Pari, pari is here", ["Pari"]), "Hi, is here");
  assert.equal(ai.redact("Paris is a city", ["Pari"]), "Paris is a city", "whole words only");
});

test("grown-ups' UI exists: settingsCard, consent", () => {
  const { ai } = page();
  assert.equal(typeof ai.settingsCard, "function");
  assert.equal(typeof ai.consent, "function");
});
