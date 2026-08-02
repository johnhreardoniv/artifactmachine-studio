/**
 * Artifact Machine — first-party visit counter.
 *
 * Why this exists: artifactmachine.studio is served from GitHub Pages, which
 * gives no server logs at all. Until this is deployed the studio cannot tell
 * whether a single human has ever visited, and PRODUCT-REVENUE-ARCHITECTURE.md
 * §6 Job 2 is exact about the consequence — "in 60 days the studio will know
 * exactly what it knows today."
 *
 * Why it is written rather than bought: a third-party beacon would make the
 * site's own footer claim false, and none of the free hosted options record
 * checkout clicks, which is the one number Stage 2's exit criteria turn on.
 *
 * What it deliberately does not do: no cookies, no localStorage, no device
 * fingerprint, no raw IP written to storage, no cross-day identity, and no
 * third-party network call. Do Not Track and Global Privacy Control are
 * honoured client-side, before the request is ever made.
 *
 * Endpoints:
 *   POST /hit    — record one event. Public, CORS-locked to the site origin.
 *   GET  /stats  — aggregated read. Requires STATS_TOKEN.
 *   GET  /health — liveness.
 */

import {
  RETENTION_SECONDS,
  aggregate,
  dayKey,
  normaliseHit,
  recentDays,
  visitorHash,
} from './lib.js';

const SITE_HOST = 'artifactmachine.studio';

const ALLOWED_ORIGINS = new Set([
  'https://artifactmachine.studio',
  'https://www.artifactmachine.studio',
]);

/** A ceiling on how much a single /stats call will read back out of KV. */
const MAX_RECORDS = 20000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (request.method === 'OPTIONS') return preflight(request);
      if (url.pathname === '/health') return json({ ok: true });
      if (url.pathname === '/hit' && request.method === 'POST') {
        return await recordHit(request, env);
      }
      if (url.pathname === '/stats' && request.method === 'GET') {
        return await readStats(url, env);
      }
      return json({ error: 'not found' }, 404);
    } catch (err) {
      // Never leak internals to the caller, but make the cause findable in logs.
      console.error('beacon error', err && err.stack ? err.stack : err);
      return json({ error: 'internal error' }, 500);
    }
  },
};

async function recordHit(request, env) {
  const origin = request.headers.get('Origin');
  if (!ALLOWED_ORIGINS.has(origin)) {
    return json({ error: 'origin not allowed' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return cors(json({ error: 'invalid JSON' }, 400), origin);
  }

  const result = normaliseHit(body, SITE_HOST);
  if (!result.ok) {
    return cors(json({ error: result.error }, 400), origin);
  }

  const date = dayKey();
  const visitor = await visitorHash({
    salt: await dailySalt(env, date),
    date,
    ip: request.headers.get('CF-Connecting-IP'),
    userAgent: request.headers.get('User-Agent'),
  });

  const record = { ...result.hit, d: date, v: visitor, t: Date.now() };

  // One KV key per event rather than a read-modify-write counter: concurrent
  // hits cannot lose each other, and the raw records stay sliceable later.
  await env.BEACON.put(`ev:${date}:${crypto.randomUUID()}`, JSON.stringify(record), {
    expirationTtl: RETENTION_SECONDS,
  });

  return cors(json({ ok: true }), origin);
}

/**
 * The salt that makes a visitor identifier un-joinable across days.
 *
 * Generated on first use each day and stored under its own key, so even the
 * operator cannot reconstruct an earlier day's identifiers once the salt has
 * expired. STATS_SALT_SEED keeps this stable across a Worker redeploy.
 */
async function dailySalt(env, date) {
  const key = `salt:${date}`;
  const existing = await env.BEACON.get(key);
  if (existing) return existing;

  const fresh = `${env.STATS_SALT_SEED ?? ''}:${crypto.randomUUID()}`;
  await env.BEACON.put(key, fresh, { expirationTtl: 2 * 24 * 60 * 60 });
  return fresh;
}

async function readStats(url, env) {
  const token = url.searchParams.get('token');
  if (!env.STATS_TOKEN || token !== env.STATS_TOKEN) {
    return json({ error: 'unauthorized' }, 401);
  }

  const days = clampDays(url.searchParams.get('days'));
  const records = [];

  // Listed one day at a time under an exact prefix. Listing all of `ev:` and
  // filtering afterwards would walk every retained day to answer a 30-day
  // question, which gets slower every month the site stays up.
  for (const date of recentDays(days)) {
    let cursor;
    do {
      const page = await env.BEACON.list({ prefix: `ev:${date}:`, cursor, limit: 1000 });
      const values = await Promise.all(page.keys.map((k) => env.BEACON.get(k.name, 'json')));
      records.push(...values.filter(Boolean));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor && records.length < MAX_RECORDS);
    if (records.length >= MAX_RECORDS) break;
  }

  const truncated = records.length >= MAX_RECORDS;
  return json({ windowDays: days, truncated, ...aggregate(records.slice(0, MAX_RECORDS)) });
}

function clampDays(raw) {
  const n = Number.parseInt(raw ?? '30', 10);
  if (!Number.isFinite(n)) return 30;
  return Math.min(Math.max(n, 1), 400);
}

function preflight(request) {
  const origin = request.headers.get('Origin');
  if (!ALLOWED_ORIGINS.has(origin)) return new Response(null, { status: 403 });
  return cors(new Response(null, { status: 204 }), origin);
}

function cors(response, origin) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
