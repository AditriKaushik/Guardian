// Tests for the realistic lesson pictures: web/js/content/images.js (NS.images / NS.img) and
// web/img/real/. Run: node --test tools/test/*.test.mjs   (prints picture coverage per lesson deck)
// See docs/IMAGES.md. Rebuild with tools/images/fetch-fluent.py + tools/images/build-images.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { SYMBOLS, keyOf } from "../images/symbols.mjs";   // swatches, shapes, arrows, UI: no picture on purpose

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WEB = path.join(ROOT, "web");
const REAL = path.join(WEB, "img/real");
const MAX_BYTES = 5 * 1024 * 1024;
const MUST = { fruits: 0.9, animals: 0.9, vehicles: 0.9, body: 0.9 };   // fruits deck = fruits + vegetables

function load(files) {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.NS = { content: {} };
  vm.createContext(sandbox);
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(WEB, "js", f), "utf8"), sandbox, { filename: f });
  return sandbox.NS;
}
const NS = load(["content/images.js", "content/lessons.js"]);
const EMOJI = /\p{RGI_Emoji}/gv;
const plain = (o) => JSON.parse(JSON.stringify(o));   // objects from the vm realm
const emojiIn = (s) => (typeof s === "string" ? s.match(EMOJI) || [] : []);

test("images.js loads without a DOM and exposes NS.images + NS.img", () => {
  assert.equal(typeof NS.images, "object");
  assert.equal(typeof NS.img, "function");
  assert.equal(typeof NS.img.parts, "function");
  assert.ok(Object.keys(NS.images).length >= 200, "has pictures");
});

test("the owner's mango: आ से आम shows a real-looking mango", () => {
  const varn = NS.content.lessons.deck("varn");
  const aam = varn.cards.find((c) => c.big === "आ");
  assert.equal(aam.name.hi, "आम");
  assert.equal(NS.img(aam.pic), "img/real/mango.webp");
});

test("NS.img normalises keys: variation selectors, skin tones, junk", () => {
  assert.equal(NS.img("☀️"), NS.img("☀"));
  assert.ok(NS.img("☀️"));
  assert.equal(NS.img("👩🏿‍🌾"), NS.img("👩🏾‍🌾"), "a missing skin tone falls back to the same person");
  assert.equal(NS.img("👩🏻"), "img/real/woman-light.webp", "an existing skin tone is kept");
  assert.equal(NS.img("not an emoji"), null);
  assert.equal(NS.img(""), null);
  assert.equal(NS.img(null), null);
  assert.equal(NS.img(undefined), null);
  for (const k of Object.keys(NS.images)) assert.ok(!/[︎️]/.test(k), "keys are stored without U+FE0F: " + k);
});

test("NS.img.parts splits picture strings into emoji (counting rows, story scenes)", () => {
  const p = NS.img.parts("🥭🥭🥭");
  assert.equal(p.length, 3);
  assert.ok(p.every((x) => x.url === "img/real/mango.webp"));
  const scene = NS.img.parts("🐦🌳☀️ and 🚫");
  assert.deepEqual(plain(scene.map((x) => x.key)), ["🐦", "🌳", "☀️", "🚫"]);
  assert.equal(scene[3].url, null, "a symbol without a picture gives url null");
  assert.equal(NS.img.parts("👨‍👩‍👦🏃🏽‍♀️").length, 2, "ZWJ and skin-tone sequences stay whole");
  assert.deepEqual(plain(NS.img.parts("")), []);
  assert.deepEqual(plain(NS.img.parts(null)), []);
});

test("every picture file exists, slugs are ASCII, nothing is orphaned, total size ≤ 5 MB", () => {
  const used = new Set();
  for (const [k, url] of Object.entries(NS.images)) {
    assert.match(url, /^img\/real\/(photo\/)?[a-z0-9]+(-[a-z0-9]+)*\.(webp|png|jpg)$/, "ASCII slug path for " + k);
    const f = path.join(WEB, url);
    assert.ok(fs.existsSync(f), "missing file " + url + " for " + k);
    used.add(path.relative(REAL, f));
  }
  let total = 0;
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const f = path.join(d, e.name);
    if (e.isDirectory()) return walk(f);
    total += fs.statSync(f).size;
    if (/\.(webp|png|jpg)$/.test(e.name)) assert.ok(used.has(path.relative(REAL, f)), "orphan picture " + path.relative(WEB, f));
  });
  walk(REAL);
  assert.ok(total <= MAX_BYTES, "web/img/real is " + total + " bytes (limit " + MAX_BYTES + ")");
});

test("pictures are real WebP files of a sensible size", () => {
  for (const url of new Set(Object.values(NS.images))) {
    if (!url.endsWith(".webp")) continue;
    const b = fs.readFileSync(path.join(WEB, url));
    assert.equal(b.toString("ascii", 0, 4), "RIFF", url);
    assert.equal(b.toString("ascii", 8, 12), "WEBP", url);
    assert.ok(b.length < 60 * 1024, url + " is small");
    if (b.toString("ascii", 12, 16) === "VP8X") {
      const w = 1 + b.readUIntLE(24, 3), h = 1 + b.readUIntLE(27, 3);
      assert.ok(w >= 96 && w <= 512 && h >= 96 && h <= 512, url + " is " + w + "x" + h);
    }
  }
});

test("CREDITS.txt carries the Fluent Emoji MIT licence", () => {
  const c = fs.readFileSync(path.join(REAL, "CREDITS.txt"), "utf8");
  assert.match(c, /Fluent Emoji © Microsoft Corporation, MIT License/);
  assert.match(c, /Permission is hereby granted, free of charge/);
  for (const url of new Set(Object.values(NS.images))) assert.ok(c.includes(path.basename(url)), "credited: " + url);
});

