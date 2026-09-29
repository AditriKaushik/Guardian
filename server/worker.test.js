import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
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

function sign(paymentId, subId, secret = env.RAZORPAY_KEY_SECRET) {
  return createHmac('sha256', secret).update(`${paymentId}|${subId}`).digest('hex');
}

async function passIsValid(token) {
  const [payload, sig] = token.split('.');
  const bytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, bytes(sig), new TextEncoder().encode(payload));
}

function addSub(id, fields) {
  subs.set(id, { id, status: 'active', notes: { email: 'parent@example.com' }, current_end: 2_000_000_000, ...fields });
}

test('only the app\'s own site gets CORS access', async () => {
  const ok = await worker.fetch(new Request('https://api.example/api/subscribe', { method: 'OPTIONS', headers: { Origin: ORIGIN } }), env);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const evil = await worker.fetch(new Request('https://api.example/api/subscribe', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }), env);
  assert.equal(evil.headers.get('Access-Control-Allow-Origin'), null);
});

test('subscribe creates a Razorpay subscription for the plan, tagged with the email', async () => {
  const res = await call('/api/subscribe', { email: '  Parent@Example.com ' });
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.match(data.subscription_id, /^sub_/);
  assert.equal(data.key_id, 'rzp_test_key');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.plan_id, 'plan_test123');
  assert.equal(sent.notes.email, 'parent@example.com');
  assert.match(calls[0].init.headers.Authorization, /^Basic /);
});

test('a Razorpay setup mistake is reported as a provider error, not "not found"', async () => {
  globalThis.fetch = async () => new Response('{"error":{"description":"The id provided does not exist"}}', { status: 400 });
  const res = await call('/api/subscribe', { email: 'parent@example.com' });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'payment_provider_error');
});

test('subscribe rejects a bad email', async () => {
  const res = await call('/api/subscribe', { email: 'not-an-email' });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'bad_email');
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

test('no pass for a subscription that is not active', async () => {
  addSub('sub_HALTED123', { status: 'halted' });
  const res = await call('/api/verify', {
    razorpay_payment_id: 'pay_XYZ98765',
    razorpay_subscription_id: 'sub_HALTED123',
    razorpay_signature: sign('pay_XYZ98765', 'sub_HALTED123'),
  });
  assert.equal(res.status, 402);
});

test('restore needs the email the subscription was bought with', async () => {
  addSub('sub_ABC12345');
  const wrong = await call('/api/restore', { email: 'someone@else.com', subscription_id: 'sub_ABC12345' });
  assert.equal(wrong.status, 404);
  const right = await call('/api/restore', { email: 'PARENT@example.com', subscription_id: 'sub_ABC12345' });
  assert.equal(right.status, 200);
  assert.equal(await passIsValid((await right.json()).token), true);
});

test('refresh renews a genuine pass and rejects a tampered one', async () => {
  addSub('sub_ABC12345');
  const first = await (await call('/api/restore', { email: 'parent@example.com', subscription_id: 'sub_ABC12345' })).json();

  const renewed = await call('/api/refresh', { token: first.token });
  assert.equal(renewed.status, 200);

  const [payload, sig] = first.token.split('.');
  const forged = btoa(JSON.stringify({ sid: 'sub_OTHER1234', exp: 9_999_999_999 })).replace(/=+$/, '') + '.' + sig;
  const bad = await call('/api/refresh', { token: forged });
  assert.equal(bad.status, 401);
  assert.equal(payload.length > 0, true);
});

test('cancel stops renewal at the end of the paid period', async () => {
  addSub('sub_ABC12345');
  const { token } = await (await call('/api/restore', { email: 'parent@example.com', subscription_id: 'sub_ABC12345' })).json();
  const res = await call('/api/cancel', { token });
  assert.equal(res.status, 200);
  const cancelCall = calls.find(c => String(c.url).endsWith('/cancel'));
  assert.deepEqual(JSON.parse(cancelCall.init.body), { cancel_at_cycle_end: 1 });
});

test('subscribing during the trial delays the first charge, capped at 7 days', async () => {
  const before = Math.floor(Date.now() / 1000);
  await call('/api/subscribe', { email: 'parent@example.com', trial_days_left: 5 });
  const sent = JSON.parse(calls[0].init.body);
  assert.ok(sent.start_at >= before + 5 * 86400 && sent.start_at <= before + 5 * 86400 + 5);

  calls = [];
  await call('/api/subscribe', { email: 'parent@example.com', trial_days_left: 365 });
  assert.ok(JSON.parse(calls[0].init.body).start_at <= before + 7 * 86400 + 5);

  calls = [];
  await call('/api/subscribe', { email: 'parent@example.com', trial_days_left: 0 });
  assert.equal(JSON.parse(calls[0].init.body).start_at, undefined);
});

test('a pass bought during the trial lasts until billing starts', async () => {
  const startAt = Math.floor(Date.now() / 1000) + 4 * 86400;
  addSub('sub_TRIAL1234', { status: 'authenticated', current_end: null, start_at: startAt });
  const res = await call('/api/restore', { email: 'parent@example.com', subscription_id: 'sub_TRIAL1234' });
  assert.equal((await res.json()).exp, startAt + 2 * 24 * 3600);
});

test('unknown routes and non-POST requests are 404', async () => {
  assert.equal((await call('/api/nope', {})).status, 404);
  const get = await worker.fetch(new Request('https://api.example/api/verify', { method: 'GET' }), env);
  assert.equal(get.status, 404);
});
