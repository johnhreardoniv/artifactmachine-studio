import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  aggregate,
  dayKey,
  normaliseHit,
  recentDays,
  referrerHost,
  visitorHash,
} from '../src/lib.js';

const SELF = 'artifactmachine.studio';

test('referrerHost reduces a URL to a bare hostname', () => {
  assert.equal(referrerHost('https://news.ycombinator.com/item?id=1', SELF), 'news.ycombinator.com');
  assert.equal(referrerHost('https://www.google.com/search?q=secret', SELF), 'google.com');
});

test('referrerHost never leaks a query string', () => {
  const host = referrerHost('https://mail.example.com/x?token=abc123&email=a@b.c', SELF);
  assert.equal(host, 'mail.example.com');
  assert.ok(!host.includes('token'));
  assert.ok(!host.includes('@'));
});

test('referrerHost classifies empty, self and malformed', () => {
  assert.equal(referrerHost('', SELF), 'direct');
  assert.equal(referrerHost(undefined, SELF), 'direct');
  assert.equal(referrerHost('not a url', SELF), 'direct');
  assert.equal(referrerHost(`https://${SELF}/tools/x.html`, SELF), 'internal');
});

test('normaliseHit defaults to pageview and strips the query string', () => {
  const r = normaliseHit({ p: '/tools/schema-audit.html?utm_source=x' }, SELF);
  assert.equal(r.ok, true);
  assert.equal(r.hit.e, 'pageview');
  assert.equal(r.hit.p, '/tools/schema-audit.html');
});

test('normaliseHit rejects an unknown event', () => {
  const r = normaliseHit({ p: '/', e: 'exfiltrate' }, SELF);
  assert.equal(r.ok, false);
  assert.match(r.error, /unknown event/);
});

test('normaliseHit rejects a non-absolute path', () => {
  assert.equal(normaliseHit({ p: 'https://evil.test/x' }, SELF).ok, false);
  assert.equal(normaliseHit({ p: 42 }, SELF).ok, false);
  assert.equal(normaliseHit(null, SELF).ok, false);
});

test('normaliseHit caps attacker-controlled lengths', () => {
  const r = normaliseHit({ p: '/' + 'a'.repeat(5000), e: 'outbound', l: 'b'.repeat(5000) }, SELF);
  assert.equal(r.ok, true);
  assert.ok(r.hit.p.length <= 128);
  assert.ok(r.hit.l.length <= 96);
});

test('normaliseHit does not mutate its input', () => {
  const input = { p: '/x?y=1', e: 'pageview' };
  const frozen = JSON.stringify(input);
  normaliseHit(input, SELF);
  assert.equal(JSON.stringify(input), frozen);
});

test('visitorHash is stable within a day and unjoinable across days', async () => {
  const base = { salt: 's1', ip: '1.2.3.4', userAgent: 'UA' };
  const a = await visitorHash({ ...base, date: '2026-08-02' });
  const b = await visitorHash({ ...base, date: '2026-08-02' });
  const c = await visitorHash({ ...base, date: '2026-08-03' });

  assert.equal(a, b, 'same day, same visitor → same hash');
  assert.notEqual(a, c, 'next day → different hash');
  assert.equal(a.length, 16);
});

test('visitorHash changes when the salt rotates', async () => {
  const base = { date: '2026-08-02', ip: '1.2.3.4', userAgent: 'UA' };
  const a = await visitorHash({ ...base, salt: 's1' });
  const b = await visitorHash({ ...base, salt: 's2' });
  assert.notEqual(a, b);
});

test('visitorHash does not contain the IP', async () => {
  const h = await visitorHash({ salt: 's', date: '2026-08-02', ip: '203.0.113.9', userAgent: 'UA' });
  assert.ok(!h.includes('203'));
  assert.ok(/^[0-9a-f]{16}$/.test(h));
});

test('recentDays returns N descending day keys', () => {
  const days = recentDays(3, new Date('2026-08-02T12:00:00Z'));
  assert.deepEqual(days, ['2026-08-02', '2026-08-01', '2026-07-31']);
});

test('dayKey is UTC', () => {
  assert.equal(dayKey(new Date('2026-08-02T23:59:59Z')), '2026-08-02');
});

test('aggregate counts uniques per day, not across the window', () => {
  const out = aggregate([
    { d: '2026-08-02', v: 'aaa', e: 'pageview', p: '/', r: 'direct' },
    { d: '2026-08-02', v: 'aaa', e: 'pageview', p: '/about.html', r: 'direct' },
    { d: '2026-08-01', v: 'bbb', e: 'pageview', p: '/', r: 'google.com' },
  ]);

  assert.equal(out.totals.hits, 3);
  assert.equal(out.totals.pageviews, 3);
  // Two distinct visitor-days: aaa on the 2nd, bbb on the 1st.
  assert.equal(out.totals.uniqueVisitorDays, 2);
  assert.equal(out.days[0].date, '2026-08-02');
  assert.equal(out.days[0].uniques, 1);
  assert.equal(out.days[0].hits, 2);
});

test('aggregate surfaces the Stage 2 exit-criteria numbers', () => {
  const out = aggregate([
    { d: '2026-08-02', v: 'a', e: 'pageview', p: '/', r: 'direct' },
    { d: '2026-08-02', v: 'a', e: 'checkout_click', p: '/', r: 'direct' },
    { d: '2026-08-02', v: 'b', e: 'grader_run', p: '/', r: 'direct' },
    { d: '2026-08-02', v: 'b', e: 'email_capture', p: '/', r: 'direct' },
  ]);

  assert.equal(out.totals.checkoutClicks, 1);
  assert.equal(out.totals.graderRuns, 1);
  assert.equal(out.totals.emailCaptures, 1);
  assert.equal(out.totals.pageviews, 1);
});

test('aggregate ranks paths and referrers by pageviews only', () => {
  const out = aggregate([
    { d: '2026-08-02', v: 'a', e: 'pageview', p: '/', r: 'direct' },
    { d: '2026-08-02', v: 'b', e: 'pageview', p: '/', r: 'news.ycombinator.com' },
    { d: '2026-08-02', v: 'c', e: 'pageview', p: '/about.html', r: 'direct' },
    { d: '2026-08-02', v: 'c', e: 'outbound', p: '/never-ranked', r: 'direct' },
  ]);

  assert.deepEqual(out.topPaths[0], { name: '/', count: 2 });
  assert.equal(out.topPaths.length, 2, 'outbound path is not ranked as a page');
  assert.deepEqual(out.topReferrers[0], { name: 'direct', count: 2 });
});

test('aggregate handles an empty window without throwing', () => {
  const out = aggregate([]);
  assert.equal(out.totals.hits, 0);
  assert.equal(out.totals.uniqueVisitorDays, 0);
  assert.deepEqual(out.days, []);
  assert.deepEqual(out.topPaths, []);
});
