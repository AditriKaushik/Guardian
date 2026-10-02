// End-to-end check of the web app in real Chromium.
//
//   PW_PATH=$(npm root -g)/playwright node tools/e2e/e2e.mjs        (SHOTS=<dir> to save screenshots,
//                                                                    E2E_PORT=<port> instead of 8766)
//
// Covers: the core shell and activities; first-run profiles, the "कौन खेल रहा है?" picker and
// per-profile data; language switching; voice settings; the session wind-down; night mode and
// bedtime; stickers; layouts from 320px phones to desktops and landscape; the trial and
// subscription flow (browser and Android shell); security (CSP, no inline code, text-only
// rendering); privacy (nothing personal stored or sent); the Android checkout page (pay.html);
// and the service worker. The real Worker code runs in this process behind a fake Razorpay API.
// Activities written by other modules are tested only when present.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import worker from '../../server/worker.js';

const require = createRequire(import.meta.url);
if (!process.env.PW_PATH) { console.error('Set PW_PATH to a playwright install, e.g. PW_PATH=$(npm root -g)/playwright'); process.exit(2); }
const { chromium } = require(process.env.PW_PATH);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '../../web');
const PORT = Number(process.env.E2E_PORT) || 8766;   // E2E_PORT=… when another run holds 8766
const ORIGIN = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const snap = (page, name) => (SHOTS ? page.screenshot({ path: path.join(SHOTS, name + '.png') }) : null);

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await crypto.subtle.exportKey('jwk', pair.privateKey);
const pubFull = await crypto.subtle.exportKey('jwk', pair.publicKey);
const pub = { kty: pubFull.kty, crv: pubFull.crv, x: pubFull.x, y: pubFull.y };
const env = {
  ALLOWED_ORIGINS: ORIGIN, RAZORPAY_KEY_ID: 'rzp_test_key12345', RAZORPAY_KEY_SECRET: 'test_secret',
  RAZORPAY_PLAN_ID: 'plan_test', RAZORPAY_PLAN_ID_YEARLY: 'plan_test_yearly', TOTAL_COUNT: '120', TRIAL_DAYS: '7', SIGNING_KEY_JWK: JSON.stringify(priv),
};

// Fake Razorpay: a subscription becomes paid the first time it is looked up after checkout.
const subs = new Map();
const razorpayBodies = [];            // everything the Worker sent to Razorpay
let n = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith('https://api.razorpay.com/')) return realFetch(url, init);
  if (init.body) razorpayBodies.push(String(init.body));
  const p = new URL(u).pathname.replace('/v1', '');
  if (init.method === 'POST' && p === '/subscriptions') {
    const b = JSON.parse(init.body);
    const s = { id: `sub_TEST${++n}xyz`, status: 'created', notes: b.notes, start_at: b.start_at || null, current_end: null, plan_id: b.plan_id };
    subs.set(s.id, s);
    return Response.json(s);
  }
  const c = p.match(/^\/subscriptions\/(sub_\w+)\/cancel$/);
  if (c) {
    const s = subs.get(c[1]);
    s.cancelled = true;
    return Response.json(s);
  }
  const g = p.match(/^\/subscriptions\/(sub_\w+)$/);
  if (g && subs.has(g[1])) {
    const s = subs.get(g[1]);
    if (s.status === 'created') {
      if (s.start_at) {
        s.status = 'authenticated';
      } else {
        s.status = 'active';
        s.current_end = Math.floor(Date.now() / 1000) + 30 * 86400;
      }
    }
    return Response.json(s);
  }
  return new Response('{}', { status: 404 });
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.png': 'image/png', '.webp': 'image/webp',
};
const apiBodies = [];                 // every request body that reached /api/*
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    apiBodies.push({ path: req.url, method: req.method, body: Buffer.concat(chunks).toString() });
    const headers = {};
    if (req.headers['content-type']) headers['Content-Type'] = req.headers['content-type'];
    if (req.headers.origin) headers.Origin = req.headers.origin;
    const r = await worker.fetch(new Request(ORIGIN + req.url, {
      method: req.method, headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
    }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let f = decodeURIComponent(req.url.split('?')[0]);
  if (f === '/') f = '/index.html';
  const fp = path.join(WEB, f);
  if (!fp.startsWith(WEB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fp)] || 'application/octet-stream' });
  res.end(fs.readFileSync(fp));
});
await new Promise(r => server.listen(PORT, r));

const PAY_PAGE = 'https://aditrikaushik.github.io/Guardian/pay.html';
const baseConfig = { API_BASE: ORIGIN, PUBLIC_KEY_JWK: pub, TRIAL_DAYS: 7, PRICE_TEXT: '₹99 / महीना', FREE: ['ABC', 'अक्षर', 'गिनती'], FREE_RHYMES: 2, PAY_PAGE_URL: PAY_PAGE };
const cfg = extra => `window.NS_CONFIG = ${JSON.stringify(Object.assign({}, baseConfig, extra || {}))};`;
const testConfig = cfg();

// Stands in for Razorpay's checkout popup: "pays" at once and returns a correctly signed result.
const checkoutStub = `window.Razorpay = function (opts) {
  this.open = async () => {
    const pay = 'pay_TEST' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('test_secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(pay + '|' + opts.subscription_id)));
    const sig = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
    window.__checkout = { key: opts.key, subscription_id: opts.subscription_id, name: opts.name, description: opts.description,
      theme: opts.theme, prefill: opts.prefill, hasDismiss: !!(opts.modal && opts.modal.ondismiss) };
    opts.handler({ razorpay_payment_id: pay, razorpay_subscription_id: opts.subscription_id, razorpay_signature: sig });
  };
};`;
// A parent who closes the checkout without paying.
const dismissStub = `window.Razorpay = function (opts) { this.open = () => setTimeout(() => opts.modal.ondismiss(), 50); };`;

// Child names used in this run: they must never appear in any network request.
const NAMES = ['आरव', 'Aarav', 'Mira', 'मीरा'];
const prof = (id, name, extra) => Object.assign({ id, name, avatar: '🐯', ageBand: '4-5', voice: 'female', lang: 'hi' }, extra || {});
const profilesInit = (list, current) => `localStorage.setItem('ns_profiles', ${JSON.stringify(JSON.stringify({ v: 1, list, current: current || list[0].id }))});`;
const ONE = profilesInit([prof('pa', 'आरव')]);
const EXPIRED = `localStorage.setItem('ns_trial', String(Date.now() - 10 * 86400000));`;

const browser = await chromium.launch();
const results = [];
const allErrors = [];
const csp = { events: [], console: [] };          // must stay empty for the whole run
const cspControl = { events: [], console: [] };   // the one context that deliberately breaks the policy
const external = [];                              // requests to any host but localhost / Razorpay checkout
const sent = [];                                  // every request URL + body, for the privacy check
function check(name, ok, detail = '') { results.push({ name, ok: !!ok, detail }); }

// Records CSP violations (as DOM events and as console reports), third-party requests and every request sent.
async function instrument(ctx, sink) {
  await ctx.exposeBinding('__cspViolation', (_src, v) => sink.events.push(v));
  await ctx.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', e => {
      window.__cspViolation({ page: location.pathname, directive: e.effectiveDirective, blocked: e.blockedURI, sample: e.sample, line: e.lineNumber });
    }, true);
  });
  ctx.on('request', r => {
    const u = new URL(r.url());
    if (!['http:', 'https:'].includes(u.protocol)) return;
    sent.push(r.url() + ' ' + (r.postData() || ''));
    if (u.hostname !== 'localhost' && u.hostname !== 'checkout.razorpay.com') external.push(r.url());
  });
  ctx.on('page', page => {
    page.on('pageerror', e => allErrors.push(page.url() + ' :: ' + e.message + ' :: ' + (e.stack || '').split('\n').slice(0, 3).join(' / ')));
    page.on('console', m => { if (/Content.Security.Policy/i.test(m.text())) sink.console.push(m.text()); });
  });
}

async function open({ payments = true, init, path: at = '/', stub = checkoutStub, sink = csp, profile = ONE, viewport, time, config, sw = 'block', wait = 700, motion } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: sw, viewport: viewport || { width: 400, height: 820 }, reducedMotion: motion || 'no-preference' });
  await instrument(ctx, sink);
  await ctx.route(u => u.hostname !== 'localhost' && u.hostname !== 'checkout.razorpay.com', r => r.abort());
  await ctx.route('https://checkout.razorpay.com/**', r => r.fulfill({ contentType: 'text/javascript', body: stub }));
  if (payments) await ctx.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: config || testConfig }));
  // Test setup runs only in the app's own documents (not the new tab's initial about:blank).
  const setup = (profile || '') + (init || '');
  if (setup) await ctx.addInitScript(`if (location.origin === ${JSON.stringify(ORIGIN)} && !sessionStorage.getItem('__setup')) { sessionStorage.setItem('__setup', '1'); ${setup} }`);
  const page = await ctx.newPage();
  if (time) await page.clock.install({ time: new Date(time) });
  await page.goto(ORIGIN + at);
  await page.waitForTimeout(wait);
  return { ctx, page };
}
const locked = page => page.locator('.tile.locked').count();
const expectedLocked = page => page.evaluate(() => NS.activities().filter(a => !a.hidden && !NS.billing.isFree(a)).length);
const visibleTiles = page => page.evaluate(() => NS.activities().filter(a => !a.hidden).length);
async function passGate(page) {
  const [a, b] = (await page.locator('.pq').innerText()).match(/\d+/g).map(Number);
  await page.fill('#gateAnswer', String(a * b));
  await page.locator('.pbtn', { hasText: 'आगे' }).click();
}
const storageDump = page => page.evaluate(() => JSON.stringify({
  local: Object.entries(localStorage).filter(([k]) => k !== '__setup'), session: Object.entries(sessionStorage).filter(([k]) => k !== '__setup'), cookie: document.cookie,
}));
const home = page => page.evaluate(() => NS.home());

