// OPTIONAL, FOR LATER: replace Fluent 3D pictures with real photographs from Wikimedia Commons.
// Nothing is ever chosen automatically: a person picks every Commons file, a person looks at every
// downloaded picture, and only pictures a person approved (by name and by picture hash) are
// published. See docs/IMAGES.md for the whole procedure.
//
//   node tools/images/fetch-photos.mjs check   --csv tools/images/photos.csv
//   node tools/images/fetch-photos.mjs fetch   --csv tools/images/photos.csv --contact "you@example.org"
//   node tools/images/fetch-photos.mjs publish --csv tools/images/photos.csv
//
// CSV columns (header row required, UTF-8):
//   slug          ASCII name of the picture, e.g. mango  → web/img/real/photo/mango.webp
//   keys          the emoji this photo stands for, space separated, e.g. 🥭
//   commons_file  the exact Commons file a person chose, e.g. "File:Some mango photo.jpg" (empty = not chosen)
//   approved_by   empty until a person has looked at the downloaded picture and says it is the right
//                 thing, a real photo, and fine for children aged 2–6
//   approved_hash the first 12 characters of the picture's sha256, copied from review.txt — the approval
//                 is for exactly that picture
//   notes         anything
//
// fetch    asks the Commons API (action=query, prop=imageinfo, iiprop=url|size|mime|thumbmime|sha1|
//          extmetadata, iiurlwidth/iiurlheight) about each chosen file, refuses anything that is not
//          CC0, public domain or CC BY (no BY-SA, NC, ND, non-free, or files with "Restrictions" such as
//          personality rights), downloads the thumbnail Commons scales for us (fits 384×384), and
//          writes it with its credits into a staging folder outside web/ plus review.txt (and a
//          contact sheet when Python + Pillow exist).
// publish  copies only approved pictures into web/img/real/photo/ (as WebP when Pillow exists),
//          writes tools/images/photos.json, and runs build-images.mjs (images.js + CREDITS.txt).
//
// Wikimedia asks every script for a User-Agent with contact details (--contact or WIKIMEDIA_CONTACT).
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 (Node ≥ 22.21).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const API = "https://commons.wikimedia.org/w/api.php";
const BOX = 384;   // thumbnails fit in 384×384 (2× the 192 px the app shows)
const PHOTO_DIR_DEFAULT = path.join(ROOT, "web/img/real/photo");
const PHOTOS_JSON_DEFAULT = path.join(ROOT, "tools/images/photos.json");
const COLUMNS = ["slug", "keys", "commons_file", "approved_by", "approved_hash", "notes"];
const META = ["License", "LicenseShortName", "LicenseUrl", "Artist", "Credit", "Attribution", "AttributionRequired",
  "UsageTerms", "Copyrighted", "Restrictions", "NonFree", "ObjectName", "ImageDescription"];

