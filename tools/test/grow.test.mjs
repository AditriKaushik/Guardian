// Tests for the "grow" activities (web/js/modules/{routine,garden,stories,dreams,focus}.js) and
// their content (web/js/content/{routine,stories,careers,focus}.js). Run: node --test tools/test/
// The files are classic browser scripts; they are loaded here with node:vm as the page loads them,
// against a tiny fake NS that follows docs/ARCHITECTURE.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const WEB = new URL("../../web/js/", import.meta.url);
const CONTENT = ["routine", "stories", "careers", "focus"];
const MODULES = ["routine", "garden", "stories", "dreams", "focus"];
const plain = (o) => JSON.parse(JSON.stringify(o));
const DEV = /[ऀ-ॿ]/;

function load({ activeData } = {}) {
  const handlers = {};
  const registered = {};
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.NS = {
    content: {},
    registerActivity(def) { registered[def.id] = def; },
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); return () => {}; },
    emit(name, payload) { (handlers[name] || []).forEach((fn) => fn(payload)); },
    now: () => new Date(2026, 9, 2, 8, 30).getTime(),
  };
  if (activeData) sandbox.NS.activeData = activeData;
  vm.createContext(sandbox);
  for (const c of CONTENT) {
    const f = fileURLToPath(new URL("content/" + c + ".js", WEB));
    vm.runInContext(readFileSync(f, "utf8"), sandbox, { filename: "content/" + c + ".js" });
  }
  for (const m of MODULES) {
    const f = fileURLToPath(new URL("modules/" + m + ".js", WEB));
    vm.runInContext(readFileSync(f, "utf8"), sandbox, { filename: "modules/" + m + ".js" });
  }
  return { NS: sandbox.NS, registered, handlers };
}
function memStore() {
  const m = {};
  return { get: (k, f) => (k in m ? JSON.parse(JSON.stringify(m[k])) : f), set: (k, v) => { m[k] = JSON.parse(JSON.stringify(v)); }, raw: m };
}
function seeded(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  const next = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  for (let i = 0; i < 5; i++) next();   // warm up: tiny seeds give tiny first values
  return next;
}

const { NS, registered } = load();
const R = NS.grow.routine, G = NS.grow.garden, F = NS.grow.focus;

/* ---------------- registration ---------------- */
test("all five activities register with the documented contract", () => {
  for (const id of MODULES) {
    const a = registered[id];
    assert.ok(a, id + " registered");
    assert.match(a.id, /^[a-z]+$/);
    assert.equal(a.section, "grow");
    assert.equal(typeof a.open, "function");
    assert.ok(a.title.hi && a.title.en && a.icon && a.color);
  }
});

