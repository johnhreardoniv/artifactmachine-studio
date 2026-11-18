# Artifact Machine site

- Current public site: `https://artifactmachine.studio/`, served by GitHub Pages from `main` with `CNAME` and `.nojekyll`. Check the live response and `origin/main` before deploying; an older `feat/beacon` branch contains a different Worker-based site and is not the current production source.
- The Meshtastic journey lives in `meshtastic/`: Basics at `/meshtastic/`, Field Operations at `/meshtastic/field.html`, Mesh Design at `/meshtastic/design.html`, and the three-device setup companion at `/meshtastic/setup.html`. Keep relative links and media assets working both at `/meshtastic/` and `/meshtastic/index.html`.
- The courses are static HTML, CSS, JS, and local images. `node --check meshtastic/app.js` and `node --check meshtastic/journey.js` check script syntax. Test each course, setup page, quiz progress, navigation, and narrow layout in a browser before publishing. `meshtastic/COURSE_DESIGN.md` records the course design findings.
- The reusable explainer course skill is versioned at `skills/build-explainer-course/SKILL.md` and installed locally under `~/.codex/skills/build-explainer-course/`.
- Publish this GitHub Pages site by committing changes on current `main` and pushing to `origin main`, then verify the live URL. The Worker branch's `wrangler deploy` workflow does not publish the current site.
- Keep `.dev.vars`, `.wrangler/`, and `dist/` out of Git and the published site. Do not read or stage credentials.
