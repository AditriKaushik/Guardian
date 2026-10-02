import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import worker from './worker.js';

const ORIGIN = 'https://aditrikaushik.github.io';
const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const env = {
  ALLOWED_ORIGINS: ORIGIN,
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'test_secret',
  RAZORPAY_PLAN_ID: 'plan_test123',
  TOTAL_COUNT: '120',
  TRIAL_DAYS: '7',
  SIGNING_KEY_JWK: JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey)),
};

// A fake Razorpay: subscriptions live in this map, and every request is recorded.
let subs;
let calls;
beforeEach(() => {
  subs = new Map();
  calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, init });
    const path = new URL(url).pathname.replace('/v1', '');
    if (init.method === 'POST' && path === '/subscriptions') {
      const body = JSON.parse(init.body);
      const sub = { id: 'sub_NEW' + (subs.size + 1) + 'abc', status: 'created', notes: body.notes, current_end: null };
      subs.set(sub.id, sub);
      return Response.json(sub);
    }
    const cancel = path.match(/^\/subscriptions\/(sub_\w+)\/cancel$/);
    if (cancel) {
      const sub = subs.get(cancel[1]);
      sub.status = 'active';   // stays active until the cycle ends
      return Response.json(sub);
    }
    const get = path.match(/^\/subscriptions\/(sub_\w+)$/);
    if (get && subs.has(get[1])) {
      return Response.json(subs.get(get[1]));
    }
    return new Response('{}', { status: 404 });
  };
});

function call(path, body, origin = ORIGIN) {
  return worker.fetch(new Request('https://api.example' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  }), env);
}

/** A request with full control over method, headers, raw body and env. */
function send(path, { method = 'POST', headers = {}, body, environment = env } = {}) {
  const init = { method, headers };
  if (body !== undefined) {
    init.body = body;
    if (body instanceof ReadableStream) {
      init.duplex = 'half';
    }
  }
  return worker.fetch(new Request('https://api.example' + path, init), environment);
}

function sign(paymentId, subId, secret = env.RAZORPAY_KEY_SECRET) {
  return createHmac('sha256', secret).update(`${paymentId}|${subId}`).digest('hex');
}

/** The restore code, computed independently of worker.js from the written spec. */
function restoreCode(subId, secret = env.RAZORPAY_KEY_SECRET) {
  return `${subId}.${createHmac('sha256', secret).update('nanha-restore|' + subId).digest('base64url').slice(0, 16)}`;
}

async function passIsValid(token) {
  const [payload, sig] = token.split('.');
  const bytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, bytes(sig), new TextEncoder().encode(payload));
}

function addSub(id, fields) {
  subs.set(id, { id, status: 'active', notes: { app: 'nanha-school' }, current_end: 2_000_000_000, ...fields });
}

async function passFor(subId) {
  const res = await call('/api/restore', { restore_code: restoreCode(subId) });
  assert.equal(res.status, 200);
  return res.json();
}