/* ---------- small pure helpers (tested in tools/test/images.test.mjs) ---------- */
export function parseCsv(text) {
  const rows = []; let row = []; let f = ""; let q = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && s[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  const [head, ...body] = rows.filter((r) => !(r.length === 1 && r[0] === ""));
  if (!head || head.map((h) => h.trim()).join(",") !== COLUMNS.join(",")) throw new Error("CSV header must be: " + COLUMNS.join(","));
  return body.map((r) => Object.fromEntries(COLUMNS.map((k, i) => [k, (r[i] || "").trim()])));
}

/** Which Commons licences we accept: CC0, public domain, CC BY (any version/port). Never SA/NC/ND. */
export function licenceOk(meta) {
  const v = (k) => String((meta[k] && meta[k].value) ?? "").trim();
  const lic = v("License").toLowerCase();
  const short = v("LicenseShortName");
  if (/^(true|yes|1)$/i.test(v("NonFree"))) return { ok: false, why: "non-free" };
  if (v("Restrictions")) return { ok: false, why: "restrictions: " + v("Restrictions") };
  if (!lic && !short) return { ok: false, why: "no licence information" };
  if (/(^|-)(sa|nc|nd)(-|$)/.test(lic) || /\b(SA|NC|ND)\b/.test(short)) return { ok: false, why: "licence " + (short || lic) + " (share-alike / non-commercial / no-derivatives)" };
  if (lic === "cc0" || /^cc-?zero/.test(lic) || /^CC0/i.test(short)) return { ok: true, kind: "CC0" };
  if (/^pd($|-)/.test(lic) || /^public domain$/i.test(short)) return { ok: true, kind: "PD" };
  if (/^cc-by-\d\.\d(-[a-z]{2,})?$/.test(lic)) return { ok: true, kind: "CC BY", needsCredit: true };
  return { ok: false, why: "licence " + (short || lic) + " is not CC0 / PD / CC BY" };
}

export function htmlToText(html) {
  return String(html ?? "").replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();
}

export function fileTitle(s) {
  const t = String(s || "").trim().replace(/_/g, " ");
  if (!t) return "";
  return /^file:/i.test(t) ? "File:" + t.slice(5).trim() : "File:" + t;
}

export function checkRows(rows) {
  const problems = [];
  const seen = new Set();
  rows.forEach((r, i) => {
    const at = "row " + (i + 2) + " (" + (r.slug || "?") + "): ";
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)) problems.push(at + "slug must be ASCII a-z 0-9 -");
    if (seen.has(r.slug)) problems.push(at + "slug used twice");
    seen.add(r.slug);
    if (!r.keys) problems.push(at + "keys (emoji) missing");
    if (r.approved_by && !r.commons_file) problems.push(at + "approved without a chosen file");
    if (r.approved_by && !/^[0-9a-f]{12}$/.test(r.approved_hash)) problems.push(at + "approved_hash must be the 12 characters from review.txt");
    if (r.commons_file && /^https?:/i.test(r.commons_file)) problems.push(at + "commons_file must be the file title (File:…), not a URL");
  });
  return problems;
}

const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- commands ---------- */
function args() {
  const a = process.argv.slice(2);
  const o = { cmd: a[0], csv: path.join(ROOT, "tools/images/photos.csv"), staging: path.join(os.tmpdir(), "nanha-photo-staging"), contact: process.env.WIKIMEDIA_CONTACT || "" };
  for (let i = 1; i < a.length; i++) {
    if (a[i] === "--csv") o.csv = path.resolve(a[++i]);
    else if (a[i] === "--staging") o.staging = path.resolve(a[++i]);
    else if (a[i] === "--contact") o.contact = a[++i];
    else throw new Error("unknown option " + a[i]);
  }
  return o;
}

async function api(params, ua) {
  const url = API + "?" + new URLSearchParams({ format: "json", formatversion: "2", maxlag: "5", ...params });
  for (let tries = 0; ; tries++) {
    const res = await fetch(url, { headers: { "User-Agent": ua, "Api-User-Agent": ua } });
    if (res.status === 429 || res.status === 503 || res.headers.get("retry-after")) {
      if (tries >= 4) throw new Error("Commons is busy (HTTP " + res.status + ")");
      await sleep(1000 * Number(res.headers.get("retry-after") || 5));
      continue;
    }
    if (!res.ok) throw new Error("Commons API HTTP " + res.status);
    const j = await res.json();
    if (j.error && j.error.code === "maxlag" && tries < 4) { await sleep(5000); continue; }
    if (j.error) throw new Error("Commons API: " + j.error.code + " " + (j.error.info || ""));
    return j;
  }
}

