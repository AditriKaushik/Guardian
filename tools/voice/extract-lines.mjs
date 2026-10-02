#!/usr/bin/env node
// Collects every fixed line the app speaks, so a human voice artist (or a neural voice)
// can record each one once. Writes:
//   tools/voice/lines.csv            id,lang,text — the recording list (one file per id)
//   tools/voice/RECORDING_SCRIPT.md  the same lines, grouped by section, for printing
//
// Usage:  node tools/voice/extract-lines.mjs [--web web] [--out tools/voice] [--extra file.js ...]
//
// How lines are found (no build step, nothing in the app changes):
//  1. The app's classic scripts are run in a node:vm sandbox with a stub window/document,
//     in the order index.html loads them (then any other web/js/**/*.js). A file that throws
//     is reported and skipped; the rest still load.
//  2. Lines come from:
//     - NS.voiceLines: [{lang, text, section?}] — the convention for fixed lines that are not
//       plain content data (UI prompts, praise, buddy greetings). Modules add theirs with
//         NS.voiceLines = (NS.voiceLines || []).concat([{ lang: "hi", text: "शाबाश!" }]);
//     - activity tile titles passed to NS.registerActivity ({hi, en, hinglish}),
//     - NS.content (the data in web/js/content/*.js): every hi/en/hinglish string property
//       (e.g. {hi, en}, {scene, hi, en}); strings under spoken keys such as speak, say, text,
//       lines, pages, question, options, title, name …; zero-argument functions under
//       get/cards/items/build are called and their result is searched the same way.
//  3. Language: the {hi|en|hinglish} key, else the nearest "lang" field, else the script
//     (Devanagari → hi, otherwise en). Lines are de-duplicated by the manifest key
//     (normalize.mjs), so a line used in two places is recorded once.
//
// IDs are stable: a line already in lines.csv keeps its id; new lines get the next free
// number for their language (hi-0001, en-0001 …). Lines with placeholders like {name} are
// dynamic and skipped (the app falls back to the phone/browser voice for them).

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { normalizeText, normalizeLang, clipKey, isSpeakable } from './normalize.mjs';
import { readLines, writeLines } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');

const SPOKEN_KEYS = new Set([
  'speak', 'say', 'says', 'text', 'line', 'lines', 'page', 'pages', 'question', 'questions', 'q',
  'prompt', 'prompts', 'ask', 'hint', 'hints', 'praise', 'cheer', 'cheers', 'intro', 'outro',
  'title', 'name', 'words', 'sentence', 'sentences', 'story', 'stories', 'rhyme', 'verse', 'verses',
  'moral', 'options', 'choices', 'steps', 'tip', 'tips', 'goodnight',
  'greeting', 'greetings', 'reply', 'replies', 'narration', 'spoken',
]);
const SKIP_KEYS = new Set([
  'id', 'icon', 'emoji', 'color', 'colour', 'bg', 'img', 'image', 'src', 'href', 'url', 'sticker',
  'type', 'section', 'key', 'sound', 'big', 'css', 'cls', 'class', 'order', 'free',
]);
const CALL_KEYS = new Set(['get', 'cards', 'items', 'build', 'list', 'make']);
const LOCALES = new Set(['hi', 'en', 'hinglish']);
const PLACEHOLDER = /\{[^}]*\}|\$\{|%s|\{\{/;

// ---- CLI --------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { web: path.join(ROOT, 'web'), out: HERE, extra: [], quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--web') {
      opts.web = path.resolve(argv[++i]);
    } else if (a === '--out') {
      opts.out = path.resolve(argv[++i]);
    } else if (a === '--extra') {
      opts.extra.push(path.resolve(argv[++i]));
    } else if (a === '--quiet') {
      opts.quiet = true;
    } else if (a === '--help' || a === '-h') {
      console.log('node tools/voice/extract-lines.mjs [--web web] [--out tools/voice] [--extra file.js ...] [--quiet]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  return opts;
}

// ---- Loading the app's scripts in a sandbox ---------------------------------

/** A do-nothing object that absorbs any DOM call (document.createElement(...).append(...) …). */
function absorber() {
  const target = function () {};
  const proxy = new Proxy(target, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) {
        return () => '';
      }
      if (prop === 'then' || typeof prop === 'symbol') {
        return undefined;
      }
      if (prop === 'length') {
        return 0;
      }
      return proxy;
    },
    set() {
      return true;
    },
    apply() {
      return proxy;
    },
    construct() {
      return proxy;
    },
    has() {
      return true;
    },
  });
  return proxy;
}

function memoryStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: k => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: i => [...m.keys()][i] ?? null,
    get length() { return m.size; },
  };
}

function stubNS(activities) {
  const handlers = {};
  return {
    content: {},
    voiceLines: [],
    registerActivity(def) { activities.push(def); },
    on(name, fn) { (handlers[name] = handlers[name] || []).push(fn); },
    off() {},
    emit() {},
  };
}

function makeSandbox(activities) {
  const dom = absorber();
  const sandbox = {
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, queueMicrotask() {},
    fetch: () => Promise.reject(new Error('no network in extract-lines')),
    document: dom, navigator: dom, location: dom, history: dom, screen: dom,
    speechSynthesis: dom, SpeechSynthesisUtterance: dom, Audio: dom, Image: dom,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {} }),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    localStorage: memoryStorage(), sessionStorage: memoryStorage(),
    Intl, Date, Math, JSON, Promise, URL, URLSearchParams, TextEncoder, TextDecoder,
    crypto: globalThis.crypto,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  context.__activities = activities;
  return context;
}

/** Local scripts in index.html order, then every other web/js/**.js (sorted), then extras. */
function scriptList(web, extra) {
  const list = [];
  const seen = new Set();
  const add = file => {
    const abs = path.resolve(file);
    if (!seen.has(abs) && fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      seen.add(abs);
      list.push(abs);
    }
  };
  const index = path.join(web, 'index.html');
  if (fs.existsSync(index)) {
    const html = fs.readFileSync(index, 'utf8');
    for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)) {
      const src = m[1];
      if (!/^(?:[a-z]+:)?\/\//i.test(src) && !src.startsWith('data:')) {
        add(path.join(web, src.split(/[?#]/)[0]));
      }
    }
  }
  const walk = dir => {
    if (!fs.existsSync(dir)) {
      return [];
    }
    return fs.readdirSync(dir, { withFileTypes: true })
        .flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.js') ? [path.join(dir, e.name)] : []))
        .sort();
  };
  // Same order as the architecture: core (ui last), content, brain, modules.
  const js = path.join(web, 'js');
  const core = walk(path.join(js, 'core'));
  const coreOrder = ['ns.js', 'store.js', 'voice.js', 'rewards.js', 'billing.js'];
  core.sort((a, b) => {
    const rank = f => {
      const i = coreOrder.indexOf(path.basename(f));
      return i === -1 ? (path.basename(f) === 'ui.js' ? 99 : 50) : i;
    };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  const ui = core.filter(f => path.basename(f) === 'ui.js');
  add(path.join(web, 'config.js'));
  core.filter(f => path.basename(f) !== 'ui.js').forEach(add);
  walk(path.join(js, 'content')).forEach(add);
  walk(path.join(js, 'brain')).forEach(add);
  walk(path.join(js, 'modules')).forEach(add);
  walk(js).forEach(add);
  ui.forEach(add);
  extra.forEach(add);
  return list;
}

function loadApp(web, extra, log) {
  const activities = [];
  const context = makeSandbox(activities);
  const loaded = [];
  const failed = [];
  const files = scriptList(web, extra);
  for (const file of files) {
    // ns.js creates the real NS; before it (or without it) a small stub stands in.
    if (!context.NS && path.basename(file) !== 'ns.js' && path.basename(file) !== 'config.js') {
      context.NS = stubNS(activities);
    }
    try {
      vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file, timeout: 5000 });
      loaded.push(file);
    } catch (e) {
      failed.push({ file, error: String(e && e.message || e).split('\n')[0] });
    }
    wrapRegister(context, activities);
  }
  if (!context.NS) {
    context.NS = stubNS(activities);
  }
  for (const f of failed) {
    log(`  ! skipped ${path.relative(web, f.file)}: ${f.error}`);
  }
  return { NS: context.NS, activities, loaded, failed };
}

function wrapRegister(context, activities) {
  const NS = context.NS;
  if (!NS || typeof NS.registerActivity !== 'function' || NS.registerActivity.__wrapped) {
    return;
  }
  const original = NS.registerActivity;
  const wrapped = function (def) {
    activities.push(def);
    try {
      return original.apply(this, arguments);
    } catch {
      return undefined;
    }
  };
  wrapped.__wrapped = true;
  try {
    NS.registerActivity = wrapped;
  } catch {
    // a frozen NS: activities registered through it are simply not captured
  }
}

// ---- Collecting lines ---------------------------------------------------------

function guessLang(text) {
  return /[ऀ-ॿ]/.test(text) ? 'hi' : 'en';
}

function isLocalized(obj) {
  const keys = Object.keys(obj);
  return keys.length > 0 && keys.every(k => LOCALES.has(k)) && keys.some(k => typeof obj[k] === 'string');
}

function titleOf(obj) {
  for (const k of ['title', 'name', 'label']) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) {
      return normalizeText(v);
    }
    if (v && typeof v === 'object' && (typeof v.hi === 'string' || typeof v.en === 'string')) {
      return normalizeText(v.hi || v.en);
    }
  }
  return null;
}

