#!/usr/bin/env node
// Structural provisional-figure guard for /refunds — the REVISED POLICY-10
// (mission refunds-cancellation-terms, F1). The original POLICY-10 (still preserved
// verbatim in check-refunds-no-fabrication.mjs, now scoped to POLICY-09's sibling
// duty) banned ANY digit+unit refund figure (day/days/hour/hours/week/weeks/%/percent)
// anywhere on the page — correct while the council had supplied nothing, wrong once
// this feature adds real (estimated, disclosed) cancellation terms.
//
// This check proves a narrower, still-mechanical property instead of simply deleting
// the guard:
//
//   1. NO digit+unit figure may appear anywhere on the page OUTSIDE a
//      <mark data-provisional-figure="true">...</mark> region. The fabrication guard
//      survives for every figure not going through the provisional mechanism.
//   2. At least one such region must exist (the page must actually use the mechanism,
//      not merely avoid figures altogether — that would silently regress to the old
//      empty page this feature exists to fix).
//   3. EVERY such region must itself contain BOTH a real digit+unit figure AND the
//      literal visible word "provisional" as text content (case-insensitive) — not
//      just markup/attributes. This closes the weak-check hole: a page cannot pass by
//      wrapping something irrelevant in the mark while leaving the real figure bare
//      (see negative-mark-no-figure.html / negative-mark-no-word.html fixtures), and
//      cannot pass by putting the word "provisional" somewhere unrelated on the page
//      while the figure itself sits unwrapped (see negative-fabricated.html — the word
//      appears in the pre-existing legal-review banner, unrelated to the bare figure).
//
// What this does NOT prove: that the figures are correct, that council has seen them,
// or that no OTHER kind of fabricated claim (a spelled-out number, an invented
// non-numeric fact) slipped in — same scope limitation the original POLICY-10 documented.
//
// Usage:
//   node check-refunds-provisional-figures.mjs <url>
//   node check-refunds-provisional-figures.mjs --fixture <path-to-html-file>

const args = process.argv.slice(2);
let html;
let source;

if (args[0] === '--fixture') {
  const fs = await import('node:fs/promises');
  source = args[1];
  if (!source) {
    console.error('usage: check-refunds-provisional-figures.mjs --fixture <path>');
    process.exit(2);
  }
  html = await fs.readFile(source, 'utf8');
} else {
  source = args[0];
  if (!source) {
    console.error('usage: check-refunds-provisional-figures.mjs <url>');
    process.exit(2);
  }
  const res = await fetch(source);
  if (res.status !== 200) {
    console.error(`FAIL: ${source} did not return HTTP 200 (got ${res.status})`);
    process.exit(1);
  }
  html = await res.text();
}

let failed = false;

// NOTE on the trailing \b after "%": the ORIGINAL POLICY-10 pattern
// (check-refunds-no-fabrication.mjs) writes `(?:...|%|percent)\b` with one shared
// trailing \b for every alternative. That's a real, pre-existing bug: \b is a boundary
// between a \w and non-\w character, and "%" is itself non-\w, so `\b` immediately after
// a matched "%" only succeeds when the NEXT character is also a word character with no
// space (e.g. "50%refund") — the realistic case ("50% refund", "50%.", "50%" at end of
// string) silently fails to match. Verified: the original pattern does NOT catch "50%
// refund" despite the negative-control doc's claim it fires on synthetic "50%" text.
// This check does not repeat that bug — % and percent get their own un-anchored-at-the-
// end alternative. Flagged for @dev to also fix in check-refunds-no-fabrication.mjs.
//
// NOTE on spelled-out day/hour/week thresholds (found by @dev, 2026-09-06): the legacy
// POLICY-09 script only bans DIGIT-based figures. Writing every threshold spelled out
// ("thirty days" instead of "30 days") is therefore the only way this feature can ever
// satisfy A12 (legacy script must keep passing unmodified) while also satisfying A4 —
// but a spelled-out threshold ("thirty days") is just as real a figure as "30 days", so
// the anti-vacuity property (a mark must contain an ACTUAL figure, not arbitrary text)
// has to recognise both forms, on both sides of the check: a bare "thirty days" sitting
// OUTSIDE a mark must still fail (#1), and a mark's own content must accept a spelled-out
// figure as satisfying "contains a real figure" (#3) — otherwise @dev's fully-disclosed,
// fully-marked tree (the correct, more-disclosed state per the team lead) would wrongly
// fail #3 for every day/week threshold. See golden §8 for the corrected record — the
// original claim that the legacy script keeps passing unmodified once real day/hour/week
// figures land was wrong; it only holds because those figures are spelled out.
//
// NUMBER_WORD covers one..ninety (with an optional hyphenated/spaced ones-word after a
// tens-word, e.g. "twenty-one" / "twenty one") — enough range for realistic cancellation
// windows without trying to parse arbitrary English number phrases.
const NUMBER_WORD =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|' +
  'fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|' +
  'eighty|ninety)(?:[-\\s](?:one|two|three|four|five|six|seven|eight|nine))?';
const UNIT = '(?:days?|hours?|weeks?)';

// Non-global for repeated .test() calls in a loop (a global regex's .test() mutates
// lastIndex across calls and would silently skip matches on later iterations).
const FIGURE_PATTERN = new RegExp(
  `\\b\\d+\\s*${UNIT}\\b|\\b\\d+\\s*%|\\b\\d+\\s*percent\\b|\\b${NUMBER_WORD}\\s*${UNIT}\\b`,
  'i'
);
// Global, single-use, only for extracting the first match text for an error message.
const FIGURE_PATTERN_G = new RegExp(
  `\\b\\d+\\s*${UNIT}\\b|\\b\\d+\\s*%|\\b\\d+\\s*percent\\b|\\b${NUMBER_WORD}\\s*${UNIT}\\b`,
  'gi'
);
const MARK_PATTERN = /<mark\b[^>]*data-provisional-figure="true"[^>]*>([\s\S]*?)<\/mark>/gi;

function stripTags(s) {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const markBlocks = [...html.matchAll(MARK_PATTERN)].map((m) => m[1]);
const htmlWithoutMarks = html.replace(MARK_PATTERN, ' ');

// 1. No bare figure outside any provisional-figure mark.
const outsideText = stripTags(htmlWithoutMarks);
const bareFigure = outsideText.match(FIGURE_PATTERN_G);
if (bareFigure) {
  console.error(
    `FAIL: unconfirmed figure "${bareFigure[0]}" appears outside any ` +
    `data-provisional-figure region`
  );
  failed = true;
}

// 2. At least one provisional-figure region exists.
if (markBlocks.length === 0) {
  console.error('FAIL: no data-provisional-figure region found on the page');
  failed = true;
}

// 3. Every provisional-figure region carries both a real figure and the visible word
//    "provisional" — proves the marker is bound to the actual number, not decorative.
markBlocks.forEach((block, i) => {
  const text = stripTags(block);
  const hasFigure = FIGURE_PATTERN.test(text);
  const hasWord = /\bprovisional\b/i.test(text);
  if (!hasFigure || !hasWord) {
    console.error(
      `FAIL: provisional-figure region #${i + 1} does not carry both a real figure and ` +
      `the word "provisional" as visible text: "${text}"`
    );
    failed = true;
  }
});

if (!failed) {
  console.log(
    `OK: ${source} — every unconfirmed figure is bound to a disclosed provisional marker`
  );
}
process.exit(failed ? 1 : 0);