/** Signs any payload string with the real signing key, to test what happens after the signature check. */
async function signedToken(payload, key = pair.privateKey) {
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(sig).toString('base64url')}`;
}
const b64u = s => Buffer.from(s).toString('base64url');

// ---- Contract --------------------------------------------------------------

test('only the app\'s own site gets CORS access', async () => {
  const ok = await worker.fetch(new Request('https://api.example/api/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const evil = await worker.fetch(new Request('https://api.example/api/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(evil.headers.get('Access-Control-Allow-Origin'), null);
});

test('subscribe creates a Razorpay subscription for the plan with no personal data, plus a restore code', async () => {
  // Even if an old client still sends an email, it is never read or passed on.
  const res = await call('/api/subscribe', { trial_days_left: 0, email: 'parent@example.com', phone: '9999999999' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), ['key_id', 'restore_code', 'subscription_id']);
  assert.match(data.subscription_id, /^sub_/);
  assert.equal(data.key_id, 'rzp_test_key');
  assert.equal(data.restore_code, restoreCode(data.subscription_id));
  assert.match(data.restore_code, /^sub_[A-Za-z0-9]+\.[A-Za-z0-9_-]{16}$/);
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.plan_id, 'plan_test123');
  assert.deepEqual(sent.notes, { app: 'nanha-school' });
  assert.doesNotMatch(calls[0].init.body, /@|parent|9999999999/);
  assert.match(calls[0].init.headers.Authorization, /^Basic /);
});

test('a Razorpay setup mistake is reported as a provider error, not "not found"', async () => {
  globalThis.fetch = async () => new Response('{"error":{"description":"The id provided does not exist"}}', { status: 400 });
  const res = await call('/api/subscribe', {});
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'payment_provider_error');
});

test('Razorpay being unreachable or answering garbage is a provider error', async () => {
  globalThis.fetch = async () => { throw new TypeError('network down'); };
  let res = await call('/api/subscribe', {});
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'payment_provider_error');

  globalThis.fetch = async () => new Response('<html>oops</html>', { status: 200 });
  res = await call('/api/subscribe', {});
  assert.equal(res.status, 502);

  globalThis.fetch = async () => Response.json({ id: '../../evil', status: 'created' });
  res = await call('/api/subscribe', {});
  assert.equal(res.status, 502);

  // Never sign a pass for a different subscription than the one asked about.
  globalThis.fetch = async () => Response.json({ id: 'sub_SOMEONEELSE', status: 'active', current_end: 2_000_000_000 });
  res = await call('/api/restore', { restore_code: restoreCode('sub_ABC12345') });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'payment_provider_error');
});

test('verify issues a signed pass for a correctly signed payment', async () => {
  addSub('sub_ABC12345');
  const res = await call('/api/verify', {
    razorpay_payment_id: 'pay_XYZ98765',
    razorpay_subscription_id: 'sub_ABC12345',
    razorpay_signature: sign('pay_XYZ98765', 'sub_ABC12345'),
  });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(await passIsValid(data.token), true);
  assert.equal(data.exp, 2_000_000_000 + 2 * 24 * 3600);
});

test('the pass format is exactly <base64url JSON {sid, exp}>.<64-byte P1363 signature>', async () => {
  addSub('sub_ABC12345');
  const { token, exp } = await passFor('sub_ABC12345');
  const [payload, sig, extra] = token.split('.');
  assert.equal(extra, undefined);
  assert.match(payload, /^[A-Za-z0-9_-]+$/);
  assert.match(sig, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')), { sid: 'sub_ABC12345', exp });
  assert.equal(Buffer.from(sig, 'base64url').length, 64);
});

test('verify refuses a forged payment signature', async () => {
  addSub('sub_ABC12345');
  const res = await call('/api/verify', {
    razorpay_payment_id: 'pay_XYZ98765',
    razorpay_subscription_id: 'sub_ABC12345',
    razorpay_signature: sign('pay_XYZ98765', 'sub_ABC12345', 'wrong_secret'),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'bad_signature');
});

test('verify never accepts a signature made with an empty key when the secret is missing', async () => {
  addSub('sub_ABC12345');
  const { RAZORPAY_KEY_SECRET, ...noSecret } = env;
  const res = await send('/api/verify', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_payment_id: 'pay_XYZ98765',
      razorpay_subscription_id: 'sub_ABC12345',
      razorpay_signature: createHmac('sha256', '').update('pay_XYZ98765|sub_ABC12345').digest('hex'),
    }),
    environment: noSecret,
  });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'server_error');
  // ...and nothing is sent to Razorpay with a missing secret.
  const sub = await send('/api/subscribe', { headers: { 'Content-Type': 'application/json' }, body: '{}', environment: noSecret });
  assert.equal(sub.status, 500);
  assert.equal(calls.length, 0);
});

test('no pass for a subscription that is not active', async () => {
  addSub('sub_HALTED123', { status: 'halted' });
  const res = await call('/api/verify', {
    razorpay_payment_id: 'pay_XYZ98765',
    razorpay_subscription_id: 'sub_HALTED123',
    razorpay_signature: sign('pay_XYZ98765', 'sub_HALTED123'),
  });
  assert.equal(res.status, 402);
});

// ---- Restore codes ---------------------------------------------------------

test('restore with the right restore code issues a pass', async () => {
  addSub('sub_ABC12345');
  const res = await call('/api/restore', { restore_code: restoreCode('sub_ABC12345') });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(await passIsValid(data.token), true);
  assert.equal(data.exp, 2_000_000_000 + 2 * 24 * 3600);
});

test('the restore code from subscribe works once the parent has paid (the Android confirm flow)', async () => {
  const { subscription_id, restore_code } = await (await call('/api/subscribe', {})).json();
  const unpaid = await call('/api/restore', { restore_code });
  assert.equal(unpaid.status, 402);
  assert.equal((await unpaid.json()).error, 'not_active');
  subs.get(subscription_id).status = 'authenticated';
  const paid = await call('/api/restore', { restore_code });
  assert.equal(paid.status, 200);
});

test('every wrong restore code is "not found", and none reach Razorpay', async () => {
  addSub('sub_ABC12345');
  addSub('sub_OTHER1234');
  const good = restoreCode('sub_ABC12345');
  const mac = good.split('.')[1];
  const flip = mac[0] === 'A' ? 'B' + mac.slice(1) : 'A' + mac.slice(1);
  const wrong = [
    `sub_ABC12345.${flip}`,                                   // wrong mac
    `sub_OTHER1234.${mac}`,                                   // a code for another subscription
    restoreCode('sub_ABC12345', 'wrong_secret'),              // made with another secret
    'sub_ABC12345',                                           // malformed from here on
    'sub_ABC12345.',
    `${good}=`,
    `${good}x`,
    good.slice(0, -1),
    ` ${good}`,
    `${good}\n`,
    good.toUpperCase(),
    `sub_ABC12345.${mac}.${mac}`,
    `sub_ABC/../12345.${mac}`,
    '',
    'x'.repeat(3000),
  ];
  for (const restore_code of wrong) {
    const res = await call('/api/restore', { restore_code });
    assert.equal(res.status, 404, JSON.stringify(restore_code));
    assert.deepEqual(await res.json(), { error: 'not_found' });
  }
  assert.equal(calls.length, 0);
});

test('a genuine restore code for a subscription Razorpay does not know is "not found"', async () => {
  const res = await call('/api/restore', { restore_code: restoreCode('sub_UNKNOWN99') });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

test('the old email-based restore is gone', async () => {
  addSub('sub_ABC12345');
  for (const body of [
    { email: 'parent@example.com', subscription_id: 'sub_ABC12345' },
    { restore_code: 12345 },
    { restore_code: [restoreCode('sub_ABC12345')] },
    { restore_code: null },
  ]) {
    const res = await call('/api/restore', body);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, 'bad_request');
  }
  assert.equal(calls.length, 0);
});

test('restore-code.mjs prints the same code the Worker accepts, and needs the secret from the environment', () => {
  const script = fileURLToPath(new URL('./restore-code.mjs', import.meta.url));
  const run = (args, extraEnv) => spawnSync(process.execPath, [script, ...args], {
    env: { PATH: process.env.PATH, ...extraEnv }, encoding: 'utf8',
  });

  const ok = run(['sub_ABC12345'], { RAZORPAY_KEY_SECRET: 'test_secret' });
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout, restoreCode('sub_ABC12345') + '\n');
  assert.doesNotMatch(ok.stdout + ok.stderr, /test_secret/);

  const noSecret = run(['sub_ABC12345'], {});
  assert.equal(noSecret.status, 1);
  assert.equal(noSecret.stdout, '');

  // A secret passed as an argument is refused and never echoed.
  const asArg = run(['sub_ABC12345', 'test_secret'], { RAZORPAY_KEY_SECRET: 'x' });
  assert.equal(asArg.status, 1);
  assert.equal(asArg.stdout, '');
  assert.doesNotMatch(asArg.stderr, /test_secret/);

  const badId = run(['not-a-sub'], { RAZORPAY_KEY_SECRET: 'test_secret' });
  assert.equal(badId.status, 1);
  assert.equal(badId.stdout, '');

  // With RESTORE_SECRET set, the tool uses it (matching the Worker).
  const own = run(['sub_ABC12345'], { RESTORE_SECRET: 'restore_only', RAZORPAY_KEY_SECRET: 'test_secret' });
  assert.equal(own.stdout, restoreCode('sub_ABC12345', 'restore_only') + '\n');
});

test('with RESTORE_SECRET set, rotating the Razorpay secret keeps restore codes working', async () => {
  addSub('sub_ABC12345');
  const restore = (code, environment) => send('/api/restore', {
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ restore_code: code }),
    environment,
  });
  const code = restoreCode('sub_ABC12345', 'restore_only');
  assert.equal((await restore(code, { ...env, RESTORE_SECRET: 'restore_only' })).status, 200);
  const rotated = { ...env, RESTORE_SECRET: 'restore_only', RAZORPAY_KEY_SECRET: 'new_razorpay_secret' };
  assert.equal((await restore(code, rotated)).status, 200);
  // A code made from the Razorpay secret is not accepted once RESTORE_SECRET is set.
  assert.equal((await restore(restoreCode('sub_ABC12345'), rotated)).status, 404);
});

// ---- Passes ----------------------------------------------------------------

test('refresh renews a genuine pass and rejects a tampered one', async () => {
  addSub('sub_ABC12345');
  const first = await passFor('sub_ABC12345');

  const renewed = await call('/api/refresh', { token: first.token });
  assert.equal(renewed.status, 200);

  const [payload, sig] = first.token.split('.');
  const forged = btoa(JSON.stringify({ sid: 'sub_OTHER1234', exp: 9_999_999_999 })).replace(/=+$/, '') + '.' + sig;
  const bad = await call('/api/refresh', { token: forged });
  assert.equal(bad.status, 401);
  assert.equal(payload.length > 0, true);
});

test('an expired pass can still be renewed while the subscription is active', async () => {
  addSub('sub_ABC12345');
  const old = await signedToken(b64u(JSON.stringify({ sid: 'sub_ABC12345', exp: 1_000_000 })));
  const res = await call('/api/refresh', { token: old });
  assert.equal(res.status, 200);
});

test('malformed or tampered passes are always 401 bad_token, never 500, and never reach Razorpay', async () => {
  addSub('sub_ABC12345');
  const { token } = await passFor('sub_ABC12345');
  calls = [];
  const otherKey = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const bad = [
    undefined, null, 42, {}, [token], '', '.', 'abc', 'a.', '.b', 'a.b.c',
    `${token}.x`, `${token}=`, `${token} `, ` ${token}`, token.replace('.', '..'),
    '!!!!.@@@@', 'x'.repeat(1000), `${'A'.repeat(401)}.${'A'.repeat(86)}`, `${token.split('.')[0]}.${'A'.repeat(86)}`,
    await signedToken(b64u(JSON.stringify({ sid: 'sub_ABC12345', exp: 2_000_000_000 })), otherKey.privateKey),
    // Correctly signed, but the payload is not what the Worker issues:
    await signedToken('a'),                                                   // not decodable
    await signedToken(b64u('not json')),
    await signedToken(Buffer.from([0xff, 0xfe, 0xfd]).toString('base64url')), // not UTF-8
    await signedToken(b64u('null')),
    await signedToken(b64u('[]')),
    await signedToken(b64u('"sub_ABC12345"')),
    await signedToken(b64u(JSON.stringify({ sid: 'sub_ABC12345' }))),          // no exp
    await signedToken(b64u(JSON.stringify({ sid: 'sub_ABC12345', exp: '2000000000' }))),
    await signedToken(b64u(JSON.stringify({ sid: 'sub_ABC12345', exp: 1.5 }))),
    await signedToken(b64u(JSON.stringify({ sid: ['sub_ABC12345'], exp: 1 }))),
    await signedToken(b64u(JSON.stringify({ sid: 'sub_ABC/../x', exp: 1 }))),
  ];
  for (const t of bad) {
    for (const route of ['/api/refresh', '/api/cancel']) {
      const res = await call(route, { token: t });
      assert.equal(res.status, 401, `${route} ${JSON.stringify(t)}`);
      assert.deepEqual(await res.json(), { error: 'bad_token' });
    }
  }
  assert.equal(calls.length, 0);
});

test('cancel stops renewal at the end of the paid period', async () => {
  addSub('sub_ABC12345');
  const { token } = await passFor('sub_ABC12345');
  const res = await call('/api/cancel', { token });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { cancelled: true, ends_at: 2_000_000_000 });
  const cancelCall = calls.find(c => String(c.url).endsWith('/cancel'));
  assert.deepEqual(JSON.parse(cancelCall.init.body), { cancel_at_cycle_end: 1 });
});

test('subscribing during the trial delays the first charge, capped at 7 days', async () => {
  const before = Math.floor(Date.now() / 1000);
  await call('/api/subscribe', { trial_days_left: 5 });
  const sent = JSON.parse(calls[0].init.body);
  assert.ok(sent.start_at >= before + 5 * 86400 && sent.start_at <= before + 5 * 86400 + 5);

  calls = [];
  await call('/api/subscribe', { trial_days_left: 365 });
  assert.ok(JSON.parse(calls[0].init.body).start_at <= before + 7 * 86400 + 5);

  calls = [];
  await call('/api/subscribe', { trial_days_left: 0 });
  assert.equal(JSON.parse(calls[0].init.body).start_at, undefined);

  for (const weird of [-3, 'lots', null, [], {}, 1e308]) {
    calls = [];
    const res = await call('/api/subscribe', { trial_days_left: weird });
    assert.equal(res.status, 200);
    const startAt = JSON.parse(calls[0].init.body).start_at;
    assert.ok(startAt === undefined || (Number.isInteger(startAt) && startAt <= before + 7 * 86400 + 5), String(weird));
  }
});

test('a pass bought during the trial lasts until billing starts', async () => {
  const startAt = Math.floor(Date.now() / 1000) + 4 * 86400;
  addSub('sub_TRIAL1234', { status: 'authenticated', current_end: null, start_at: startAt });
  const res = await call('/api/restore', { restore_code: restoreCode('sub_TRIAL1234') });
  assert.equal((await res.json()).exp, startAt + 2 * 24 * 3600);
});

test('pass expiry is always a whole number, even if Razorpay sends times as strings or junk', async () => {
  addSub('sub_STRING123', { current_end: '2000000000' });
  let data = await passFor('sub_STRING123');
  assert.equal(data.exp, 2_000_000_000 + 2 * 24 * 3600);

  const now = Math.floor(Date.now() / 1000);
  addSub('sub_JUNK12345', { current_end: 'soon', start_at: { x: 1 } });
  data = await passFor('sub_JUNK12345');
  assert.ok(Number.isSafeInteger(data.exp));
  assert.ok(data.exp >= now + 5 * 86400 && data.exp <= now + 5 * 86400 + 5);   // fallback + grace
});

test('unknown routes and non-POST requests are 404', async () => {
  assert.equal((await call('/api/nope', {})).status, 404);
  assert.equal((await call('/__proto__', {})).status, 404);
  assert.equal((await call('/api/subscribe/', {})).status, 404);
  const get = await worker.fetch(new Request('https://api.example/api/verify', { method: 'GET' }), env);
  assert.equal(get.status, 404);
});

// ---- 1. Content-Type -------------------------------------------------------

test('POST bodies must be sent as application/json', async () => {
  for (const type of [undefined, 'text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x',
    'text/plain; application/json', 'application/json, text/plain', 'application/jsonx', 'application/json-patch+json']) {
    const headers = { Origin: ORIGIN };
    if (type) {
      headers['Content-Type'] = type;
    }
    const res = await send('/api/subscribe', { headers, body: '{}' });
    assert.equal(res.status, 415, String(type));
    assert.deepEqual(await res.json(), { error: 'unsupported_media_type' });
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);   // so the web app can read the error
  }
  for (const type of ['application/json', 'application/json; charset=utf-8', 'Application/JSON;charset=UTF-8']) {
    const res = await send('/api/subscribe', { headers: { Origin: ORIGIN, 'Content-Type': type }, body: '{}' });
    assert.equal(res.status, 200, type);
  }
  assert.equal(calls.length, 3);
});

// ---- 2. Origin -------------------------------------------------------------

test('a browser page from another site is refused with 403, preflight included', async () => {
  for (const origin of ['https://evil.example', 'null', 'https://aditrikaushik.github.io.evil.example',
    'http://aditrikaushik.github.io', 'https://aditrikaushik.github.io:8443', '']) {
    const pre = await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: origin } });
    assert.equal(pre.status, 403, origin);
    assert.deepEqual(await pre.json(), { error: 'forbidden_origin' });
    assert.equal(pre.headers.get('Access-Control-Allow-Origin'), null);

    const post = await send('/api/subscribe', { headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(post.status, 403, origin);
    assert.deepEqual(await post.json(), { error: 'forbidden_origin' });
    assert.equal(post.headers.get('Access-Control-Allow-Origin'), null);
  }
  assert.equal(calls.length, 0);
});

test('the Android app (no Origin header) can use every route', async () => {
  addSub('sub_ABC12345');
  const android = (path, body) => send(path, { headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
  const sub = await android('/api/subscribe', { trial_days_left: 3 });
  assert.equal(sub.status, 200);
  assert.equal(sub.headers.get('Access-Control-Allow-Origin'), null);
  const restored = await android('/api/restore', { restore_code: restoreCode('sub_ABC12345') });
  assert.equal(restored.status, 200);
  const { token } = await restored.json();
  assert.equal((await android('/api/refresh', { token })).status, 200);
  assert.equal((await android('/api/cancel', { token })).status, 200);
});

test('allowed origins tolerate a trailing slash or capitals in the config', async () => {
  const res = await send('/api/subscribe', {
    method: 'OPTIONS', headers: { Origin: ORIGIN },
    environment: { ...env, ALLOWED_ORIGINS: ' https://example.org , https://AditriKaushik.github.io/ ' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
});

// ---- 3. Body size and shape --------------------------------------------------

test('bodies over 4096 bytes are refused with 413', async () => {
  const pad = n => '{"trial_days_left":0}' + ' '.repeat(n - 21);
  assert.equal(pad(4096).length, 4096);
  const post = (body, extra = {}) => send('/api/subscribe', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...extra }, body });

  assert.equal((await post(pad(4096))).status, 200);
  const big = await post(pad(4097));
  assert.equal(big.status, 413);
  assert.deepEqual(await big.json(), { error: 'payload_too_large' });

  // Counted in bytes, not characters: 2100 'é' are 4200 bytes.
  assert.equal((await post(JSON.stringify({ x: 'é'.repeat(2100) }))).status, 413);
  // A declared Content-Length that is too big is refused without reading the body.
  assert.equal((await post('{}', { 'Content-Length': '1000000' })).status, 413);
});

test('an endless streamed body is cut off at the limit, not buffered', async () => {
  let sent = 0;
  let cancelled = false;
  const stream = new ReadableStream({
    pull(controller) {
      sent += 1000;
      controller.enqueue(new Uint8Array(1000).fill(32));
    },
    cancel() {
      cancelled = true;
    },
  });
  const res = await send('/api/subscribe', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: stream });
  assert.equal(res.status, 413);
  assert.ok(sent <= 6000, `read ${sent} bytes`);
  assert.equal(cancelled, true);
});

test('bodies that are not a JSON object are 400 bad_request', async () => {
  for (const body of ['', 'not json', '{', 'null', '[]', '[{}]', '"text"', '42', 'true', new Uint8Array([0x7b, 0xff, 0x7d])]) {
    const res = await send('/api/subscribe', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body });
    assert.equal(res.status, 400, String(body));
    assert.deepEqual(await res.json(), { error: 'bad_request' });
  }
  assert.equal(calls.length, 0);
});

// ---- 4. Security headers ---------------------------------------------------

test('every response carries the security headers', async () => {
  addSub('sub_ABC12345');
  const responses = [
    await call('/api/subscribe', {}),                                                              // 200
    await call('/api/restore', { restore_code: restoreCode('sub_ABC12345') }),                    // 200
    await call('/api/refresh', { token: 'nope' }),                                                // 401
    await call('/api/nope', {}),                                                                  // 404
    await send('/api/subscribe', { headers: { Origin: ORIGIN, 'Content-Type': 'text/plain' }, body: '{}' }), // 415
    await send('/api/subscribe', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: '{' }), // 400
    await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } }),             // 204
    await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), // 403
    await send('/api/subscribe', { method: 'GET' }),                                              // 404
  ];
  globalThis.fetch = async () => { throw new Error('boom'); };
  responses.push(await call('/api/subscribe', {}));                                               // 502
  responses.push(await worker.fetch(new Request('https://api.example/api/refresh', {             // 500 (broken key config)
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: `a.${'A'.repeat(86)}` }),
  }), { ...env, SIGNING_KEY_JWK: 'not json' }));
  for (const res of responses) {
    const where = `status ${res.status}`;
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff', where);
    assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer', where);
    assert.equal(res.headers.get('Content-Security-Policy'), "default-src 'none'; frame-ancestors 'none'", where);
    assert.equal(res.headers.get('Cache-Control'), 'no-store', where);
    assert.equal(res.headers.get('Vary'), 'Origin', where);
  }
  assert.deepEqual(responses.map(r => r.status), [200, 200, 401, 404, 415, 400, 204, 403, 404, 502, 500]);
});

// ---- 5. Rate limiting ------------------------------------------------------

test('with a rate limiter bound, each IP gets a budget per route and then 429', async () => {
  const keys = [];
  let budget = 2;
  const limited = { ...env, RATE_LIMITER: { async limit({ key }) { keys.push(key); return { success: budget-- > 0 }; } } };
  const post = () => send('/api/subscribe', {
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.7' },
    body: '{}', environment: limited,
  });
  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 200);
  const third = await post();
  assert.equal(third.status, 429);
  assert.deepEqual(await third.json(), { error: 'too_many_requests' });
  assert.equal(third.headers.get('Retry-After'), '60');
  assert.equal(third.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  assert.equal(third.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.equal(calls.length, 2);                                        // the limited call never reached Razorpay
  assert.deepEqual(keys, Array(3).fill('203.0.113.7|/api/subscribe'));

  // Preflights, other sites and unknown routes don't use the limiter.
  await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN }, environment: limited });
  await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' }, environment: limited });
  await send('/api/nope', { headers: { 'Content-Type': 'application/json' }, body: '{}', environment: limited });
  assert.equal(keys.length, 3);

  // Keys are per route.
  budget = 5;
  await send('/api/restore', {
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '2001:db8::1' },
    body: '{"restore_code":"x"}', environment: limited,
  });
  assert.equal(keys.at(-1), '2001:db8::1|/api/restore');
});

test('a failing rate limiter does not block parents (fails open); no limiter means no limiting', async () => {
  const broken = { ...env, RATE_LIMITER: { async limit() { throw new Error('limiter down'); } } };
  const res = await send('/api/subscribe', { headers: { 'Content-Type': 'application/json' }, body: '{}', environment: broken });
  assert.equal(res.status, 200);
  for (let i = 0; i < 20; i++) {
    assert.equal((await call('/api/subscribe', {})).status, 200);
  }
});

// ---- 6. No logging, no echo ------------------------------------------------

test('nothing is logged and no error echoes the request back', async () => {
  addSub('sub_ABC12345');
  const marker = 'ZQXMARKER';
  const logged = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug', 'trace'];
  const saved = methods.map(m => console[m]);
  methods.forEach(m => { console[m] = (...args) => logged.push([m, ...args]); });
  const texts = [];
  try {
    const bodies = [
      ['/api/subscribe', { trial_days_left: marker, email: `${marker}@example.com` }],
      ['/api/verify', { razorpay_payment_id: marker, razorpay_subscription_id: marker, razorpay_signature: marker }],
      ['/api/verify', { razorpay_payment_id: 'pay_XYZ98765', razorpay_subscription_id: 'sub_ABC12345', razorpay_signature: 'a'.repeat(64) }],
      ['/api/restore', { restore_code: marker }],
      ['/api/restore', { restore_code: `sub_ABC12345.${marker}1234567` }],
      ['/api/restore', { restore_code: restoreCode('sub_ABC12345') }],
      ['/api/refresh', { token: marker }],
      ['/api/cancel', { token: `${marker}.${marker}` }],
      [`/api/${marker}`, { token: marker }],
    ];
    for (const [path, body] of bodies) {
      const res = await call(path, body);
      texts.push(await res.text(), JSON.stringify([...res.headers]));
    }
    for (const raw of [`{"${marker}":`, `["${marker}"]`, `${marker}`]) {
      const res = await send('/api/refresh', { headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: raw });
      texts.push(await res.text(), JSON.stringify([...res.headers]));
    }
    const res = await send('/api/refresh', { headers: { Origin: `https://${marker}.example`, 'Content-Type': 'application/json' }, body: '{}' });
    texts.push(await res.text(), JSON.stringify([...res.headers]));
    globalThis.fetch = async () => { throw new Error(marker); };
    const failed = await call('/api/subscribe', {});
    texts.push(await failed.text());
  } finally {
    methods.forEach((m, i) => { console[m] = saved[i]; });
  }
  assert.deepEqual(logged, []);
  for (const text of texts) {
    assert.ok(!text.includes(marker), text);
  }
});