// S. Static checks of the files themselves.
{
  const read = f => fs.readFileSync(path.join(WEB, f), 'utf8');
  const idx = read('index.html'), payHtml = read('pay.html'), hdrs = read('_headers');
  const metaCsp = s => (s.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/) || [])[1];
  const inlineProblems = s => {
    const out = [];
    for (const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (!/\bsrc=/.test(m[1]) || m[2].trim()) out.push('inline <script>');
    }
    if (/<style\b/i.test(s)) out.push('<style>');
    if (/\sstyle\s*=/i.test(s)) out.push('style= attribute');
    if (/\son[a-z]+\s*=/i.test(s)) out.push('on*= handler');
    if (/javascript:/i.test(s)) out.push('javascript: URL');
    return out;
  };
  const cspFirst = s => s.indexOf('http-equiv="Content-Security-Policy"') > 0 &&
    s.indexOf('http-equiv="Content-Security-Policy"') < Math.min(...['<link', '<script', '<style'].map(t => (s.indexOf(t) + 1 || Infinity) - 1));
  check('S index.html has a CSP <meta> before any script or stylesheet', metaCsp(idx) && cspFirst(idx));
  check('S pay.html has a CSP <meta> before any script or stylesheet', metaCsp(payHtml) && cspFirst(payHtml));
  const policy = metaCsp(idx) || '';
  // 'unsafe-inline' is allowed for styles only (Razorpay's checkout injects inline styles).
  const scriptSrc = (policy.match(/script-src[^;]*/) || [''])[0];
  const withoutStyle = policy.replace(/style-src[^;]*/, '');
  check('S CSP is strict for scripts: no unsafe-inline/eval, data: or wildcards; unsafe only in style-src; media-src self',
    !/unsafe-|data:|\*/.test(scriptSrc) && !/unsafe-/.test(withoutStyle) &&
    /style-src 'self' 'unsafe-inline'/.test(policy) && /object-src 'none'/.test(policy) && /base-uri 'none'/.test(policy) &&
    /media-src 'self'(;|$)/.test(policy), policy);
  check('S no inline <script>/<style>, style= or on*= attributes in index.html and pay.html',
    inlineProblems(idx).length === 0 && inlineProblems(payHtml).length === 0, [...inlineProblems(idx), ...inlineProblems(payHtml)].join(', '));
  check('S both pages send strict-origin-when-cross-origin referrers',
    [idx, payHtml].every(s => s.includes('<meta name="referrer" content="strict-origin-when-cross-origin">')));
  const hdrCsp = (hdrs.match(/^\s+Content-Security-Policy:\s*(.+)$/m) || [])[1];
  check('S CSP identical in index.html, pay.html and _headers (+ frame-ancestors)',
    metaCsp(payHtml) === policy && hdrCsp === policy + "; frame-ancestors 'none'", hdrCsp);
  check('S _headers applies HSTS, nosniff, DENY, referrer and permissions policies to /* (camera and mic only for this site)',
    /^\/\*$/m.test(hdrs) &&
    ['Strict-Transport-Security: max-age=31536000; includeSubDomains', 'X-Content-Type-Options: nosniff', 'X-Frame-Options: DENY',
     'Referrer-Policy: strict-origin-when-cross-origin', 'Permissions-Policy: camera=(self), microphone=(self), geolocation=(), interest-cohort=()']
      .every(h => hdrs.includes('  ' + h)));
  // Script order: config, core, content, brain, modules, ui.js last; all deferred; relative paths.
  const scripts = [...idx.matchAll(/<script\b([^>]*)><\/script>/g)].map(m => ({ src: (m[1].match(/src="([^"]+)"/) || [])[1], defer: /\bdefer\b/.test(m[1]) }));
  const srcs = scripts.map(s => s.src);
  const rank = s => s === 'config.js' ? 0 : s === 'js/core/ns.js' ? 1 : s === 'js/core/store.js' ? 2 : s === 'js/core/voice.js' ? 3 :
    s === 'js/core/sfx.js' ? 3.5 : s === 'js/core/rewards.js' ? 4 : s === 'js/core/billing.js' ? 5 : s === 'js/core/ai.js' ? 5.5 :
    s.startsWith('js/content/') ? 6 : s.startsWith('js/brain/') ? 7 : s.startsWith('js/modules/') ? 8 : s === 'js/core/ui.js' ? 9 : -1;
  const ranks = srcs.map(rank);
  check('S index.html loads config → core → content → brain → modules → ui.js, all defer, relative paths',
    scripts.every(s => s.defer) && ranks.every(r => r >= 0) && ranks.every((r, i) => i === 0 || r >= ranks[i - 1]) &&
    srcs[srcs.length - 1] === 'js/core/ui.js' && srcs.every(s => !s.startsWith('/') && !/^https?:/.test(s)) &&
    ['config.js', 'js/core/ns.js', 'js/core/store.js', 'js/core/voice.js', 'js/core/sfx.js', 'js/core/rewards.js', 'js/core/billing.js', 'js/core/ui.js',
      'js/content/lessons.js', 'js/content/rhymes.js', 'js/modules/learn.js'].every(f => srcs.includes(f) && fs.existsSync(path.join(WEB, f))),
    srcs.join(' '));
  const present = ['js/content', 'js/brain', 'js/modules'].flatMap(d => fs.existsSync(path.join(WEB, d)) ? fs.readdirSync(path.join(WEB, d)).filter(f => f.endsWith('.js')).map(f => d + '/' + f) : []);
  check('S every script in js/content, js/brain and js/modules is loaded by index.html', present.every(f => srcs.includes(f)), present.filter(f => !srcs.includes(f)).join(','));
  check('S web/app.js is gone (its code moved to js/core and js/modules)', !fs.existsSync(path.join(WEB, 'app.js')));
  const jsFiles = ['pay.js', ...['js/core', 'js/content', 'js/brain', 'js/modules'].flatMap(d => fs.existsSync(path.join(WEB, d)) ? fs.readdirSync(path.join(WEB, d)).filter(f => f.endsWith('.js')).map(f => d + '/' + f) : [])];
  const bad = jsFiles.filter(f => /\.(innerHTML|outerHTML)\b|insertAdjacentHTML|document\.write|\beval\s*\(|new Function|setTimeout\(\s*["'`]/.test(read(f)));
  check('S no script parses HTML strings or evals (all of web/js and pay.js)', bad.length === 0, bad.join(','));
  const billing = read('js/core/billing.js');
  check('S billing no longer stores or asks for an email', !/ns_email"\s*,\s*[^)]|type\s*=\s*"email"|payEmail|restoreEmail|prefill\s*:\s*\{/.test(billing) && billing.includes('store.del("ns_email")'));
  const noStorage = ['js/modules', 'js/brain'].flatMap(d => fs.existsSync(path.join(WEB, d)) ? fs.readdirSync(path.join(WEB, d)).map(f => d + '/' + f) : [])
    .filter(f => /localStorage|sessionStorage|indexedDB/.test(read(f)));
  check('S modules never touch storage directly (only ctx.data)', noStorage.length === 0, noStorage.join(','));
  const sw = read('sw.js');
  const list = name => [...(sw.match(new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];')) || ['', ''])[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
  const shell = list('SHELL');
  const missing = shell.filter(f => !fs.existsSync(path.join(WEB, f === './' ? 'index.html' : f)));
  const need = ['./index.html', './app.css', './config.js', './js/core/ns.js', './js/core/store.js', './js/core/voice.js', './js/core/sfx.js', './js/core/rewards.js',
    './js/core/billing.js', './js/core/ui.js', './js/content/lessons.js', './js/content/rhymes.js', './js/modules/learn.js', './pay.html', './pay.js',
    './fonts/baloo2-devanagari.woff2', './fonts/baloo2-latin.woff2'];
  const allJs = new Set([...shell, ...list('OPTIONAL')]);
  check('S sw.js: cache nanha-school-v5, shell has the core/learn/pay/fonts and every listed file exists; every js file is cached; pictures and clips never precached',
    sw.includes("const CACHE = 'nanha-school-v5'") && missing.length === 0 && need.every(f => shell.includes(f)) &&
    present.every(f => allJs.has('./' + f)) && !shell.some(f => f.includes('audio/') && f.endsWith('.mp3')) &&
    ![...shell, ...list('OPTIONAL')].some(f => f.includes('img/real/')) && /\\\/img\\\//.test(sw),
    'missing: ' + missing.join(',') + ' uncached: ' + present.filter(f => !allJs.has('./' + f)).join(','));
  const textFiles = fs.readdirSync(WEB).filter(f => /\.(html|js|css|webmanifest)$|^_headers$/.test(f));
  const google = [...textFiles, ...jsFiles].filter(f => /fonts\.googleapis|fonts\.gstatic/.test(read(f)));
  const woff = ['baloo2-devanagari.woff2', 'baloo2-latin.woff2'].every(f => fs.readFileSync(path.join(WEB, 'fonts', f)).subarray(0, 4).toString() === 'wOF2');
  const linkJs = ['js/core/billing.js', 'js/core/ui.js', 'pay.js'].map(read).join('\n');
  const legalLinks = [...new Set([...linkJs.matchAll(/"(legal\/[a-z]+\.html)"/g)].map(m => m[1]))];
  check('S legal pages linked from the app and pay page exist (privacy, terms, refund, contact)',
    ['legal/privacy.html', 'legal/terms.html', 'legal/refund.html', 'legal/contact.html'].every(l => legalLinks.includes(l)) &&
    legalLinks.every(l => fs.existsSync(path.join(WEB, l))), legalLinks.join(','));
  check('S fonts are self-hosted (woff2 + OFL licence), no Google Fonts reference',
    google.length === 0 && woff && read('fonts/OFL.txt').includes('SIL OPEN FONT LICENSE Version 1.1'), google.join(','));
  // The voice-clip key rule is written down in voice.js and ARCHITECTURE.md.
  const arch = fs.readFileSync(path.resolve(WEB, '../docs/ARCHITECTURE.md'), 'utf8');
  check('S voice-clip manifest format documented in voice.js and docs/ARCHITECTURE.md',
    read('js/core/voice.js').includes('"version": 1') && /Voice clips/.test(arch) && arch.includes('"clips"'));
}

// A. Payments not configured: everything free, no banner; the learning tiles are there.
{
  const { ctx, page } = await open({ payments: false });
  const tiles = await page.locator('.tile').count();
  check('A payments off: one tile per registered activity', tiles === await visibleTiles(page) && tiles >= 6, String(tiles));
  check('A payments off: nothing locked', (await locked(page)) === 0);
  check('A payments off: no banner', (await page.locator('.banner').count()) === 0);
  const ids = await page.locator('.tile').evaluateAll(ts => ts.map(t => t.dataset.id));
  check('A learn tiles present (abc, varn, count, world, rhymes, quiz); bedtime tile only at night',
    ['abc', 'varn', 'count', 'world', 'rhymes', 'quiz'].every(i => ids.includes(i)) && !ids.includes('sleep'), ids.join(','));
  const sections = await page.locator('.sect-h').allInnerTexts();
  check('A home tiles are grouped into sections (सीखो first)', sections[0] && sections[0].includes('सीखो'), sections.join('|'));
  await ctx.close();
}

// L/Q/X/V/K. Lessons, quiz, buddy (if present), voices, fonts.
{
  const { ctx, page } = await open({ payments: false });
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].filter(f => f.family.replace(/["']/g, '') === 'Baloo 2').map(f => f.status);
  });
  check('K self-hosted Baloo 2 loads (devanagari + latin)', fonts.length === 2 && fonts.every(s => s === 'loaded'), fonts.join(','));

  await page.locator('.tile[data-id="abc"]').click();
  await page.waitForTimeout(300);
  const first = await page.locator('.card .face.front .big').innerText();
  await page.locator('.navbtn.next').click();
  await page.waitForTimeout(200);
  const second = await page.locator('.card .face.front .big').innerText();
  await page.locator('.card').click();
  await page.waitForTimeout(700);
  const flipped = await page.locator('.card').evaluate(c => c.classList.contains('flipped'));
  const cap = await page.locator('.card .face.back .cap').innerText();
  check('L lesson ABC: A, then B; tapping flips the card to "B for Ball"', first === 'A' && second === 'B' && flipped && cap.includes('Ball'), `${first} ${second} ${flipped} ${cap}`);
  check('L flashcards show progress and a "say it with me" button', (await page.locator('#prog').innerText()).includes('2 / 26') && await page.locator('.saywith').isVisible());
  await page.locator('#backBtn').click();
  await page.waitForTimeout(200);

  await page.locator('.tile[data-id="quiz"]').click();
  await page.waitForTimeout(300);
  const question = await page.locator('.qtext').innerText();
  const want = await page.evaluate(() => NS.learn.quiz.answer.big);
  const right = await page.locator('.opt').evaluateAll((bs, w) => bs.findIndex(b => (b.dataset.big || b.textContent) === w), want);
  await page.locator('.opt').nth(right).click();
  await page.waitForTimeout(200);
  check('Q quiz (age 4–5): 3 choices, the right one earns a star', (await page.locator('.opt').count()) === 3 && (await page.locator('#prog').innerText()).includes('1'),
    `${question} -> ${right}`);
  await page.locator('#backBtn').click();

  const buddy = await page.evaluate(() => !!NS.activity('buddy'));
  if (buddy) {
    let dialogs = 0;
    page.on('dialog', d => { dialogs++; d.dismiss(); });
    await page.evaluate(() => NS.open('buddy'));
    await page.waitForTimeout(600);
    const kbd = page.locator('.bd-kbd');
    if (await kbd.count()) await kbd.first().click();
    const input = page.locator('.act input[type="text"]:visible');
    if (await input.count()) {
      const evil = '<img src=x onerror=alert(1)>';
      await input.first().fill(evil);
      await input.first().press('Enter');
      await page.waitForTimeout(800);
      const imgs = await page.locator('.act img').count();
      const shown = await page.locator('.act').innerText();
      check('X buddy shows <img src=x onerror=alert(1)> as plain text', imgs === 0 && dialogs === 0 && shown.includes(evil), JSON.stringify({ imgs, dialogs }));
    } else check('X buddy opens', (await page.locator('.act').count()) === 1);
    await home(page);
  }

  const voicesOk = await page.evaluate(() => {
    const hiNet = { name: 'Google हिन्दी', lang: 'hi-IN', localService: false };
    const hiLocal = { name: 'Hindi (on device)', lang: 'hi-IN', localService: true };
    const enNet = { name: 'Google US English', lang: 'en-US', localService: false };
    const enLocal = { name: 'English (on device)', lang: 'en_GB', localService: true };
    const pick = (l, g, list) => { const r = NS.voice.pick(l, g, list); return r && r.voice; };
    const preferLocal = pick('hi', 'female', [hiNet, enNet, hiLocal, enLocal]) === hiLocal && pick('en', 'female', [hiNet, enNet, hiLocal, enLocal]) === enLocal;
    const fallback = pick('hi', 'female', [hiNet, enNet]) === hiNet && pick('en', 'female', [hiNet, enNet]) === enNet;
    const noMatch = NS.voice.pick('hi', 'female', [{ name: 'Chinese', lang: 'zh-CN', localService: true }]) === null;
    return { preferLocal, fallback, noMatch };
  });
  check('V speech prefers on-device voices, network voice only as fallback', voicesOk.preferLocal && voicesOk.fallback && voicesOk.noMatch, JSON.stringify(voicesOk));
  const gender = await page.evaluate(() => {
    const lekha = { name: 'Lekha', lang: 'hi-IN', localService: true };
    const hemant = { name: 'Microsoft Hemant - Hindi (India)', lang: 'hi-IN', localService: true };
    const madhurNet = { name: 'Microsoft Madhur Online (Natural) - Hindi (India)', lang: 'hi-IN', localService: false };
    const m = NS.voice.pick('hi', 'male', [lekha, hemant]);
    const f = NS.voice.pick('hi', 'female', [lekha, hemant]);
    const onlyF = NS.voice.pick('hi', 'male', [lekha]);
    const localFirst = NS.voice.pick('hi', 'male', [lekha, madhurNet]);
    return { male: m.voice.name === hemant.name && m.pitchShift === 1, female: f.voice.name === 'Lekha' && f.pitchShift === 1,
      shifted: onlyF.voice.name === 'Lekha' && onlyF.pitchShift === 0.85, localFirst: localFirst.voice.name === 'Lekha' && localFirst.pitchShift === 0.85 };
  });
  check('V voice gender: picks a male/female voice by name, else shifts the pitch (male 0.85)', Object.values(gender).every(Boolean), JSON.stringify(gender));
  const keys = await page.evaluate(() => [NS.voice.clipKey('hinglish', '  🍎 Seb   khao 🙂 '), NS.voice.clipKey('en', 'A for Apple'), NS.voice.clipKey('hi', 'शाबाश! 🌟 नया स्टिकर!')]);
  check('V clip keys: speech lang + "|" + text without emoji, spaces collapsed', JSON.stringify(keys) === JSON.stringify(['hi|Seb khao', 'en|A for Apple', 'hi|शाबाश! नया स्टिकर!']), JSON.stringify(keys));
  const phrases = await page.evaluate(() => NS.voice.phrases(NS.voice.cleanForSpeech('नमस्ते दोस्त! 👋 मैं मिट्ठू हूँ। चलो, खेलें?')));
  check('V speech is split into short phrases and never reads emoji', JSON.stringify(phrases) === JSON.stringify(['नमस्ते दोस्त!', 'मैं मिट्ठू हूँ।', 'चलो,', 'खेलें?']), JSON.stringify(phrases));
  await ctx.close();
}

// VC. Recorded voice clips are played when audio/manifest.json has the line.
{
  const wav = Buffer.alloc(44 + 800);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + 800, 4); wav.write('WAVE', 8); wav.write('fmt ', 12); wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(800, 40);
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 400, height: 820 } });
  await instrument(ctx, csp);
  await ctx.route('**/audio/manifest.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, clips: {
    female: { 'hi|नमस्ते दोस्त!': 'audio/female/hi/0001.mp3' }, male: { 'hi|नमस्ते दोस्त!': 'audio/male/hi/0001.mp3' } } }) }));
  const clipReqs = [];
  await ctx.route('**/audio/*/hi/*.mp3', r => { clipReqs.push(new URL(r.request().url()).pathname); r.fulfill({ contentType: 'audio/wav', body: wav }); });
  await ctx.addInitScript(`if (location.origin === ${JSON.stringify(ORIGIN)}) { ${profilesInit([prof('pa', 'आरव', { voice: 'male' })])} }`);
  const page = await ctx.newPage();
  await page.goto(ORIGIN + '/');
  await page.waitForTimeout(600);
  await page.mouse.click(5, 400);
  await page.evaluate(() => Promise.race([NS.voice.say('👋 नमस्ते   दोस्त!', { lang: 'hi' }), new Promise(r => setTimeout(r, 3000))]));
  check('VC a recorded clip (male voice, key "hi|नमस्ते दोस्त!") is played instead of the synthetic voice', clipReqs.includes('/audio/male/hi/0001.mp3'), clipReqs.join(','));
  await ctx.close();
}

