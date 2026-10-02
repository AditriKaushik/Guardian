// Tests for the "कल की दुनिया" activities: web/js/modules/{robo,future,magic}.js and their content
// (web/js/content/{robo,future}.js). Run: node --test "tools/test/**/*.test.mjs"
// The files are classic browser scripts; they are loaded with node:vm against a tiny fake NS that
// follows docs/ARCHITECTURE.md. Only pure logic and data are tested here (the screens are covered by
// the Playwright runs described in the report).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const WEB = new URL("../../web/js/", import.meta.url);
const read = (rel) => readFileSync(fileURLToPath(new URL(rel, WEB)), "utf8");
const FILES = ["content/robo.js", "content/future.js", "modules/robo.js", "modules/future.js", "modules/magic.js"];
const DEV = /[ऀ-ॿ]/;
const plain = (o) => JSON.parse(JSON.stringify(o));

function load() {
  const registered = {};
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.NS = { content: {}, registerActivity(def) { registered[def.id] = def; }, on() { return () => {}; }, emit() {} };
  vm.createContext(sandbox);
  for (const f of FILES) vm.runInContext(read(f), sandbox, { filename: f });
  return { NS: sandbox.NS, registered };
}
const { NS, registered } = load();
const RC = NS.content.robo, FC = NS.content.future;
const R = NS.future.robo, TRIP = NS.future.trip, M = NS.future.magic;
const BANDS = ["2-3", "4-5", "6+"];

