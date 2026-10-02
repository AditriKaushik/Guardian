// Tests for the voice tools. Run: node --test "tools/voice/test/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { normalizeText, normalizeLang, clipKey, isSpeakable } from '../normalize.mjs';
import { parseCsv, readLines, writeLines } from '../csv.mjs';
import { run as extract } from '../extract-lines.mjs';
import { run as build, hasFfmpeg } from '../build-manifest.mjs';
import { spawnSync } from 'node:child_process';

const NS_JS = fileURLToPath(new URL('../../../web/js/core/ns.js', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nanha-voice-'));
const quietly = fn => {
  const log = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = log;
  }
};

test('normalizeText strips emoji and collapses whitespace, like NS.stripEmoji', () => {
  assert.equal(normalizeText('  लाल · Red  🔴 '), 'लाल · Red');      // "·" is kept, as the app keeps it
  assert.equal(normalizeText('B for  Ball ⚽'), 'B for Ball');
  assert.equal(normalizeText('👨‍👩‍👧 परिवार ❤️'), 'परिवार');
  assert.equal(normalizeText('🇮🇳 भारत 👍🏽'), 'भारत');
  assert.equal(normalizeText('1️⃣ एक'), '1 एक');
  assert.equal(normalizeText('शाबाश!\n\tबहुत  बढ़िया।'), 'शाबाश! बहुत बढ़िया।');
  assert.equal(normalizeText('क्षत्रिय ज्ञानी'), 'क्षत्रिय ज्ञानी');   // conjuncts untouched
  assert.equal(normalizeText(null), '');
  assert.equal(isSpeakable(normalizeText('⭐ 🎉')), false);
  assert.equal(isSpeakable('अ'), true);
});

test('language codes and keys', () => {
  assert.equal(normalizeLang('hi-IN'), 'hi');
  assert.equal(normalizeLang('en_US'), 'en');
  assert.equal(normalizeLang('en'), 'en');
  assert.equal(normalizeLang('hinglish'), 'hi');
  assert.equal(clipKey('hi-IN', ' मछली 🐟 '), 'hi|मछली');
});

test('keys match the app (web/js/core/ns.js) exactly', { skip: !fs.existsSync(NS_JS) && 'web/js/core/ns.js not there yet' }, () => {
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(NS_JS, 'utf8'), sandbox);
  const NS = sandbox.NS;
  const samples = ['  लाल · Red  🔴 ', 'B for  Ball ⚽', '👨‍👩‍👧 परिवार ❤️', '🇮🇳 भारत 👍🏽', '1️⃣ एक', '#️⃣ *️⃣ ©️ ™ ↔️ ☀ ☀️',
    'शाबाश!\n\tबहुत  बढ़िया।', 'क्ष ज्ञ श्र त्र द्ध', 'Twinkle, "twinkle"…', '', '🐟'];
  for (const t of samples) {
    assert.equal(normalizeText(t), NS.stripEmoji(t), JSON.stringify(t));
  }
  for (const l of ['hi', 'en', 'hinglish']) {
    assert.equal(normalizeLang(l), NS.speechLang(l), l);
  }
  const voiceJs = path.join(path.dirname(NS_JS), 'voice.js');
  if (fs.existsSync(voiceJs)) {
    assert.match(fs.readFileSync(voiceJs, 'utf8'), /NS\.speechLang\(lang\) \+ "\|" \+ NS\.stripEmoji\(text\)/);
  }
});

test('CSV round-trips commas, quotes, newlines and Hindi, with a BOM', () => {
  const lines = [
    { id: 'en-0001', lang: 'en', text: 'Twinkle, twinkle, "little" star,' },
    { id: 'hi-0001', lang: 'hi', text: 'मछली जल की रानी है,' },
  ];
  const csv = writeLines(lines);
  assert.ok(csv.startsWith('﻿id,lang,text\r\n'));
  assert.deepEqual(readLines(csv), lines);
  assert.deepEqual(parseCsv('a,"b\nc"\n'), [['a', 'b\nc']]);
  assert.throws(() => readLines('x,y\n1,2\n'));
});

