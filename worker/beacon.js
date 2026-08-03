/**
 * The beacon endpoints, mounted under /beacon on the site's own origin.
 *
 * Same-origin is the point. Because the site and this handler are one Worker
 * on one hostname, there is no CORS, no second domain, and no third party in
 * the request path — which is what lets the site's footer say plainly that
 * nothing here is a tracker without qualifying it.
 */

import { RETENTION_SECONDS, aggregate, dayKey, normaliseHit, recentDays, visitorHash } from './lib.js';

const SITE_HOST = 'artifactmachine.studio';

/** A ceiling on how much a single /stats call will read back out of KV. */
const MAX_RECORDS = 20000;

export async function handleHit(request, env) {
  // Same-origin POSTs do send an Origin header. A missing one is tolerated
  // (some privacy tooling strips it) but a foreign one is refused. This is a
  // hygiene guard on a counter, not a security boundary — nothing here is
  // worth forging, and it holds no data that a visitor did not just send.
  const origin = request.headers.get('Origin');
  if (origin) {
    try {
      const host = new URL(origin).hostname.replace(/^www\./, '');
      if (host !== SITE_HOST && host !== 'localhost') {
        return json({ error: 'origin not allowed' }, 403);
      }
    } catch {
      return json({ error: 'bad origin' }, 400);
    }
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  const result = normaliseHit(body, SITE_HOST);
  if (!result.ok) return json({ error: result.error }, 400);

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

  return json({ ok: true });
}

/**
 * The salt that makes a visitor identifier un-joinable across days.
 *
 * Generated on first use each day and expired after 48 hours, so once a day
 * has passed its identifiers cannot be reconstructed by anyone, including the
 * operator. STATS_SALT_SEED keeps this stable across a redeploy.
 */
async function dailySalt(env, date) {
  const key = `salt:${date}`;
  const existing = await env.BEACON.get(key);
  if (existing) return existing;

  const fresh = `${env.STATS_SALT_SEED ?? ''}:${crypto.randomUUID()}`;
  await env.BEACON.put(key, fresh, { expirationTtl: 2 * 24 * 60 * 60 });
  return fresh;
}

export async function handleStats(url, env) {
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