// K. The policy really is enforced: injected inline script and eval are blocked. Inline styles are
//    deliberately allowed (Razorpay's checkout injects them), so they must still apply.
{
  const { ctx, page } = await open({ payments: false, sink: cspControl });
  // eval has to be tried from a real page script (DevTools-evaluated code is exempt from CSP).
  await ctx.route(ORIGIN + '/__csp-probe.js', r => r.fulfill({ contentType: 'text/javascript', body:
    `try { eval('1'); window.__evalRan = true; } catch (e) { window.__evalBlocked = e instanceof EvalError; }
     try { new Function('return 1'); window.__fnRan = true; } catch (e) { window.__fnBlocked = e instanceof EvalError; }` }));
  const r = await page.evaluate(async () => {
    const s = document.createElement('script'); s.textContent = 'window.__inlineRan = 1'; document.head.appendChild(s);
    const st = document.createElement('style'); st.textContent = 'body { background: rgb(1, 2, 3) !important; }'; document.head.appendChild(st);
    const probe = document.createElement('script'); probe.src = '/__csp-probe.js';
    await new Promise(res => { probe.onload = res; probe.onerror = res; document.head.appendChild(probe); });
    const evalBlocked = !window.__evalRan && window.__evalBlocked === true && !window.__fnRan && window.__fnBlocked === true;
    return { ran: !!window.__inlineRan, evalBlocked, bg: getComputedStyle(document.body).backgroundColor };
  });
  await page.waitForTimeout(300);
  const dirs = cspControl.events.map(v => v.directive);
  check('K CSP blocks injected inline script and eval, allows inline styles',
    !r.ran && r.evalBlocked && r.bg === 'rgb(1, 2, 3)' && dirs.includes('script-src-elem') && !dirs.includes('style-src-elem'),
    JSON.stringify({ r, dirs }));
  await ctx.close();
}

// R. Every screen size: no horizontal scroll, no overlapping tiles, big touch targets, labelled buttons.
for (const [w, h] of [[320, 568], [390, 844], [768, 1024], [1366, 768], [844, 390], [2560, 1440]]) {
  const { ctx, page } = await open({ payments: false, viewport: { width: w, height: h }, time: '2026-10-02T12:00:00' });
  const r = await page.evaluate(() => {
    const doc = document.scrollingElement;
    const body = document.getElementById('body');
    const tiles = [...document.querySelectorAll('.tile')].map(t => t.getBoundingClientRect());
    let overlap = 0;
    for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i], b = tiles[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap++;
    }
    const small = [...document.querySelectorAll('button, a[href]')].filter(b => b.offsetParent)
      .map(b => b.getBoundingClientRect()).filter(r => r.width < 48 || r.height < 48).length;
    const tileSmall = tiles.filter(t => t.width < 56 || t.height < 56).length;
    const unlabelled = [...document.querySelectorAll('button')].filter(b => b.offsetParent && !NS.stripEmoji(b.textContent).replace(/[\s◀▶⏹+✕]/g, '') && !b.getAttribute('aria-label')).length;
    const cols = new Set(tiles.filter(t => Math.abs(t.top - tiles[0].top) < 2).map(t => Math.round(t.left))).size;
    return { hscroll: doc.scrollWidth > innerWidth + 1 || body.scrollWidth > body.clientWidth + 1, overlap, small, tileSmall, unlabelled, cols, n: tiles.length };
  });
  check(`R home ${w}×${h}: no horizontal scroll, no overlapping tiles, targets ≥56px (tiles) / ≥48px (all), every icon button labelled`,
    !r.hscroll && r.overlap === 0 && r.small === 0 && r.tileSmall === 0 && r.unlabelled === 0 && r.n > 0, JSON.stringify(r));
  if (w === 320) check('R 320px phone: 2 tile columns', r.cols === 2, String(r.cols));
  if (w === 768) check('R 768px tablet: 4 tile columns', r.cols === 4, String(r.cols));
  await snap(page, `home-${w}x${h}`);
  // An activity must fit too (the arrows stay on screen).
  await page.locator('.tile[data-id="abc"]').click();
  await page.waitForTimeout(700);
  const a = await page.evaluate(() => {
    const next = document.querySelector('.navbtn.next').getBoundingClientRect();
    const body = document.getElementById('body');
    return { hscroll: document.scrollingElement.scrollWidth > innerWidth + 1 || body.scrollWidth > body.clientWidth + 1, nextVisible: next.bottom <= innerHeight + 1 && next.right <= innerWidth + 1 };
  });
  check(`R flashcards ${w}×${h}: fit the screen with the arrows visible`, !a.hscroll && a.nextVisible, JSON.stringify(a));
  if ([320, 768, 844].includes(w)) await snap(page, `abc-${w}x${h}`);
  await ctx.close();
}

// O. First run: a profile made with taps (a grown-up types the name); everything stays on the device.
{
  const { ctx, page } = await open({ payments: false, profile: '', time: '2026-10-02T10:00:00' });
  check('O first run shows the welcome (no profile yet)', await page.locator('.onboard #obStart').isVisible());
  await snap(page, 'onboard-1');
  await page.locator('#obStart').click();
  await page.locator('.choice.av').nth(2).click();
  await page.waitForTimeout(900);
  await page.fill('#obName', 'Aarav');
  await snap(page, 'onboard-name');
  await page.locator('.btn.big.primary').click();
  await page.locator('[data-age="6+"]').click();
  await page.locator('[data-voice="male"]').click();
  await snap(page, 'onboard-voice');
  await page.locator('.ob-stage .btn.big.primary').click();
  await page.locator('[data-lang="en"]').click();
  await page.locator('#obDone').click();
  await page.waitForTimeout(500);
  const p = await page.evaluate(() => JSON.parse(localStorage.getItem('ns_profiles')));
  const me = p.list[0];
  check('O profile saved on the device: name, avatar, age 6+, male voice, English',
    p.list.length === 1 && me.name === 'Aarav' && me.avatar === '🦁' && me.ageBand === '6+' && me.voice === 'male' && me.lang === 'en', JSON.stringify(p));
  check('O home greets the child by name, in English', (await page.locator('.greet-big').innerText()).includes('Aarav') &&
    (await page.locator('.sect-h').first().innerText()).includes('Learn') && (await page.evaluate(() => document.documentElement.lang)) === 'en');
  await page.waitForTimeout(2600);
  await page.locator('.tile[data-id="quiz"]').click();
  await page.waitForTimeout(300);
  check('O age 6+ gets the hardest quiz step (4 choices)', (await page.locator('.opt').count()) === 4);
  await ctx.close();
}

// I. Several children: the picker, and each child's own stickers and progress.
{
  const two = profilesInit([prof('pa', 'आरव'), prof('pb', 'Mira', { avatar: '🦄', ageBand: '2-3' })]);
  const { ctx, page } = await open({ payments: false, profile: two, time: '2026-10-02T16:00:00' });
  check('I two profiles: "कौन खेल रहा है?" picker first', (await page.locator('.pick-card[data-pid]').count()) === 2 && (await page.locator('.pick-h').innerText()).includes('कौन खेल रहा है'));
  await snap(page, 'picker');
  await page.locator('.pick-card[data-pid="pa"]').click();
  await page.locator('.tile[data-id="world"]').click();
  await page.locator('.deck', { hasText: 'आकार' }).click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 6; i++) { await page.locator('.navbtn.next').click(); await page.waitForTimeout(80); }
  await page.waitForTimeout(400);
  check('I finishing a set gives a sticker with a celebration', await page.locator('.celebrate .sticker-pop').isVisible() && (await page.locator('.celebrate .sticker-pop').textContent()).trim() === '⭐');
  await snap(page, 'sticker-celebrate');
  await page.locator('.celebrate').click();
  await home(page);
  await page.locator('.tile[data-id="abc"]').click();
  await page.locator('.navbtn.next').click();
  await page.locator('.navbtn.next').click();
  await home(page);
  check('I home shows the sticker count on the avatar', (await page.locator('.me-stk').innerText()).includes('1'));
  await page.locator('.me').click();
  await page.waitForTimeout(300);
  check('I the sticker book (from the avatar) shows the new sticker', (await page.locator('.stk:not(.empty)').count()) === 1 && (await page.locator('.stk-e').first().textContent()).trim() === '⭐');
  await snap(page, 'sticker-book');
  await page.locator('.btn.big', { hasText: 'खिलाड़ी बदलो' }).click();
  await page.locator('.pick-card[data-pid="pb"]').click();
  await page.locator('.me').click();
  check('I the other child has their own empty sticker book', (await page.locator('.stk:not(.empty)').count()) === 0 && (await page.locator('.book-msg').innerText()).includes('अभी कोई स्टिकर नहीं'));
  await home(page);
  await page.locator('.tile[data-id="abc"]').click();
  await page.waitForTimeout(200);
  const bStart = await page.locator('.card .face.front .big').innerText();
  check('I progress is per child: the second child starts ABC at A (the first stopped at C)', bStart === 'A', bStart);
  await home(page);
  await page.locator('.tile[data-id="quiz"]').click();
  await page.waitForTimeout(200);
  check('I age 2–3 gets the easiest quiz step (2 choices)', (await page.locator('.opt').count()) === 2);
  const keys = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ns_p_')));
  check('I data is namespaced per profile (ns_p_<id>_…)', keys.some(k => k.startsWith('ns_p_pa_')) && keys.every(k => /^ns_p_p[ab]_/.test(k)), keys.join(','));
  await ctx.close();
}