// ---- 7. Plan choice ----------------------------------------------------------

const YEARLY = { ...env, RAZORPAY_PLAN_ID_YEARLY: 'plan_year456', TOTAL_COUNT_YEARLY: '12' };
const subscribeWith = (body, environment = env) => send('/api/subscribe', {
  headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body), environment,
});

test('no plan, null or "monthly" uses the monthly plan and TOTAL_COUNT', async () => {
  for (const body of [{}, { plan: null }, { plan: 'monthly' }, { trial_days_left: 2, plan: 'monthly' }]) {
    calls = [];
    const res = await subscribeWith(body, YEARLY);
    assert.equal(res.status, 200, JSON.stringify(body));
    const sent = JSON.parse(calls[0].init.body);
    assert.equal(sent.plan_id, 'plan_test123');
    assert.equal(sent.total_count, 120);
  }
});

test('"yearly" uses RAZORPAY_PLAN_ID_YEARLY and TOTAL_COUNT_YEARLY, with the same response shape', async () => {
  const res = await subscribeWith({ trial_days_left: 3, plan: 'yearly' }, YEARLY);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.deepEqual(Object.keys(data).sort(), ['key_id', 'restore_code', 'subscription_id']);
  assert.equal(data.restore_code, restoreCode(data.subscription_id));
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.plan_id, 'plan_year456');
  assert.equal(sent.total_count, 12);
  assert.deepEqual(sent.notes, { app: 'nanha-school' });
  assert.ok(sent.start_at > Math.floor(Date.now() / 1000) + 2 * 86400);   // trial still honoured
});

