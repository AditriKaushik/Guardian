// Nanha School subscription API — a Cloudflare Worker.
//
// Razorpay is the only source of truth: there is no database and no user
// accounts. After a parent pays, this Worker checks the payment with Razorpay
// (using the secret key, which never leaves the server) and hands the app a
// short, signed "pass" that says which subscription is active and until when.
// The app checks the pass with a public key, so it keeps working offline.
//
// Privacy: the Worker never asks for, sends to Razorpay, stores or logs an email,
// phone number or any other personal data, and it never logs request bodies or tokens.
// A parent gets back into their subscription with a "restore code": the subscription
// ID plus a short MAC made with the server secret. It contains no personal data.
//
// Routes (all POST, Content-Type: application/json, body at most 4096 bytes):
//   /api/subscribe  { trial_days_left,
//                     plan?: "monthly" | "yearly" }     -> { subscription_id, key_id, restore_code }
//   /api/verify     { razorpay_payment_id,
//                     razorpay_subscription_id,
//                     razorpay_signature }             -> { token, exp }
//   /api/restore    { restore_code }                    -> { token, exp }
//   /api/refresh    { token }                           -> { token, exp }
//   /api/cancel     { token }                           -> { cancelled: true, ends_at }
//
// Errors are { "error": code } and never echo the request back:
//   400 bad_request | bad_signature | plan_unavailable   401 bad_token   402 not_active
//   403 forbidden_origin               404 not_found          413 payload_too_large
//   415 unsupported_media_type         429 too_many_requests  500 server_error
//   502 payment_provider_error

const RAZORPAY = 'https://api.razorpay.com/v1';
const RAZORPAY_TIMEOUT_MS = 15_000;
const ACTIVE = new Set(['active', 'authenticated']);
const GRACE_SECONDS = 2 * 24 * 3600;           // keep working 2 days past renewal while payment retries
const FALLBACK_SECONDS = 3 * 24 * 3600;        // when Razorpay has no period end yet
const MAX_BODY_BYTES = 4096;
const SUB_ID = /^sub_[A-Za-z0-9]{6,40}$/;
const PAY_ID = /^pay_[A-Za-z0-9]{6,40}$/;
const RESTORE_CODE = /^(sub_[A-Za-z0-9]{6,40})\.([A-Za-z0-9_-]{16})$/;
const RESTORE_PREFIX = 'nanha-restore|';
// A pass is exactly "<payload>.<sig>": base64url without padding, and a P-256
// P1363 signature is always 64 bytes = 86 characters.
const PASS = /^([A-Za-z0-9_-]{1,400})\.([A-Za-z0-9_-]{86})$/;

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  Vary: 'Origin',
};

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const headers = responseHeaders(request, env);
    try {
      return await handle(request, env, headers);
    } catch (e) {
      // Only fixed codes go back to the caller; nothing from the request or the error is echoed or logged.
      if (e instanceof HttpError) {
        return json({ error: e.code }, e.status, headers);
      }
      return json({ error: 'server_error' }, 500, headers);
    }
  },
};

const ROUTES = {
  '/api/subscribe': subscribe,
  '/api/verify': verify,
  '/api/restore': restore,
  '/api/refresh': refresh,
  '/api/cancel': cancel,
};

async function handle(request, env, headers) {
  // Browsers always send Origin on these requests; the Android app sends none.
  // A browser page from any other site is refused outright, preflight included.
  if (request.headers.has('Origin') && !headers['Access-Control-Allow-Origin']) {
    throw new HttpError(403, 'forbidden_origin');
  }
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') {
    throw new HttpError(404, 'not_found');
  }
  const path = new URL(request.url).pathname;
  const route = Object.hasOwn(ROUTES, path) ? ROUTES[path] : null;
  if (!route) {
    throw new HttpError(404, 'not_found');
  }
  if (await rateLimited(request, env, path)) {
    return json({ error: 'too_many_requests' }, 429, { ...headers, 'Retry-After': '60' });
  }
  // application/json is not a CORS "simple" content type, so a browser must
  // preflight first — which only the allowed origins pass.
  if (!isJsonContentType(request.headers.get('Content-Type'))) {
    throw new HttpError(415, 'unsupported_media_type');
  }
  const body = await readJsonBody(request);
  return json(await route(body, env), 200, headers);
}

// ---- Routes ---------------------------------------------------------------

