---
name: role-design-craft
description: Craft floor and verification method for @designer subagents producing UI, so the output is specific to the brief, meets accessibility minimums and is checked by looking at a rendered screenshot.
usage: Preloaded into every @designer dispatch. Read it before planning any screen, follow sections 1 to 7 in order, and return the screenshot paths with the work.
---

# role-design-craft

## 1. Start from a subject

Name the subject before choosing any colour or layout. Write three lines: audience (who, on what device, under what light), job (the one thing they must finish on this screen), and tone (three adjectives you could defend against the brief). If the brief is silent, propose one concrete subject and state it in the handoff. Never design for "a generic app".

Pick one memorable element: a typographic move, image, interaction or structural idea that only this subject would have. Everything else stays quiet and disciplined. Spend boldness in one place.

## 2. Plan the system before code

Write the plan first, as short prose and a small table:

- **Colour:** 4 to 6 named hex values, each with a role (surface, text, accent, border, signal). Tint secondary text from the hue. Never use neutral grey on a coloured surface. Do not stand tinted near-black in for black unless that is the intent.
- **Type:** one family, or two clearly distinct families. Name the roles (display, body, data) and a scale of 4 to 6 steps with weight and tracking. Body text runs 65 to 75 characters per line.
- **Spacing:** one base unit and its multiples. Related items sit tight, groups are separated generously, and space above a heading is larger than space below it.
- **Layout grid:** column count per breakpoint, alignment (left unless there is a reason otherwise), and where the memorable element sits.

Then review the plan against the brief. Ask whether the same plan would fit any similar product. If it would, change the generic part, and record what you changed and why.

## 3. AI-default tells to avoid

Each item below is a default, not a choice. Remove it unless the brief asks for it by name:

- A warm cream background with a high-contrast serif and a terracotta accent.
- A near-black background with one acid-green or vermilion accent.
- Identical rounded cards in a grid, one border radius on everything, the same soft grey shadow under each.
- A hero with a big number, a small label, supporting stats and a gradient accent.
- A tracked-out ALL-CAPS eyebrow label above every heading.
- Section numbers (01, 02, 03) where the content is not a sequence.
- Gradient text, and glass blur used as decoration.
- A coloured side border thicker than 1px on cards, alerts or list items.
- A monospace face used as a costume for "technical".
- Unicode glyphs or emoji standing in for icons. Use one drawn icon set at one stroke weight.
- Meta strings joined with middle dots, and labels written as "WORD — fragment".
- An arrow appended to every link and button.
- A modal for a task that needs neither interruption nor protected focus.
- Fade-and-slide-up on every section. One authored page-load moment is enough.

## 4. Craft floor (non-negotiable)

Every screen meets all of these before handoff:

- **Contrast:** body text and input text at least 4.5:1. Large text, input borders, meaningful icons and focus indicators at least 3:1.
- **Focus:** a visible focus ring on every interactive element, at least 2px and at least 3:1 against its surroundings. Never remove an outline without a replacement.
- **Reduced motion:** wrap motion in `prefers-reduced-motion`, and keep state changes visible without it. Do not kill every transition with a blanket 0.01ms rule, because that also removes feedback.
- **States:** hover, disabled, loading, error and empty for every control and every list or data view. An empty state says what will appear here and offers the first action.
- **Measure:** body text at 65 to 75 characters per line.
- **Responsive:** no horizontal scroll and no clipped text down to 360px wide. Test the real copy, not filler.
- **Touch targets:** at least 44px in each direction, with spacing between neighbours.
- **Browser surfaces:** theme text selection, the caret and scrollbars from the palette. Use tabular numerals in numeric columns.

## 5. Copy

Write in active voice. A button names its action: "Save changes", not "Submit". An action keeps its name through the whole flow, so a button labelled "Publish" produces a confirmation that says "Published". Write errors that name the problem and the recovery: "Email needs an @ sign. Add it and try again", not "Invalid input". Errors never apologise. Empty states invite the next action. Use sentence case and plain verbs, with no filler.

## 6. Verify by looking

You have no shell, so ask the lead or the dev to run this at each shipped width (360, 768 and 1440 px):

`python3 execution/browser_qa.py --url <url> --screenshot <png> --width 360` (then `--width 768` and `--width 1440`)

Then Read every PNG. Batch your checks: list every defect one look reveals, fix them together, and only then request a new render. Do not request a render after every tweak.

Exit code 2 means no screenshot engine is available (no Playwright and no Chromium-family browser), or an assertion was requested without Playwright. That is never a PASS. Report it and ask for the environment to be fixed. Never claim a design is done without a screenshot of it at all three widths, and name the screenshot paths in the handoff.

Where a browser tool is available to you, use reconnaissance then action: load the page, wait for the network to settle, take a screenshot, read the rendered structure, then exercise the controls. Check the focus order by tabbing through the page and capturing a screenshot of each state that matters.

## 7. Critique and audit

Critique the render through three lenses. Job: can the user finish the task within seconds? Cognitive load: at most four choices at any decision point, one primary action, and context shown where it is needed. Heuristics: status feedback, error recovery, consistency, and recognition over recall. Score each lens 0 to 4.

Rank every finding:

- **P0:** blocks the task or breaks a floor rule, such as contrast below minimum, no focus ring, or content clipped at 360px.
- **P1:** a major defect, such as a missing state, a missing WCAG AA item, or a generic default that makes the page interchangeable with any other.
- **P2:** a minor annoyance with a workaround.
- **P3:** polish.

Fix every P0 and P1 before handoff, re-render, and re-check. Keep P3 short, because a long tail buries the important items.

## Sources

- `anthropics/skills`, `skills/frontend-design/SKILL.md`: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md. Licence not stated in the text read.
- `pbakaus/impeccable`, `skill/SKILL.src.md`: https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md. Apache-2.0 per prior research notes; not re-checked in this read.
- `pbakaus/impeccable`, `skill/reference/craft-floor.md`: https://github.com/pbakaus/impeccable/blob/main/skill/reference/craft-floor.md. Same licence note as above.
- `pbakaus/impeccable`, `skill/reference/audit.md`: https://github.com/pbakaus/impeccable/blob/main/skill/reference/audit.md. Same licence note as above.
- `pbakaus/impeccable`, `skill/reference/critique-rubric.md`: https://github.com/pbakaus/impeccable/blob/main/skill/reference/critique-rubric.md. Same licence note as above.
- `anthropics/skills`, `skills/webapp-testing/SKILL.md`: https://github.com/anthropics/skills/blob/main/skills/webapp-testing/SKILL.md. Licence not stated in the text read. Used for the look-at-the-render pattern only.

This skill is distilled prose, not a copy of the sources. Every script, binary, download, hook and remote-fetch instruction in them was dropped.