function fakeWeb() {
  const web = tmp();
  fs.mkdirSync(path.join(web, 'js/core'), { recursive: true });
  fs.mkdirSync(path.join(web, 'js/content'), { recursive: true });
  fs.mkdirSync(path.join(web, 'js/modules'), { recursive: true });
  fs.writeFileSync(path.join(web, 'index.html'),
      '<script src="config.js" defer></script><script src="js/core/ns.js" defer></script><script src="https://cdn.example/x.js"></script>');
  fs.writeFileSync(path.join(web, 'config.js'), 'window.CFG = {};');
  fs.writeFileSync(path.join(web, 'js/core/ns.js'),
      'window.NS = { content: {}, registerActivity(){}, on(){}, emit(){} };');
  fs.writeFileSync(path.join(web, 'js/core/ui.js'),
      'document.querySelector("#app").append(document.createElement("div"));\n' +
      'NS.voiceLines = (NS.voiceLines || []).concat([{ lang: "hi", text: "चलो खेलें! 🎉" }, { lang: "hi", text: "नमस्ते {name}" }]);');
  fs.writeFileSync(path.join(web, 'js/content/data.js'), `
    const VARN = [["अ","अनार"],["आ","आम"]];
    NS.content.lessons = [
      { id: "varn", icon: "अ", title: { hi: "अक्षर", en: "Letters" }, lang: "hi", say: "हिंदी वर्णमाला",
        get() { return VARN.map(r => ({ big: r[0], cap: r[0] + " · " + r[1], speak: r[0] + " से " + r[1] })); } },
      { id: "abc", title: "ABC", lang: "en", cards: [{ big: "A", speak: "A for Apple 🍎", color: "#f00" }] },
    ];
    NS.content.rhymes = [{ title: "Twinkle ⭐", lang: "en", lines: ["Twinkle, twinkle, little star,", "A for Apple"] }];
    NS.content.stories = [{ title: { hi: "प्यासा कौआ" }, pages: [{ text: { hi: "एक कौआ था।", en: "There was a crow." }, img: "🐦" }],
      questions: [{ q: { hi: "कौआ क्या चाहता था?" }, options: [{ hi: "पानी" }], answer: 0 }] }];
  `);
  fs.writeFileSync(path.join(web, 'js/modules/routine.js'),
      'NS.registerActivity({ id: "routine", icon: "🌞", title: { hi: "मेरा दिन", en: "My Day" }, open() {} });');
  fs.writeFileSync(path.join(web, 'js/modules/broken.js'), 'this is not javascript(');
  return web;
}