/* ---------------- registration ---------------- */
test("robo, future and magic register in the future section with the documented contract", () => {
  for (const id of ["robo", "future", "magic"]) {
    const a = registered[id];
    assert.ok(a, id + " registered");
    assert.equal(a.id, id);
    assert.equal(a.section, "future");
    assert.equal(typeof a.open, "function");
    assert.ok(a.title.hi && a.title.en && DEV.test(a.title.hi) && !DEV.test(a.title.en));
    assert.ok(a.icon && /^#[0-9A-Fa-f]{6}$/.test(a.color));
    assert.equal(a.free, false);
  }
  assert.deepEqual([registered.robo.order, registered.magic.order, registered.future.order], [10, 20, 30]);
});

/* ---------------- robot learning model ---------------- */
test("train counts features per basket; predict picks the basket whose examples share the most", () => {
  const m = R.train([{ f: ["red", "round"], label: "a" }, { f: ["red", "long"], label: "a" }, { f: ["green"], label: "b" }]);
  assert.deepEqual(plain(m), { a: { n: 2, c: { red: 2, round: 1, long: 1 } }, b: { n: 1, c: { green: 1 } } });
  const p = R.predict(m, ["red", "round"], ["a", "b"]);
  assert.equal(p.label, "a");
  assert.equal(p.scores.a, 1.5);
  assert.equal(p.sure, true);
  assert.equal(R.predict(m, ["green"], ["a", "b"]).label, "b");
});

test("predict says 'not sure' (null) when nothing is learned or the baskets tie", () => {
  assert.equal(R.predict(R.train([]), ["red"], ["a", "b"]).label, null);
  const m = R.train([{ f: ["x"], label: "a" }, { f: ["y"], label: "b" }]);
  assert.equal(R.predict(m, ["x", "y"], ["a", "b"]).label, null);
  assert.equal(R.predict(m, ["z"], ["a", "b"]).label, null);
  assert.equal(R.train([null, { f: "bad", label: "a" }, { label: "a" }]).a, undefined, "junk examples are ignored");
});

test("explain names the feature that pushed the guess (and it can be the wrong thing to look at)", () => {
  const m = R.train([{ f: ["red", "food", "round"], label: "red" }, { f: ["green", "animal", "small"], label: "green" }]);
  const p = R.predict(m, ["green", "food", "round"], ["red", "green"]);
  assert.equal(p.label, "red", "with two examples the robot calls a green apple red");
  assert.ok(["food", "round"].includes(R.explain(m, ["green", "food", "round"], "red", ["red", "green"])));
  assert.equal(R.explain(m, ["purple"], "red", ["red", "green"]), null);
});

/* Plays a teach set exactly like the game: examples are sorted first, then each test picture is
   guessed and — once checked by the child — joins the examples straight away. */
function play(set, band) {
  const by = Object.fromEntries(set.items.map((i) => [i.id, i]));
  const labels = set.baskets.map((b) => b.id);
  const ex = [];
  return R.teachPlan(set, band).map((r) => {
    r.teach.forEach((id) => ex.push({ f: by[id].f, label: by[id].is }));
    return r.test.map((id) => {
      const p = R.predict(R.train(ex), by[id].f, labels);
      ex.push({ f: by[id].f, label: by[id].is });
      return p.label === null ? "unsure" : p.label === by[id].is ? "ok" : "wrong";
    });
  });
}

test("every teach set: few examples → a mistake (or 'not sure'); more examples → every guess right", () => {
  for (const set of RC.teach) {
    for (const band of BANDS) {
      const rounds = play(set, band);
      assert.equal(rounds.length, 2, set.id);
      assert.ok(rounds[0].some((x) => x !== "ok"), `${set.id} ${band}: round 1 should include a mistake: ${rounds[0]}`);
      assert.ok(rounds[1].every((x) => x === "ok"), `${set.id} ${band}: round 2 should be all right: ${rounds[1]}`);
      const right = (r) => r.filter((x) => x === "ok").length / r.length;
      assert.ok(right(rounds[1]) > right(rounds[0]), set.id + " gets better");
    }
  }
  assert.ok(RC.teach.some((s) => play(s, "6+")[0].includes("unsure")), "at least one set shows the robot unsure");
  assert.ok(RC.teach.some((s) => play(s, "6+")[0].includes("wrong")), "at least one set shows the robot wrong");
});

test("teach sets are well formed: baskets, items, features, 6–8 pictures taught", () => {
  const ids = new Set();
  for (const set of RC.teach) {
    assert.ok(!ids.has(set.id)); ids.add(set.id);
    assert.ok(BANDS.includes(set.level));
    assert.equal(set.baskets.length, 2);
    for (const b of set.baskets) assert.ok(b.hi && b.en && DEV.test(b.hi) && /^#[0-9A-F]{6}$/i.test(b.color));
    const items = new Set(set.items.map((i) => i.id));
    assert.equal(items.size, set.items.length, set.id + " item ids unique");
    for (const it of set.items) {
      assert.ok(set.baskets.some((b) => b.id === it.is), it.id);
      assert.ok(it.hi && it.en && DEV.test(it.hi) && !DEV.test(it.en), it.id);
      for (const f of it.f) assert.ok(RC.features[f], `${set.id}/${it.id}: unknown feature ${f}`);
    }
    for (const band of BANDS) {
      const plan = R.teachPlan(set, band);
      const used = plan.flatMap((r) => r.teach.concat(r.test));
      assert.equal(new Set(used).size, used.length, set.id + " a picture appears once");
      for (const id of used) assert.ok(items.has(id), `${set.id}: unknown item ${id}`);
      const first = plan[0].teach.map((id) => set.items.find((i) => i.id === id).is);
      assert.ok(set.baskets.every((b) => first.includes(b.id)), set.id + ": both baskets get an example first");
      const sorted = plan.reduce((n, r) => n + r.teach.length, 0);
      const all = plan.reduce((n, r) => n + r.teach.length + r.test.length, 0);
      assert.ok(sorted >= 4 && sorted <= 8, `${set.id} ${band}: the child sorts ${sorted} pictures`);
      assert.ok(all >= 8 && all <= 12, `${set.id} ${band}: ${all} pictures in all`);
    }
  }
  for (const f of Object.values(RC.features)) assert.ok(f.hi && f.en && f.why && DEV.test(f.why.hi) && !DEV.test(f.why.en));
  assert.equal(R.teachSetFor(RC.teach, "2-3").id, "colour");
  assert.equal(R.teachSetFor(RC.teach, "4-5").id, "fruitveg");
  assert.equal(R.teachSetFor(RC.teach, "6+").id, "waterland");
});

test("उल्टा-पुल्टा: taught backwards, the robot learns exactly that (mixed-up examples → wrong guesses)", () => {
  for (const set of RC.teach) {
    assert.ok(set.mix, set.id);
    const labels = set.baskets.map((b) => b.id);
    const other = (l) => labels.find((x) => x !== l);
    const by = Object.fromEntries(set.items.map((i) => [i.id, i]));
    const teach = set.mix.teach.map((id) => by[id]);
    assert.ok(teach.every(Boolean) && set.mix.test.every((id) => by[id]), set.id);
    for (const b of labels) assert.ok(teach.some((i) => i.is === b), set.id + " both baskets taught");
    const m = R.train(teach.map((i) => ({ f: i.f, label: other(i.is) })));
    for (const id of set.mix.test) {
      const p = R.predict(m, by[id].f, labels);
      assert.equal(p.label, other(by[id].is), `${set.id}/${id}: the robot repeats the backwards lesson`);
      assert.equal(p.sure, true);
    }
    assert.ok(labels.every((b) => set.mix.test.some((id) => by[id].is === b)), set.id + " one test per basket");
  }
});

/* ---------------- the grid: programs, walls, edges, loops ---------------- */
const LV = { start: [0, 2, 1], goal: [2, 0], walls: [[1, 1]] };
test("runProgram moves square by square (abs) and stops at walls, edges, the goal or when cards run out", () => {
  let r = R.runProgram(LV, 3, "abs", [{ c: "right", n: 1 }, { c: "right", n: 1 }, { c: "up", n: 2 }]);
  assert.equal(r.result, "goal");
  assert.deepEqual(plain(r.steps.map((s) => [s.x, s.y, s.i])), [[1, 2, 0], [2, 2, 1], [2, 1, 2], [2, 0, 2]]);
  r = R.runProgram(LV, 3, "abs", [{ c: "right", n: 1 }, { c: "up", n: 1 }]);
  assert.equal(r.result, "bump");
  assert.equal(r.at, 1);
  assert.deepEqual([r.steps.at(-1).tx, r.steps.at(-1).ty], [1, 1]);
  r = R.runProgram(LV, 3, "abs", [{ c: "down", n: 1 }]);
  assert.equal(r.result, "edge");
  assert.equal(r.at, 0);
  r = R.runProgram(LV, 3, "abs", [{ c: "right", n: 1 }]);
  assert.equal(r.result, "short");
  assert.deepEqual([r.x, r.y], [1, 2]);
  r = R.runProgram(LV, 3, "abs", [{ c: "right", n: 2 }, { c: "up", n: 3 }]);
  assert.equal(r.result, "goal", "stops at the goal even with cards left");
  assert.equal(R.runProgram(LV, 3, "abs", [{ c: "fwd", n: 1 }]).result, "bad");
});

test("runProgram in rel mode: forward goes the way the robot faces; turns only turn", () => {
  const lv = { start: [0, 2, 0], goal: [2, 0], walls: [] };
  let r = R.runProgram(lv, 3, "rel", [{ c: "fwd", n: 2 }, { c: "tr", n: 1 }, { c: "fwd", n: 2 }]);
  assert.equal(r.result, "goal");
  assert.deepEqual(plain(r.steps.map((s) => s.ev)), ["move", "move", "turn", "move", "move"]);
  assert.equal(r.steps[2].h, 1);
  r = R.runProgram(lv, 3, "rel", [{ c: "tl", n: 1 }, { c: "fwd", n: 1 }]);
  assert.equal(r.result, "edge");
  r = R.runProgram(lv, 3, "rel", [{ c: "tr", n: 2 }]);
  assert.equal(r.result, "short");
  assert.equal(r.h, 2);
  assert.equal(R.runProgram(lv, 3, "rel", [{ c: "up", n: 1 }]).result, "bad");
});

test("validateProgram checks cards for the mode, the card limit and repeats (loops only for 6+)", () => {
  assert.deepEqual(plain(R.validateProgram([], "abs")), { ok: false, why: "empty" });
  assert.equal(R.validateProgram([{ c: "up" }], "abs").ok, true);
  assert.equal(R.validateProgram([{ c: "up", n: 1 }, { c: "up", n: 1 }], "abs", { max: 1 }).why, "long");
  assert.equal(R.validateProgram([{ c: "fwd", n: 1 }], "abs").why, "card");
  assert.equal(R.validateProgram([{ c: "up", n: 1 }], "rel").why, "card");
  assert.equal(R.validateProgram([{ c: "fwd", n: 2 }], "rel").why, "repeat");
  assert.equal(R.validateProgram([{ c: "fwd", n: 2 }], "rel", { loops: true }).ok, true);
  assert.equal(R.validateProgram([{ c: "fwd", n: 4 }], "rel", { loops: true }).why, "repeat");
  assert.equal(R.validateProgram(null, "abs").ok, false);
});

test("every grid level is valid and solvable within its card limit (with repeats for 6+)", () => {
  assert.deepEqual(plain(Object.keys(RC.paths).sort()), BANDS.slice().sort());
  assert.deepEqual(BANDS.map((b) => RC.paths[b].size), [3, 4, 5]);
  assert.equal(RC.paths["6+"].mode, "rel");
  assert.equal(RC.paths["6+"].loops, true);
  for (const band of BANDS) {
    const cfg = RC.paths[band];
    assert.ok(cfg.levels.length >= 5);
    for (const [i, lv] of cfg.levels.entries()) {
      const where = `${band} level ${i + 1}`;
      const inside = (p) => p[0] >= 0 && p[1] >= 0 && p[0] < cfg.size && p[1] < cfg.size;
      assert.ok(inside(lv.start) && inside(lv.goal), where);
      assert.ok([0, 1, 2, 3].includes(lv.start[2]), where);
      assert.ok(!(lv.start[0] === lv.goal[0] && lv.start[1] === lv.goal[1]), where);
      for (const wl of lv.walls || []) {
        assert.ok(inside(wl), where);
        assert.ok(!(wl[0] === lv.goal[0] && wl[1] === lv.goal[1]) && !(wl[0] === lv.start[0] && wl[1] === lv.start[1]), where);
      }
      assert.ok(RC.prizes[lv.prize], where + " prize has a name");
      const sol = R.solve(lv, cfg.size, cfg.mode);
      assert.ok(sol && sol.length, where + " solvable");
      const prog = R.compress(sol, cfg.loops);
      assert.ok(prog.length <= cfg.max, `${where}: ${prog.length} cards > ${cfg.max}`);
      assert.equal(R.validateProgram(prog, cfg.mode, { max: cfg.max, loops: cfg.loops }).ok, true, where);
      assert.equal(R.runProgram(lv, cfg.size, cfg.mode, prog).result, "goal", where);
    }
  }
  const sixPlus = RC.paths["6+"];
  assert.ok(sixPlus.levels.some((lv) => R.compress(R.solve(lv, 5, "rel"), true).some((p) => p.n > 1)), "a 6+ level is shorter with a repeat");
  assert.ok(RC.paths["4-5"].levels.some((lv) => (lv.walls || []).length) && sixPlus.levels.some((lv) => (lv.walls || []).length));
});

test("compress merges repeats only when loops are on, never more than 3", () => {
  assert.deepEqual(plain(R.compress(["fwd", "fwd", "fwd", "fwd", "tl"], true)), [{ c: "fwd", n: 3 }, { c: "fwd", n: 1 }, { c: "tl", n: 1 }]);
  assert.deepEqual(plain(R.compress(["up", "up"], false)), [{ c: "up", n: 1 }, { c: "up", n: 1 }]);
});

test("hint: points at the card that bumps, or suggests the next card; following hints always arrives", () => {
  assert.deepEqual(plain(R.hint(LV, 3, "abs", [{ c: "right", n: 1 }, { c: "up", n: 1 }])), { fix: 1 });
  assert.deepEqual(plain(R.hint(LV, 3, "abs", [{ c: "down", n: 1 }])), { fix: 0 });
  assert.ok(["right", "up"].includes(R.hint(LV, 3, "abs", []).add));
  assert.equal(R.hint(LV, 3, "abs", [{ c: "right", n: 2 }, { c: "up", n: 2 }]), null);
  for (const band of BANDS) {
    const cfg = RC.paths[band];
    for (const lv of cfg.levels) {
      const prog = [];
      for (let k = 0; k < 40; k++) {
        const h = R.hint(lv, cfg.size, cfg.mode, prog);
        if (!h) break;
        if (h.fix != null) prog.splice(h.fix);
        else prog.push({ c: h.add, n: 1 });
      }
      assert.equal(R.runProgram(lv, cfg.size, cfg.mode, prog).result, "goal");
    }
  }
});

/* ---------------- "रोबो से पूछो" ---------------- */
test("ask rounds: by age band, one clear request, the thing asked for is on the shelf", () => {
  const n = BANDS.map((b) => R.askRounds(RC.ask, b).length);
  assert.ok(n[0] >= 4 && n[0] < n[1] && n[1] <= n[2], JSON.stringify(n));
  assert.ok(R.askRounds(RC.ask, "2-3").every((r) => r.level === "2-3"));
  const types = new Set(RC.ask.map((r) => r.type));
  for (const t of ["ask", "draw", "check", "who", "robot"]) assert.ok(types.has(t), t);
  for (const r of RC.ask) {
    assert.ok(r.intro && DEV.test(r.intro.hi) && !DEV.test(r.intro.en), r.type);
    if (r.type === "ask") {
      assert.equal(r.options.filter((o) => o.clear).length, 1);
      for (const o of r.options) assert.ok(r.shelf.includes(o.gets));
      assert.equal(r.options.find((o) => o.clear).gets, r.need.e);
    }
    if (r.type === "draw") assert.equal(r.options.filter((o) => o.clear).length, 1);
    if (r.type === "who" || r.type === "robot") { assert.equal(r.options.filter((o) => o.right).length, 1); assert.ok(r.answer.hi && r.answer.en); }
    if (r.type === "check") { assert.ok(r.right.hi && r.wrong.hi && r.claim); assert.notEqual([...r.show].filter((c) => /\p{Extended_Pictographic}/u.test(c)).length, Number(r.claim)); }
  }
  const who = RC.ask.filter((r) => r.type === "who");
  assert.ok(who.every((r) => r.options.find((o) => o.right).pic !== "🤖"), "feelings and hurts go to grown-ups, not the robot");
});

/* ---------------- भविष्य की सैर ---------------- */
const PROPS = ["panel", "battery", "charger", "drone", "printer", "bin", "lander", "rover", "moon"];
test("nine journeys on the topics asked for, 6–8 pages each (shorter for 2–3), a quiz and a mission", () => {
  const ids = plain(FC.journeys.map((j) => j.id));
  assert.deepEqual(ids, ["solar", "ev", "drone", "space", "helpers", "talk", "green", "printer", "safe"]);
  for (const j of FC.journeys) {
    assert.ok(j.title.hi && j.title.en && j.icon && j.sticker && /^#[0-9A-F]{6}$/i.test(j.color), j.id);
    const full = TRIP.pagesFor(j, "6+").length;
    assert.ok(full >= 6 && full <= 8, `${j.id}: ${full} pages`);
    assert.equal(TRIP.pagesFor(j, "4-5").length, full);
    const small = TRIP.pagesFor(j, "2-3").length;
    assert.ok(small >= 5 && small <= full, `${j.id}: ${small} pages for 2–3`);
    assert.ok(j.pages.filter((p) => p.act).length >= 2, j.id + " has interactions");
    assert.ok(j.quiz.length >= 1 && j.quiz.length <= 2, j.id);
    for (const q of j.quiz) { assert.ok(q.options.length >= 2 && Number.isInteger(q.answer) && q.options[q.answer], j.id); assert.ok(q.why && q.why.hi); }
    assert.ok(j.mission.e && DEV.test(j.mission.hi) && j.mission.en, j.id);
  }
});

test("journey pages: scenes, props and interactions all point at things that exist", () => {
  for (const j of FC.journeys) {
    for (const [i, p] of j.pages.entries()) {
      const where = `${j.id} page ${i + 1}`;
      assert.ok(p.text && DEV.test(p.text.hi) && !DEV.test(p.text.en), where);
      assert.ok(Array.isArray(p.scene) && p.scene.length, where);
      const ids = new Set();
      for (const d of p.scene) {
        assert.ok((d.e && !d.p) || (d.p && !d.e), where + " emoji or prop");
        if (d.p) assert.ok(PROPS.includes(d.p), `${where}: unknown prop ${d.p}`);
        assert.ok(d.x >= 0 && d.x <= 100 && d.y >= 0 && d.y <= 100 && d.s >= 4 && d.s <= 90, `${where}: ${d.e || d.p} position`);
        if (d.id) { assert.ok(!ids.has(d.id), where); ids.add(d.id); }
        if (d.name) assert.ok(DEV.test(d.name.hi) && !DEV.test(d.name.en), where);
      }
      const a = p.act;
      if (!a) continue;
      assert.ok(a.prompt && a.done && DEV.test(a.prompt.hi) && DEV.test(a.done.hi), where);
      if (a.type === "tap") {
        assert.ok(ids.has(a.target), `${where}: tap target ${a.target}`);
        assert.ok(a.times >= 1 && a.times <= 4);
        assert.equal((a.steps || []).length, a.times, where + " one step per tap");
        for (const ch of (a.steps || []).flat().concat(a.after || [])) assert.ok(ids.has(ch.id), `${where}: change for ${ch.id}`);
      } else if (a.type === "choose") {
        assert.ok(a.options.length >= 2 && (a.answer === "any" || a.options[a.answer]), where);
        if (a.answer !== "any") assert.ok(a.wrong, where + " a gentle word for a wrong pick");
      } else if (a.type === "sort") {
        const bins = new Set(a.bins.map((b) => b.id));
        assert.equal(bins.size, 2);
        assert.ok(a.items.length >= 3 && a.items.every((it) => bins.has(it.bin)), where);
        assert.ok(a.bins.every((b) => a.items.some((it) => it.bin === b.id)), where);
      } else assert.fail(`${where}: unknown act ${a.type}`);
    }
  }
});

test("trip helpers: answers (incl. open questions), sorting, the next suggestion, finished list", () => {
  assert.equal(TRIP.isRight({ answer: 1, options: [{}, {}] }, 1), true);
  assert.equal(TRIP.isRight({ answer: 1, options: [{}, {}] }, 0), false);
  assert.equal(TRIP.isRight({ answer: "any", options: [{}, {}, {}] }, 2), true);
  assert.equal(TRIP.isRight({ answer: "any", options: [{}, {}] }, 5), false);
  assert.equal(TRIP.sortRight({ bin: "wet" }, "wet"), true);
  assert.equal(TRIP.sortRight({ bin: "wet" }, "dry"), false);
  assert.equal(TRIP.suggest(FC.journeys, []), "solar");
  assert.equal(TRIP.suggest(FC.journeys, ["solar", "ev"]), "drone");
  assert.equal(TRIP.suggest(FC.journeys, FC.journeys.map((j) => j.id)), "solar");
  assert.deepEqual(plain(TRIP.markDone(["solar"], "solar")), ["solar"]);
  assert.deepEqual(plain(TRIP.markDone(null, "ev")), ["ev"]);
  assert.deepEqual(plain(TRIP.markDone(["a", 3, null], "b")), ["a", "b"]);
});

test("the owner's key ideas are in the words children hear", () => {
  const all = JSON.stringify(FC.journeys);
  assert.ok(all.includes("कंप्यूटर बहुत सी बातें पढ़कर सीखता है, पर वह भी गलती कर सकता है"));
  const safe = JSON.stringify(FC.journeys.find((j) => j.id === "safe"));
  assert.ok(safe.includes("1098") && safe.includes("112"), "help numbers 1098 or 112");
  assert.ok(/पता/.test(safe) && /बड़ों/.test(safe), "never share the address; ask a grown-up");
  const space = JSON.stringify(FC.journeys.find((j) => j.id === "space"));
  assert.ok(space.includes("चंद्रयान") && space.includes("प्रज्ञान"));
});

/* ---------------- जादुई खिड़की ---------------- */
test("panFromTilt: the starting pose looks straight ahead; tilting and turning look around (clamped)", () => {
  const base = { alpha: 100, beta: 80, gamma: 0 };
  assert.deepEqual(plain(M.panFromTilt(base, base, 0)), { x: 0, y: 0 });
  assert.equal(M.panFromTilt({ beta: null, gamma: 1 }, base, 0), null);
  assert.equal(M.panFromTilt(null, base, 0), null);
  assert.ok(M.panFromTilt({ alpha: 100, beta: 80, gamma: 14 }, base, 0).x > 0.4, "tilt right → look right");
  assert.ok(M.panFromTilt({ alpha: 100, beta: 95, gamma: 0 }, base, 0).y < -0.4, "tilt back → look up");
  assert.ok(M.panFromTilt({ alpha: 80, beta: 80, gamma: 0 }, base, 0).x > 0.3, "turn right (alpha falls) → look right");
  assert.deepEqual(plain(M.panFromTilt({ alpha: 100, beta: 80, gamma: 89 }, base, 0)), { x: 1, y: 0 });
  assert.equal(M.angDiff(350, 10), 20);
  assert.equal(M.angDiff(10, 350), -20);
  const wrap = M.panFromTilt({ alpha: 350, beta: 80, gamma: 0 }, { alpha: 10, beta: 80, gamma: 0 }, 0);
  assert.ok(wrap.x > 0.4 && wrap.x < 0.5, "turning across north is a small turn, not a huge one");
  assert.ok(M.panFromTilt({ alpha: 100, beta: 66, gamma: 0 }, base, 90).x > 0.4, "landscape uses beta for left/right");
});

test("parallax: far layers barely move, near layers slide across; animals peek only in the middle", () => {
  const far = M.layerShift(1, 0, 400), near = M.layerShift(1, 1, 400);
  assert.deepEqual([far.width, far.x], [400, 0]);
  assert.deepEqual([near.width, near.x], [1200, -800]);
  assert.equal(M.layerShift(-1, 1, 400).x === 0, true);
  assert.equal(M.layerShift(5, 1, 400).x, -800, "clamped");
  assert.equal(M.screenX(50, 1, 0, 400), 200);
  assert.equal(M.inView(200, 400), true);
  assert.equal(M.inView(20, 400), false);
  assert.equal(M.inView(390, 400), false);
});

test("magic window scenes: animals by age, the camera only for 4+, a real grown-up question", () => {
  assert.deepEqual(plain(FC.windows.map((w) => w.id)), ["jungle", "sea", "space", "garden"]);
  for (const w of FC.windows) {
    assert.ok(w.title.hi && w.end && DEV.test(w.end.hi) && !DEV.test(w.end.en), w.id);
    assert.ok(w.animals.length >= 4, w.id);
    for (const a of w.animals) {
      assert.ok(DEV.test(a.hi) && !DEV.test(a.en) && a.fact && DEV.test(a.fact.hi), w.id + " " + a.e);
      assert.ok(a.x >= 0 && a.x <= 100 && a.y >= 0 && a.y <= 100 && a.d >= 0 && a.d <= 1 && a.cover, w.id);
    }
    for (const ly of w.layers) for (const it of ly.items) assert.ok(it.x >= 0 && it.x <= 100 && it.y >= 0 && it.y <= 100, w.id);
    for (const a of w.animals) {
      let reach = false;
      for (let pan = -1; pan <= 1.0001; pan += 0.02) if (M.inView(M.screenX(a.x, a.d, pan, 400), 400)) reach = true;
      assert.ok(reach, `${w.id}: ${a.en} can be looked at (peeks out) somewhere in the panorama`);
    }
    assert.equal(M.animalsFor(w, "2-3").length, 3);
    assert.equal(M.animalsFor(w, "4-5").length, 4);
    assert.equal(M.animalsFor(w, "6+").length, w.animals.length);
  }
  assert.deepEqual(BANDS.map(M.cameraAllowed), [false, true, true]);
  assert.equal(M.CAMERA_MS, 5 * 60 * 1000);
  let seed = 1; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 50; i++) {
    const q = M.gateQuestion(rand);
    assert.ok(q.a >= 6 && q.a <= 9 && q.b >= 6 && q.b <= 9 && q.answer === q.a * q.b);
  }
  const q = { a: 7, b: 8, answer: 56 };
  assert.equal(M.gateCheck(q, "56"), true);
  assert.equal(M.gateCheck(q, " ५६ "), true, "Devanagari digits");
  for (const bad of ["", "5 6", "abc", "57", null, "56.0"]) assert.equal(M.gateCheck(q, bad), false, String(bad));
});

test("camera code: video only from the rear camera, shown in place, stopped on exit / when hidden", () => {
  const src = read("modules/magic.js");
  const calls = src.match(/getUserMedia\(([^)]*\))/g) || [];
  assert.equal(calls.length, 1);
  assert.match(calls[0], /getUserMedia\(\{ video: \{ facingMode: "environment" \} \}\)/);
  assert.ok(!/audio\s*:/.test(src), "never asks for audio");
  assert.ok(src.includes(".srcObject = ") && src.includes("playsinline") && src.includes("video.muted = true"));
  assert.ok(src.includes("getTracks().forEach((t) => t.stop())"));
  assert.match(src, /visibilitychange[\s\S]{0,80}stopCamera\(\)/);
  assert.match(src, /function reset\(\)[\s\S]{0,400}stopCamera\(\)/, "every screen change (and exit) stops the camera");
  assert.ok(/cameraAllowed\(age\(\)\)/.test(src), "the camera tile is age-gated");
  assert.ok(src.indexOf("gateCheck(q, input.value)") < src.indexOf("function startCamera") , "the grown-up question comes before the camera");
});

/* ---------------- rules for every module ---------------- */
test("no innerHTML, no network, no direct storage, no vibrate API, no timers shown to children", () => {
  for (const f of FILES) {
    const src = read(f);
    for (const bad of ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "localStorage", "sessionStorage", "fetch(", "XMLHttpRequest", "WebSocket", "navigator.vibrate", "eval(", "new Function"]) {
      assert.ok(!src.includes(bad), `${f} uses ${bad}`);
    }
  }
});

