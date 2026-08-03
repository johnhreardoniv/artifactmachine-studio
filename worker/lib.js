/**
 * Artifact Machine beacon — pure helpers.
 *
 * Everything here is side-effect free and returns new objects, so the Worker's
 * request path stays easy to reason about and each piece is testable alone.
 */

/** Events the beacon will record. Anything else is rejected at the boundary. */
export const EVENTS = new Set([
  'pageview',
  'tool_view',
  'checkout_click',
  'grader_run',
  'email_capture',
  'outbound',
]);

/** Hard caps, so a hostile client cannot write large values into KV. */
const MAX_PATH = 128;
const MAX_REF = 96;

/** Keep ~13 months, enough to compare a year over year, then let KV drop it. */
export const RETENTION_SECONDS = 400 * 24 * 60 * 60;

/**
 * A visitor identifier that is not a cookie and not reversible to a person.
 *
 * SHA-256 over a rotating daily salt, the date, the IP and the user agent —
 * then truncated to 16 hex characters. The raw IP is never written anywhere:
 * it exists only inside this function's stack frame. Because the salt and the
 * date both change every day, yesterday's identifier cannot be joined to
 * today's, which is what keeps this a *counter* rather than a tracker.
 *
 * The truncation is deliberate. 64 bits is ample to separate a handful of
 * daily visitors and far too short to be useful as a durable identifier.
 */
export async function visitorHash({ salt, date, ip, userAgent }) {
  const material = `${salt}|${date}|${ip ?? ''}|${userAgent ?? ''}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(material));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

/** UTC day key. UTC rather than local so the salt rotation has one clear edge. */
export function dayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/** The last `days` day keys, most recent first. */
export function recentDays(days, now = new Date()) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    return dayKey(d);
  });
}

/**
 * Reduce a referrer to its bare hostname, or 'direct'.
 *
 * Full referrer URLs can carry query strings with personal data in them, and
 * the studio has no use for the path anyway — the only question is which
 * channel produced the visit.
 */
export function referrerHost(raw, selfHost) {
  if (!raw) return 'direct';
  try {
    const host = new URL(raw).hostname.replace(/^www\./, '');
    if (!host || host === selfHost) return 'internal';
    return host.slice(0, MAX_REF);
  } catch {
    return 'direct';
  }
}

/**
 * Validate a beacon payload and return a normalised copy, or an error.
 *
 * Returns `{ ok: true, hit }` or `{ ok: false, error }` rather than throwing,
 * so the caller decides the status code in one place.
 */
export function normaliseHit(body, selfHost) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'body must be a JSON object' };
  }

  const event = typeof body.e === 'string' && body.e ? body.e : 'pageview';
  if (!EVENTS.has(event)) {
    return { ok: false, error: `unknown event: ${event}` };
  }

  if (typeof body.p !== 'string' || !body.p.startsWith('/')) {
    return { ok: false, error: 'p must be an absolute path' };
  }

  const hit = {
    e: event,
    p: body.p.split('?')[0].slice(0, MAX_PATH),
    r: referrerHost(typeof body.r === 'string' ? body.r : '', selfHost),
  };

  // Optional free-text label, used for which tool an outbound click left toward.
  if (typeof body.l === 'string' && body.l) {
    return { ok: true, hit: { ...hit, l: body.l.slice(0, MAX_REF) } };
  }
  return { ok: true, hit };
}

/**
 * Fold raw hit records into the shape §6 Job 2 asks for.
 *
 * Unique visitors are counted per day and then summed, so a person who returns
 * on three days counts three times. That is the honest reading of a rotating
 * daily identifier — it cannot tell a returning visitor from a new one, and
 * pretending otherwise would overstate reach.
 */
export function aggregate(records) {
  const byDay = new Map();
  const paths = new Map();
  const referrers = new Map();
  const events = new Map();

  for (const rec of records) {
    const day = byDay.get(rec.d) ?? { visitors: new Set(), hits: 0 };
    day.visitors.add(rec.v);
    day.hits += 1;
    byDay.set(rec.d, day);

    events.set(rec.e, (events.get(rec.e) ?? 0) + 1);
    if (rec.e === 'pageview') {
      paths.set(rec.p, (paths.get(rec.p) ?? 0) + 1);
      referrers.set(rec.r, (referrers.get(rec.r) ?? 0) + 1);
    }
  }

  const days = [...byDay.entries()]
    .map(([date, d]) => ({ date, uniques: d.visitors.size, hits: d.hits }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  return {
    totals: {
      hits: records.length,
      uniqueVisitorDays: days.reduce((sum, d) => sum + d.uniques, 0),
      pageviews: events.get('pageview') ?? 0,
      checkoutClicks: events.get('checkout_click') ?? 0,
      graderRuns: events.get('grader_run') ?? 0,
      emailCaptures: events.get('email_capture') ?? 0,
    },
    days,
    topPaths: rank(paths),
    topReferrers: rank(referrers),
    events: Object.fromEntries(events),
  };
}

function rank(counter, limit = 25) {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}
