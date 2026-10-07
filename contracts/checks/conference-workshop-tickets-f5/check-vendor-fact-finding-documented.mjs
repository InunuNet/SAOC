// F5 (conference-workshop-tickets, M3) — A7: the doc states plainly that no
// Exhibitor-vs-Vendor role selector, "Indoor/Outdoors", or "Full Access" concept exists
// anywhere in the current codebase — a FACTUAL finding (confirmed by repo-wide grep,
// per the golden), not a guess around Brad's message. Checks docs/national-show-
// conference-workshop-tickets.md for the three claims, each stated as a real absence
// (not merely mentioning the terms as part of quoting Brad/Lee-Ann's source text).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_REL_PATH = 'docs/national-show-conference-workshop-tickets.md';
const docPath = path.join(__dirname, '../../../', DOC_REL_PATH);

const failures = [];
let source;
try {
  source = readFileSync(docPath, 'utf8');
} catch (error) {
  console.error('FAIL: check-vendor-fact-finding-documented.mjs');
  console.error(`  - could not read ${DOC_REL_PATH}: ${error.message}`);
  process.exit(1);
}

// Each claim must appear near an absence word (no/zero/does not/nowhere/no match) within
// a reasonably tight window — a bare mention of the term while quoting Brad/Lee-Ann's
// source text (which uses these terms without negation) must not satisfy this.
const ABSENCE_WORDS = /\b(no|zero|does not|nowhere|never|not exist|no match(es)?)\b/i;

function hasNegatedClaim(term) {
  const termRegex = new RegExp(term, 'gi');
  let match;
  while ((match = termRegex.exec(source)) !== null) {
    const windowStart = Math.max(0, match.index - 150);
    const windowEnd = Math.min(source.length, match.index + term.length + 150);
    const window = source.slice(windowStart, windowEnd);
    if (ABSENCE_WORDS.test(window)) return true;
  }
  return false;
}

if (!hasNegatedClaim('Exhibitor.{0,20}Vendor|role selector')) {
  failures.push('no negated claim found for "Exhibitor vs Vendor role selector" — the doc must state plainly that none exists, not just mention the idea');
}
if (!hasNegatedClaim('Indoor.?Outdoor')) {
  failures.push('no negated claim found for "Indoor/Outdoors" — the doc must state it exists nowhere in the codebase');
}
if (!hasNegatedClaim('Full Access')) {
  failures.push('no negated claim found for "Full Access" — the doc must state it exists nowhere in the codebase');
}

if (failures.length > 0) {
  console.error('FAIL: check-vendor-fact-finding-documented.mjs');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASS: the doc states, as a negated fact, that no role selector, Indoor/Outdoors, or Full Access concept exists in the codebase.');