/* ---------------- routine: dates, pruning, now, sequencing ---------------- */
test("dateKey is the local calendar day", () => {
  assert.equal(R.dateKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(R.dayDiff("2026-02-27", "2026-03-02"), 3);
  assert.equal(R.dayDiff("2025-12-31", "2026-01-01"), 1);
});

test("pruneDays keeps only the last 14 days (today included) and drops junk/future keys", () => {
  const days = {};
  for (let i = 0; i < 20; i++) days[R.dateKey(new Date(2026, 9, 2 - i))] = ["brush"];
  days["2026-10-05"] = ["future"];
  days["junk"] = ["x"];
  const out = plain(R.pruneDays(days, "2026-10-02", 14));
  const keys = Object.keys(out).sort();
  assert.equal(keys.length, 14);
  assert.equal(keys[0], "2026-09-19");
  assert.equal(keys[13], "2026-10-02");
  assert.deepEqual(plain(R.pruneDays(null, "2026-10-02")), {});
});

test("nowIndex: what is it time for at each hour", () => {
  const items = NS.content.routine.items;
  const at = (h, done) => items[R.nowIndex(items, h, done)].id;
  assert.equal(at(3), "sleep");          // small hours: still sleep time
  assert.equal(at(6), "sleep");
  assert.equal(at(7), "wake");
  assert.equal(at(7, ["wake"]), "brush"); // same hour: first one not done yet
  assert.equal(at(7, ["wake", "brush"]), "brush");
  assert.equal(at(10), "school");
  assert.equal(at(13), "lunch");
  assert.equal(at(18), "outdoor");
  assert.equal(at(23), "sleep");
});

test("routine items are in day order with valid habits", () => {
  const items = NS.content.routine.items;
  const allowed = ["brush", "eat", "play", "read", "sleep", "water", "bath", "help", null];
  assert.equal(items.length, 12);
  for (let i = 1; i < items.length; i++) assert.ok(items[i].hour >= items[i - 1].hour, "ordered by hour: " + items[i].id);
  for (const it of [...items, ...NS.content.routine.extras]) {
    assert.ok(allowed.includes(it.habit), it.id + " habit");
    assert.match(it.title.hi, DEV);
    assert.ok(it.title.en && it.yay.hi && it.yay.en);
  }
  const sort = NS.content.routine.sort;
  assert.ok(sort.filter((s) => s.part === "morning").length >= 4 && sort.filter((s) => s.part === "night").length >= 4);
});

test("checkOrder marks each position right or wrong", () => {
  assert.deepEqual(plain(R.checkOrder([0, 4, 9])), [true, true, true]);
  assert.deepEqual(plain(R.checkOrder([4, 0, 9])), [false, false, true]);
  assert.deepEqual(plain(R.checkOrder([9, 4, 0])), [false, true, false]);
});

test("pickSequence picks n distinct-hour items, spaced apart, in day order", () => {
  const items = NS.content.routine.items;
  for (let seed = 1; seed < 200; seed++) {
    for (const [n, gap] of [[3, 4], [4, 3], [4, 1]]) {
      const p = plain(R.pickSequence(items, n, seeded(seed), gap));
      assert.equal(p.length, n);
      assert.deepEqual(p, p.slice().sort((a, b) => a - b));
      const hours = p.map((i) => items[i].hour);
      assert.equal(new Set(hours).size, n, "distinct hours");
      for (let i = 1; i < n; i++) assert.ok(hours[i] - hours[i - 1] >= gap, `gap ${gap} seed ${seed}: ${hours}`);
    }
  }
});

test("hourLabel speaks the part of the day", () => {
  assert.equal(R.hourLabel(7).hi, "सुबह 7 बजे");
  assert.equal(R.hourLabel(13).hi, "दोपहर 1 बजे");
  assert.equal(R.hourLabel(17).hi, "शाम 5 बजे");
  assert.equal(R.hourLabel(21).hi, "रात 9 बजे");
  assert.equal(R.hourLabel(0).h12, 12);
});

/* ---------------- garden: growth, caps, never shrinking ---------------- */
test("growth stages: seed → sprout → plant → flower → fruit", () => {
  const stages = [0, 1, 2, 3, 4, 5, 6, 9, 10, 13, 14, 30].map((w) => G.stageOf(w));
  assert.deepEqual(plain(stages), [0, 1, 1, 2, 2, 2, 3, 3, 4, 4, 4, 4]);
  assert.equal(G.fruitsOf(9), 0);
  assert.equal(G.fruitsOf(10), 1);
  assert.equal(G.fruitsOf(14), 2);
  assert.deepEqual(plain(G.progressOf(4)), { have: 1, need: 3 });
  assert.deepEqual(plain(G.progressOf(12)), { have: 2, need: 4 });
});

test("applyHabit waters at most twice a day per plant, never shrinks, ignores unknown habits", () => {
  let plants = {};
  let r = G.applyHabit(plants, "brush", "2026-10-02");
  assert.ok(r.changed && r.grewStage);
  plants = r.plants;
  r = G.applyHabit(plants, "brush", "2026-10-02"); plants = r.plants;
  assert.ok(r.changed && !r.grewStage);
  r = G.applyHabit(plants, "brush", "2026-10-02");
  assert.ok(r.capped && !r.changed);
  assert.equal(r.plants.brush.w, 2);
  r = G.applyHabit(plants, "brush", "2026-10-03"); plants = r.plants;
  assert.ok(r.changed && r.grewStage);                    // 3 drops → plant
  assert.equal(plants.brush.w, 3);
  assert.ok(G.applyHabit(plants, "fly", "2026-10-03").unknown);
  // a long gap does nothing bad: growth only pauses
  r = G.applyHabit(plants, "brush", "2027-01-01");
  assert.equal(r.plants.brush.w, 4);
  // the input object is not mutated
  const before = { eat: { w: 5, d: "x", n: 1, seen: 0 } };
  G.applyHabit(before, "eat", "y");
  assert.equal(before.eat.w, 5);
});

test("about five days of brushing twice reaches fruit", () => {
  let plants = {};
  for (let d = 1; d <= 5; d++) for (let t = 0; t < 3; t++) plants = G.applyHabit(plants, "brush", "2026-10-0" + d).plants;
  assert.equal(G.stageOf(plants.brush.w), 4);
});

test("unseen lists plants that grew since last celebrated", () => {
  const plants = { brush: { w: 3, seen: G.levelOf(1) }, eat: { w: 1, seen: G.levelOf(1) }, read: { w: 0, seen: 0 } };
  assert.deepEqual(plain(G.unseen(plants)), ["brush"]);
});

test("habit:done while the garden is closed is queued, then applied on open", () => {
  const env = load();
  const g = env.NS.grow.garden;
  env.NS.emit("habit:done", { habit: "brush" });
  env.NS.emit("habit:done", { habit: "nonsense" });
  assert.equal(g._pending.length, 1);
  const data = memStore();
  g._flush(data);
  assert.equal(g._pending.length, 0);
  assert.equal(data.raw.plants.brush.w, 1);
  env.NS.emit("habit:done", { habit: "eat" });
  env.NS.emit("profile:changed", { id: "other" });
  assert.equal(g._pending.length, 0, "a different child's queue is dropped");
});

test("habit:done goes straight to NS.activeData('garden') when the core provides it", () => {
  const data = memStore();
  const env = load({ activeData: (id) => (id === "garden" ? data : null) });
  env.NS.emit("habit:done", { habit: "water" });
  env.NS.emit("habit:done", { habit: "water" });
  env.NS.emit("habit:done", { habit: "water" });
  assert.equal(data.raw.plants.water.w, 2);
  assert.equal(env.NS.grow.garden._pending.length, 0);
});

test("every habit the routine can emit has a plant", () => {
  const habits = [...NS.content.routine.items, ...NS.content.routine.extras].map((i) => i.habit).filter(Boolean);
  for (const h of habits) assert.ok(G.PLANTS[h], h);
  assert.deepEqual(plain(G.HABITS).sort(), ["bath", "brush", "eat", "help", "play", "read", "sleep", "water"]);
});

/* ---------------- focus: memory deck, odd one out ---------------- */
test("memory card counts follow the age band", () => {
  assert.equal(F.memoryCount("2-3", 0), 4);
  assert.equal(F.memoryCount("4-5", 0), 6);
  assert.equal(F.memoryCount("4-5", 1), 8);
  assert.equal(F.memoryCount("6+", 0), 12);
});

test("makeDeck: every face exactly twice, and isPair matches only real pairs", () => {
  const syms = NS.content.focus.memory;
  assert.ok(syms.length >= 6 && new Set(syms).size === syms.length);
  for (let seed = 1; seed < 100; seed++) {
    for (const n of [4, 6, 8, 12]) {
      const deck = plain(F.makeDeck(syms, n, seeded(seed)));
      assert.equal(deck.length, n);
      const counts = {};
      deck.forEach((c) => { counts[c.sym] = (counts[c.sym] || 0) + 1; });
      assert.ok(Object.values(counts).every((c) => c === 2));
      assert.equal(Object.keys(counts).length, n / 2);
      for (let i = 0; i < n; i++) {
        assert.equal(F.isPair(deck, i, i), false, "a card is not its own pair");
        for (let j = i + 1; j < n; j++) assert.equal(F.isPair(deck, i, j), deck[i].sym === deck[j].sym);
      }
    }
  }
});

test("oddRound has exactly one odd card, at a random place", () => {
  const sets = NS.content.focus.odd;
  const seen = new Set();
  for (let seed = 1; seed < 60; seed++) {
    for (const set of sets) {
      for (const size of [3, 4]) {
        const r = plain(F.oddRound(set, size, seeded(seed)));
        assert.equal(r.cards.length, size);
        assert.equal(r.cards[r.oddIndex], set.odd);
        assert.equal(r.cards.filter((c) => c === set.odd).length, 1);
        seen.add(r.oddIndex);
      }
    }
  }
  assert.equal(seen.size, 4);
  for (const lvl of [1, 2, 3]) assert.ok(sets.filter((s) => s.level === lvl).length >= 5, "level " + lvl + " has enough rounds");
  assert.deepEqual(plain(F.oddLevels("2-3")), [1]);
  assert.equal(F.breathCount("2-3"), 3);
  assert.equal(F.breathCount("6+"), 5);
});

/* ---------------- stories & careers content ---------------- */
test("stories: 8–12 stories, 6–10 pages, valid questions and a mission each", () => {
  const S = NS.content.stories;
  assert.ok(S.length >= 8 && S.length <= 12, "count " + S.length);
  assert.equal(new Set(S.map((s) => s.id)).size, S.length);
  for (const s of S) {
    assert.ok(s.pages.length >= 6 && s.pages.length <= 10, s.id + " pages " + s.pages.length);
    assert.match(s.title.hi, DEV);
    for (const p of s.pages) {
      assert.ok(p.scene && p.en, s.id + " page");
      assert.match(p.hi, DEV, s.id + " page hi");
    }
    assert.ok(s.questions.length >= 1 && s.questions.length <= 2);
    for (const q of s.questions) {
      assert.ok(q.choices.length >= 2 && q.choices.length <= 3);
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length, s.id + " answer index");
      q.choices.forEach((c) => assert.ok(c.emoji && c.hi && c.en));
    }
    assert.ok(s.mission.emoji && s.mission.en);
    assert.match(s.mission.hi, DEV);
  }
  assert.equal(NS.grow.stories.questionCount("2-3", 2), 1);
  assert.equal(NS.grow.stories.questionCount("6+", 2), 2);
});

test("careers: 12–16 jobs, each with two characters, what they do, pretend play and a habit link", () => {
  const C = NS.content.careers;
  assert.ok(C.length >= 12 && C.length <= 16, "count " + C.length);
  assert.equal(new Set(C.map((c) => c.id)).size, C.length);
  for (const c of C) {
    assert.equal(c.people.length, 2, c.id);
    for (const k of ["title", "does", "act", "link"]) { assert.match(c[k].hi, DEV, c.id + " " + k); assert.ok(c[k].en); }
    assert.ok(c.act.emoji);
  }
  const rec = plain(NS.grow.dreams.dreamRecord(C[0], "2026-10-02"));
  assert.deepEqual(rec, { id: C[0].id, title: { hi: C[0].title.hi, en: C[0].title.en }, icon: C[0].icon, at: "2026-10-02" });
});

test("no module writes HTML or touches storage directly", () => {
  for (const m of MODULES) {
    const src = readFileSync(fileURLToPath(new URL("modules/" + m + ".js", WEB)), "utf8");
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|localStorage|sessionStorage|fetch\(|XMLHttpRequest/, m);
  }
});