test('TOTAL_COUNT_YEARLY defaults to 10', async () => {
  const { TOTAL_COUNT_YEARLY, ...noCount } = YEARLY;
  assert.equal((await subscribeWith({ plan: 'yearly' }, noCount)).status, 200);
  assert.equal(JSON.parse(calls[0].init.body).total_count, 10);
});

test('"yearly" without a configured yearly plan is 400 plan_unavailable and never reaches Razorpay', async () => {
  for (const environment of [env, { ...env, RAZORPAY_PLAN_ID_YEARLY: '' }, { ...env, RAZORPAY_PLAN_ID_YEARLY: '   ' }]) {
    const res = await subscribeWith({ plan: 'yearly' }, environment);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'plan_unavailable' });
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN);
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
  }
  assert.equal(calls.length, 0);
});

test('any other plan value is 400 bad_request, never echoed, and never reaches Razorpay', async () => {
  const marker = 'ZQXPLAN';
  for (const plan of ['weekly', 'Yearly', 'MONTHLY', ' monthly', 'yearly ', '', 0, 1, true, false, [], ['yearly'],
    { yearly: true }, 'plan_year456', marker, '__proto__', 'constructor']) {
    const res = await subscribeWith({ plan }, YEARLY);
    assert.equal(res.status, 400, JSON.stringify(plan));
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { error: 'bad_request' });
    assert.ok(!text.includes(marker));
  }
  assert.equal(calls.length, 0);
});