/** The Razorpay plan for the parent's choice. No plan means monthly (older apps send none). */
function choosePlan(plan, env) {
  if (plan === undefined || plan === null || plan === 'monthly') {
    return { planId: env.RAZORPAY_PLAN_ID, totalCount: Number(env.TOTAL_COUNT || 120) };
  }
  if (plan === 'yearly') {
    if (typeof env.RAZORPAY_PLAN_ID_YEARLY !== 'string' || !env.RAZORPAY_PLAN_ID_YEARLY.trim()) {
      throw new HttpError(400, 'plan_unavailable');   // the owner hasn't set up a yearly plan
    }
    return { planId: env.RAZORPAY_PLAN_ID_YEARLY.trim(), totalCount: Number(env.TOTAL_COUNT_YEARLY || 10) };
  }
  throw new HttpError(400, 'bad_request');
}

async function subscribe(body, env) {
  const { planId, totalCount } = choosePlan(body.plan, env);
  const request = {
    plan_id: planId,
    total_count: totalCount,
    customer_notify: 1,
    notes: { app: 'nanha-school' },            // no personal data, ever
  };
  // A parent who subscribes during the free trial keeps the rest of it: the first
  // charge happens when the trial ends. Capped here so the app can't ask for more.
  const maxTrial = Number(env.TRIAL_DAYS || 7);
  const daysLeft = Math.min(Math.max(Math.floor(Number(body.trial_days_left) || 0), 0), maxTrial);
  if (daysLeft > 0) {
    request.start_at = Math.floor(Date.now() / 1000) + daysLeft * 86400;
  }
  const sub = await razorpay(env, 'POST', '/subscriptions', request);
  if (!sub || typeof sub.id !== 'string' || !SUB_ID.test(sub.id)) {
    throw new HttpError(502, 'payment_provider_error');
  }
  return {
    subscription_id: sub.id,
    key_id: env.RAZORPAY_KEY_ID,
    restore_code: `${sub.id}.${await restoreMac(env, sub.id)}`,
  };
}

async function verify(body, env) {
  const paymentId = str(body.razorpay_payment_id, PAY_ID);
  const subId = str(body.razorpay_subscription_id, SUB_ID);
  const signature = str(body.razorpay_signature, /^[a-f0-9]{64}$/);
  const expected = hex(await hmac(secret(env), `${paymentId}|${subId}`));
  if (!timingSafeEqual(expected, signature)) {
    throw new HttpError(400, 'bad_signature');
  }
  const sub = await fetchSubscription(env, subId);
  return issue(sub, env);
}

async function restore(body, env) {
  if (typeof body.restore_code !== 'string') {
    throw new HttpError(400, 'bad_request');
  }
  // Every kind of wrong code gets the same answer as an unknown subscription.
  const match = RESTORE_CODE.exec(body.restore_code);
  if (!match || !timingSafeEqual(await restoreMac(env, match[1]), match[2])) {
    throw new HttpError(404, 'not_found');
  }
  const sub = await fetchSubscription(env, match[1]);
  return issue(sub, env);
}

async function refresh(body, env) {
  const pass = await readPass(body.token, env);
  const sub = await fetchSubscription(env, pass.sid);
  return issue(sub, env);
}

async function cancel(body, env) {
  const pass = await readPass(body.token, env);
  const sub = await razorpay(env, 'POST', `/subscriptions/${pass.sid}/cancel`, { cancel_at_cycle_end: 1 });
  return { cancelled: true, ends_at: unixTime(sub && sub.current_end) || null };
}

// ---- Passes (signed tokens) -----------------------------------------------

async function issue(sub, env) {
  if (!sub || !ACTIVE.has(sub.status)) {
    throw new HttpError(402, 'not_active');
  }
  if (typeof sub.id !== 'string' || !SUB_ID.test(sub.id)) {
    throw new HttpError(502, 'payment_provider_error');
  }
  const now = Math.floor(Date.now() / 1000);
  const currentEnd = unixTime(sub.current_end);
  const startAt = unixTime(sub.start_at);
  let end = now + FALLBACK_SECONDS;
  if (currentEnd > now) {
    end = currentEnd;
  } else if (startAt > now) {
    end = startAt;                             // subscribed during the trial; billing starts later
  }
  const exp = end + GRACE_SECONDS;
  const payload = b64url(new TextEncoder().encode(JSON.stringify({ sid: sub.id, exp })));
  const key = await crypto.subtle.importKey(
      'jwk', JSON.parse(env.SIGNING_KEY_JWK), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(payload));
  return { token: `${payload}.${b64url(new Uint8Array(sig))}`, exp };
}