// G/VS. Grown-ups: language switch, voice settings that persist, mic, data deletion.
{
  const { ctx, page } = await open({ payments: false, time: '2026-10-02T11:30:00' });
  await page.locator('.sky-btn[aria-label="बड़ों के लिए"]').click();
  await passGate(page);
  check('VS grown-ups area opens behind the question, with summary, children, voice, time, mic, data', ['#summary', '#profilesCard', '#voiceCard', '#micSwitch', '#delAll'].every(Boolean) &&
    await page.locator('#summary').isVisible() && await page.locator('#voiceCard').isVisible() && await page.locator('#micSwitch').isVisible());
  check('VS mic is off by default and the privacy note says browsers may send audio to their speech service',
    (await page.locator('#micSwitch').getAttribute('aria-checked')) === 'false' && (await page.locator('.parents').innerText()).includes('स्पीच सर्विस'));
  await snap(page, 'parents');
  await page.locator('#voiceCard .seg-b[data-v="male"]').click();
  await page.locator('#voiceCard .seg-b[data-v="slow"]').click();
  await page.locator('#micSwitch').click();
  await page.locator('#segSession .seg-b[data-v="20"]').click();
  check('VS voice preview button ("सुनो") is there', await page.locator('#voiceCard .pbtn', { hasText: 'सुनो' }).isVisible());
  await page.reload();
  await page.waitForTimeout(600);
  const saved = await page.evaluate(() => ({ p: NS.store.current(), s: NS.store.settings() }));
  check('VS voice, speed, mic and session length persist on the device', saved.p.voice === 'male' && saved.s.speed === 'slow' && saved.s.mic === true && saved.s.sessionMin === 20, JSON.stringify(saved));
  await page.locator('.sky-btn[aria-label="बड़ों के लिए"]').click();
  await passGate(page);
  check('VS settings screen shows the saved choices', (await page.locator('#voiceCard .seg-b[data-v="male"]').getAttribute('aria-checked')) === 'true' &&
    (await page.locator('#micSwitch').getAttribute('aria-checked')) === 'true');
  // Language
  await page.locator('#voiceCard .seg-b[data-v="en"]').click();
  await page.waitForTimeout(300);
  check('G switching to English re-renders the grown-ups screen in English', (await page.locator('.ptitle').first().innerText()).includes('For grown-ups'));
  await home(page);
  const en = await page.evaluate(() => ({ sect: document.querySelector('.sect-h').textContent, rhymes: document.querySelector('.tile[data-id="rhymes"] .lb').textContent, lang: document.documentElement.lang }));
  check('G home is in English after the switch (Learn, Rhymes, <html lang=en>)', en.sect.includes('Learn') && en.rhymes === 'Rhymes' && en.lang === 'en', JSON.stringify(en));
  const hl = await page.evaluate(() => { let got = null; NS.on('lang:changed', e => { got = e.lang; }); NS.setLang('hinglish'); return { got, sect: document.querySelector('.sect-h').textContent, saved: NS.store.current().lang }; });
  check('G NS.setLang("hinglish") saves, re-renders and emits lang:changed', hl.got === 'hinglish' && hl.sect.includes('Seekho') && hl.saved === 'hinglish', JSON.stringify(hl));
  await page.evaluate(() => NS.open('rhymes'));
  await page.evaluate(() => NS.setLang('hi'));
  check('G changing language inside an activity keeps it open and updates the title', (await page.locator('.rlist').count()) === 1 && (await page.locator('#scrTitle').innerText()).includes('कविताएँ'));
  // Delete one child's data.
  await home(page);
  await page.evaluate(() => { NS.rewards.grant({ sticker: '🌟', reason: 'test' }, 'quiz'); });
  await page.locator('.celebrate').click();
  await page.locator('.sky-btn[aria-label="बड़ों के लिए"]').click();
  await passGate(page);
  await page.locator('#delProfile').click();
  await page.locator('#delProfileYes').click();
  await page.waitForTimeout(300);
  const left = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ns_p_') || (k === 'ns_profiles' && JSON.parse(localStorage.ns_profiles).list.length > 0)));
  check('VS deleting the only child removes all their data and starts the first-run again', left.length === 0 && await page.locator('.onboard').isVisible(), left.join(','));
  await ctx.close();
}

// AI. The optional AI chat switch (js/core/ai.js) is in the grown-ups' area, before the microphone,
//     off until a grown-up consents, and only when the app has a server (API_BASE).
{
  const withServer = await open({ time: '2026-10-02T11:30:00' });
  const r = await withServer.page.evaluate(() => {
    if (!NS.ai) return { absent: true };
    NS.ui.parents();
    const cards = [...document.querySelectorAll('.parents > .pcard')];
    const ai = cards.findIndex(c => c.id === 'aiCard'), mic = cards.findIndex(c => c.querySelector('#micSwitch'));
    return { configured: NS.ai.configured(), ai, mic, off: document.querySelector('#aiSwitch') && document.querySelector('#aiSwitch').getAttribute('aria-checked') === 'false' };
  });
  await withServer.ctx.close();
  const noServer = await open({ payments: false, time: '2026-10-02T11:30:00' });
  const none = await noServer.page.evaluate(() => { NS.ui.parents(); return document.querySelectorAll('#aiCard').length; });
  await noServer.ctx.close();
  check('AI grown-ups see the AI chat switch (off) before the microphone only when the app has a server',
    r.absent || (r.configured && r.ai >= 0 && r.ai < r.mic && r.off && none === 0), JSON.stringify({ r, none }));
}

// WD. The session winds down gently at the limit (no countdown) and only a grown-up continues.
{
  const { ctx, page } = await open({ payments: false, time: '2026-10-02T10:00:00', init: `localStorage.setItem('ns_settings', JSON.stringify({ sessionMin: 10 }));` });
  await page.evaluate(() => { window.__wd = 0; NS.on('session:wind-down', () => { window.__wd++; }); });
  await page.locator('.tile[data-id="abc"]').click();
  const before = await page.evaluate(() => document.body.innerText);
  await page.clock.runFor(9 * 60000);
  check('WD nothing happens before the limit, and no countdown is ever shown', (await page.locator('.rest').count()) === 0 && !/\d+\s*(मिनट|min)/.test(before) &&
    !/\d+\s*(मिनट|min)/.test(await page.evaluate(() => document.body.innerText)));
  await page.clock.runFor(90000);
  await page.waitForTimeout(200);
  check('WD at the limit: calm break screen with an off-screen idea; session:wind-down emitted', await page.locator('.rest .idea').isVisible() && (await page.evaluate(() => window.__wd)) === 1);
  check('WD minutes used today are counted for the child', (await page.evaluate(() => NS.ui.minutesToday())) >= 10);
  await snap(page, 'wind-down');
  await page.reload();
  await page.waitForTimeout(600);
  check('WD a reload does not skip the break', await page.locator('.rest').isVisible());
  await page.locator('.rest-more').click();
  await passGate(page);
  await page.waitForTimeout(200);
  check('WD after the grown-up\'s answer the child is back home', (await page.locator('.tile').count()) > 0);
  await ctx.close();
}

// N. Night: the sky darkens and "सोने की तैयारी" leads to a lullaby and goodnight.
{
  const { ctx, page } = await open({ payments: false, time: '2026-10-02T21:00:00', viewport: { width: 390, height: 844 } });
  const r = await page.evaluate(() => ({ dp: document.documentElement.dataset.daypart, sky: !!document.querySelector('.sky-night .moon'), greet: document.querySelector('.greet-big').textContent }));
  check('N at 21:00 the app is in night mode with the moon, and greets "शुभ रात्रि"', r.dp === 'night' && r.sky && r.greet.includes('शुभ रात्रि'), JSON.stringify(r));
  check('N the bedtime path is the first, prominent tile', await page.locator('.home-content > .bedtime').first().isVisible());
  await snap(page, 'night-home');
  await page.locator('.bedtime').click();
  await page.waitForTimeout(400);
  check('N bedtime opens the lullaby screen', (await page.locator('.sleep .rline').count()) === 4);
  await snap(page, 'night-lullaby');
  await ctx.close();
  const day = await open({ payments: false, time: '2026-10-02T09:00:00', wait: 400 });
  check('N in the morning: day theme, sun, "सुप्रभात", no bedtime tile', (await day.page.evaluate(() => document.documentElement.dataset.daypart)) === 'morning' &&
    (await day.page.locator('.sky .sun').count()) === 1 && (await day.page.locator('.greet-big').innerText()).includes('सुप्रभात') && (await day.page.locator('.bedtime').count()) === 0);
  await day.ctx.close();
}

// U. Feel and layout. Every screen at phone, tablet, desktop and landscape sizes: no control
//    overlaps, covers, hides or squeezes another (≥ 8px apart, ≥ 48px, nothing floating over
//    content, nothing cut off sideways, no words under a control); install only for grown-ups;
//    sound effects, haptics, expressive voice, realistic pictures, मिट्ठू's reactions, sections,
//    accessibility (contrast, focus, 130% text, reduced motion).
const LAYOUT_PROBE = (kid = false) => {
  const vw = innerWidth, vh = innerHeight;
  const shown = e => {
    const closed = e.closest('details:not([open])');
    if (closed && !(e.closest('summary') && e.closest('summary').parentElement === closed)) return false;   // folded away
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    }
    return true;
  };
  // The part of an element that can actually be seen: its box cut by every clipping ancestor.
  const seen = e => {
    const r = e.getBoundingClientRect();
    let l = r.left, t = r.top, rt = r.right, b = r.bottom;
    for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (/hidden|auto|scroll|clip/.test(cs.overflowX + ' ' + cs.overflowY)) {
        const q = p.getBoundingClientRect();
        l = Math.max(l, q.left); t = Math.max(t, q.top); rt = Math.min(rt, q.right); b = Math.min(b, q.bottom);
      }
    }
    l = Math.max(l, 0); t = Math.max(t, 0); rt = Math.min(rt, vw); b = Math.min(b, vh);
    return { left: l, top: t, right: rt, bottom: b, w: rt - l, h: b - t, raw: r };
  };
  const name = e => {
    const c = typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    const t = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + c + (t ? ' "' + t + '"' : '');
  };
  const hit = (a, b, tol = 1) => a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;
  const related = (a, b) => a === b || a.contains(b) || b.contains(a);
  const SEL = 'button, a[href], input, select, textarea, summary, [role=button], [role=radio], [role=switch], [role=tab]';
  let ctl = [...document.querySelectorAll(SEL)].filter(e => shown(e) && e.getBoundingClientRect().width > 0);
  ctl = ctl.filter(e => !ctl.some(o => o !== e && o.contains(e)));          // the outermost control only
  const vis = ctl.map(e => ({ e, s: seen(e) })).filter(x => x.s.w > 1 && x.s.h > 1);
  const out = { overlap: [], tight: [], covered: [], clipped: [], floating: [], textUnder: [], small: [] };
  const celebrating = !!document.querySelector('.celebrate');
  for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) {
    const a = vis[i], b = vis[j];
    if (related(a.e, b.e)) continue;
    if (hit(a.s, b.s)) { out.overlap.push(name(a.e) + ' × ' + name(b.e)); continue; }
    const ra = a.s, rb = b.s;
    const gap = Math.max(Math.max(ra.left, rb.left) - Math.min(ra.right, rb.right), Math.max(ra.top, rb.top) - Math.min(ra.bottom, rb.bottom));
    if (gap < 7.5 && !a.e.closest('.celebrate') && !b.e.closest('.celebrate')) out.tight.push(name(a.e) + ' ~ ' + name(b.e) + ' ' + Math.round(gap) + 'px');
  }
  for (const { e, s } of vis) {
    const r = s.raw;
    // cut off sideways (by the screen or by a container) — scrolling up/down is fine
    if (r.left < -1 || r.right > vw + 1) out.clipped.push(name(e));
    else {
      for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (/hidden|clip/.test(cs.overflowX)) { const q = p.getBoundingClientRect(); if (r.left < q.left - 1 || r.right > q.right + 1) { out.clipped.push(name(e) + ' in ' + name(p)); break; } }
      }
    }
    // ≥ 48px everywhere (text links too); ≥ 56px on children's screens, except inside the grown-ups' corners.
    const min = kid && !e.closest('.install-card') ? 55.5 : 47.5;
    if (r.width < min || r.height < min) out.small.push(name(e) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
    if (!celebrating) {
      const cx = (s.left + s.right) / 2, cy = (s.top + s.bottom) / 2;
      const t = document.elementFromPoint(cx, cy);
      if (t && !related(e, t)) out.covered.push(name(e) + ' under ' + name(t));
    }
  }
  // Anything fixed or sticky must not sit on a control (the celebration layer is a full-screen modal).
  for (const f of document.querySelectorAll('body *')) {
    const p = getComputedStyle(f).position;
    if ((p !== 'fixed' && p !== 'sticky') || f.classList.contains('celebrate') || f.closest('.celebrate') || !shown(f)) continue;
    const rf = f.getBoundingClientRect();
    for (const { e, s } of vis) if (!related(f, e) && hit(rf, s)) out.floating.push(name(f) + ' over ' + name(e));
  }
  // Words under a control (e.g. a greeting under the mascot button).
  for (const t of document.querySelectorAll('.app h1, .app h2, .app h3, .app p')) {
    if (!shown(t) || !t.textContent.trim()) continue;
    const st = seen(t);
    if (st.w <= 1 || st.h <= 1) continue;
    for (const { e, s } of vis) if (!related(t, e) && hit(st, s, 3)) out.textUnder.push(name(t) + ' under ' + name(e));
  }
  const body = document.getElementById('body');
  if (document.scrollingElement.scrollWidth > vw + 1 || (body && body.scrollWidth > body.clientWidth + 1)) out.hscroll = true;
  for (const k in out) if (Array.isArray(out[k]) && !out[k].length) delete out[k];
  return out;
};
// Measure the settled screen: entrance springs (finite animations) are allowed to finish first, so a
// tile caught mid-bounce is not mistaken for an overlap. Looping animations (breathing) keep running.
const settle = page => page.evaluate(() => Promise.race([
  Promise.all(document.getAnimations().filter(a => { const t = a.effect && a.effect.getComputedTiming(); return t && t.iterations !== Infinity && a.playState === 'running'; })
    .map(a => a.finished.catch(() => {}))),
  new Promise(r => setTimeout(r, 2500))]));
