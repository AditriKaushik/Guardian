// Nanha School subscription API — a Cloudflare Worker.
//
// Razorpay is the only source of truth: there is no database and no user
// accounts. After a parent pays, this Worker checks the payment with Razorpay
// (using the secret key, which never leaves the server) and hands the app a
// short, signed "pass" that says which subscription is active and until when.
// The app checks the pass with a public key, so it keeps working offline.
//
// Routes (all POST, JSON):
//   /api/subscribe  { email, trial_days_left }         -> { subscription_id, key_id }
//   /api/verify     { razorpay_payment_id,
//                     razorpay_subscription_id,
//                     razorpay_signature }             -> { token, exp }
//   /api/restore    { email, subscription_id }         -> { token, exp }
//   /api/refresh    { token }                          -> { token, exp }
//   /api/cancel     { token }                          -> { cancelled: true, ends_at }

const RAZORPAY = 'https://api.razorpay.com/v1';
const ACTIVE = new Set(['active', 'authenticated']);
const GRACE_SECONDS = 2 * 24 * 3600;           // keep working 2 days past renewal while payment retries
const FALLBACK_SECONDS = 3 * 24 * 3600;        // when Razorpay has no period end yet
const SUB_ID = /^sub_[A-Za-z0-9]{6,40}$/;
const PAY_ID = /^pay_[A-Za-z0-9]{6,40}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ error: 'not_found' }, 404, cors);
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_request' }, 400, cors);
    }
    if (!body || typeof body !== 'object') {
      return json({ error: 'bad_request' }, 400, cors);
    }
    try {
      const path = new URL(request.url).pathname;
      const route = ROUTES[path];
      if (!route) {
        return json({ error: 'not_found' }, 404, cors);
      }
      return json(await route(body, env), 200, cors);
    } catch (e) {
      if (e instanceof HttpError) {
        return json({ error: e.code }, e.status, cors);
      }
      return json({ error: 'server_error' }, 500, cors);
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

// ---- Routes ---------------------------------------------------------------

async function subscribe(body, env) {
  const email = cleanEmail(body.email);
  const request = {
    plan_id: env.RAZORPAY_PLAN_ID,
    total_count: Number(env.TOTAL_COUNT || 120),
    customer_notify: 1,
    notes: { email },
  };
  // A parent who subscribes during the free trial keeps the rest of it: the first
  // charge happens when the trial ends. Capped here so the app can't ask for more.
  const maxTrial = Number(env.TRIAL_DAYS || 7);
  const daysLeft = Math.min(Math.max(Math.floor(Number(body.trial_days_left) || 0), 0), maxTrial);
  if (daysLeft > 0) {
    request.start_at = Math.floor(Date.now() / 1000) + daysLeft * 86400;
  }
  const sub = await razorpay(env, 'POST', '/subscriptions', request);
  return { subscription_id: sub.id, key_id: env.RAZORPAY_KEY_ID };
}

async function verify(body, env) {
  const paymentId = str(body.razorpay_payment_id, PAY_ID);
  const subId = str(body.razorpay_subscription_id, SUB_ID);
  const signature = str(body.razorpay_signature, /^[a-f0-9]{64}$/);
  const expected = await hmacHex(env.RAZORPAY_KEY_SECRET, `${paymentId}|${subId}`);
  if (!timingSafeEqual(expected, signature)) {
    throw new HttpError(400, 'bad_signature');
  }
  const sub = await fetchSubscription(env, subId);
  return issue(sub, env);
}

async function restore(body, env) {
  const email = cleanEmail(body.email);
  const subId = str(body.subscription_id, SUB_ID);
  const sub = await fetchSubscription(env, subId);
  const owner = String((sub.notes && sub.notes.email) || '').toLowerCase();
  if (owner !== email) {
    throw new HttpError(404, 'not_found');   // same answer as a wrong ID, so IDs can't be probed
  }
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
  return { cancelled: true, ends_at: sub.current_end || null };
}

// ---- Passes (signed tokens) -----------------------------------------------

async function issue(sub, env) {
  if (!ACTIVE.has(sub.status)) {
    throw new HttpError(402, 'not_active');
  }
  const now = Math.floor(Date.now() / 1000);
  let end = now + FALLBACK_SECONDS;
  if (sub.current_end && sub.current_end > now) {
    end = sub.current_end;
  } else if (sub.start_at && sub.start_at > now) {
    end = sub.start_at;                        // subscribed during the trial; billing starts later
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
  if (typeof token !== 'string' || token.length > 600) {
    throw new HttpError(401, 'bad_token');
  }
  const [payload, sig] = token.split('.');
  if (!payload || !sig) {
    throw new HttpError(401, 'bad_token');
  }
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
  const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
  if (!data || !SUB_ID.test(data.sid)) {
    throw new HttpError(401, 'bad_token');
  }
  return data;
}

// ---- Razorpay -------------------------------------------------------------

async function fetchSubscription(env, subId) {
  return razorpay(env, 'GET', `/subscriptions/${subId}`);
}

async function razorpay(env, method, path, body) {
  const res = await fetch(RAZORPAY + path, {
    method,
    headers: {
      Authorization: 'Basic ' + btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'GET' && (res.status === 404 || res.status === 400)) {
    throw new HttpError(404, 'not_found');
  }
  if (!res.ok) {
    throw new HttpError(502, 'payment_provider_error');
  }
  return res.json();
}

// ---- Helpers --------------------------------------------------------------

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const headers = { Vary: 'Origin' };
  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '86400';
  }
  return headers;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function cleanEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!EMAIL.test(email)) {
    throw new HttpError(400, 'bad_email');
  }
  return email;
}

function str(value, pattern) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new HttpError(400, 'bad_request');
  }
  return value;
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
  return [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
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