/** Checks a pass's signature. An expired pass is still accepted here, so it can be renewed. */
async function readPass(token, env) {
  const match = typeof token === 'string' ? PASS.exec(token) : null;
  if (!match) {
    throw new HttpError(401, 'bad_token');
  }
  const [, payload, sig] = match;
  const priv = JSON.parse(env.SIGNING_KEY_JWK);
  const pubJwk = { kty: priv.kty, crv: priv.crv, x: priv.x, y: priv.y };
  const key = await crypto.subtle.importKey(
      'jwk', pubJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, key, fromB64url(sig), new TextEncoder().encode(payload));
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new HttpError(401, 'bad_token');
  }
  let data;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(fromB64url(payload)));
  } catch {
    throw new HttpError(401, 'bad_token');
  }
  if (!data || typeof data !== 'object' || typeof data.sid !== 'string' || !SUB_ID.test(data.sid) ||
      !Number.isSafeInteger(data.exp)) {
    throw new HttpError(401, 'bad_token');
  }
  return { sid: data.sid, exp: data.exp };
}

// ---- Razorpay -------------------------------------------------------------

async function fetchSubscription(env, subId) {
  const sub = await razorpay(env, 'GET', `/subscriptions/${subId}`);
  if (!sub || sub.id !== subId) {
    throw new HttpError(502, 'payment_provider_error');
  }
  return sub;
}

async function razorpay(env, method, path, body) {
  const auth = 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${secret(env)}`);
  let res;
  try {
    res = await fetch(RAZORPAY + path, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(RAZORPAY_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'payment_provider_error');   // network failure or timeout
  }
  if (method === 'GET' && (res.status === 404 || res.status === 400)) {
    throw new HttpError(404, 'not_found');
  }
  if (!res.ok) {
    throw new HttpError(502, 'payment_provider_error');
  }
  try {
    return await res.json();
  } catch {
    throw new HttpError(502, 'payment_provider_error');
  }
}

// ---- Request handling -----------------------------------------------------

/** Security headers for every response, plus CORS headers when the Origin is allowed. */
function responseHeaders(request, env) {
  const headers = { ...SECURITY_HEADERS };
  const origin = request.headers.get('Origin');
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',')
      .map(s => s.trim().replace(/\/+$/, '').toLowerCase()).filter(Boolean);
  if (origin !== null && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

/** Uses the optional Workers Rate Limiting binding (see wrangler.toml); skipped when it isn't set up. */
async function rateLimited(request, env, path) {
  if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== 'function') {
    return false;
  }
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const result = await env.RATE_LIMITER.limit({ key: `${ip}|${path}` });
    return result.success === false;
  } catch {
    return false;   // fail open: a limiter outage must not stop parents from paying
  }
}

function isJsonContentType(value) {
  return typeof value === 'string' && value.split(';')[0].trim().toLowerCase() === 'application/json';
}

/** Reads at most MAX_BODY_BYTES without buffering anything larger, then parses a JSON object. */
async function readJsonBody(request) {
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large');
  }
  const chunks = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        throw new HttpError(413, 'payload_too_large');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let body;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new HttpError(400, 'bad_request');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'bad_request');
  }
  return body;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

// ---- Helpers --------------------------------------------------------------

function str(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new HttpError(400, 'bad_request');
  }
  return value;
}

/** A whole number of seconds from Razorpay, or 0 if it isn't one (never string-concatenated). */
function unixTime(value) {
  const n = typeof value === 'string' && /^\d{1,12}$/.test(value) ? Number(value) : value;
  return Number.isSafeInteger(n) && n > 0 ? n : 0;
}

function secret(env) {
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new Error('RAZORPAY_KEY_SECRET is not set');   // -> 500; never HMAC with an empty key
  }
  return env.RAZORPAY_KEY_SECRET;
}

/** Key for restore codes: its own secret when set, so rotating the Razorpay key after a leak
 *  doesn't break every parent's restore code. Falls back to the Razorpay secret. */
function restoreSecret(env) {
  return env.RESTORE_SECRET || secret(env);
}

async function hmac(keyText, message) {
  const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(keyText), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/** The MAC part of a restore code. restore-code.mjs computes the same thing for the owner. */
async function restoreMac(env, subId) {
  return b64url(await hmac(restoreSecret(env), RESTORE_PREFIX + subId)).slice(0, 16);
}

function hex(bytes) {
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function b64url(bytes) {
  let bin = '';
  for (const b of bytes) {
    bin += String.fromCharCode(b);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) {
    t += '=';
  }
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}