const layoutIssues = async (page, kid = false) => { await settle(page); return page.evaluate(LAYOUT_PROBE, kid); };
const fakeInstallPrompt = page => page.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => { window.__installPrompted = (window.__installPrompted || 0) + 1; };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
});
const toBottom = page => page.evaluate(() => { const b = document.getElementById('body'); b.scrollTop = b.scrollHeight; });
const warnings = [];                              // other agents' screens: cramped spacing is reported, not failed
const CORE_ACTS = ['abc', 'varn', 'count', 'world', 'rhymes', 'quiz', 'sleep'];
const STICKERS3 = `localStorage.setItem('ns_p_pa_core', JSON.stringify({ stickers: [{ s: '⭐', r: 'x', a: 'abc', t: Date.now() }, { s: '🎵', r: 'x', a: 'rhymes', t: Date.now() }, { s: '🏆', r: 'x', a: 'quiz', t: Date.now() }] }));`;
{
  const sizes = [[320, 568], [360, 740], [390, 844], [768, 1024], [1366, 768], [844, 390]];
  for (const [w, h] of sizes) {
    const { ctx, page } = await open({ payments: false, viewport: { width: w, height: h }, time: '2026-10-02T12:00:00', init: STICKERS3 });
    await fakeInstallPrompt(page);
    const bad = [];
    let screens = 0;
    const look = async (what, wait = 550, moduleScreen = false, kid = true) => {
      await page.waitForTimeout(wait);
      screens++;
      const r = await layoutIssues(page, kid);
      if (SHOTS) await snap(page, `u-${w}x${h}-${String(screens).padStart(2, '0')}-${what.replace(/[^\w]+/g, '-')}`);
      if (moduleScreen) {
        const soft = {};
        for (const k of ['tight', 'small']) if (r[k]) { soft[k] = r[k]; delete r[k]; }
        if (Object.keys(soft).length) warnings.push(`${w}×${h} ${what} ${JSON.stringify(soft)}`);
      }
      if (Object.keys(r).length) bad.push(what + ' ' + JSON.stringify(r));
    };
    await home(page); await look('home');
    await toBottom(page); await look('home (bottom)', 350);
    const ids = await page.evaluate(() => NS.activities().map(a => a.id));
    for (const id of ids) { await page.evaluate(i => NS.open(i), id); await look('activity ' + id, 800, !CORE_ACTS.includes(id)); }
    await page.evaluate(() => NS.open('world')); await page.waitForTimeout(300); await page.locator('.deck').first().click(); await look('picture deck');
    await page.evaluate(() => NS.open('rhymes')); await page.waitForTimeout(300); await page.locator('.rbtn').first().click(); await look('rhyme player');
    await page.evaluate(() => NS.open('count')); await page.waitForTimeout(300); await page.locator('.card').click(); await look('counting card (back)', 900);
    await page.evaluate(() => NS.open('quiz')); await page.waitForTimeout(400);
    const wrongAt = await page.locator('.opt').evaluateAll(bs => bs.findIndex(b => b.dataset.big !== NS.learn.quiz.answer.big));
    await page.locator('.opt').nth(wrongAt).click(); await look('quiz (after a wrong answer)');
    await page.evaluate(() => NS.ui.stickerBook()); await look('sticker book');
    await page.evaluate(() => NS.ui.parents()); await look('grown-ups', 550, false, false);
    await toBottom(page); await look('grown-ups (bottom)', 350, false, false);
    await page.evaluate(() => NS.billing.gate(() => {})); await look('grown-ups question', 550, false, false);
    await page.evaluate(() => NS.ui.picker()); await look('picker');
    await page.evaluate(() => NS.ui.onboarding()); await look('first run');
    await page.locator('#obStart').click(); await look('first run: avatars');
    await page.locator('.choice.av').first().click(); await page.waitForTimeout(800); await look('first run: name');
    await page.locator('.ob-stage .btn.secondary').click(); await look('first run: age');
    await page.locator('[data-age="4-5"]').click(); await page.waitForTimeout(400); await page.locator('[data-voice="female"]').click(); await look('first run: voice');
    await page.locator('.ob-stage .btn.primary').click(); await page.locator('[data-lang="hi"]').click(); await look('first run: language');
    await page.evaluate(() => NS.ui.windDown()); await look('wind-down', 550, false, false);
    check(`U layout ${w}×${h}: ${screens} screens — no overlapping, covered, cramped, clipped or floating controls, no horizontal scroll`, bad.length === 0, bad.join(' | ').slice(0, 3000));
    await ctx.close();
  }
  // Night home, the paywall and the celebration, on a phone and in landscape.
  for (const [w, h] of [[360, 740], [844, 390]]) {
    const night = await open({ payments: false, viewport: { width: w, height: h }, time: '2026-10-02T21:00:00' });
    const n1 = await layoutIssues(night.page, true);
    await night.page.evaluate(() => NS.open('sleep')); await night.page.waitForTimeout(800);
    const n2 = await layoutIssues(night.page, true);
    await night.ctx.close();
    const pay = await open({ viewport: { width: w, height: h }, init: EXPIRED, time: '2026-10-02T12:00:00' });
    const p1 = await layoutIssues(pay.page, true);
    await pay.page.evaluate(() => NS.billing.paywall()); await pay.page.waitForTimeout(700);
    const p2 = await layoutIssues(pay.page);
    await pay.page.evaluate(() => NS.rewards.celebrate('🌟')); await pay.page.waitForTimeout(500);
    const covered = await pay.page.evaluate(() => { const c = document.querySelector('.celebrate').getBoundingClientRect(); return c.left <= 0 && c.top <= 0 && c.right >= innerWidth && c.bottom >= innerHeight; });
    await pay.ctx.close();
    check(`U layout ${w}×${h}: night home, bedtime, locked home and paywall are clean; the celebration covers the whole screen`,
      [n1, n2, p1, p2].every(r => Object.keys(r).length === 0) && covered, JSON.stringify({ n1, n2, p1, p2 }).slice(0, 2000));
  }
}