test("spoken fixed lines are listed for the recording script (NS.voiceLines), in the right script", () => {
  const lines = NS.voiceLines || [];
  for (const sec of ["robo", "future", "magic"]) assert.ok(lines.filter((l) => l.section === sec).length >= 10, sec);
  for (const l of lines) {
    assert.ok(l.lang === "hi" || l.lang === "en");
    assert.ok(l.text && !/\{[^}]*\}/.test(l.text), l.text);
    assert.equal(DEV.test(l.text), l.lang === "hi", `${l.lang}: ${l.text}`);
  }
});

test("content uses no emoji too new for older phones (Unicode 13+)", () => {
  const NEW = ["🫧", "🪸", "🪨", "🪴", "🪣", "🪟", "🩶", "🫑", "🛞", "🪫", "🪄", "🦭", "🫛", "🪷", "🫎"];
  for (const f of FILES) {
    const src = read(f);
    for (const e of NEW) assert.ok(!src.includes(e), `${f} uses ${e}`);
  }
});

test("every hi/en pair in the content is in the right script", () => {
  const walk = (o, path) => {
    if (!o || typeof o !== "object") return;
    if (typeof o.hi === "string" && typeof o.en === "string") {
      assert.ok(DEV.test(o.hi), `${path}: hi "${o.hi}"`);
      assert.ok(!DEV.test(o.en), `${path}: en "${o.en}"`);
      if (typeof o.hinglish === "string") assert.ok(!DEV.test(o.hinglish), path);
    }
    for (const k of Object.keys(o)) walk(o[k], path + "." + k);
  };
  walk(RC, "robo");
  walk(FC, "future");
});