test("lesson nouns have realistic pictures (coverage per deck)", (t) => {
  const L = NS.content.lessons;
  const pictureKeys = (deck) => {
    const out = [];
    for (const c of deck.cards) {
      // Letter and number decks show their picture in `pic`; picture decks in `big`, and colour /
      // shape cards also carry a real object in `pic`.
      for (const s of [c.big, c.pic]) for (const e of emojiIn(s)) if (!SYMBOLS.has(keyOf(e))) out.push(e);
    }
    return out;
  };
  const report = [];
  for (const deck of L.decks) {
    const keys = [...new Set(pictureKeys(deck))];
    if (!keys.length) continue;
    const missing = keys.filter((k) => !NS.img(k));
    const cov = (keys.length - missing.length) / keys.length;
    report.push(deck.id.padEnd(9) + (cov * 100).toFixed(0).padStart(4) + "%  (" + (keys.length - missing.length) + "/" + keys.length + ")" + (missing.length ? "  missing: " + missing.join(" ") : ""));
    if (MUST[deck.id] != null) assert.ok(cov >= MUST[deck.id], deck.id + " picture coverage " + (cov * 100).toFixed(0) + "% < 90%; missing " + missing.join(" "));
  }
  for (const line of report) t.diagnostic(line);
  // Colour cards: the real object really exists as a picture.
  for (const c of L.deck("colors").cards) assert.ok(NS.img(c.pic), "colour " + c.name.en + " has a real object picture");
});

test("other content and modules (routine, stories, careers, focus, robo …): coverage report", (t) => {
  const files = ["content", "modules"].flatMap((d) => fs.readdirSync(path.join(WEB, "js", d))
    .filter((f) => f.endsWith(".js") && f !== "images.js" && f !== "lessons.js").map((f) => d + "/" + f));
  for (const f of files) {
    const src = fs.readFileSync(path.join(WEB, "js", f), "utf8");
    const keys = [...new Set(emojiIn(src))].filter((e) => !SYMBOLS.has(keyOf(e)));
    if (!keys.length) continue;
    const missing = keys.filter((k) => !NS.img(k));
    t.diagnostic(f.padEnd(20) + (((keys.length - missing.length) / keys.length) * 100).toFixed(0).padStart(4) + "%  (" + (keys.length - missing.length) + "/" + keys.length + ")" + (missing.length ? "  no picture: " + missing.join(" ") : ""));
  }
});

/* ---------- the optional real-photo pipeline (tools/images/fetch-photos.mjs): pure parts only ---------- */
test("photo pipeline: only CC0 / public domain / CC BY, never auto-chosen, approval is per picture", async () => {
  const P = await import("../images/fetch-photos.mjs");
  const m = (lic, short, extra = {}) => ({ License: { value: lic }, LicenseShortName: { value: short }, ...extra });
  assert.equal(P.licenceOk(m("cc0", "CC0")).ok, true);
  assert.equal(P.licenceOk(m("pd", "Public domain")).ok, true);
  assert.equal(P.licenceOk(m("cc-by-4.0", "CC BY 4.0")).needsCredit, true);
  assert.equal(P.licenceOk(m("cc-by-3.0-in", "CC BY 3.0 in")).ok, true);
  for (const [lic, short] of [["cc-by-sa-4.0", "CC BY-SA 4.0"], ["cc-by-nc-2.0", "CC BY-NC 2.0"], ["cc-by-nd-4.0", "CC BY-ND 4.0"], ["gfdl", "GFDL"], ["", ""]]) {
    assert.equal(P.licenceOk(m(lic, short)).ok, false, lic + " refused");
  }
  assert.equal(P.licenceOk(m("cc0", "CC0", { Restrictions: { value: "personality" } })).ok, false, "personality rights refused");
  assert.equal(P.licenceOk(m("cc-by-4.0", "CC BY 4.0", { NonFree: { value: "true" } })).ok, false);
  assert.equal(P.fileTitle("Mango_tree.jpg"), "File:Mango tree.jpg");
  assert.equal(P.fileTitle("file: Mango.jpg"), "File:Mango.jpg");
  assert.equal(P.htmlToText('<a href="x">Ram&nbsp;Kumar</a> &amp; co'), "Ram Kumar & co");
  assert.throws(() => P.parseCsv("a,b\n1,2"), /header/);
  const rows = P.parseCsv('slug,keys,commons_file,approved_by,approved_hash,notes\nmango,🥭,"File:A, b.jpg",Asha,0123456789ab,x\nbad slug,🍎,,,,\n');
  assert.equal(rows[0].commons_file, "File:A, b.jpg");
  const problems = P.checkRows(rows.concat([{ slug: "apple", keys: "🍎", commons_file: "", approved_by: "Asha", approved_hash: "", notes: "" }]));
  assert.ok(problems.some((p) => /bad slug/.test(p)));
  assert.ok(problems.some((p) => /approved without a chosen file/.test(p)), "approval needs a human-chosen file");
  // The shipped worklist is valid and nothing in it is chosen or approved by a machine.
  const list = P.parseCsv(fs.readFileSync(path.join(ROOT, "tools/images/photos.csv"), "utf8"));
  assert.deepEqual(P.checkRows(list), []);
  for (const r of list) if (r.approved_by) assert.match(r.approved_hash, /^[0-9a-f]{12}$/);
});