// U. Install: only for grown-ups, never floating, never on activities, the Android shell or once installed.
{
  const { ctx, page } = await open({ payments: false, viewport: { width: 390, height: 844 } });
  check('U install: nothing about installing until the browser offers it (and no floating #installBtn)', (await page.locator('.install-card, #installBtn').count()) === 0);
  await fakeInstallPrompt(page);
  const r = await page.evaluate(() => {
    const c = document.querySelector('.home-content > .install-card');
    const fixed = [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed').length;
    return { there: !!c, last: !!c && c.parentElement.lastElementChild === c, afterTiles: !!c && !!c.previousElementSibling, pos: c && getComputedStyle(c).position, fixed };
  });
  check('U install: a quiet card at the very end of home, below the tiles, in the page flow (nothing fixed)', r.there && r.last && r.afterTiles && r.pos === 'static' && r.fixed === 0, JSON.stringify(r));
  await page.locator('.install-card .install-go').click();
  check('U install: the home card asks the grown-ups\' question first', await page.locator('#gateAnswer').isVisible() && !(await page.evaluate(() => window.__installPrompted)));
  await passGate(page);
  await page.waitForTimeout(200);
  check('U install: after the right answer the browser\'s install prompt opens and the card goes away', (await page.evaluate(() => window.__installPrompted)) === 1 && (await page.locator('.install-card').count()) === 0);
  await fakeInstallPrompt(page);
  await page.locator('.tile[data-id="abc"]').click();
  await page.waitForTimeout(300);
  check('U install: never on an activity screen', (await page.locator('.install-card').count()) === 0);
  await page.evaluate(() => NS.ui.parents());
  check('U install: offered in the grown-ups\' area', await page.locator('#installCardParents .install-go').isVisible());
  await home(page);
  await page.locator('.home .install-card .install-x').click();
  await page.reload(); await page.waitForTimeout(500); await fakeInstallPrompt(page);
  check('U install: "अभी नहीं" hides the home card for good', (await page.locator('.home .install-card').count()) === 0 && (await page.evaluate(() => NS.store.settings().installHide)) === true);
  await ctx.close();
}
{
  const standalone = `const mm = window.matchMedia.bind(window); window.matchMedia = q => /display-mode:\\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } : mm(q);`;
  const { ctx, page } = await open({ payments: false, init: standalone });
  await fakeInstallPrompt(page);
  await page.evaluate(() => NS.ui.parents());
  check('U install: never once the app is installed (standalone)', (await page.locator('.install-card').count()) === 0 && !(await page.evaluate(() => NS.ui.install.available())));
  await ctx.close();
}

// U. Sound effects, haptics and expressive speech (Android shell stub records vibrate and speak).
{
  const shell = `window.__vib = []; window.__spoken = [];
    window.NanhaNative = { platform: () => 'android', voices: () => '[]', stop: () => {}, listen: () => {}, openExternal: () => true, secure: () => {},
      speak: (id, text) => { window.__spoken.push(text); setTimeout(() => window.NS.native.onEvent(JSON.stringify({ type: 'speak-done', id })), 5); },
      vibrate: k => { window.__vib.push(k); return true; } };`;
  const { ctx, page } = await open({ payments: false, init: shell });
  await fakeInstallPrompt(page);
  await page.evaluate(() => NS.ui.parents());
  check('U install: never inside the Android shell', (await page.locator('.install-card').count()) === 0 && !(await page.evaluate(() => NS.ui.install.available())));
  await home(page);
  const hv = await page.evaluate(() => { window.__vib = []; NS.sfx.play('correct'); NS.sfx.play('tryagain'); return window.__vib.slice(); });
  await page.locator('.tile[data-id="abc"]').click();
  const tapV = await page.evaluate(() => window.__vib.slice());
  await page.evaluate(() => { NS.store.setSetting('sound', false); window.__vib = []; NS.sfx.play('correct'); NS.sfx.haptic('tap'); });
  const mutedV = await page.evaluate(() => window.__vib.length);
  await page.evaluate(() => { NS.store.setSetting('sound', true); NS.store.setSetting('sfx', false); window.__vib = []; NS.sfx.play('sparkle'); });
  const offV = await page.evaluate(() => window.__vib.length);
  check('U haptics: sounds pair with NanhaNative.vibrate (correct → success, tryagain → soft, a tap → tap); none when muted or switched off',
    JSON.stringify(hv) === '["success","soft"]' && tapV.includes('tap') && mutedV === 0 && offV === 0, JSON.stringify({ hv, tapV, mutedV, offV }));
  await page.evaluate(() => NS.store.setSetting('sfx', true));
  await home(page);
  await page.evaluate(() => { window.__spoken = []; return NS.voice.say('चलो, खेलें? हाँ, 3 बार! 🎉', { lang: 'hi' }); });
  const spoken = await page.evaluate(() => window.__spoken.slice());
  check('U voice: whole sentences go to the engine (commas stay inside), numbers in Hindi words, no emoji',
    JSON.stringify(spoken) === JSON.stringify(['चलो, खेलें?', 'हाँ, तीन बार!']), JSON.stringify(spoken));
  await ctx.close();
}
{
  const { ctx, page } = await open({ payments: false });
  const r = await page.evaluate(() => ({ names: NS.sfx.names, all: NS.sfx.names.map(n => NS.sfx.play(n)), unknown: NS.sfx.play('boom') }));
  check('U sfx: NS.sfx.play synthesises tap pop correct tryagain sparkle whoosh flip open close (no audio files)',
    ['tap', 'pop', 'correct', 'tryagain', 'sparkle', 'whoosh', 'flip', 'open', 'close'].every(n => r.names.includes(n)) && r.all.every(Boolean) && r.unknown === false, JSON.stringify(r));
  const off = await page.evaluate(() => {
    NS.store.setSetting('sound', false); const a = NS.sfx.play('correct');
    NS.store.setSetting('sound', true); NS.store.setSetting('sfx', false); const b = NS.sfx.play('sparkle');
    NS.store.setSetting('sfx', true); return [a, b, NS.sfx.enabled()];
  });
  check('U sfx: silent when the 🔊 mute is on or a grown-up turned sound effects off', off[0] === false && off[1] === false && off[2] === true, JSON.stringify(off));
  await page.evaluate(() => NS.ui.parents());
  await page.locator('#sfxSwitch').click();
  check('U sfx: the grown-ups\' "आवाज़ें (sound effects)" switch is saved on the device', (await page.evaluate(() => NS.store.settings().sfx)) === false &&
    (await page.locator('#sfxCard').innerText()).includes('आवाज़ें') && (await page.locator('#sfxSwitch').getAttribute('aria-checked')) === 'false');
  await page.locator('#sfxSwitch').click();
  await home(page);
  await page.evaluate(() => { window.__sfx = []; const p = NS.sfx.play; NS.sfx.play = n => { window.__sfx.push(n); return p(n); }; });
  await page.locator('.tile[data-id="quiz"]').click();
  await page.waitForTimeout(400);
  const wrongAt = await page.locator('.opt').evaluateAll(bs => bs.findIndex(b => b.dataset.big !== NS.learn.quiz.answer.big));
  await page.locator('.opt').nth(wrongAt).click();
  const tilted = await page.evaluate(() => document.querySelector('.mascot-q').classList.contains('r-tilt'));
  const rightAt = await page.locator('.opt').evaluateAll(bs => bs.findIndex(b => b.dataset.big === NS.learn.quiz.answer.big));
  await page.locator('.opt').nth(rightAt).click();
  const nodded = await page.evaluate(() => document.querySelector('.mascot-q').classList.contains('r-nod'));
  const played = await page.evaluate(() => window.__sfx.slice());
  check('U sfx + मिट्ठू: a tile pops, the activity whooshes in; a wrong answer gets a soft "hmm" and a head tilt, a right one a chime and a nod',
    ['pop', 'whoosh', 'tryagain', 'correct'].every(n => played.includes(n)) && tilted && nodded, JSON.stringify({ played, tilted, nodded }));
  const wrongOpt = await page.evaluate(() => { const o = document.querySelector('.opt.wrong'); return o ? Number(getComputedStyle(o).opacity) : null; });
  check('U quiz: a wrong choice visibly fades', wrongOpt !== null && wrongOpt < 0.6, String(wrongOpt));
  const v = await page.evaluate(() => ({
    a: NS.voice.speakable('तुम्हारे पास 4 स्टिकर हैं! ✓ ▶ 🌟', 'hi'), b: NS.voice.speakable('2–3 साल', 'hi'), c: NS.voice.speakable('You have 26 stickers ★', 'en'),
    d: [99, 100, 1234, 26].map(n => NS.voice.hindiNumber(n)),
    q: NS.voice.prosody('क्या खेलें?'), s: NS.voice.prosody('यह एक सेब है।'), p: NS.voice.prosody('शाबाश! बहुत बढ़िया!'), i: NS.voice.prosody('लाल वाला दबाओ।'),
    steady: NS.voice.prosody('मछली जल की रानी है', { rate: 0.72 }),
    vary: new Set(Array.from({ length: 8 }, () => NS.voice.prosody('यह एक सेब है।').pitch.toFixed(5))).size,
  }));
  check('U voice: symbols never read; ranges and numbers said in Hindi words (4 → चार, 2–3 → दो से तीन, 1234)',
    v.a === 'तुम्हारे पास चार स्टिकर हैं!' && v.b === 'दो से तीन साल' && v.c === 'You have 26 stickers' &&
    JSON.stringify(v.d) === JSON.stringify(['निन्यानबे', 'एक सौ', 'एक हज़ार दो सौ चौंतीस', 'छब्बीस']), JSON.stringify(v));
  check('U voice: questions rise, praise is warmer and quicker, instructions calmer, songs keep a steady rate, repeated lines vary',
    v.q.kind === 'question' && v.p.kind === 'praise' && v.i.kind === 'instruction' && v.s.kind === 'statement' && v.q.pitch > v.s.pitch &&
    v.p.rate > v.i.rate && v.p.pitch > v.s.pitch && Math.abs(v.steady.rate - 0.72) < 0.01 && v.vary > 1, JSON.stringify(v));
  await ctx.close();
}

// U. Realistic pictures (js/content/images.js), with the emoji as the fallback.
{
  const { ctx, page } = await open({ payments: false });
  const hasImages = await page.evaluate(() => typeof NS.img === 'function' && !!NS.img('🌍') && !!NS.img('🐄') && !!NS.img('🍎'));
  if (hasImages) {
    const attrs = sel => page.evaluate(q => { const i = document.querySelector(q); return i && { w: i.getAttribute('width'), h: i.getAttribute('height'), alt: i.alt, loading: i.loading, decoding: i.decoding, src: i.getAttribute('src') }; }, sel);
    const good = a => a && a.w === '192' && a.h === '192' && a.alt.length > 0 && a.loading === 'lazy' && a.decoding === 'async' && /^img\/real\/[\w-]+\.webp$/.test(a.src);
    const tile = await attrs('.tile[data-id="world"] .ic img');
    check('U pictures: home tiles show the realistic picture (width/height, alt, lazy, async, same-origin)', good(tile), JSON.stringify(tile));
    await page.evaluate(() => NS.open('world'));
    await page.locator('.deck', { hasText: 'जानवर' }).click();
    await page.waitForTimeout(500);
    const front = await attrs('.card .face.front .big img');
    check('U pictures: picture cards show the realistic image with alt text', good(front), JSON.stringify(front));
    await page.evaluate(() => NS.open('world'));
    await page.locator('.deck', { hasText: 'रंग' }).click();
    await page.waitForTimeout(500);
    const pair = await attrs('.card .face.front .pair img');
    check('U pictures: colour cards show a real thing of that colour next to the swatch (लाल → 🍅)', good(pair) && (await page.locator('.card .face.front .pair').textContent()).includes('🍅'), JSON.stringify(pair));
    await page.evaluate(() => NS.open('count'));
    await page.waitForTimeout(300);
    for (let i = 0; i < 2; i++) { await page.locator('.navbtn.next').click(); await page.waitForTimeout(150); }
    await page.locator('.card').click();
    await page.waitForTimeout(700);
    const many = await page.locator('.card .face.back .pic-many img').count();
    check('U pictures: counting cards show one picture per thing (3 → three pictures)', many === 3, String(many));
    await page.evaluate(() => NS.open('quiz'));
    await page.waitForTimeout(400);
    const q = await page.evaluate(() => {
      const a = NS.learn.quiz.answer;
      const opts = [...document.querySelectorAll('.opt')];
      return { pics: opts.filter(o => o.querySelector('img, .swatch, svg.shape')).length, n: opts.length, kinds: opts.map(o => o.dataset.big) };
    });
    check('U pictures: quiz choices show pictures when there are pictures', q.pics > 0 || q.kinds.every(k => !/\p{Extended_Pictographic}/u.test(k)), JSON.stringify(q));
    const art = await page.evaluate(() => {
      const out = {};
      for (let i = 0; i < 80 && Object.keys(out).length < 2; i++) {
        NS.open('quiz');
        const a = NS.learn.quiz.answer;
        if (a.deck !== 'colors' && a.deck !== 'shapes') continue;
        const opts = [...document.querySelectorAll('.opt')];
        out[a.deck] = opts.every(o => o.querySelector(a.deck === 'colors' ? '.swatch' : 'svg.shape') && o.getAttribute('aria-label'));
      }
      NS.ui.stickerBook();
      return out;
    });
    check('U quiz: colour choices are painted swatches and shape choices drawn shapes (same on every phone), each with a name', art.colors === true && art.shapes === true, JSON.stringify(art));
    const colourQ = await page.evaluate(() => {
      const pool = NS.learn.quizPool(NS.learn.quizLevels['6+']);
      const colours = new Set(pool.filter(x => x.deck === 'colors').map(x => x.big));
      let mixed = 0;
      for (let i = 0; i < 60; i++) {
        NS.open('quiz');
        const a = NS.learn.quiz.answer;
        const shown = [...document.querySelectorAll('.opt')].map(o => o.dataset.big);
        if (colours.has(a.big) && shown.some(b => !colours.has(b))) mixed++;
        if (!colours.has(a.big) && a.deck !== 'shapes' && shown.some(b => colours.has(b))) mixed++;
      }
      return mixed;
    });
    check('U quiz: a colour question only shows colours (never a red apple next to "लाल कहाँ है?")', colourQ === 0, String(colourQ));
    await ctx.close();
    const broken = await open({ payments: false });
    await broken.ctx.route('**/img/real/**', r => r.fulfill({ status: 404, body: '' }));
    await broken.page.evaluate(() => NS.open('world'));
    await broken.page.locator('.deck', { hasText: 'जानवर' }).click();
    await broken.page.waitForTimeout(800);
    const fb = await broken.page.evaluate(() => { const b = document.querySelector('.card .face.front .big'); const e = b.querySelector('.pic-emo'); return { imgs: b.querySelectorAll('img').length, emoji: e && !e.hidden && e.textContent }; });
    check('U pictures: if a picture cannot load, the emoji shows instead', fb.imgs === 0 && fb.emoji === '🐄', JSON.stringify(fb));
    await broken.ctx.close();
  } else {
    check('U pictures: without js/content/images.js the emoji are shown', (await page.locator('.tile img').count()) === 0);
    await ctx.close();
  }
}

// U. मिट्ठू, sections, accessibility.
{
  const { ctx, page } = await open({ payments: false, viewport: { width: 360, height: 740 }, time: '2026-10-02T12:00:00' });
  const m = await page.evaluate(() => {
    const svg = document.querySelector('.mascot-home');
    NS.mascot.react(svg, 'nod'); const nod = svg.classList.contains('r-nod');
    NS.mascot.react(svg, 'tilt'); const tilt = svg.classList.contains('r-tilt');
    NS.mascot.look(svg, 0, innerHeight); const lx = parseFloat(svg.style.getPropertyValue('--lx'));
    return { nod, tilt, lx, anim: getComputedStyle(svg.querySelector('.m-all')).animationName };
  });
  check('U मिट्ठू breathes, looks toward a tap and reacts (nod, tilt)', m.nod && m.tilt && m.lx < 0 && /breathe/.test(m.anim), JSON.stringify(m));
  const secs = await page.evaluate(() => ({ list: NS.SECTIONS.slice(), shown: [...document.querySelectorAll('.home .sect')].map(s => (s.className.match(/sect-(\w+)/) || [])[1]) }));
  check('U sections: सीखो → अच्छी आदतें → खेलो → कल की दुनिया, in that order',
    JSON.stringify(secs.list) === '["learn","grow","play","future"]' && secs.shown.every((x, i) => i === 0 || secs.list.indexOf(x) > secs.list.indexOf(secs.shown[i - 1])), JSON.stringify(secs));
  await page.evaluate(() => NS.registerActivity({ id: 'zzfuture', icon: '🔭', title: { hi: 'कल', en: 'Tomorrow' }, color: '#3D9BE9', section: 'future', open() {} }));
  check('U a "future" activity gets a tile under कल की दुनिया', await page.locator('.sect-future .tile[data-id="zzfuture"]').isVisible() &&
    (await page.locator('.sect-future .sect-h').innerText()).includes('कल की दुनिया'));
  // Contrast (AA) of the words a child or parent reads.
  const contrast = await page.evaluate(() => {
    const parse = c => {
      let m = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (m) return [m[1] / 255, m[2] / 255, m[3] / 255, m[4] == null ? 1 : +m[4]];
      m = c.match(/color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+))?\)/);
      if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
      return null;
    };
    const lum = ([r, g, b]) => { const f = v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = e => { for (let x = e; x; x = x.parentElement) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c[3] > 0.5) return c; } return [1, 1, 1, 1]; };
    const ratio = e => { const a = lum(parse(getComputedStyle(e).color)), b = lum(bgOf(e)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const out = [];
    const need = (sel, min) => document.querySelectorAll(sel).forEach(e => { if (e.offsetParent && e.textContent.trim()) { const r = ratio(e); if (r < min) out.push(sel + ' "' + e.textContent.trim().slice(0, 16) + '" ' + r.toFixed(2)); } });
    need('.tile .lb', 4.5); need('.sect-h', 4.5); need('.greet-sub', 4.5); need('.me-name', 4.5);
    NS.open('abc'); need('.topbar .title-t', 4.5); need('.taphint', 4.5); need('.chip', 4.5); need('.navbtn.next', 3);
    NS.ui.parents(); need('.psmall', 4.5); need('.plabel', 4.5); need('.pcard-h', 4.5); need('.pbtn', 4.5); need('.seg-b', 4.5);
    NS.home();
    return out;
  });
  check('U contrast: tile labels, headings, bubbles, hints and grown-ups\' text meet WCAG AA', contrast.length === 0, contrast.join(' | '));
  await page.keyboard.press('Tab');
  const focus = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { tag: a.tagName, style: cs.outlineStyle, w: parseFloat(cs.outlineWidth) }; });
  check('U keyboard focus is clearly visible', focus.tag === 'BUTTON' && focus.style === 'solid' && focus.w >= 3, JSON.stringify(focus));
  await page.evaluate(() => { document.documentElement.style.fontSize = '130%'; NS.home(); });
  const big1 = await layoutIssues(page, true);
  await page.evaluate(() => NS.open('abc')); await page.waitForTimeout(600);
  const big2 = await layoutIssues(page, true);
  await page.evaluate(() => NS.ui.parents()); await page.waitForTimeout(400);
  const big3 = await layoutIssues(page);
  check('U text scaled to 130%: home, flashcards and grown-ups still fit with nothing overlapping', [big1, big2, big3].every(r => Object.keys(r).length === 0), JSON.stringify({ big1, big2, big3 }).slice(0, 1500));
  await ctx.close();
  const calm = await open({ payments: false, motion: 'reduce' });
  const rm = await calm.page.evaluate(() => ({ mascot: getComputedStyle(document.querySelector('.mascot-home .m-all')).animationName, cloud: getComputedStyle(document.querySelector('.cloud')).animationName }));
  check('U reduced motion: मिट्ठू and the clouds stay still', rm.mascot === 'none' && rm.cloud === 'none', JSON.stringify(rm));
  await calm.ctx.close();
}

