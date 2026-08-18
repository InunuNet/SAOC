#!/usr/bin/env node
// F9 (vendor-registration) — A4. Proves docs/vendor-registration.md carries a committee-facing
// note stating that whether SAOC verifies the three permit/certificate fields is a show
// -committee decision, not an engineering default -- mirroring the mission brief's own
// "Regulatory note" section verbatim in spirit. The doc's existing F9 placeholder line
// ("Adds a non-verification notice to the confirmation copy...") describes the vendor-facing
// copy (A3) but does not itself state the committee-decision framing this assertion requires,
// so this is a positive discriminator against the pre-F9 doc.
//
// Required (case-insensitive, normalised whitespace): the doc must contain a sentence
// matching /show.?committee/i in the same neighbourhood as /verif/i and /decision|default/i --
// i.e. it must actually say verification-or-not is a committee decision, not just mention
// "show committee" and "permit" somewhere unrelated.
//
// DEFEATING MUTATION: mentioning "show committee" in an unrelated context (e.g. booth
// allocation) without ever connecting it to permit verification; restating "not validated"
// without the committee-decision framing.
//
// Self-tests against three inline strings before trusting the live file: a WIRED sentence
// (must pass), an UNWIRED sentence mentioning only "show committee" (must fail), and a
// SCATTERED example containing all three required terms across separate sentences, never
// together (must fail) -- this last case is what defeated an earlier version of this check
// against the real pre-F9 doc, which independently mentions "show committee" (booth
// allocation), "verification" (a QA checklist heading), and "default" (rate-limit constants)
// in three unrelated places.
//
// Run as: node contracts/checks/vendor-f9-permit-posture/check-docs-committee-note.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { normalize } from './lib-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const COMMITTEE_RE = /show[- ]committee/i;
const VERIFY_RE = /verif/i;
const DECISION_RE = /decision|default/i;

// Scattered mentions of "show committee" (e.g. booth allocation), "verification" (e.g. an
// unrelated QA checklist heading), and "decision"/"default" (e.g. rate-limit constants) exist
// independently elsewhere in this doc and must NOT satisfy this check on their own -- the three
// concepts must appear together IN THE SAME SENTENCE, actually stating the committee-decision
// framing, not just co-occurring in the same file.
function evaluate(source) {
  const norm = normalize(source);
  const sentences = norm.split(/(?<=[.!?])\s+/);

  const matchingSentence = sentences.find(
    (s) => COMMITTEE_RE.test(s) && VERIFY_RE.test(s) && DECISION_RE.test(s),
  );

  if (matchingSentence) return [];

  const failures = [];
  if (!COMMITTEE_RE.test(norm)) failures.push('missing "show committee" reference anywhere');
  if (!VERIFY_RE.test(norm)) failures.push('missing a verification-related term ("verif...") anywhere');
  if (!DECISION_RE.test(norm)) failures.push('missing "decision"/"default" framing anywhere');
  if (failures.length === 0) {
    failures.push(
      'found "show committee", a verification term, and decision/default framing, but never together in one sentence',
    );
  }
  return failures;
}

// --- Self-test (inline, since this doc is a live file with no frozen fixture pair) --------

const wiredExample =
  'Whether SAOC is obliged to verify permit and certificate numbers is a decision for the ' +
  'show committee, not an engineering default.';
const unwiredExample = 'The show committee will allocate booth numbers manually.';
const scatteredExample =
  'The show committee will allocate booth numbers manually. ' +
  'Rate-limit constants are placeholders and not Council-approved defaults. ' +
  'See the integration checklist for QA/verification below.';

const wiredFailures = evaluate(wiredExample);
if (wiredFailures.length !== 0) {
  console.error(`SELF-TEST FAILED: inline WIRED example should pass but reported: ${wiredFailures.join('; ')}`);
  process.exit(1);
}

const unwiredFailures = evaluate(unwiredExample);
if (unwiredFailures.length === 0) {
  console.error('SELF-TEST FAILED: inline UNWIRED example should fail (mentions committee but not verification/decision).');
  process.exit(1);
}

const scatteredFailures = evaluate(scatteredExample);
if (scatteredFailures.length === 0) {
  console.error(
    'SELF-TEST FAILED: SCATTERED example should fail -- it contains all three terms but never in the same sentence, which must not satisfy this check.',
  );
  process.exit(1);
}

// --- Real check ----------------------------------------------------------

const targetFile = path.join(REPO_ROOT, 'docs/vendor-registration.md');
const source = readFileSync(targetFile, 'utf8');
const failures = evaluate(source);

if (failures.length > 0) {
  console.error(`FAIL: ${path.relative(REPO_ROOT, targetFile)} — ${failures.join('; ')}`);
  process.exit(1);
}

console.log('PASS: docs/vendor-registration.md states permit verification is a show-committee decision, not an engineering default.');
process.exit(0);
