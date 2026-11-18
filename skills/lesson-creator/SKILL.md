---
name: lesson-creator
description: Turn a topic and chosen depth and teaching style into a finished lesson or full course. Use for lesson and curriculum authoring rather than course website implementation or deployment.
---

# Lesson creator

Create lessons a learner can actually use. A topic-only request should produce a complete, scoped course rather than stopping at a syllabus. A request for one lesson should produce one finished lesson. Match the user's chosen format; do not assume every course needs a website.

## Inputs the user can choose

Accept these in natural language, in any order:

- **Topic** — required. Narrow a broad topic to a teachable promise and state the boundary.
- **Scope** — one lesson, short course, or full course. Default to a complete short course when the user gives only a topic.
- **Depth** — for example, *primer* (core mental model), *practical* (use, test, and troubleshoot), or *deep* (mechanisms, tradeoffs, and edge cases). Honor other levels, a numeric scale, or a requested duration. Depth changes what the learner can do and explain, not merely the word count.
- **Style** — for example, field guide, workshop, visual explainer, narrative, textbook, or reference. Accept blends and user-supplied examples. Style changes examples, pacing, and presentation; it must not change factual standards.
- **Audience and format** — use stated prior knowledge, equipment, constraints, and output format. If absent, assume a curious beginner and a portable Markdown course; use an existing project's format when working in one.

If depth or style is absent, infer it from context and state the choice briefly. With no clue, use practical depth and a clear, example-led style. Offer options when the missing preference would materially change the result. Do not make the user supply a full specification before producing work.

Example invocation: `$lesson-creator Topic: Meshtastic. Scope: full course. Depth: practical. Style: field guide. Audience: a first-time node owner. Format: HTML.`

## Author from the outcome backward

1. State the end capability in observable terms: what can the learner explain, decide, make, or test? For a course, order lessons so each new capability uses something learned or produced earlier.
2. Give each lesson one main question or decision. Explain the necessary model in plain language, show a concrete example, then give a small practice task. Use the learner's real context when available.
3. Describe what evidence would show the task worked. Label demonstrations, predictions, and untested examples accurately; do not present a simulated result as a field result.
4. End each lesson with a brief check of understanding, usually a short quiz. Prefer decisions and plausible misconceptions over trivia. Supply correct answers with explanations or accessible feedback so the learner can improve.
5. Give a multi-lesson course a final task or artifact that integrates its lessons. The artifact should be reviewable and its limits clear.

Do not repeat the same introduction at increasing length to simulate depth. A deeper course should add mechanisms, comparison, failure analysis, and transfer to unfamiliar cases. Keep prerequisite concepts visible without burying the learner in jargon.

## Ground the content

- Check current or niche claims against primary sources. Cite the specific source near the claim; distinguish source fact from inference.
- Verify exact product, software, and hardware variants before giving controls, firmware, or safety steps. If identity is unknown, give an identification step and conditional guidance.
- Let text carry the full lesson. Use diagrams, images, or video when they clarify a mechanism or physical action; provide attribution and alternatives where needed. A visual style calls for useful visuals, not decorative media.

## Deliver and review

- Deliver the finished lesson or all lessons in the requested format, not just an outline. For a long course, save the full artifact and provide a concise guide to it.
- Preserve the chosen scope, depth, and style consistently across lessons. Let lesson count and length follow the learning goal rather than a fixed template.
- Before finishing, check: Can the learner perform the stated outcome? Is each practice task doable with the stated materials? Does each quiz assess what the lesson taught? Are uncertain claims marked and sources usable? If interactive, do links, keyboard access, feedback, and progress work?
- If the work modifies an existing course, keep its navigation and saved learner progress working. Publish only when the user's request or existing authorization includes publication.