export function collect({ NS, activities }) {
  const found = [];       // {lang, text, section}
  const stats = { dynamic: 0 };
  const push = (lang, text, section) => {
    if (typeof text !== 'string') {
      return;
    }
    if (PLACEHOLDER.test(text)) {
      stats.dynamic++;
      return;
    }
    const clean = normalizeText(text);
    if (!isSpeakable(clean)) {
      return;
    }
    found.push({ lang: normalizeLang(lang || guessLang(clean)), text: clean, section });
  };

  // 1. Explicit fixed lines.
  const voiceLines = Array.isArray(NS && NS.voiceLines) ? NS.voiceLines : [];
  for (const l of voiceLines) {
    if (l && typeof l === 'object') {
      push(l.lang, l.text, l.section ? `UI › ${l.section}` : 'UI');
    }
  }

  // 2. Home tiles.
  for (const a of activities) {
    if (a && a.title && typeof a.title === 'object') {
      for (const k of Object.keys(a.title)) {
        if (LOCALES.has(k)) {
          push(k, a.title[k], 'Home tiles');
        }
      }
    } else if (a && typeof a.title === 'string') {
      push(null, a.title, 'Home tiles');
    }
  }

  // 3. Content data.
  const seen = new WeakSet();
  const walk = (value, ctx, depth) => {
    if (depth > 14 || value === null || value === undefined) {
      return;
    }
    if (typeof value === 'string') {
      if (ctx.spoken) {
        push(ctx.lang, value, ctx.section);
      }
      return;
    }
    if (typeof value !== 'object') {
      return;
    }
    if (seen.has(value)) {
      return;
    }
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach(v => walk(v, ctx, depth + 1));
      return;
    }
    // {hi, en, hinglish} strings are text the child sees, and everything on screen is also
    // spoken — even when the object has other keys too ({scene, hi, en}, {emoji, hi, en}).
    for (const k of LOCALES) {
      if (typeof value[k] === 'string') {
        push(k, value[k], ctx.section);
      }
    }
    if (isLocalized(value)) {
      return;
    }
    let lang = ctx.lang;
    for (const k of ['lang', 'voiceLang', 'speakLang']) {
      if (typeof value[k] === 'string' && value[k]) {
        lang = value[k];
        break;
      }
    }
    const title = depth <= 3 ? titleOf(value) : null;
    const section = title && depth >= 1 ? `${ctx.root} › ${title}` : ctx.section;
    let keys;
    try {
      keys = Object.keys(value);
    } catch {
      return;
    }
    for (const k of keys) {
      if (SKIP_KEYS.has(k) || LOCALES.has(k) && typeof value[k] === 'string' || k === 'lang' || k === 'voiceLang' || k === 'speakLang') {
        continue;
      }
      let v;
      try {
        v = value[k];
      } catch {
        continue;
      }
      if (typeof v === 'function') {
        if (CALL_KEYS.has(k) && v.length === 0) {
          try {
            walk(v.call(value), { ...ctx, lang, section, spoken: ctx.spoken }, depth + 1);
          } catch {
            // a generator that needs the DOM: its lines are skipped
          }
        }
        continue;
      }
      const spoken = SPOKEN_KEYS.has(k);
      if (typeof v === 'string') {
        if (spoken) {
          push(lang, v, section);
        }
        continue;
      }
      walk(v, { lang, section, root: ctx.root, spoken: spoken || (ctx.spoken && Array.isArray(v)) }, depth + 1);
    }
  };
  const content = NS && NS.content && typeof NS.content === 'object' ? NS.content : {};
  for (const root of Object.keys(content)) {
    walk(content[root], { lang: null, section: root, root, spoken: false }, 1);
  }
  return { found, stats };
}

