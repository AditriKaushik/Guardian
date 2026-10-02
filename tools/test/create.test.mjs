// Tests for the creative activities: web/js/modules/{trace,draw,music,puzzle}.js.
// Run: node --test tools/test/            (the browser checks also need PW_PATH, see the end)
// The files are classic browser scripts; they are loaded here with node:vm as the page loads them,
// against a tiny fake NS that follows docs/ARCHITECTURE.md. Their pure logic is NS.create.*.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const WEB = fileURLToPath(new URL("../../web/", import.meta.url));
const MODULES = ["trace", "draw", "music", "puzzle"];
const DEV = /[ऀ-ॿ]/;

function load({ lessons = true } = {}) {
  const registered = {};
  const sandbox = { console, Math, Date };
  sandbox.window = sandbox;
  sandbox.NS = {
    content: {},
    registerActivity(def) { registered[def.id] = def; },
    on() { return () => {}; },
    emit() {},
    now: () => new Date(2026, 9, 2, 10, 0).getTime(),
  };
  vm.createContext(sandbox);
  const run = rel => vm.runInContext(readFileSync(path.join(WEB, rel), "utf8"), sandbox, { filename: rel });
  if (lessons) run("js/content/lessons.js");
  for (const m of MODULES) run("js/modules/" + m + ".js");
  return { NS: sandbox.NS, registered };
}
/* deterministic pseudo-random numbers */
function seeded(seed) {
  let s = (seed * 2654435761) % 2147483647 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

const { NS, registered } = load();
const TR = NS.create.trace, DR = NS.create.draw, MU = NS.create.music, PZ = NS.create.puzzle;

/* ---------------- registration ---------------- */
test("the four activities register with the documented contract", () => {
  const want = { trace: "learn", draw: "play", music: "play", puzzle: "play" };
  for (const id of MODULES) {
    const a = registered[id];
    assert.ok(a, id + " registered");
    assert.match(a.id, /^[a-z][a-z0-9]*$/);
    assert.equal(a.section, want[id]);
    assert.equal(a.free, false);
    assert.equal(typeof a.open, "function");
    assert.match(a.title.hi, DEV);
    assert.ok(a.title.en && a.icon && /^#[0-9A-F]{6}$/i.test(a.color) && typeof a.order === "number");
  }
});

test("modules touch no DOM, storage or network at load time", () => {
  for (const m of MODULES) {
    const src = readFileSync(path.join(WEB, "js/modules", m + ".js"), "utf8");
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, m + ": text only");
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/, m + ": storage only via ctx.data");
    assert.doesNotMatch(src.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ""), /fetch\(|XMLHttpRequest|WebSocket|sendBeacon|https?:\/\//, m + ": no network");
  }
});

/* ---------------- tracing: stroke data ---------------- */
const set = id => TR.SETS.find(s => s.id === id);
const bbox = ps => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ps.forEach(p => p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
  return { x0, y0, x1, y1 };
};

test("stroke data exists for every included character", () => {
  const sw = set("swar").items.map(i => i.ch), vy = set("vyanjan").items.map(i => i.ch);
  assert.ok(sw.length >= 12, "at least 12 स्वर");
  assert.ok(vy.length >= 20, "at least 20 व्यंजन");
  for (const ch of ["अ", "आ", "इ", "ई", "उ", "ऊ", "ए", "ऐ", "ओ", "औ", "अं"]) assert.ok(sw.includes(ch), ch);
  for (const ch of ["क", "ख", "ग", "घ", "च", "ज", "ट", "ड", "त", "द", "न", "प", "ब", "म", "र", "ल", "स", "ह"]) assert.ok(vy.includes(ch), ch);
  assert.deepEqual([...set("abc").items.map(i => i.ch)], "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""));
  assert.deepEqual([...set("num").items.map(i => i.ch)], "0123456789".split(""));
  const all = TR.SETS.flatMap(s => s.items.map(i => i.ch));
  assert.equal(new Set(all).size, all.length, "no character twice");
});

test("every stroke is well-formed and inside the box", () => {
  for (const s of TR.SETS) for (const it of s.items) {
    assert.ok(Array.isArray(it.s) && it.s.length >= 1 && it.s.length <= 8, it.ch + " stroke count");
    it.s.forEach((d, k) => {
      assert.match(d, /^[ME]-?\d/, it.ch + " stroke " + (k + 1) + " starts with a move (M) or an arc (E)");
      assert.match(d, /^(?:[MLQCE]|[\s,]|-?\d*\.?\d+)+$/, it.ch + " stroke " + (k + 1) + " uses only M L Q C E");
    });
    const ps = TR.polys(it);
    assert.equal(ps.length, it.s.length);
    ps.forEach((p, k) => {
      assert.ok(p.length >= 1, it.ch + " stroke " + (k + 1) + " has points");
      const isDot = p.length === 1;
      if (!isDot) assert.ok(TR.pathLen(p) >= 6, it.ch + " stroke " + (k + 1) + " is not a speck");
      p.forEach(([x, y]) => assert.ok(x >= -2 && x <= 102 && y >= -2 && y <= 102 && isFinite(x) && isFinite(y), it.ch + " point in box: " + x + "," + y));
      for (let j = 1; j < p.length; j++) assert.ok(Math.hypot(p[j][0] - p[j - 1][0], p[j][1] - p[j - 1][1]) < 4, it.ch + " smooth sampling");
    });
    const b = bbox(ps);
    assert.ok(b.y1 - b.y0 >= 50, it.ch + " is tall enough (" + (b.y1 - b.y0) + ")");
    assert.ok(b.x1 - b.x0 >= 15 && b.x1 - b.x0 <= 100, it.ch + " sensible width");
    const fr = TR.frame(ps);
    assert.ok(fr.x <= b.x0 && fr.y <= b.y0 && fr.x + fr.size >= b.x1 && fr.y + fr.size >= b.y1, it.ch + " frame holds the letter");
  }
});

test("Devanagari: शिरोरेखा present, drawn left to right after the body; only marks above it come later", () => {
  for (const id of ["swar", "vyanjan"]) for (const it of set(id).items) {
    const ps = TR.polys(it);
    const heads = ps.map((p, k) => (TR.isHead(p) ? k : -1)).filter(k => k >= 0);
    assert.equal(heads.length, 1, it.ch + " has one शिरोरेखा");
    const h = heads[0], hp = ps[h];
    assert.ok(hp[hp.length - 1][0] > hp[0][0], it.ch + " शिरोरेखा left → right");
    const body = bbox(ps.filter((_, k) => k !== h));
    assert.ok(hp[0][0] <= body.x0 + 48 && hp[hp.length - 1][0] >= body.x1 - 4, it.ch + " शिरोरेखा spans the letter's top");
    ps.slice(h + 1).forEach((p, j) => assert.ok(p.every(([, y]) => y <= 22), it.ch + " stroke " + (h + 2 + j) + " after the शिरोरेखा is a mark above it"));
    assert.ok(h >= 1, it.ch + " body comes first");
  }
});

test("Latin capitals and digits start at the top", () => {
  for (const id of ["abc", "num"]) for (const it of set(id).items) {
    const first = TR.polys(it)[0][0];
    assert.ok(first[1] <= 50, it.ch + " first stroke starts in the top half (" + first[1] + ")");
  }
});

test("example word + picture come from the lessons (fallback to the module's own table)", () => {
  const ka = set("vyanjan").items.find(i => i.ch === "क");
  const ex = TR.example(set("vyanjan"), ka);
  const card = NS.content.lessons.deck("varn").cards.find(c => c.big === "क");
  assert.equal(ex.word.hi, card.name.hi);
  assert.equal(ex.pic, card.pic);
  assert.equal(ex.say, "क से " + card.name.hi);
  const A = set("abc").items[0];
  assert.equal(TR.example(set("abc"), A).say, "A for " + NS.content.lessons.deck("abc").cards[0].name.en);
  // ऋ is not on the flashcards: the module's own word is used
  const ri = set("swar").items.find(i => i.ch === "ऋ");
  assert.equal(TR.example(set("swar"), ri).word.hi, ri.word.hi);
  // without lessons at all
  const bare = load({ lessons: false }).NS.create.trace;
  const k2 = bare.SETS.find(s => s.id === "vyanjan").items[0];
  assert.equal(bare.example(bare.SETS.find(s => s.id === "vyanjan"), k2).word.hi, k2.word.hi);
});

/* ---------------- tracing: the scorer ---------------- */
const jitter = (p, amp, rand) => p.map(([x, y]) => [x + (rand() - 0.5) * 2 * amp, y + (rand() - 0.5) * 2 * amp]);
const AGES = ["2-3", "4-5", "6+"];

test("scorer accepts a near path for every stroke, at every age", () => {
  const rand = seeded(7);
  for (const s of TR.SETS) for (const it of s.items) TR.polys(it).forEach((p, k) => {
    const user = jitter(TR.resample(p, Math.max(2, Math.round(TR.pathLen(p) / 3))), 3, rand);
    for (const a of AGES) {
      const r = TR.score(user, p, TR.level(a));
      assert.ok(r.ok, it.ch + " stroke " + (k + 1) + " near path at " + a + ": " + JSON.stringify(r));
    }
  });
});

test("scorer rejects a wrong stroke", () => {
  const rand = seeded(11);
  let checked = 0;
  for (const s of TR.SETS) for (const it of s.items) {
    const ps = TR.polys(it);
    ps.forEach((p, k) => {
      if (TR.pathLen(p) < 20) return;
      /* the same shape moved well away from where it belongs */
      const moved = jitter(p.map(([x, y]) => [x + 40, y + 34]), 2, rand);
      for (const a of AGES) assert.equal(TR.score(moved, p, TR.level(a)).ok, false, it.ch + " stroke " + (k + 1) + " moved at " + a);
      checked++;
    });
  }
  // a scribble in a corner, a line across the bottom
  const k1 = TR.polys(set("vyanjan").items[0])[1];      // क: the खड़ी पाई
  assert.equal(TR.score([[5, 95], [30, 95], [60, 96], [95, 95]], k1, TR.level("2-3")).ok, false);
  assert.equal(TR.score([[0, 0], [4, 3], [2, 6]], k1, TR.level("2-3")).ok, false);
  assert.equal(TR.score([], k1).reason, "empty");
  assert.ok(checked > 150);
});

test("direction matters from 4 years on; 2–3 year olds may go either way", () => {
  const I = TR.polys(set("abc").items.find(i => i.ch === "I"))[0];           // big line down
  const up = I.slice().reverse();
  assert.equal(TR.score(up, I, TR.level("2-3")).ok, true);
  for (const a of ["4-5", "6+"]) {
    const r = TR.score(up, I, TR.level(a));
    assert.equal(r.ok, false);
    assert.equal(r.reason, "reverse");
  }
  const C = TR.polys(set("abc").items.find(i => i.ch === "C"))[0];
  assert.equal(TR.score(C.slice().reverse(), C, TR.level("6+")).reason, "reverse");
});

test("lifting the finger half-way is fine: the stroke can be finished with a second line", () => {
  const p = TR.polys(set("vyanjan").items.find(i => i.ch === "प"))[0];
  const half = p.slice(0, Math.floor(p.length / 2));
  const r1 = TR.score(half, p, TR.level("4-5"));
  assert.equal(r1.ok, false);
  assert.equal(r1.reason, "short");
  assert.equal(r1.partial, true);
  const r2 = TR.score([half, p.slice(Math.floor(p.length / 2) - 1)], p, TR.level("4-5"));
  assert.equal(r2.ok, true);
});

test("stricter for 6+ than for 2–3 year olds", () => {
  const p = TR.polys(set("abc").items.find(i => i.ch === "L"))[0];          // a vertical line x = 30
  const off = p.map(([x, y]) => [x + 12, y]);                                   // 12 units to the side
  assert.equal(TR.score(off, p, TR.level("2-3")).ok, true);
  assert.equal(TR.score(off, p, TR.level("6+")).ok, false);
  const L = AGES.map(a => TR.level(a));
  assert.ok(L[0].tol > L[1].tol && L[1].tol > L[2].tol);
  assert.ok(L[0].cover < L[1].cover && L[1].cover < L[2].cover);
});

test("the अं dot is a tap", () => {
  const am = TR.polys(set("swar").items.find(i => i.ch === "अं"));
  const dot = am[am.length - 1];
  assert.equal(dot.length, 1);
  assert.equal(TR.score([[dot[0][0] + 3, dot[0][1] + 2]], dot, TR.level("6+")).ok, true);
  assert.equal(TR.score([[dot[0][0] + 40, dot[0][1] + 40]], dot, TR.level("2-3")).ok, false);
});

test("geometry helpers", () => {
  const sq = TR.parse("M0 0 L10 0 L10 10", 1);
  assert.equal(TR.pathLen(sq), 20);
  const r = TR.resample(sq, 5);
  assert.equal(r.length, 5);
  assert.deepEqual([...r[2].map(v => Math.round(v * 1000) / 1000)], [10, 0]);
  const circle = TR.parse("E50 50 10 10 0 360", 1);
  assert.ok(Math.abs(TR.pathLen(circle) - 2 * Math.PI * 10) < 0.5);
  assert.equal(TR.parse("garbage").length, 0);
  assert.equal(TR.parse("M10 10 L").length, 1);            // a malformed tail is dropped, never loops
  assert.equal(TR.parse("M10 10 L20").length, 1);
  const mid = TR.pointAt(sq, 0.5);
  assert.deepEqual([Math.round(mid.x), Math.round(mid.y)], [10, 0]);
});

/* ---------------- colouring & drawing ---------------- */
test("colouring pages: 8–10 pictures with separate, closed, tappable regions", () => {
  assert.ok(DR.PAGES.length >= 8 && DR.PAGES.length <= 10);
  const ids = DR.PAGES.map(p => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ["mango", "elephant", "house", "butterfly", "car", "flower", "fish", "peacock", "kite", "diya"]) assert.ok(ids.includes(id), id);
  const counts = {};
  for (const pg of DR.PAGES) {
    assert.match(pg.name.hi, DEV);
    assert.ok(pg.name.en && pg.e);
    assert.equal(pg.regions[0], "M0 0 H200 V200 H0 Z", pg.id + ": the background can be coloured too");
    assert.ok(pg.regions.length >= 5, pg.id + " has enough regions");
    for (const d of pg.regions) {
      assert.match(d, /^M[\d.\s-]/, pg.id);
      assert.match(d.trim(), /Z$/, pg.id + ": every region is closed");
      assert.match(d, /^[MLHVCAZ\d.\s-]+$/, pg.id + ": plain path data only");
      (d.match(/-?\d*\.?\d+/g) || []).forEach(n => assert.ok(+n >= -360 && +n <= 360, pg.id + " number " + n));
    }
    for (const d of pg.lines || []) assert.match(d, /^[MLHVCAZ\d.\s-]+$/);
    counts[pg.id] = DR.regionCount(pg);
  }
  assert.deepEqual(counts, { mango: 5, elephant: 12, house: 12, butterfly: 11, car: 12, flower: 12, fish: 12, peacock: 21, kite: 11, diya: 12 });
});

test("palette: 12 bright colours with names, plus an eraser", () => {
  assert.equal(DR.COLORS.length, 12);
  const hex = DR.COLORS.map(c => c.c.toUpperCase());
  assert.equal(new Set(hex).size, 12);
  DR.COLORS.forEach(c => { assert.match(c.c, /^#[0-9A-F]{6}$/i); assert.match(c.n.hi, DEV); assert.ok(c.n.en); });
  assert.equal(DR.ERASER.c, "#FFFFFF");
  assert.ok(DR.STAMPS.length >= 8 && DR.BRUSHES.length === 3 && DR.BRUSHES[0] < DR.BRUSHES[2]);
});

test("gallery keeps at most 12 pictures and drops the oldest", () => {
  const png = n => ({ id: "p" + n, at: n, src: "data:image/png;base64,AAAA" + n });
  let g = [];
  for (let i = 0; i < 15; i++) g = DR.addToGallery(g, png(i), DR.GALLERY_MAX);
  assert.equal(g.length, 12);
  assert.equal(g[0].id, "p3");
  assert.equal(g[11].id, "p14");
  // junk in storage is ignored
  assert.equal(DR.addToGallery([{ src: "javascript:alert(1)" }, null, { src: "data:image/svg+xml,<svg>" }], png(1)).length, 1);
});

test("free drawing: undo-able clear (only ops after the last clear are visible)", () => {
  const ops = [{ t: "line" }, { t: "stamp" }, { t: "clear" }, { t: "line", n: 1 }];
  assert.deepEqual(JSON.parse(JSON.stringify(DR.visibleOps(ops))), [{ t: "line", n: 1 }]);
  assert.equal(DR.visibleOps(ops.slice(0, 2)).length, 2);
  assert.equal(DR.visibleOps(ops.slice(0, 3)).length, 0);
});

/* ---------------- puzzle ---------------- */
test("puzzle: pieces by age, and the cut covers the board exactly", () => {
  assert.deepEqual([...PZ.levels("2-3")], [2, 3, 4]);
  assert.deepEqual([...PZ.levels("4-5")], [4, 6]);
  assert.deepEqual([...PZ.levels("6+")], [6, 9]);
  for (const n of [2, 3, 4, 6, 9]) {
    const g = PZ.grid(n);
    assert.equal(g.rows * g.cols, n);
    const B = 300, pcs = PZ.cut(n, B);
    assert.equal(pcs.length, n);
    const area = pcs.reduce((a, p) => a + p.w * p.h, 0);
    assert.ok(Math.abs(area - B * B) < 1e-6, "areas add up");
    pcs.forEach(p => assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= B + 1e-9 && p.y + p.h <= B + 1e-9));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = pcs[i], b = pcs[j];
      const overlap = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      assert.ok(overlap < 1e-6, "no overlap");
    }
  }
  assert.ok(PZ.PICS.length >= 8 && PZ.PICS.every(p => DEV.test(p.hi) && p.en && p.e));
});

test("puzzle: pieces snap when close, gentler for younger children", () => {
  const p = PZ.cut(4, 200)[3];                       // 100 × 100 at (100, 100)
  assert.equal(PZ.snaps(p, 100, 100, PZ.snapTol("6+")), true);
  assert.equal(PZ.snaps(p, 118, 112, PZ.snapTol("6+")), true);
  assert.equal(PZ.snaps(p, 130, 100, PZ.snapTol("6+")), false);
  assert.equal(PZ.snaps(p, 130, 100, PZ.snapTol("2-3")), true);
  assert.equal(PZ.snaps(p, 0, 0, PZ.snapTol("2-3")), false);
  assert.ok(PZ.snapTol("2-3") > PZ.snapTol("4-5") && PZ.snapTol("4-5") > PZ.snapTol("6+"));
});

test("puzzle: the tray holds every piece, shuffled", () => {
  const rect = { x: 0, y: 320, w: 336, h: 220 };
  for (const n of [2, 3, 4, 6, 9]) {
    const c = PZ.cut(n, 330)[0];
    const spots = PZ.trayLayout(n, c.w, c.h, rect, seeded(n));
    assert.equal(spots.length, n);
    spots.forEach(s => {
      assert.ok(s.s > 0 && s.s <= 1);
      assert.ok(s.x >= rect.x - 1 && s.y >= rect.y - 1 && s.x + c.w * s.s <= rect.x + rect.w + 1 && s.y + c.h * s.s <= rect.y + rect.h + 1, "inside the tray");
    });
  }
  // order is shuffled (never the identity for more than one piece)
  for (let seed = 1; seed < 30; seed++) {
    const spots = PZ.trayLayout(4, 50, 50, { x: 0, y: 0, w: 400, h: 100 }, seeded(seed));
    const order = spots.map((s, i) => [s.x, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    assert.notDeepEqual(order, [0, 1, 2, 3]);
  }
});

/* ---------------- music ---------------- */
test("music: an ascending सा–सां scale and three drum sounds", () => {
  assert.equal(MU.SCALE.length, 8);
  assert.deepEqual([...MU.SCALE.map(s => s.hi)], ["सा", "रे", "ग", "म", "प", "ध", "नि", "सां"]);
  for (let i = 1; i < 8; i++) assert.ok(MU.SCALE[i].f > MU.SCALE[i - 1].f);
  assert.ok(Math.abs(MU.SCALE[7].f / MU.SCALE[0].f - 2) < 0.01, "one octave");
  assert.ok(MU.DRUMS.length >= 2 && MU.DRUMS.length <= 3);
  MU.TAAL.forEach(k => assert.ok(k === null || MU.DRUMS.some(d => d.id === k)));
});

test("music: listen-and-play patterns grow with age (2–5 notes)", () => {
  const len = (a, r) => MU.patternLength(a, r);
  assert.deepEqual([0, 1, 2, 5].map(r => len("2-3", r)), [2, 3, 3, 3]);
  assert.deepEqual([0, 1, 2, 5].map(r => len("4-5", r)), [3, 4, 4, 4]);
  assert.deepEqual([0, 1, 2, 5].map(r => len("6+", r)), [3, 4, 5, 5]);
  assert.equal(MU.memoryLevel("2-3").keys.length, 3);
  assert.equal(MU.memoryLevel("4-5").keys.length, 5);
  assert.equal(MU.memoryLevel("6+").keys.length, 8);
  assert.ok(MU.memoryLevel("2-3").gap > MU.memoryLevel("6+").gap, "slower for little ones");
  for (const a of AGES) for (let r = 0; r < 6; r++) for (let seed = 1; seed < 20; seed++) {
    const p = [...MU.makePattern(a, r, seeded(seed * 31 + r))];
    const L = MU.memoryLevel(a);
    assert.equal(p.length, len(a, r));
    assert.ok(p.length >= 2 && p.length <= 5);
    p.forEach(k => assert.ok(L.keys.includes(k)));
    if (!L.repeats) for (let i = 1; i < p.length; i++) assert.notEqual(p[i], p[i - 1], "no same note twice in a row for " + a);
  }
});

test("music: the pattern maker never stalls, even with a stuck random source", () => {
  assert.deepEqual([...MU.makePattern("2-3", 0, () => 0)], [0, 2]);
  assert.deepEqual([...MU.makePattern("4-5", 0, () => 0)], [0, 1, 0]);
  assert.deepEqual([...MU.makePattern("6+", 0, () => 0)], [0, 0, 0]);
  assert.equal(MU.makePattern("4-5", 1, () => 0.9999999).length, 4);
});

test("music: checking the child's notes", () => {
  const p = [0, 2, 4];
  assert.equal(MU.checkTap(p, 0, 0), "ok");
  assert.equal(MU.checkTap(p, 1, 2), "ok");
  assert.equal(MU.checkTap(p, 2, 4), "done");
  assert.equal(MU.checkTap(p, 1, 4), "miss");
});

test("music: the play-along tune stays on the xylophone", () => {
  assert.ok(MU.TUNE.length >= 16);
  MU.TUNE.forEach(([k, beats]) => { assert.ok(k >= 0 && k < 8); assert.ok(beats >= 1 && beats <= 4); });
  assert.ok(MU.tuneFor("2-3").length < MU.tuneFor("6+").length);
  assert.equal(MU.tuneFor("2-3")[0][0], 0, "starts on सा");
});

/* ---------------- in a real browser (optional) ----------------
   PW_PATH=$(npm root -g)/playwright node --test tools/test/create.test.mjs
   (SHOTS=<dir> also saves screenshots.) Opens every activity at 360×740, 1024×768 and 844×390,
   draws / traces / taps / drags with real pointer events, and checks for console errors and
   horizontal overflow. */
const PW = process.env.PW_PATH;
test("browser: every creative activity works at phone, tablet and landscape sizes", { skip: PW ? false : "set PW_PATH to a Playwright install to run" }, async () => {
  const { chromium } = createRequire(import.meta.url)(PW);
  const SHOTS = process.env.SHOTS || "";
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".woff2": "font/woff2", ".webp": "image/webp", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  const server = http.createServer((req, res) => {
    let f = decodeURIComponent(req.url.split("?")[0]);
    if (f === "/") f = "/index.html";
    const fp = path.join(WEB, f);
    if (!fp.startsWith(WEB) || !existsSync(fp) || statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(readFileSync(fp));
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch();
  const problems = [];
  try {
    for (const [width, height, age] of [[360, 740, "4-5"], [1024, 768, "6+"], [844, 390, "2-3"]]) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, hasTouch: true, serviceWorkers: "block" });
      const prof = { id: "pt", name: "", avatar: "🐯", ageBand: age, voice: "female", lang: "hi", created: 1 };
      await ctx.addInitScript(`if (!sessionStorage.getItem('__t')) { sessionStorage.setItem('__t', '1'); localStorage.setItem('ns_profiles', ${JSON.stringify(JSON.stringify({ v: 1, list: [prof], current: "pt" }))}); }`);
      await ctx.addInitScript(() => { try { Object.defineProperty(window, "speechSynthesis", { value: undefined }); } catch (e) { /* fine */ } });
      await ctx.route(u => !u.href.startsWith(origin), r => r.abort());
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
      await page.goto(origin + "/");
      await page.waitForFunction(() => window.NS && NS.open && document.getElementById("app").dataset.state !== "boot");
      const tag = width + "x" + height;
      const shot = name => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name + "_" + tag + ".png") }) : null);
      const overflow = async where => {
        const o = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth, b = document.getElementById("body");
          return { doc: document.documentElement.scrollWidth - vw, body: b ? b.scrollWidth - b.clientWidth : 0 };
        });
        if (o.doc > 1 || o.body > 1) problems.push(tag + " " + where + ": horizontal overflow " + JSON.stringify(o));
      };
      const calm = () => page.evaluate(() => { const c = document.querySelector(".celebrate"); if (c) c.remove(); });
      const draw = async (pts) => {
        await page.mouse.move(pts[0][0], pts[0][1]);
        await page.mouse.down();
        for (const [x, y] of pts.slice(1)) await page.mouse.move(x, y, { steps: 2 });
        await page.mouse.up();
      };
      /* trace: क, stroke by stroke along the guide */
      await page.evaluate(() => NS.open("trace"));
      await page.waitForTimeout(250);
      await overflow("trace menu");
      await shot("trace_menu");
      await page.locator(".trace-tab").nth(1).click();
      await page.locator(".trace-tile").first().click();
      await page.waitForTimeout(250);
      const strokes = await page.evaluate(() => NS.create.trace.polys(NS.create.trace.SETS[1].items[0]).length);
      for (let j = 0; j < strokes; j++) {
        const pts = await page.evaluate(j => {
          const T = NS.create.trace, ps = T.polys(T.SETS[1].items[0]), fr = T.frame(ps);
          const r = document.querySelectorAll(".trace-paper canvas")[1].getBoundingClientRect(), k = r.width / fr.size;
          return T.resample(ps[j], 20).map(q => [r.left + (q[0] - fr.x) * k, r.top + (q[1] - fr.y) * k]);
        }, j);
        await draw(pts);
        if (j === 1) await shot("trace_mid");
      }
      const cap = await page.locator(".trace-cap").innerText();
      if (!/कमल|क से/.test(cap)) problems.push(tag + " trace: letter not finished: " + cap);
      await shot("trace_done");
      await overflow("trace");
      await calm();
      /* draw: colour two regions, then free drawing + stamp + frame */
      await page.evaluate(() => NS.open("draw"));
      await page.waitForTimeout(200);
      await page.locator(".draw-tile").first().click();
      await page.locator(".draw-thumb").nth(1).click();
      await page.waitForTimeout(200);
      await page.locator(".draw-sw").nth(4).click();
      const pb = await page.locator(".draw-paper").boundingBox();
      await page.mouse.click(pb.x + pb.width * 0.6, pb.y + pb.height * 0.45);      // elephant body
      await page.locator(".draw-sw").nth(5).click();
      await page.mouse.click(pb.x + pb.width * 0.05, pb.y + pb.height * 0.05);     // sky
      const filled = await page.evaluate(() => [...document.querySelectorAll(".draw-paper path[data-r]")].filter(p => p.getAttribute("fill") !== "#FFFFFF").length);
      if (filled !== 2) problems.push(tag + " draw: expected 2 filled regions, got " + filled);
      await shot("draw_colour");
      await overflow("colouring");
      await page.locator(".draw-btn.draw-go").click();
      await page.waitForTimeout(300);
      await calm();
      await page.evaluate(() => NS.open("draw"));
      await page.locator(".draw-tile").nth(1).click();
      await page.waitForTimeout(200);
      const cb = await page.locator(".draw-paper").boundingBox();
      await draw([[cb.x + 20, cb.y + 30], [cb.x + cb.width / 2, cb.y + cb.height / 2], [cb.x + cb.width - 20, cb.y + 40]]);
      await page.locator(".draw-st").first().click();
      await page.mouse.click(cb.x + cb.width * 0.7, cb.y + cb.height * 0.7);
      await shot("draw_free");
      await overflow("drawing");
      await page.locator(".draw-btn.draw-go").click();
      await page.waitForTimeout(200);
      const saved = await page.evaluate(() => NS.activeData("draw").get("gallery", []).length);
      if (saved !== 2) problems.push(tag + " draw: gallery should hold 2 pictures, has " + saved);
      await calm();
      /* music: every screen, taps and a slide */
      for (const k of [0, 1, 2, 3]) {
        await page.evaluate(() => NS.open("music"));
        await page.waitForTimeout(150);
        if (k === 2) await page.evaluate(() => { window.__rand = Math.random; Math.random = () => 0; });
        await page.locator(".music-tile").nth(k).click();
        await page.waitForTimeout(250);
        const keys = page.locator(".music-key");
        if (k === 2) {
          /* listen and play: wait for "अब तुम बजाओ!", then play the pattern back */
          await page.evaluate(() => { Math.random = window.__rand; });
          await page.waitForFunction(() => /अब तुम बजाओ/.test(document.querySelector(".music-cap").textContent), null, { timeout: 10000 });
          const plan = await page.evaluate(age => { const M = NS.create.music; return { p: [...M.makePattern(age, 0, () => 0)], keys: M.memoryLevel(age).keys }; }, age);
          for (const note of plan.p) await keys.nth(plan.keys.indexOf(note)).click();
          const stars = await page.locator(".music-stars").innerText();
          if (!stars.includes("⭐")) problems.push(tag + " music: the played-back pattern was not accepted");
        } else if (k === 3) {
          /* play-along: tap the glowing bar three times */
          for (let t = 0; t < 3; t++) await page.locator(".music-key.music-glow").click();
          const w = await page.evaluate(() => parseFloat(document.querySelector(".music-prog i").style.width));
          if (!(w > 0)) problems.push(tag + " music: play-along did not move on");
        } else if (await keys.count()) {
          const a = await keys.first().boundingBox(), z = await keys.last().boundingBox();
          await draw([[a.x + a.width / 2, a.y + a.height / 2], [z.x + z.width / 2, z.y + z.height / 2]]);
          await keys.nth(1).click();
        } else await page.locator(".music-pad").first().click();
        await shot("music_" + k);
        await overflow("music " + k);
      }
      /* puzzle: drag every piece home */
      await page.evaluate(() => NS.open("puzzle"));
      await page.waitForTimeout(150);
      await page.locator(".puzzle-thumb").first().click();
      await page.waitForTimeout(300);
      await shot("puzzle_start");
      const n = await page.locator(".puzzle-piece").count();
      for (let i = 0; i < n; i++) {
        const t = await page.evaluate(i => {
          const area = document.querySelector(".puzzle-play").getBoundingClientRect();
          const b = document.querySelector(".puzzle-board").getBoundingClientRect();
          const p = document.querySelectorAll(".puzzle-piece")[i].getBoundingClientRect();
          const cuts = NS.create.puzzle.cut(document.querySelectorAll(".puzzle-piece").length, b.width);
          return { from: [p.left + p.width / 2, p.top + p.height / 2], to: [b.left + cuts[i].x + cuts[i].w / 2 + 3, b.top + cuts[i].y + cuts[i].h / 2 - 2], area: area.width };
        }, i);
        await page.mouse.move(t.from[0], t.from[1]);
        await page.mouse.down();
        await page.mouse.move((t.from[0] + t.to[0]) / 2, (t.from[1] + t.to[1]) / 2, { steps: 4 });
        await page.mouse.move(t.to[0], t.to[1], { steps: 4 });
        await page.mouse.up();
        await page.waitForTimeout(280);
      }
      await page.waitForTimeout(400);
      const fixed = await page.locator(".puzzle-piece.puzzle-fixed").count();
      if (fixed !== n) problems.push(tag + " puzzle: " + fixed + "/" + n + " pieces placed");
      const pcap = await page.locator(".puzzle-cap").innerText();
      if (!/आम/.test(pcap)) problems.push(tag + " puzzle: no naming: " + pcap);
      await shot("puzzle_done");
      await overflow("puzzle");
      if (errors.length) problems.push(tag + " console: " + errors.join(" | "));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  assert.deepEqual(problems, []);
});
