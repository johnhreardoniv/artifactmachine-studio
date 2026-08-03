/**
 * artifactmachine.studio — the whole site, as one Worker.
 *
 * Serves the static site from the assets binding and handles the beacon
 * endpoints on the same origin. Everything else falls through to assets, so
 * adding a page means adding a file and nothing here changes.
 *
 * Why a Worker rather than Cloudflare Pages: Pages rewrites /about.html to
 * /about with a 308, which would have silently changed every URL on the site —
 * 12 sitemap entries and 21 internal links on the homepage alone. Workers
 * static assets can be told not to (`html_handling = "none"` in wrangler.toml),
 * which makes the move off GitHub Pages URL-for-URL identical rather than
 * merely byte-for-byte.
 */

import { handleHit, handleStats } from './beacon.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      if (url.pathname === '/beacon/hit') {
        if (request.method !== 'POST') return methodNotAllowed('POST');
        return await handleHit(request, env);
      }

      if (url.pathname === '/beacon/stats') {
        if (request.method !== 'GET') return methodNotAllowed('GET');
        return await handleStats(url, env);
      }

      if (url.pathname === '/beacon/health') {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return await env.ASSETS.fetch(withDirectoryIndex(request, url));
    } catch (err) {
      // Never leak internals, but make the cause findable in `wrangler tail`.
      console.error('worker error', err && err.stack ? err.stack : err);

      // A beacon failure must never take the site down with it. Anything that
      // is not a beacon path still gets served from assets.
      if (!url.pathname.startsWith('/beacon/')) {
        return env.ASSETS.fetch(request);
      }
      return new Response(JSON.stringify({ error: 'internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

/**
 * Map a directory path to its index.html.
 *
 * `html_handling = "none"` is what preserves the site's .html URLs, but it also
 * switches off the implicit "/" -> "/index.html" mapping, which would 404 the
 * homepage. Rewriting internally rather than redirecting means "/" stays "/" in
 * the address bar — a redirect here would change the canonical URL of the most
 * important page on the site, which is the exact problem this setup exists to
 * avoid.
 */
function withDirectoryIndex(request, url) {
  if (!url.pathname.endsWith('/')) return request;

  const rewritten = new URL(url);
  rewritten.pathname = `${url.pathname}index.html`;
  return new Request(rewritten, request);
}

function methodNotAllowed(allowed) {
  return new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: allowed },
  });
}
