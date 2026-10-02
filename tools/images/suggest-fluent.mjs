// Finds emoji in web/js/content/*.js and web/js/modules/*.js that have no realistic picture yet and
// suggests tools/images/fluent.json entries for them (Fluent Emoji 3D, MIT).
//
//   node tools/images/suggest-fluent.mjs            list what is missing + suggested entries
//   node tools/images/suggest-fluent.mjs --write    also add the suggestions to fluent.json
//   then: python3 tools/images/fetch-fluent.py && node tools/images/build-images.mjs
//
// Needs the npm registry once: the emoji → Fluent folder table comes from the MIT package
// `fluentui-emoji-js` (emojiData.json), fetched with `npm pack` into a temp folder.
// People and hands get the "Medium" skin-tone render unless the emoji names a tone.
// Look at every new picture (tools/images/contact-sheet.py) before shipping it.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SYMBOLS, keyOf } from "./symbols.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const LIST = path.join(ROOT, "tools/images/fluent.json");
const EMOJI = /\p{RGI_Emoji}/gv;
const TONE = /[\u{1F3FB}-\u{1F3FF}]/u;

function emojiData() {
  const dir = path.join(os.tmpdir(), "nanha-fluentui-emoji-js");
  const file = path.join(dir, "package", "emojiData.json");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dir, { recursive: true });
    const tgz = execFileSync("npm", ["pack", "fluentui-emoji-js@1.2.1", "--silent", "--pack-destination", dir], { encoding: "utf8" }).trim().split("\n").pop();
    execFileSync("tar", ["xzf", path.join(dir, tgz), "-C", dir]);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

const slugify = (folder) => folder.replace(/^\//, "").replace(/\//g, " ").normalize("NFKD")
  .replace(/[^\x00-\x7F]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function main() {
  const list = JSON.parse(fs.readFileSync(LIST, "utf8"));
  const have = new Set(list.flatMap((it) => it.keys.map(keyOf)));
  const haveLoose = new Set([...have].map((k) => k.replace(new RegExp(TONE.source, "gu"), "")));
  const wanted = new Map();
  const used = new Set();
  for (const dir of ["web/js/content", "web/js/modules", "web/js/core"]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(".js") && f !== "images.js")) {
      for (const e of fs.readFileSync(path.join(ROOT, dir, f), "utf8").match(EMOJI) || []) {
        used.add(keyOf(e));
        if (dir === "web/js/core" && f !== "store.js") continue;   // core UI icons stay emoji; store.js = avatars
        const k = keyOf(e);
        if (SYMBOLS.has(k) || have.has(k) || haveLoose.has(k.replace(new RegExp(TONE.source, "gu"), ""))) continue;
        if (!wanted.has(k)) wanted.set(k, new Set());
        wanted.get(k).add(dir.split("/").pop() + "/" + f);
      }
    }
  }
  const unused = list.filter((it) => !it.keys.some((k) => used.has(k)));
  if (unused.length) console.log("no longer used (remove from fluent.json, then fetch-fluent.py --prune):", unused.map((it) => it.slug).join(", "));
  if (!wanted.size) { console.log("Every picture emoji has a picture."); return; }
  const data = emojiData();
  const byGlyph = new Map(data.map((d) => [keyOf(d.glyph), d]));
  const byFolder = new Map(data.map((d) => [d.folder, d]));
  const add = [];
  for (const [k, files] of wanted) {
    let d = byGlyph.get(k);
    if (!d || !d.images || !d.images["3D"]) { console.log("no Fluent 3D picture:", k, [...files].join(", ")); continue; }
    if (d.folder.endsWith("/Default") && !TONE.test(k)) d = byFolder.get(d.folder.replace(/\/Default$/, "/Medium")) || d;
    const src = d.folder.replace(/^\//, "") + "/3D/" + d.images["3D"][0];
    const slug = slugify(d.folder).replace(/-medium$/, TONE.test(k) ? "-medium" : "");
    const existing = list.find((it) => it.src === src);
    if (existing) { existing.keys.push(k); console.log("add key", k, "to", existing.slug); continue; }
    if (list.some((it) => it.slug === slug) || add.some((it) => it.slug === slug)) { console.log("slug clash, add by hand:", k, slug); continue; }
    const entry = { slug, src, name: d.folder.replace(/^\//, "").split("/")[0], keys: [k] };
    add.push(entry);
    console.log("suggest", JSON.stringify(entry), " ← used in", [...files].join(", "));
  }
  if (process.argv.includes("--write")) {
    const out = list.concat(add).sort((a, b) => a.slug.localeCompare(b.slug));
    fs.writeFileSync(LIST, JSON.stringify(out, null, 1) + "\n");
    console.log("fluent.json updated (" + add.length + " new pictures). Now run fetch-fluent.py and build-images.mjs.");
  }
}

main();
