/**
 * Assemble dist/ — exactly the files that should be publicly served.
 *
 * An allow-list rather than an ignore-list, deliberately. An ignore-list fails
 * open: the day someone adds a directory of notes or a credentials file to the
 * repo root, an ignore-list publishes it and nobody notices. This fails closed
 * — anything not named here does not ship.
 */

import { cp, mkdir, rm, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/** Files and directories that make up the published site. */
const PUBLISH = [
  'index.html',
  'about.html',
  'lifecycle.html',
  'design-system.html',
  '404.html',
  'robots.txt',
  'sitemap.xml',
  'assets',
  'tools',
];

/**
 * Deliberately NOT published:
 *   CNAME, .nojekyll  — GitHub Pages artefacts, meaningless on Cloudflare
 *   worker/           — server source; it runs, it is not served
 *   scripts/          — build tooling
 *   analytics/        — superseded by worker/
 */

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  let files = 0;
  for (const entry of PUBLISH) {
    const src = join(ROOT, entry);
    try {
      await stat(src);
    } catch {
      throw new Error(`build-dist: "${entry}" is in the publish list but does not exist`);
    }
    await cp(src, join(DIST, entry), { recursive: true });
    files += await countFiles(join(DIST, entry));
  }

  console.log(`built dist/ — ${files} files from ${PUBLISH.length} entries`);
}

async function countFiles(path) {
  const info = await stat(path);
  if (!info.isDirectory()) return 1;
  const entries = await readdir(path);
  const counts = await Promise.all(entries.map((e) => countFiles(join(path, e))));
  return counts.reduce((a, b) => a + b, 0);
}

await main();