test('the Android app can choose a plan with or without an Origin header', async () => {
  const shellEnv = { ...YEARLY, ALLOWED_ORIGINS: `${ORIGIN},https://appassets.androidplatform.net` };
  const noOrigin = await send('/api/subscribe', {
    headers: { 'Content-Type': 'application/json' }, body: '{"plan":"yearly"}', environment: shellEnv,
  });
  assert.equal(noOrigin.status, 200);
  const shell = await send('/api/subscribe', {
    headers: { Origin: 'https://appassets.androidplatform.net', 'Content-Type': 'application/json' },
    body: '{"plan":"monthly"}', environment: shellEnv,
  });
  assert.equal(shell.status, 200);
  assert.equal(shell.headers.get('Access-Control-Allow-Origin'), 'https://appassets.androidplatform.net');
});

// ---- 8. wrangler.toml --------------------------------------------------------

test('wrangler.toml allows the web app and the Android shell origins, and nothing else', async () => {
  const { readFileSync } = await import('node:fs');
  const toml = readFileSync(new URL('./wrangler.toml', import.meta.url), 'utf8');
  const line = toml.split('\n').find(l => /^ALLOWED_ORIGINS\s*=/.test(l));
  const value = JSON.parse(line.split('=').slice(1).join('=').trim());
  const configured = { ...env, ALLOWED_ORIGINS: value };
  assert.deepEqual(value.split(',').map(s => s.trim()).sort(),
      ['https://aditrikaushik.github.io', 'https://appassets.androidplatform.net']);
  for (const origin of ['https://aditrikaushik.github.io', 'https://appassets.androidplatform.net']) {
    const pre = await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: origin }, environment: configured });
    assert.equal(pre.status, 204, origin);
    assert.equal(pre.headers.get('Access-Control-Allow-Origin'), origin);
  }
  for (const origin of ['http://appassets.androidplatform.net', 'https://appassets.androidplatform.net.evil.example',
    'https://evil.androidplatform.net', 'file://']) {
    const pre = await send('/api/subscribe', { method: 'OPTIONS', headers: { Origin: origin }, environment: configured });
    assert.equal(pre.status, 403, origin);
  }
  // The yearly plan ships switched off until the owner sets it up.
  assert.doesNotMatch(toml, /^RAZORPAY_PLAN_ID_YEARLY\s*=/m);
  assert.match(toml, /^TOTAL_COUNT_YEARLY = "10"$/m);
});