test('extract-lines finds every fixed line, de-duplicates, skips placeholders, keeps ids stable', () => {
  const web = fakeWeb();
  const out = tmp();
  const { lines, app } = quietly(() => extract(['--web', web, '--out', out, '--quiet']));
  assert.equal(app.failed.length, 1);                       // broken.js skipped, the rest loaded
  const keys = lines.map(l => `${l.lang}|${l.text}`);
  for (const k of ['hi|चलो खेलें!', 'hi|मेरा दिन', 'en|My Day', 'hi|अक्षर', 'en|Letters', 'hi|हिंदी वर्णमाला',
    'hi|अ से अनार', 'hi|आ से आम', 'en|ABC', 'en|A for Apple', 'en|Twinkle', 'en|Twinkle, twinkle, little star,',
    'hi|प्यासा कौआ', 'hi|एक कौआ था।', 'en|There was a crow.', 'hi|कौआ क्या चाहता था?', 'hi|पानी']) {
    assert.ok(keys.includes(k), k);
  }
  assert.equal(keys.filter(k => k === 'en|A for Apple').length, 1);    // de-duplicated
  assert.ok(!keys.some(k => k.includes('{name}') || k.includes('#f00') || k.includes('अनार') && k.includes('·')));   // cap is shown, not spoken
  assert.ok(!keys.some(k => k.endsWith('|अ') || k.endsWith('|A')));    // "big" is shown, not spoken
  const csv = readLines(fs.readFileSync(path.join(out, 'lines.csv'), 'utf8'));
  assert.equal(csv.length, lines.length);
  assert.ok(csv.every(l => /^(hi|en)-\d{4}$/.test(l.id)));
  const script = fs.readFileSync(path.join(out, 'RECORDING_SCRIPT.md'), 'utf8');
  assert.match(script, /## Home tiles/);
  assert.match(script, /`hi-0001`/);

  // Re-running after a content change keeps old ids and never reuses them.
  const before = new Map(csv.map(l => [l.text, l.id]));
  fs.appendFileSync(path.join(web, 'js/content/data.js'), '\nNS.content.extra = [{ speak: "नई पंक्ति", lang: "hi" }];');
  quietly(() => extract(['--web', web, '--out', out, '--quiet']));
  const after = readLines(fs.readFileSync(path.join(out, 'lines.csv'), 'utf8'));
  for (const l of after) {
    if (before.has(l.text)) {
      assert.equal(l.id, before.get(l.text), l.text);
    }
  }
  const added = after.find(l => l.text === 'नई पंक्ति');
  const maxHi = Math.max(...csv.filter(l => l.lang === 'hi').map(l => Number(l.id.slice(3))));
  assert.equal(added.id, `hi-${String(maxHi + 1).padStart(4, '0')}`);
});

test('build-manifest --dry-run lists only existing MP3s, keyed exactly like the app', () => {
  const web = tmp();
  const dir = tmp();
  const linesFile = path.join(dir, 'lines.csv');
  fs.writeFileSync(linesFile, writeLines([
    { id: 'hi-0001', lang: 'hi', text: 'चलो खेलें!' },
    { id: 'en-0001', lang: 'en', text: 'A for Apple' },
    { id: 'hi-0002', lang: 'hi', text: 'शाबाश' },
  ]));
  fs.mkdirSync(path.join(web, 'audio/female/hi'), { recursive: true });
  fs.mkdirSync(path.join(web, 'audio/male/en'), { recursive: true });
  fs.writeFileSync(path.join(web, 'audio/female/hi/hi-0001.mp3'), Buffer.alloc(100, 1));
  fs.writeFileSync(path.join(web, 'audio/male/en/en-0001.mp3'), Buffer.alloc(100, 1));
  fs.writeFileSync(path.join(web, 'audio/female/hi/hi-0002.mp3'), Buffer.alloc(0));   // empty = missing
  const { manifest, dryRun } = quietly(() => build(['--dry-run', '--web', web, '--lines', linesFile, '--recordings', dir]));
  assert.equal(dryRun, true);
  const expected = {
    version: 1,
    clips: {
      female: { 'hi|चलो खेलें!': 'audio/female/hi/hi-0001.mp3' },
      male: { 'en|A for Apple': 'audio/male/en/en-0001.mp3' },
    },
  };
  assert.deepEqual(manifest, expected);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(web, 'audio/manifest.json'), 'utf8')), expected);
  assert.throws(() => quietly(() => build(['--dry-run', '--web', web, '--lines', path.join(dir, 'nope.csv')])));
  assert.throws(() => quietly(() => build(['--dry-run', '--voices', 'robot', '--lines', linesFile])));
});

test('build-manifest converts recordings to small mono MP3s with ffmpeg', { skip: !hasFfmpeg() && 'ffmpeg not installed' }, () => {
  const web = tmp();
  const dir = tmp();
  const linesFile = path.join(dir, 'lines.csv');
  fs.writeFileSync(linesFile, writeLines([{ id: 'hi-0001', lang: 'hi', text: 'नमस्ते' }]));
  fs.mkdirSync(path.join(dir, 'female'));
  // 0.5 s of silence, then a quiet 1 s tone, as a stereo 44.1 kHz WAV.
  const gen = spawnSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo:d=0.5',
    '-f', 'lavfi', '-i', 'sine=f=300:d=1', '-filter_complex', '[0][1]concat=n=2:v=0:a=1,volume=0.1',
    '-y', path.join(dir, 'female', 'hi-0001.wav')]);
  assert.equal(gen.status, 0);
  const { manifest, report } = quietly(() => build(['--web', web, '--lines', linesFile, '--recordings', dir]));
  assert.deepEqual(manifest.clips.female, { 'hi|नमस्ते': 'audio/female/hi/hi-0001.mp3' });
  assert.deepEqual(manifest.clips.male, {});
  assert.equal(report[0].converted, 1);
  const mp3 = path.join(web, 'audio/female/hi/hi-0001.mp3');
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', mp3, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  assert.match(probe, /Audio: mp3.*24000 Hz, mono/);
  const seconds = Number(/Duration: 00:00:(\d+\.\d+)/.exec(probe)[1]);
  assert.ok(seconds < 1.4, `leading silence trimmed (${seconds}s)`);
  assert.ok(fs.statSync(mp3).size < 12_000);
  // Unchanged recordings are not converted again.
  assert.equal(quietly(() => build(['--web', web, '--lines', linesFile, '--recordings', dir])).report[0].converted, 0);
});
