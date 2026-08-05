#!/usr/bin/env node
// F4 (cms-loop-and-wiring): A5 — regression + migration-completeness check. Two
// independent conditions, both required for a PASS:
//   (a) SOURCE: components/judging/AwardsGrid.tsx no longer imports the static
//       `@/lib/data/awards` array — proves the dual-source-of-truth risk
//       docs/f4-orphaned-types-recon.md flagged (§3 point 5) has actually been
//       retired, not just that a Sanity-backed path was added alongside it.
//   (b) LIVE STEADY STATE: the deployed /judging page still renders all six award
//       codes in the curated order (AM, FCC, HCC, CCM, CBR, JC) AND the four
//       non-dash threshold values (AM/SAOC '80–89 pts', FCC/SAOC '90+ pts',
//       HCC/SAOC '75–79 pts', CCM/SAOC '80+ pts'). CBR/SAOC and JC/SAOC are
//       DELIBERATELY not asserted here — their threshold is '—', and
//       AwardsGrid.tsx only renders the threshold paragraph when
//       `award.threshold && award.threshold !== '—'`, so their correct behaviour is
//       to render NO threshold line at all; asserting '—' would be a wrong
//       assertion, not a stricter one.
//
// WHY (b) ALONE PROVES NOTHING WITHOUT (a): the CURRENT static `lib/data/awards`
// import already renders all six codes in this exact curated order with these exact
// threshold values — that's WHY it was a plausible seed source in the first place.
// (b) passing today is expected and does not indicate the CMS wiring works; only (a)
// flipping from FAIL to PASS indicates the static fallback has genuinely been retired
// in favour of the Sanity-backed path this mission is proving out via A1/A2's dynamic
// round trips.
//
// EXPECTED RESULT TODAY: FAIL — (a) is false (the static import is still present).
// (b) is expected to already be TRUE today (the static array already renders
// correctly) — that is normal and does not indicate the fix landed; only PASS once
// both conditions hold together.
//
// Run as: node contracts/checks/cms-loop-f4-orphaned-types/check-award-static-migration.mjs
// Exit codes: 0 = static import retired AND live content/order correct. 1 = either
// condition fails, or the live host is unreachable — never a skip.

import { readFileSync } from 'node:fs';
import { fetchPublicPageContains } from '../f6-prove-cms-loop/_shared.mjs';
import { AWARD_PAGE_PATH, CURATED_AWARD_CODES, CURATED_AWARD_THRESHOLDS } from './_award-target.mjs';
import { renderedOrder } from './_order-detect.mjs';

const AWARDS_GRID_PATH = new URL('../../../components/judging/AwardsGrid.tsx', import.meta.url);

console.log('--- Condition (a): static import retired? ---');
let sourceText;
try {
  sourceText = readFileSync(AWARDS_GRID_PATH, 'utf8');
} catch (err) {
  console.error(`FAIL: could not read components/judging/AwardsGrid.tsx — ${err.message}`);
  process.exit(1);
}
const stillImportsStatic = /from\s+['"]@\/lib\/data\/awards['"]/.test(sourceText);
console.log(`AwardsGrid.tsx imports '@/lib/data/awards': ${stillImportsStatic}`);
if (stillImportsStatic) {
  console.error(
    'FAIL: components/judging/AwardsGrid.tsx still imports the static @/lib/data/awards array. ' +
      'Expected before @dev retires it per docs/f4-orphaned-types-recon.md §3 point 5 — not yet a bug on its own, ' +
      'but this check requires the migration to be COMPLETE, not just the Sanity path added alongside the static one.'
  );
  process.exit(1);
}

console.log('--- Condition (b): live page renders correct curated order + thresholds ---');
const result = await fetchPublicPageContains('__never_matches__', AWARD_PAGE_PATH);
if (result.status !== 200) {
  console.error(`FAIL: expected 200 from ${AWARD_PAGE_PATH}, got ${result.status}`);
  process.exit(1);
}
const html = result.body;

const order = renderedOrder(html, CURATED_AWARD_CODES);
const orderCorrect = JSON.stringify(order) === JSON.stringify(CURATED_AWARD_CODES);
console.log('Rendered order:', order, '| matches curated sequence:', orderCorrect);
if (!orderCorrect) {
  console.error(
    `FAIL: rendered order on ${AWARD_PAGE_PATH} is ${JSON.stringify(order)}, expected exactly ${JSON.stringify(CURATED_AWARD_CODES)}.`
  );
  process.exit(1);
}

let thresholdFailures = 0;
for (const [code, expectedThreshold] of Object.entries(CURATED_AWARD_THRESHOLDS)) {
  if (expectedThreshold === null) {
    console.log(`  [skip] ${code}: threshold is '—', correctly renders no threshold line — not asserted.`);
    continue;
  }
  const present = html.includes(expectedThreshold);
  console.log(`  [${present ? 'PASS' : 'FAIL'}] ${code}: threshold "${expectedThreshold}" present: ${present}`);
  if (!present) thresholdFailures += 1;
}
if (thresholdFailures > 0) {
  console.error(`FAIL: ${thresholdFailures} expected threshold value(s) missing from the live page.`);
  process.exit(1);
}

console.log('PASS: static import retired AND live /judging page renders correct curated order and threshold values.');
process.exit(0);
