# Codex adversarial review: nos-landing-v1

You are reviewing a diff to the NOS hub page (app/(nos)/national-show/page.tsx and the files spec.md section 4 lists). Run in the PR worktree. Do not fix anything; report findings.

Authority: .agent/memory/project/specs/nos-landing-v1/goldens/sources/content.md is Lee-Ann's document; goldens/classification.json says which of its lines are copy, instruction or ambiguous; goldens/copy.json lists every string the page must render; goldens/spec.md has the decisions D1-D10 as ruled by the lead.

Try to break it. Specifically:
1. Byte-compare every unit in copy.json against the rendered HTML of / on the NOS host (build with the nos-content-standard build.sh, start with next start, curl). Report any difference, however small: a straightened apostrophe, a dropped italic, a corrected typo ("can be judges", "Ten judging groups", "13 Judging Groups"), trimmed punctuation, a changed case.
2. Find text rendered that is not in the doc: invented labels, aria-labels carrying copy, a Register Here control or link, an invented href, blurbs for Past shows/Previous editions, placeholder or "coming soon" prose. Her inline notes ("Copy needs to be provided", "The blow needs to be added", "Link is good") must not appear anywhere in the served HTML, including meta and JSON-LD.
3. Check the old wording is gone from description metadata and JSON-LD (old lede, About lead/body/heading, main's CLOSING) and that the four retained blocks (dates card, programme rows, exhibit block) are unchanged.
4. Check the diff did not touch shared chrome (components/chrome, components/nos-chrome, components/newsletter), lib/show-title.ts, Sanity or Firestore, or add a colour/font/token.
5. Check the two components (JudgingGroupCard, ExhibitorStageCard) changed only to take an optional description / data-lp and render identically for existing props.
6. Check the groups: 13 cards, 1-10 with descriptions whose italic spans match the source's *...* spans exactly, 11-13 with no description element and no empty element.
7. Check accessibility basics only for what changed: one h1, heading order h1 > h2 > h3, no duplicated ids, links have text.
8. Look for ways the gate could pass while the page is wrong: run checks/mutation-suite.mjs and think of a mutant it does not cover.

Verdict: PASS, FAIL (with the evidence) or BLOCKED. List findings by severity with file:line and the measured evidence.
