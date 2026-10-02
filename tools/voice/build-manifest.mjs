#!/usr/bin/env node
// Turns recorded (or neural) voice files into small clips the app can play, and writes
// web/audio/manifest.json so the app knows which lines have a clip.
//
//   input:   tools/voice/recordings/<female|male>/<id>.(wav|mp3|m4a|ogg|flac|aac|webm)
//            (id from tools/voice/lines.csv, e.g. hi-0001.wav)
//   output:  web/audio/<voice>/<lang>/<id>.mp3     mono MP3, 48 kbps, 24 kHz, loudness-normalised
//            web/audio/manifest.json               {"version":1,"clips":{"female":{"<lang>|<text>":"audio/female/<lang>/<id>.mp3"},"male":{…}}}
//
// MP3 because every browser plays it, including Safari on iPhone and the Android WebView.
//
// Usage:
//   node tools/voice/build-manifest.mjs              convert new/changed recordings (needs ffmpeg) + manifest
//   node tools/voice/build-manifest.mjs --dry-run    no ffmpeg: only list the MP3s already in web/audio
//   options: --voices female,male  --bitrate 48k  --force  --budget-mb 20
//            --recordings DIR  --web DIR  --lines FILE
// Without ffmpeg on PATH it behaves like --dry-run and says so.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { clipKey } from './normalize.mjs';
import { readLines } from './csv.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const INPUT_EXT = ['.wav', '.mp3', '.m4a', '.ogg', '.opus', '.flac', '.aac', '.webm'];
const VOICE_NAME = /^(female|male)$/;

