# The Worker

`artifactmachine.studio` is one Cloudflare Worker: it serves the static site
from the assets binding and answers the beacon endpoints on the same origin.

## Why a Worker and not Pages

Cloudflare Pages 308-redirects `/about.html` to `/about`. That would have
silently changed every URL on the site — 12 sitemap entries and 21 internal
links on the homepage alone — and left the canonical tags pointing at URLs that
redirect. Workers static assets can be told not to:

```toml
html_handling = "none"          # serve /about.html as /about.html
not_found_handling = "404-page" # a real 404, not the homepage with status 200
```

Verified on 2026-08-02 against the GitHub Pages original: identical status codes
on every path tested, including the 404. The move changed no URL at all.

`html_handling = "none"` also switches off the implicit `/` → `/index.html`
mapping, which is why `worker/index.js` rewrites directory paths internally.
Internally, not a redirect — a redirect there would change the canonical URL of
the most important page on the site.

## Why the beacon lives here too

GitHub Pages produced no server logs, so the studio could not tell whether one
human had ever visited. `PRODUCT-REVENUE-ARCHITECTURE.md` §6 Job 2: *"without
this, in 60 days the studio will know exactly what it knows today."* Stage 2's
exit criteria are numeric — 200 unique visitors and 1 checkout click in 60 days
— and neither was observable.

Putting it in the same Worker means same-origin: no CORS, no second hostname, no
third party in the request path. The site's footer can say plainly that nothing
here is a tracker without qualifying it.

## What it does not collect

No cookies. No `localStorage`. No fingerprinting. No raw IP is written to
storage — it exists only inside one function's stack frame, long enough to be
hashed. The salt rotates daily and expires after 48 hours, so once a day has
passed its identifiers cannot be reconstructed by anyone, including the
operator. There is no way to follow one person across two days.

DNT and Global Privacy Control are honoured client-side, before any request.

The honest limitation: a daily-rotating identifier cannot tell a returning
visitor from a new one, so `uniqueVisitorDays` counts a person who visits on
three days as three. It is an upper bound on reach, not a headcount, and the
200-visitor bar should be read that way.

## Endpoints

| | |
|---|---|
| `POST /beacon/hit` | record one event |
| `GET /beacon/stats?token=…&days=30` | aggregated read |
| `GET /beacon/health` | liveness |

`assets/beacon.js` fires `pageview`, `tool_view` and `outbound` automatically and
exposes `window.am.track(event, label)` for the rest:

```js
window.am.track('checkout_click', 'report-249');
window.am.track('grader_run');
window.am.track('email_capture', 'sample-report');
```

The Worker rejects any event not in the allow-list in `lib.js`.

## Deploy

```bash
node scripts/build-dist.mjs   # assembles dist/ from an allow-list
npx wrangler deploy
```

`scripts/build-dist.mjs` uses an allow-list rather than an ignore-list on
purpose: an ignore-list fails open, and would publish a directory of notes or a
credentials file the day someone adds one to the repo root.

Read the numbers:

```bash
source ~/agent-credentials/artifact-machine/.env
curl "https://artifactmachine.studio/beacon/stats?token=$STATS_TOKEN&days=30"
```

`checkoutClicks` and `uniqueVisitorDays` are the two Stage 2 gate numbers.

## Secrets

Not in `wrangler.toml`. Set with `wrangler secret put`, recorded in
`~/agent-credentials/artifact-machine/.env`:

- `STATS_TOKEN` — guards `/beacon/stats`
- `STATS_SALT_SEED` — stabilises the daily salt across redeploys

## Tests

```bash
node --test "worker/test/*.test.js"
```

17 tests over the pure helpers: that a referrer's query string never survives,
that attacker-controlled fields are length-capped, that the visitor hash is
stable within a day and *unjoinable across* days, and that the aggregate
reports the Stage 2 numbers correctly.

## Cost

Free tier: 100k Worker requests/day, 1k KV writes/day. One event is one KV
write, so the ceiling is ~1,000 events/day — far above any traffic this site is
likely to see, and the whole question is whether it sees any.