export async function fetchAll(o, rows) {
  if (!/@|https?:\/\//.test(o.contact)) throw new Error("Give contact details for the User-Agent: --contact you@example.org (Wikimedia policy)");
  const ua = "NanhaSchoolPhotoFetcher/1.0 (" + o.contact + ") node/" + process.versions.node;
  fs.mkdirSync(o.staging, { recursive: true });
  const review = [];
  for (const r of rows) {
    if (r.approved_by && r.commons_file && fs.existsSync(path.join(o.staging, r.slug + ".json"))) {
      const old = JSON.parse(fs.readFileSync(path.join(o.staging, r.slug + ".json"), "utf8"));
      if (old.title === fileTitle(r.commons_file) && old.sha256.startsWith(r.approved_hash)) { review.push(r.slug + ": approved, kept as reviewed"); continue; }
    }
    if (!r.commons_file) { review.push(r.slug + ": no Commons file chosen yet — skipped"); continue; }
    const title = fileTitle(r.commons_file);
    const j = await api({ action: "query", prop: "imageinfo", titles: title, iiprop: "url|size|mime|thumbmime|sha1|extmetadata",
      iiurlwidth: String(BOX), iiurlheight: String(BOX), iiextmetadatafilter: META.join("|"), iiextmetadatalanguage: "en" }, ua);
    const page = j.query && j.query.pages && j.query.pages[0];
    if (!page || page.missing || page.invalid || !page.imageinfo || !page.imageinfo[0]) { review.push(r.slug + ": REFUSED — " + title + " does not exist on Commons"); continue; }
    const ii = page.imageinfo[0];
    const meta = ii.extmetadata || {};
    const lic = licenceOk(meta);
    if (!lic.ok) { review.push(r.slug + ": REFUSED — " + title + ": " + lic.why); continue; }
    if (!/^image\/(jpeg|png|webp)$/.test(ii.thumbmime || ii.mime)) { review.push(r.slug + ": REFUSED — " + title + " is " + ii.mime + " (need a photo)"); continue; }
    const author = htmlToText(meta.Attribution && meta.Attribution.value) || htmlToText(meta.Artist && meta.Artist.value);
    if (lic.needsCredit && !author) { review.push(r.slug + ": REFUSED — " + title + ": CC BY but no author to credit"); continue; }
    const res = await fetch(ii.thumburl || ii.url, { headers: { "User-Agent": ua } });
    if (!res.ok) { review.push(r.slug + ": download failed HTTP " + res.status); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[ii.thumbmime || ii.mime];
    const hash = sha256(buf);
    fs.writeFileSync(path.join(o.staging, r.slug + "." + ext), buf);
    const rec = {
      slug: r.slug, keys: r.keys.split(/\s+/).filter(Boolean), file: r.slug + "." + ext, sha256: hash, title,
      source: ii.descriptionurl, originalSha1: ii.sha1, width: ii.thumbwidth, height: ii.thumbheight,
      author: author || "unknown (public domain)", credit: htmlToText(meta.Credit && meta.Credit.value),
      license: lic.kind === "CC BY" ? String(meta.LicenseShortName.value) : lic.kind === "CC0" ? "CC0 (public domain dedication)" : "Public domain",
      licenseUrl: htmlToText(meta.LicenseUrl && meta.LicenseUrl.value), fetchedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(o.staging, r.slug + ".json"), JSON.stringify(rec, null, 1));
    review.push(r.slug + ": " + hash.slice(0, 12) + "  " + rec.file + "  " + rec.license + "  by " + rec.author + "\n    " + rec.source);
    await sleep(500);   // be gentle with Commons
  }
  const txt = "Look at every picture (" + o.staging + ") before approving it:\n" +
    "  • is it the right thing, a real photo, clear on a phone screen?\n  • is it fine for a 2–6 year old (no people's faces without need, no violence, no brands, nothing scary)?\n" +
    "If yes, put your name in approved_by and the 12 characters below in approved_hash.\n\n" + review.join("\n") + "\n";
  fs.writeFileSync(path.join(o.staging, "review.txt"), txt);
  console.log(txt);
  try {
    execFileSync("python3", [path.join(ROOT, "tools/images/contact-sheet.py"), "--dir", o.staging, "--out", path.join(o.staging, "review.png"), "--cell", "192", "--cols", "6"], { stdio: "inherit" });
  } catch { console.log("(no contact sheet: needs python3 + Pillow; open the pictures directly)"); }
}

export function publish(o, rows) {
  const PHOTO_DIR = o.photoDir || PHOTO_DIR_DEFAULT, PHOTOS_JSON = o.photosJson || PHOTOS_JSON_DEFAULT;
  const approved = rows.filter((r) => r.approved_by);
  const out = [];
  const problems = [];
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  for (const r of approved) {
    const recFile = path.join(o.staging, r.slug + ".json");
    if (!fs.existsSync(recFile)) { problems.push(r.slug + ": not fetched (run fetch first)"); continue; }
    const rec = JSON.parse(fs.readFileSync(recFile, "utf8"));
    const buf = fs.readFileSync(path.join(o.staging, rec.file));
    const hash = sha256(buf);
    if (hash !== rec.sha256 || !hash.startsWith(r.approved_hash)) { problems.push(r.slug + ": the staged picture is not the one that was approved (hash " + hash.slice(0, 12) + ")"); continue; }
    if (fileTitle(r.commons_file) !== rec.title) { problems.push(r.slug + ": commons_file changed since fetch — fetch and review again"); continue; }
    let file = r.slug + "." + rec.file.split(".").pop();
    let modified = "scaled by Wikimedia Commons to fit " + BOX + "x" + BOX;
    try {   // WebP is ~30% smaller; keep the photo as it is if Pillow is missing
      execFileSync("python3", ["-c", "import sys; from PIL import Image; im=Image.open(sys.argv[1]); im.thumbnail((" + BOX + "," + BOX + ")); im.convert('RGB').save(sys.argv[2], 'WEBP', quality=80, method=6)",
        path.join(o.staging, rec.file), path.join(PHOTO_DIR, r.slug + ".webp")]);
      file = r.slug + ".webp";
      modified += ", converted to WebP";
    } catch { fs.copyFileSync(path.join(o.staging, rec.file), path.join(PHOTO_DIR, file)); }
    out.push({ slug: r.slug, keys: rec.keys, file: "img/real/photo/" + file, title: rec.title.replace(/^File:/, ""), author: rec.author,
      license: rec.license, licenseUrl: rec.licenseUrl, source: rec.source, modified, approvedBy: r.approved_by, sha256: rec.sha256 });
  }
  if (problems.length) throw new Error(problems.join("\n"));
  const keep = new Set(out.map((p) => path.basename(p.file)));
  for (const f of fs.readdirSync(PHOTO_DIR)) if (!keep.has(f)) fs.unlinkSync(path.join(PHOTO_DIR, f));   // un-approved = unpublished
  fs.writeFileSync(PHOTOS_JSON, JSON.stringify(out, null, 1) + "\n");
  console.log("published", out.length, "photos →", path.relative(ROOT, PHOTOS_JSON));
  if (o.build !== false) execFileSync(process.execPath, [path.join(ROOT, "tools/images/build-images.mjs")], { stdio: "inherit" });
  return out;
}

async function main() {
  const o = args();
  if (!["check", "fetch", "publish"].includes(o.cmd)) { console.log("usage: node tools/images/fetch-photos.mjs check|fetch|publish [--csv file] [--staging dir] [--contact email]"); process.exit(2); }
  const rows = parseCsv(fs.readFileSync(o.csv, "utf8"));
  const problems = checkRows(rows);
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  if (o.cmd === "check") { console.log(rows.length + " rows OK; " + rows.filter((r) => r.commons_file).length + " chosen, " + rows.filter((r) => r.approved_by).length + " approved"); return; }
  if (o.cmd === "fetch") return fetchAll(o, rows);
  return publish(o, rows);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