function parseArgs(argv) {
  const opts = {
    recordings: path.join(HERE, 'recordings'),
    web: path.join(ROOT, 'web'),
    lines: path.join(HERE, 'lines.csv'),
    voices: ['female', 'male'],
    bitrate: '48k',
    dryRun: false,
    force: false,
    budgetMb: 20,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`${a} needs a value`);
      }
      return argv[++i];
    };
    if (a === '--dry-run') {
      opts.dryRun = true;
    } else if (a === '--force') {
      opts.force = true;
    } else if (a === '--recordings') {
      opts.recordings = path.resolve(val());
    } else if (a === '--web') {
      opts.web = path.resolve(val());
    } else if (a === '--lines') {
      opts.lines = path.resolve(val());
    } else if (a === '--voices') {
      opts.voices = val().split(',').map(s => s.trim()).filter(Boolean);
    } else if (a === '--bitrate') {
      opts.bitrate = val();
    } else if (a === '--budget-mb') {
      opts.budgetMb = Number(val());
    } else if (a === '--help' || a === '-h') {
      console.log('node tools/voice/build-manifest.mjs [--dry-run] [--force] [--voices female,male] [--bitrate 48k] [--budget-mb 20] [--recordings DIR] [--web DIR] [--lines FILE]');
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${a}`);
    }
  }
  for (const v of opts.voices) {
    if (!VOICE_NAME.test(v)) {
      throw new Error(`voice must be "female" or "male", not "${v}"`);
    }
  }
  if (!/^(3[2-9]|[4-9]\d|1[01]\d|12[0-8])k$/.test(opts.bitrate)) {
    throw new Error('bitrate must be between 32k and 128k (48k–64k recommended)');
  }
  return opts;
}

export function hasFfmpeg() {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-version'], { stdio: 'ignore' });
  return r.status === 0;
}

// Trim silence at both ends, keep a short lead-in (some phones clip the first few ms),
// then EBU R128 loudness normalisation so every clip is equally loud.
const TRIM = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-50dB:detection=peak';
const FILTER = [TRIM, 'areverse', TRIM, 'areverse', 'adelay=80', 'apad=pad_dur=0.12',
  'loudnorm=I=-16:TP=-1.5:LRA=11'].join(',');

function convert(input, output, bitrate) {
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const tmp = output + '.tmp.mp3';
  const r = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', input,
    '-af', FILTER, '-ac', '1', '-ar', '24000',
    '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', '-id3v2_version', '0',
    tmp,
  ], { encoding: 'utf8' });
  if (r.status !== 0) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`ffmpeg failed for ${path.basename(input)}: ${(r.stderr || '').trim().split('\n').pop()}`);
  }
  fs.renameSync(tmp, output);
}

function findRecording(dir, id) {
  for (const ext of INPUT_EXT) {
    const f = path.join(dir, id + ext);
    if (fs.existsSync(f)) {
      return f;
    }
  }
  return null;
}

export function run(argv) {
  const opts = parseArgs(argv);
  if (!fs.existsSync(opts.lines)) {
    throw new Error(`${path.relative(process.cwd(), opts.lines)} not found — run extract-lines.mjs first`);
  }
  const lines = readLines(fs.readFileSync(opts.lines, 'utf8'));
  for (const l of lines) {
    if (!/^[a-z]{2,8}-\d{1,6}$/.test(l.id) || !/^[a-z]{2,8}$/.test(l.lang)) {
      throw new Error(`bad row in lines.csv: ${JSON.stringify(l)}`);
    }
  }
  let dryRun = opts.dryRun;
  if (!dryRun && !hasFfmpeg()) {
    console.log('ffmpeg not found — dry run: only MP3s already in web/audio go into the manifest.');
    dryRun = true;
  }

  const audio = path.join(opts.web, 'audio');
  const manifest = { version: 1, clips: {} };
  const report = [];
  let failed = 0;
  const long = [];
  const maxClipBytes = (parseInt(opts.bitrate, 10) * 1000 / 8) * 28;
  for (const voice of opts.voices) {
    const clips = {};
    let converted = 0;
    let bytes = 0;
    let missing = 0;
    const recDir = path.join(opts.recordings, voice);
    for (const l of lines) {
      const rel = `audio/${voice}/${l.lang}/${l.id}.mp3`;
      const out = path.join(opts.web, rel);
      const input = findRecording(recDir, l.id);
      if (!dryRun && input) {
        const stale = !fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(input).mtimeMs;
        if (opts.force || stale) {
          try {
            convert(input, out, opts.bitrate);
            converted++;
          } catch (e) {
            console.error(`  ! ${voice}/${l.id}: ${e.message}`);
            failed++;
          }
        }
      }
      if (fs.existsSync(out) && fs.statSync(out).size > 0) {
        clips[clipKey(l.lang, l.text)] = rel;
        const size = fs.statSync(out).size;
        bytes += size;
        // The app gives up on a clip after 30 s; estimate the length from the size.
        if (size > maxClipBytes) {
          long.push(`${voice}/${l.id}`);
        }
      } else {
        missing++;
      }
    }
    // Clips on disk that no line uses any more (not deleted — just reported).
    const known = new Set(Object.values(clips));
    const orphans = [];
    const voiceDir = path.join(audio, voice);
    if (fs.existsSync(voiceDir)) {
      for (const lang of fs.readdirSync(voiceDir)) {
        const langDir = path.join(voiceDir, lang);
        if (!fs.statSync(langDir).isDirectory()) {
          continue;
        }
        for (const f of fs.readdirSync(langDir)) {
          if (f.endsWith('.mp3') && !known.has(`audio/${voice}/${lang}/${f}`)) {
            orphans.push(`audio/${voice}/${lang}/${f}`);
          }
        }
      }
    }
    manifest.clips[voice] = Object.fromEntries(Object.entries(clips).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    report.push({ voice, clips: Object.keys(clips).length, converted, missing, bytes, orphans });
  }

  fs.mkdirSync(audio, { recursive: true });
  fs.writeFileSync(path.join(audio, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');

  for (const r of report) {
    const mb = r.bytes / 1e6;
    console.log(`${r.voice}: ${r.clips}/${lines.length} line(s) have a clip` +
        (dryRun ? '' : `, ${r.converted} converted`) +
        `, ${mb.toFixed(2)} MB` + (r.missing ? `, ${r.missing} still to record` : ''));
    if (mb > opts.budgetMb) {
      console.log(`  ! over the ${opts.budgetMb} MB budget for one voice — see docs/VOICE.md (size budget)`);
    }
    if (r.orphans.length) {
      console.log(`  ${r.orphans.length} clip(s) no longer used (safe to delete): ${r.orphans.slice(0, 5).join(', ')}${r.orphans.length > 5 ? ' …' : ''}`);
    }
  }
  if (long.length) {
    console.log(`! ${long.length} clip(s) look longer than ~28 s (the app stops a clip at 30 s) — split those lines: ${long.slice(0, 5).join(', ')}`);
  }
  console.log(`Wrote ${path.relative(process.cwd(), path.join(audio, 'manifest.json')) || 'manifest.json'}`);
  return { manifest, report, failed, dryRun };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { failed } = run(process.argv.slice(2));
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.error(`build-manifest: ${e.message}`);
    process.exit(1);
  }
}
