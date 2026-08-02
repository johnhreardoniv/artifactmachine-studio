# The beacon

A first-party, cookieless visit counter for artifactmachine.studio.

## Why it exists

The site is served from GitHub Pages, which produces **no server logs of any
kind**. Until this is live, the studio cannot tell whether one human has ever
visited. `PRODUCT-REVENUE-ARCHITECTURE.md` §6 Job 2 states the consequence
exactly: *"without this, in 60 days the studio will know exactly what it knows
today."*

Stage 2's exit criteria are numeric — **≥200 unique visitors and ≥1 checkout
click in 60 days.** Neither number can be observed without this, so every
downstream decision in the stage plan is a guess until it is deployed.

## Why it was written rather than bought

Three hosted options were considered.

| | Cloudflare Web Analytics | GoatCounter | This |
|---|---|---|---|
| Cookieless | yes | yes | yes |
| Third-party script | **yes** | **yes** | no |
| Checkout clicks / grader runs | **no** | yes | yes |
| Free once the site takes money | yes | **non-commercial tier** | yes |

The deciding factor was the second row and the third. A third-party beacon would
make the site's own footer claim false, and Cloudflare Web Analytics — the
otherwise obvious pick — records pageviews only, which is precisely the number
Stage 2 does *not* turn on. It also reuses the Workers account that §6 Job 3's
free grader needs anyway, so none of it is throwaway.

## What it does not collect

No cookies. No `localStorage`. No fingerprinting. No raw IP is ever written to
storage — it exists only inside one function's stack frame, long enough to be
hashed. The hash is salted with a value that **rotates daily and expires after
48 hours**, so once a day has passed its identifiers cannot be reconstructed by
anyone, including the operator. That is what makes this a counter rather than a
tracker: there is no way to follow one person across two days.

Do Not Track and Global Privacy Control are honoured **client-side**, before any
request is made.

The honest limitation, stated because the site claims to state its limits: a
daily-rotating identifier cannot distinguish a returning visitor from a new one.
`uniqueVisitorDays` therefore counts a person who visits on three days as three.
It is an upper bound on reach, not a headcount, and Stage 2's 200-visitor bar
should be read that way.

## Deploy

Requires a Cloudflare login once. The domain is **not** on Cloudflare — it
resolves straight to GitHub Pages — so the Worker lives at its `workers.dev`
address and is called cross-origin, which is why it enforces an origin
allow-list rather than relying on same-origin.

```bash
cd analytics
npx wrangler login                      # one browser round trip

npm run setup                           # creates the KV namespace
# paste the printed id into wrangler.toml → [[kv_namespaces]] id

npx wrangler secret put STATS_TOKEN      # invent one; it guards /stats
npx wrangler secret put STATS_SALT_SEED  # invent one; keeps salts stable

npm run deploy                          # prints the workers.dev URL
```

Then set that URL in **`../assets/beacon.js`** → `ENDPOINT`, replacing
`REPLACE_ME`, and push the site.

**Until `REPLACE_ME` is replaced, `beacon.js` returns immediately and makes no
network call at all.** The site is safe to deploy before the Worker exists.

## Read the numbers

```bash
curl "https://artifact-machine-beacon.<sub>.workers.dev/stats?token=$STATS_TOKEN&days=30"
```

```json
{
  "totals": { "pageviews": 0, "checkoutClicks": 0, "uniqueVisitorDays": 0 },
  "days": [], "topPaths": [], "topReferrers": []
}
```

`checkoutClicks` and `uniqueVisitorDays` are the two Stage 2 gate numbers.

## Wiring new events

`beacon.js` exposes `window.am.track(event, label)`. The Worker rejects anything
not in the allow-list in `src/lib.js`.

```js
window.am.track('checkout_click', 'report-249');
window.am.track('grader_run');
window.am.track('email_capture', 'sample-report');
```

`pageview`, `tool_view` and `outbound` fire automatically — `outbound` matters
today because every tool page's call to action currently leaves for Apify, which
makes an outbound click the closest thing the site has to an expression of
intent.

## Tests

```bash
npm test      # 17 unit tests over the pure helpers
```

They cover the things worth being sure about: that a referrer's query string
never survives, that attacker-controlled fields are length-capped, that the
visitor hash is stable within a day and *unjoinable across* days, and that the
aggregate reports the Stage 2 numbers correctly.

Verified end-to-end against `wrangler dev --local` on 2026-08-02: origin
allow-list rejects a foreign origin with 403, an unknown event is rejected 400,
`/stats` without the token is 401, and ten seeded events aggregated correctly.

## Cost and limits

Free tier: 100k Worker requests/day, 1k KV writes/day, 100k KV reads/day. One
event is one KV write, so the write ceiling is ~1,000 events/day — far above any
traffic level this site is likely to see, and the whole question is whether it
sees any. `/stats` reads at most 20,000 records and sets `truncated: true` if it
hits that.