// B. First day: full access, trial banner.
{
  const { ctx, page } = await open();
  check('B fresh: nothing locked', (await locked(page)) === 0);
  const banner = await page.locator('.banner').innerText();
  check('B fresh: banner shows 7 days left', banner.includes('7 दिन बाकी'), banner);
  await ctx.close();
}

// C. Trial over: locks, gate, paywall, subscribe.
let token;
let subId;
let restoreCode;
{
  const { ctx, page } = await open({ init: EXPIRED });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  const exp = await expectedLocked(page);
  check('C expired: every non-free activity is locked', (await locked(page)) === exp && exp >= 2, `${await locked(page)} vs ${exp}`);
  const freeLocked = await page.locator('.tile.locked[data-id="abc"], .tile.locked[data-id="varn"], .tile.locked[data-id="count"], .tile.locked[data-id="rhymes"]').count();
  check('C expired: ABC, अक्षर, गिनती and the rhymes tile stay free', freeLocked === 0);
  await snap(page, 'pay-home-locked');
  await page.locator('.tile[data-id="rhymes"]').click();
  check('C expired: 2 rhymes free, 7 locked', (await page.locator('.rbtn.locked').count()) === 7 && (await page.locator('.rbtn:not(.locked)').count()) === 2);
  await page.locator('#backBtn').click();

  await page.locator('.tile[data-id="world"]').click();
  check('C locked tile opens the grown-ups gate', await page.locator('#gateAnswer').isVisible());
  await snap(page, 'pay-gate');
  await page.fill('#gateAnswer', '1');
  await page.locator('.pbtn', { hasText: 'आगे' }).click();
  check('C wrong gate answer is refused', (await page.locator('.pmsg').innerText()).includes('सही नहीं'));
  await page.waitForTimeout(1100);
  await passGate(page);
  check('C right answer shows the paywall', await page.locator('.pbtn', { hasText: 'सब्सक्राइब' }).isVisible());
  check('C paywall shows the price, and only the monthly plan when no yearly plan is configured', (await page.locator('.price').innerText()).includes('₹99') && (await page.locator('.plan').count()) === 0);
  const trust = await page.locator('.trust li').allInnerTexts();
  check('C paywall trust badges: no ads, data stays on the phone, cancel any time, 7 days free',
    trust.length === 4 && ['कोई विज्ञापन नहीं', 'फ़ोन से बाहर नहीं जाता', 'कभी भी रद्द करें', '7 दिन मुफ़्त'].every((t, i) => trust[i].includes(t)), trust.join('|'));
  check('C paywall has exactly one primary button', (await page.locator('.panel .pbtn.primary').count()) === 1);
  const panelText = await page.locator('.panel').innerText();
  check('C paywall asks for no email or phone, and says contact details stay with Razorpay',
    (await page.locator('.panel input').count()) === 0 && panelText.includes('सिर्फ़ उसी पेज पर') && panelText.includes('कभी नहीं आती'));
  const legal = await page.locator('.plegal a').evaluateAll(as => as.map(a => [a.getAttribute('href'), a.textContent, a.target]));
  check('C paywall links to the privacy, terms and refund pages (same tab), and they exist',
    JSON.stringify(legal) === JSON.stringify([['legal/privacy.html', 'गोपनीयता नीति', ''], ['legal/terms.html', 'नियम और शर्तें', ''],
      ['legal/refund.html', 'रद्द करना और रिफ़ंड', '']]) &&
    legal.every(([href]) => fs.existsSync(path.join(WEB, href))), JSON.stringify(legal));
  await snap(page, 'pay-paywall');

  await page.locator('.pbtn', { hasText: 'सब्सक्राइब' }).click();
  await page.locator('#restoreCodeOut').waitFor({ timeout: 5000 });
  restoreCode = await page.locator('#restoreCodeOut').innerText();
  const co = await page.evaluate(() => window.__checkout);
  subId = co.subscription_id;
  check('C paying shows the thank-you screen with a restore code', restoreCode.startsWith(subId + '.') && /^sub_\w+\.[\w-]{16}$/.test(restoreCode), restoreCode);
  check('C thank-you screen explains the restore code holds no personal data', (await page.locator('.panel').innerText()).includes('इसमें आपकी कोई निजी जानकारी नहीं है'));
  check('C checkout got the key id and no prefilled contact details', co.key === 'rzp_test_key12345' && co.prefill === undefined, JSON.stringify(co));
  check('C no trial left, so billing starts now', subs.get(subId).start_at === null);
  const subBody = JSON.parse(apiBodies.filter(b => b.path === '/api/subscribe').pop().body);
  check('C /api/subscribe sends only the trial days (no plan field with a single plan)', JSON.stringify(Object.keys(subBody)) === '["trial_days_left"]', JSON.stringify(subBody));

  await page.locator('#copyCode').click();
  await page.waitForTimeout(200);
  const copied = await page.evaluate(async () => {
    try { return await navigator.clipboard.readText(); } catch (e) { return 'selection:' + getSelection().toString(); }
  });
  check('C copy button copies the restore code', copied === restoreCode || copied === 'selection:' + restoreCode, copied);

  const stored = await storageDump(page);
  const local = Object.fromEntries(JSON.parse(stored).local);
  check('C nothing stored contains an email address (no "@" in any key or value)', !stored.includes('@'), stored);
  check('C restore code, subscription and pass are kept on the phone', local.ns_restore === restoreCode && local.ns_sub === subId && !!local.ns_pass,
    Object.keys(local).join(','));

  await page.locator('.pbtn', { hasText: 'ऐप पर चलें' }).click();
  check('C after paying: nothing locked', (await locked(page)) === 0);
  check('C after paying: banner says premium', (await page.locator('.banner').innerText()).includes('प्रीमियम चालू'));
  token = await page.evaluate(() => localStorage.getItem('ns_pass'));

  await page.reload();
  await page.waitForTimeout(600);
  check('D pass survives a reload', (await locked(page)) === 0);
  await ctx.close();
}

// E. A tampered pass is rejected; an email left by an older version is deleted.
{
  const [payload, sig] = token.split('.');
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  data.exp += 10 * 365 * 86400;
  const forged = Buffer.from(JSON.stringify(data)).toString('base64url') + '.' + sig;
  const { ctx, page } = await open({
    init: EXPIRED + `localStorage.setItem('ns_pass', ${JSON.stringify(forged)}); localStorage.setItem('ns_email', 'old@example.com');`,
  });
  check('E forged pass: still locked', (await locked(page)) === await expectedLocked(page) && (await locked(page)) > 0);
  check('E an email stored by an older version is deleted on start', (await page.evaluate(() => localStorage.getItem('ns_email'))) === null);
  await ctx.close();
}

// F. Restore on a new phone with the restore code, then G. cancel.
{
  const { ctx, page } = await open({ init: EXPIRED });
  await page.locator('.banner').click();
  await passGate(page);
  await page.locator('.plink').click();
  check('F restore screen asks only for the restore code', (await page.locator('.panel input').count()) === 1 && await page.locator('#restoreCode').isVisible());
  await snap(page, 'pay-restore');
  const contact = await page.locator('.panel a').evaluateAll(as => as.map(a => [a.getAttribute('href'), a.textContent]));
  check('F restore screen links to legal/contact.html for a lost code',
    contact.some(([h, t]) => h === 'legal/contact.html' && t.includes('संपर्क करें')) && (await page.locator('.panel').innerText()).includes('कोड खो गया?'),
    JSON.stringify(contact));
  const wrong = restoreCode.slice(0, -1) + (restoreCode.endsWith('A') ? 'B' : 'A');
  await page.fill('#restoreCode', wrong);
  await page.locator('.pbtn', { hasText: 'वापस पाएँ' }).click();
  await page.waitForTimeout(400);
  check('F restore with a wrong code is refused', (await page.locator('.pmsg').innerText()).includes('यह कोड सही नहीं है'), await page.locator('.pmsg').innerText());
  await page.fill('#restoreCode', ' ' + restoreCode + ' ');
  await page.locator('.pbtn', { hasText: 'वापस पाएँ' }).click();
  await page.locator('#restoreCodeOut').waitFor({ timeout: 5000 });
  await page.locator('.pbtn', { hasText: 'ऐप पर चलें' }).click();
  check('F restore with the code from the thank-you screen unlocks everything', (await locked(page)) === 0);

  await page.locator('.banner').click();
  await passGate(page);
  check('G subscribed parent sees the account screen with the restore code',
    (await page.locator('.ptitle').innerText()).includes('चालू') && (await page.locator('#restoreCodeOut').innerText()) === restoreCode);
  await page.locator('.pbtn', { hasText: 'रद्द करें' }).first().click();
  await page.locator('.pbtn', { hasText: 'हाँ, रद्द करें' }).click();
  await page.waitForTimeout(400);
  check('G cancel is confirmed', (await page.locator('.pmsg').innerText()).includes('रद्द हो गया'));
  check('G Razorpay was asked to cancel', subs.get(subId).cancelled === true);
  check('G nothing stored contains an email address', !(await storageDump(page)).includes('@'));
  await ctx.close();
}

// H. Subscribing during the trial keeps the free days; the yearly plan is offered when configured.
{
  const { ctx, page } = await open();
  await page.locator('.banner').click();
  await passGate(page);
  check('H paywall mentions the days left', (await page.locator('#trialNote').innerText()).includes('7 दिन बाकी'));
  await snap(page, 'pay-paywall-trial');
  await page.locator('.pbtn', { hasText: 'सब्सक्राइब' }).click();
  await page.locator('#restoreCodeOut').waitFor({ timeout: 5000 });
  const id = await page.evaluate(() => window.__checkout.subscription_id);
  const startAt = subs.get(id).start_at;
  const expected = Math.floor(Date.now() / 1000) + 7 * 86400;
  check('H first charge waits for the trial to end', Math.abs(startAt - expected) < 60, String(startAt - expected));
  await snap(page, 'pay-thanks');
  await ctx.close();
}
{
  const plans = { PLANS: { monthly: { price: '₹99 / महीना' }, yearly: { price: '₹599 / साल', note: 'सबसे किफ़ायती — ₹50 / महीना' } } };
  const { ctx, page } = await open({ config: cfg(plans) });
  await page.locator('.banner').click();
  await passGate(page);
  const cards = await page.locator('.plan').evaluateAll(ps => ps.map(p => [p.dataset.plan, p.getAttribute('aria-checked'), p.textContent]));
  check('H2 with a yearly plan: two clear choices (monthly selected first), still one primary button',
    cards.length === 2 && cards[0][0] === 'monthly' && cards[0][1] === 'true' && cards[1][0] === 'yearly' && cards[1][2].includes('₹599') && cards[1][2].includes('सबसे किफ़ायती') &&
    (await page.locator('.panel .pbtn.primary').count()) === 1, JSON.stringify(cards));
  await page.locator('.plan[data-plan="yearly"]').click();
  await snap(page, 'pay-paywall-plans');
  await page.locator('.pbtn', { hasText: 'सब्सक्राइब' }).click();
  await page.locator('#restoreCodeOut').waitFor({ timeout: 5000 });
  const body = JSON.parse(apiBodies.filter(b => b.path === '/api/subscribe').pop().body);
  const sid = await page.evaluate(() => window.__checkout.subscription_id);
  check('H2 the chosen plan is sent to /api/subscribe and the yearly Razorpay plan is used', body.plan === 'yearly' && typeof body.trial_days_left === 'number' &&
    subs.get(sid).plan_id === 'plan_test_yearly', JSON.stringify(body));
  await ctx.close();
}

