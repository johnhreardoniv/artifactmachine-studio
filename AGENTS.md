# Artifact Machine site

- Current public site: `https://artifactmachine.studio/`, served by GitHub Pages from `main` with `CNAME` and `.nojekyll`. Check the live response and `origin/main` before deploying; an older `feat/beacon` branch contains a different Worker-based site and is not the current production source.
- The Meshtastic course lives in `meshtastic/` and is published at `https://artifactmachine.studio/meshtastic/`. `meshtastic/setup.html` is its three-device setup companion. Keep relative links and media assets working both at `/meshtastic/` and `/meshtastic/index.html`.
- The course is static HTML, CSS, JS, and local images. `node --check meshtastic/app.js` checks script syntax. Test the course, setup page, quiz progress, navigation, and narrow layout in a browser before publishing.
- Publish this GitHub Pages site by committing changes on current `main` and pushing to `origin main`, then verify the live URL. The Worker branch's `wrangler deploy` workflow does not publish the current site.
- Keep `.dev.vars`, `.wrangler/`, and `dist/` out of Git and the published site. Do not read or stage credentials.