/** De-duplicates by manifest key and gives every line a stable id. */
export function assignIds(found, previous) {
  const byKey = new Map(previous.map(l => [clipKey(l.lang, l.text), l.id]));
  const next = {};
  for (const l of previous) {
    const m = /^([a-z]+)-(\d+)$/.exec(l.id);
    if (m) {
      next[m[1]] = Math.max(next[m[1]] || 0, Number(m[2]));
    }
  }
  const out = [];
  const used = new Set();
  for (const f of found) {
    const key = clipKey(f.lang, f.text);
    if (used.has(key)) {
      continue;
    }
    used.add(key);
    let id = byKey.get(key);
    if (!id) {
      next[f.lang] = (next[f.lang] || 0) + 1;
      id = `${f.lang}-${String(next[f.lang]).padStart(4, '0')}`;
    }
    out.push({ id, lang: f.lang, text: f.text, section: f.section });
  }
  return out;
}

const LANG_NAME = { hi: 'हिंदी', en: 'English' };

export function recordingScript(lines) {
  const sections = new Map();
  for (const l of lines) {
    if (!sections.has(l.section)) {
      sections.set(l.section, []);
    }
    sections.get(l.section).push(l);
  }
  const cell = s => String(s).replace(/\|/g, '\\|');
  const out = [
    '# नन्हा स्कूल — Recording script (रिकॉर्डिंग स्क्रिप्ट)',
    '',
    'यह फ़ाइल `tools/voice/extract-lines.mjs` से अपने-आप बनती है — इसे हाथ से न बदलें।',
    'हर पंक्ति की **एक अलग फ़ाइल** रिकॉर्ड करें और उसका नाम **id** रखें, जैसे `hi-0001.wav`।',
    'महिला आवाज़ की फ़ाइलें `tools/voice/recordings/female/` में, पुरुष आवाज़ की `tools/voice/recordings/male/` में।',
    'कैसे रिकॉर्ड करें: `docs/VOICE.md` देखें। प्यार से, मुस्कुराते हुए, धीरे और साफ़ बोलें — जैसे किसी 3 साल के बच्चे से बात कर रहे हों।',
    '',
    `कुल पंक्तियाँ: **${lines.length}** (${Object.entries(lines.reduce((a, l) => ({ ...a, [l.lang]: (a[l.lang] || 0) + 1 }), {}))
        .map(([k, n]) => `${LANG_NAME[k] || k}: ${n}`).join(', ')})`,
    '',
  ];
  for (const [section, items] of sections) {
    out.push(`## ${section}`, '', '| ✓ F | ✓ M | id | भाषा | बोलना है |', '|---|---|---|---|---|');
    for (const l of items) {
      out.push(`| ☐ | ☐ | \`${l.id}\` | ${LANG_NAME[l.lang] || l.lang} | ${cell(l.text)} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

// ---- Main -----------------------------------------------------------------------

export function run(argv) {
  const opts = parseArgs(argv);
  const log = opts.quiet ? () => {} : (...a) => console.log(...a);
  const app = loadApp(opts.web, opts.extra, log);
  const { found, stats } = collect(app);
  const csvPath = path.join(opts.out, 'lines.csv');
  const previous = fs.existsSync(csvPath) ? readLines(fs.readFileSync(csvPath, 'utf8')) : [];
  const lines = assignIds(found, previous);
  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(csvPath, writeLines(lines));
  fs.writeFileSync(path.join(opts.out, 'RECORDING_SCRIPT.md'), recordingScript(lines) + '\n');
  const kept = new Set(lines.map(l => l.id));
  const dropped = previous.filter(l => !kept.has(l.id)).length;
  log(`Loaded ${app.loaded.length} script(s), skipped ${app.failed.length}.`);
  log(`${lines.length} unique line(s) → ${path.relative(process.cwd(), csvPath) || csvPath}` +
      (dropped ? ` (${dropped} old line(s) no longer used)` : '') +
      (stats.dynamic ? `; ${stats.dynamic} dynamic line(s) with placeholders skipped` : ''));
  return { lines, app };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    run(process.argv.slice(2));
  } catch (e) {
    console.error(`extract-lines: ${e.message}`);
    process.exit(1);
  }
}