// AN. Inside the Android shell: native voices, back button, no service worker, screenshot protection,
//     and payment through the phone's browser confirmed on "resume".
{
  const nativeStub = `
    window.__native = { speak: [], opened: [], secure: [] };
    window.NanhaNative = {
      platform: () => 'android',
      voices: () => JSON.stringify([
        { id: 'hi-f', lang: 'hi-IN', gender: 'female', local: true, label: 'Hindi female' },
        { id: 'hi-m', lang: 'hi-IN', gender: 'male', local: true, label: 'Hindi male' },
        { id: 'en-f', lang: 'en-IN', gender: 'female', local: true, label: 'English female' } ]),
      speak: (id, text, lang, voiceId, rate, pitch) => { window.__native.speak.push([id, text, lang, voiceId, rate, pitch].map(x => typeof x)); window.__native.last = { id, text, lang, voiceId, rate, pitch };
        setTimeout(() => window.NS.native.onEvent(JSON.stringify({ type: 'speak-done', id })), 5); },
      stop: () => {},
      listen: (id, lang) => { setTimeout(() => window.NS.native.onEvent(JSON.stringify({ type: 'listen-result', id, text: 'नमस्ते' })), 5); },
      openExternal: url => { window.__native.opened.push(url); return true; },
      secure: on => { window.__native.secure.push(on); },
    };`;
  const { ctx, page } = await open({ init: EXPIRED + nativeStub, sw: 'allow', profile: profilesInit([prof('pa', 'आरव', { voice: 'male' })]) });
  await page.evaluate(() => NS.voice.say('नमस्ते दोस्त', { lang: 'hinglish' }));
  const sp = await page.evaluate(() => ({ last: window.__native.last, types: window.__native.speak[0] }));
  check('AN native voice: male voice id, hi-IN for Hinglish, all arguments are strings', sp.last && sp.last.voiceId === 'hi-m' && sp.last.lang === 'hi-IN' &&
    sp.types.every(t => t === 'string') && /^[A-Za-z0-9._:-]{1,64}$/.test(sp.last.id), JSON.stringify(sp));
  await page.evaluate(() => NS.store.setSetting('mic', true));
  const heard = await page.evaluate(() => NS.voice.listen({ lang: 'hi' }));
  check('AN speech input uses the native on-device recogniser', heard === 'नमस्ते', String(heard));
  const regs = await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length));
  check('AN no service worker is registered inside the shell', regs === 0, String(regs));
  check('AN NS.back() on home returns false (the app may close)', (await page.evaluate(() => NS.back())) === false);
  await page.locator('.tile[data-id="abc"]').click();
  check('AN NS.back() in an activity goes home and returns true', (await page.evaluate(() => NS.back())) === true && (await page.locator('.sky').count()) === 1);
  await page.locator('.tile[data-id="quiz"]').click();
  check('AN screenshots are blocked while the grown-ups screens show', JSON.stringify(await page.evaluate(() => window.__native.secure)) === '["true"]');
  await passGate(page);
  await page.locator('.pbtn', { hasText: 'सब्सक्राइब' }).click();
  await page.waitForTimeout(500);
  const opened = await page.evaluate(() => window.__native.opened);
  const pending = await page.evaluate(() => JSON.parse(localStorage.getItem('ns_pending') || 'null'));
  check('AN the checkout opens pay.html#s=…&k=… in the phone\'s browser (no Razorpay inside the app)',
    opened.length === 1 && new RegExp('^' + PAY_PAGE.replace(/[.]/g, '\\.') + '#s=sub_\\w+&k=rzp_test_key12345$').test(opened[0]) &&
    (await page.evaluate(() => !window.Razorpay)), opened.join(' '));
  check('AN the pending restore code is kept on the device while paying', pending && /^sub_\w+\.[\w-]{16}$/.test(pending.code), JSON.stringify(pending));
  await snap(page, 'android-waiting');
  await page.evaluate(() => NS.native.onEvent('{"type":"resume"}'));
  await page.locator('.ptitle', { hasText: 'प्रीमियम चालू हो गया' }).waitFor({ timeout: 5000 }).catch(async () => console.log('AN debug:', await page.locator('#body').innerText(), JSON.stringify(apiBodies.slice(-3))));
  const after = await page.evaluate(() => ({ restore: localStorage.getItem('ns_restore'), pending: localStorage.getItem('ns_pending'), pass: !!localStorage.getItem('ns_pass') }));
  check('AN coming back to the app confirms the payment with /api/restore', after.restore === pending.code && after.pending === null && after.pass, JSON.stringify(after));
  await page.locator('.pbtn', { hasText: 'ऐप पर चलें' }).click();
  check('AN premium is on after paying in the browser; screenshot protection is off again', (await locked(page)) === 0 &&
    (await page.evaluate(() => window.__native.secure)).slice(-1)[0] === 'false');
  await ctx.close();
}

// P. The Android checkout page.
{
  const apiBefore = apiBodies.length;
  const payStorage = [];
  {
    const { ctx, page } = await open({ payments: false, path: '/pay.html', profile: '' });
    const text = await page.locator('#pay').innerText();
    check('P no hash: invalid-link message and no button', text.includes('यह लिंक सही नहीं है। नन्हा स्कूल ऐप से फिर से कोशिश करें।') &&
      (await page.locator('button').count()) === 0, text);
    await snap(page, 'pay-invalid');
    await ctx.close();
  }
  for (const bad of ['#s=sub_short&k=rzp_test_key12345', '#s=sub_TESTabc123&k=rzp_prod_key12345', '#s=sub_TEST<b>x</b>&k=rzp_test_key12345']) {
    const { ctx, page } = await open({ payments: false, path: '/pay.html' + bad, profile: '' });
    const text = await page.locator('#pay').innerText();
    check(`P bad hash ${bad.slice(0, 22)}…: invalid message, no button, hash removed`,
      text.includes('यह लिंक सही नहीं है') && (await page.locator('button').count()) === 0 && !page.url().includes('#'), page.url());
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ payments: false, path: '/pay.html#s=sub_TESTabc123&k=rzp_test_key12345', profile: '' });
    const heading = await page.locator('h1').innerText();
    check('P valid hash: heading and a big "भुगतान करें" button', heading === 'नन्हा स्कूल प्रीमियम' &&
      (await page.locator('#payBtn').innerText()) === 'भुगतान करें' && await page.locator('#payBtn').isVisible());
    const loc = await page.evaluate(() => ({ href: location.href, hash: location.hash }));
    check('P valid hash is removed from the address bar', loc.hash === '' && !loc.href.includes('#') && !loc.href.includes('sub_') && !page.url().includes('#'), loc.href);
    await snap(page, 'pay-valid');
    await page.locator('#payBtn').click();
    await page.locator('a.applink').waitFor({ timeout: 5000 });
    const text = await page.locator('#pay').innerText();
    const href = await page.locator('a.applink').getAttribute('href');
    check('P paying shows the success text and the link back to the app',
      text.includes('✅ भुगतान हो गया! अब नन्हा स्कूल ऐप पर वापस जाएँ — वहाँ प्रीमियम अपने-आप खुल जाएगा।') &&
      (await page.locator('a.applink').innerText()) === 'ऐप पर वापस जाएँ' &&
      href === 'intent://open#Intent;scheme=nanhaschool;package=org.guardian.buddy;end' && (await page.locator('#payBtn').count()) === 0, href);
    const co = await page.evaluate(() => window.__checkout);
    check('P checkout opened for the hash\'s subscription and key, no prefill',
      co.key === 'rzp_test_key12345' && co.subscription_id === 'sub_TESTabc123' && co.name === 'नन्हा स्कूल' &&
      co.description === 'प्रीमियम सब्सक्रिप्शन' && co.theme.color === '#FF8A3D' && co.prefill === undefined && co.hasDismiss, JSON.stringify(co));
    await snap(page, 'pay-success');
    payStorage.push(await storageDump(page));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ payments: false, path: '/pay.html#s=sub_TESTabc123&k=rzp_live_key12345', stub: dismissStub, profile: '' });
    await page.locator('#payBtn').click();
    await page.waitForTimeout(400);
    const msg = await page.locator('.pmsg').innerText();
    check('P closing the checkout shows the retry message and keeps the button',
      msg === 'भुगतान पूरा नहीं हुआ। फिर से कोशिश करें।' && await page.locator('#payBtn').isVisible() && await page.locator('#payBtn').isEnabled(), msg);
    payStorage.push(await storageDump(page));
    await ctx.close();
  }
  check('P never calls the API and stores nothing', apiBodies.length === apiBefore &&
    payStorage.every(s => s === JSON.stringify({ local: [], session: [], cookie: '' })), payStorage.join(' '));
}

// W. Service worker: caches the v5 shell, leaves API calls alone.
{
  const ctx = await browser.newContext({ serviceWorkers: 'allow', viewport: { width: 400, height: 820 } });
  await instrument(ctx, csp);
  await ctx.addInitScript(`if (location.origin === ${JSON.stringify(ORIGIN)}) { ${ONE} }`);
  const page = await ctx.newPage();
  const fromSw = {};
  page.on('response', r => { fromSw[new URL(r.url()).pathname + ' ' + r.request().method()] = r.fromServiceWorker(); });
  await page.goto(ORIGIN + '/');
  const info = await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
    const post = await fetch('/api/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"token":"x"}' });
    const get = await fetch('/api/subscribe');
    const app = await fetch('js/core/ui.js');
    await new Promise(r => setTimeout(r, 300));
    const cache = await caches.open('nanha-school-v5');
    const before = (await cache.keys()).map(r => new URL(r.url).pathname);
    const pic = NS.imgUrl('🥭');
    const got = pic ? await fetch(pic) : null;
    await new Promise(r => setTimeout(r, 300));
    const after = (await cache.keys()).map(r => new URL(r.url).pathname);
    return { names: await caches.keys(), urls: before, statuses: [post.status, get.status, app.status],
      pic, picOk: !!got && got.ok, picPrecached: before.some(u => u.includes('/img/')), picCached: !!pic && after.includes('/' + pic) };
  });
  const need = ['/', '/index.html', '/app.css', '/config.js', '/js/core/ns.js', '/js/core/sfx.js', '/js/core/ui.js', '/js/modules/learn.js', '/pay.html', '/pay.js', '/fonts/baloo2-devanagari.woff2', '/fonts/baloo2-latin.woff2'];
  check('W service worker caches the v5 shell (core, learn, pay page, fonts)',
    JSON.stringify(info.names) === '["nanha-school-v5"]' && need.every(u => info.urls.includes(u)), JSON.stringify(info));
  check('W lesson pictures are not precached, and are cached the first time they are shown', info.pic === null || (info.picOk && !info.picPrecached && info.picCached),
    JSON.stringify({ pic: info.pic, ok: info.picOk, pre: info.picPrecached, cached: info.picCached }));
  check('W service worker never intercepts or caches API calls',
    !info.urls.some(u => u.includes('/api/')) && fromSw['/api/refresh POST'] === false && fromSw['/api/subscribe GET'] === false &&
    fromSw['/js/core/ui.js GET'] === true, JSON.stringify(fromSw));
  await ctx.close();
}

await browser.close();
server.close();
const posts = apiBodies.filter(b => b.method === 'POST');
check('no request body sent to /api/* contains "@"', posts.length >= 8 && !posts.some(b => b.body.includes('@')),
  `${posts.length} bodies: ` + posts.filter(b => b.body.includes('@')).map(b => b.path + ' ' + b.body).join(' | '));
const leaks = sent.filter(s => s.includes('@') || NAMES.some(nm => s.includes(nm) || s.includes(encodeURIComponent(nm))));
check('no network request (URL or body) contains "@" or a child\'s name', sent.length > 50 && leaks.length === 0, leaks.slice(0, 5).join(' | '));
check('nothing the server sent to Razorpay contains "@"', razorpayBodies.length > 0 && !razorpayBodies.some(b => b.includes('@')), razorpayBodies.join(' | '));
check('no requests to third parties (only localhost and Razorpay checkout)', external.length === 0, external.join(' '));
check('zero CSP violations during the whole run', csp.events.length === 0 && csp.console.length === 0,
  JSON.stringify(csp.events) + ' ' + csp.console.join(' | '));
check('no page errors anywhere', allErrors.length === 0, allErrors.join(' | '));
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok || !r.detail ? '' : '  -> ' + r.detail}`);
for (const wn of warnings) console.log('WARN  (module screen, controls closer than 8px or smaller than 48px) ' + wn.slice(0, 600));
const failed = results.filter(r => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
