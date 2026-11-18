# What this course build taught us

Prepared 2026-11-17 while extending the Meshtastic Basics course into Field Operations and Mesh Design. These are working design findings from the build, not claims that every topic needs the same format.

## The useful progression

The three courses have different jobs: **understand and configure**, **operate and measure**, then **design and maintain**. Course 2 uses the user's existing three radios and produces a route card. Course 3 uses that route card to produce a deployment plan. The next course begins with an artifact from the previous one, so the sequence has a reason to exist.

## What made the lessons work

- A lesson teaches one consequential decision and ends with a small action. For example, a coverage lesson asks the learner to compare repeated message delivery at named stops, not memorize a claimed maximum distance.
- The lab produces evidence: settings, place, message outcome, or battery trend. It distinguishes **measured**, **predicted**, and **untested** results.
- Short quizzes test whether the learner can choose the right next step. Plausible wrong answers expose a common misconception; silly alternatives contribute little. Three questions fit the short lessons here, but the count is a format choice rather than a universal rule.
- Physical hardware instructions need exact model identity. The P1 Pro is confirmed; the separate SenseCAP and Wio tracker variants remain unconfirmed. Conditional device guidance is safer and more honest than invented button sequences.
- Primary documentation supports each technical lesson. Vendor material supports the hardware steps; Meshtastic documentation supports protocol behavior. The course links specific pages near the claim so it can be refreshed when firmware or UI changes.
- Images should explain a real component, placement, or path, with attribution near the image. An original diagram is often more useful than a decorative photo. Video is optional and should not carry a step that the text omits.
- A learner needs a way to tell success from appearance. A sender status, discovered node, or predicted coverage map does not prove that the intended recipient received a message.
- The course should work without an account or external video service. Local quiz progress and static HTML keep the basic learning path usable offline. A click-to-load video pattern avoids loading external media before the learner asks for it.

## Build and review criteria for future explainers

1. State the audience, existing knowledge, available equipment, and the concrete outcome.
2. Outline a progression where each section adds a capability and produces or improves an artifact.
3. Verify unstable technical claims against current primary sources; label inference, model assumptions, and untested instructions.
4. Write text that is complete without video or imagery, then add media only where it improves understanding. Keep licenses and credits.
5. Use a practice prompt after each meaningful concept. If quizzes fit, test decisions and misconceptions, then explain or highlight answers.
6. Check the rendered page, narrow layout, keyboard access, internal links, media behavior, and persistence. Test the live URL after publishing.

## Limits observed here

- The field route and larger mesh plan are instructional artifacts. No physical field results have been supplied; examples and worksheets are not measured coverage claims.
- The two tracker model labels still need confirmation for device-specific power and firmware steps. The published setup lab marks its alternative device instructions as conditional.
- The existing course design is a useful pattern, not a required visual template for unrelated explainers.
