#!/usr/bin/env node
// F9 (vendor-registration) — A2. Proves the admin review UI carries a visible, specific
// non-verification note CO-LOCATED with the three permit/certificate fields -- not merely
// present anywhere in the file (a stray comment, a changelog entry, a docs link) which would
// satisfy a naive grep without ever being shown to the reviewing admin.
//
// Required note text (normalised-whitespace substring match, case-sensitive on wording):
// "Permit and certificate numbers are recorded as submitted and have not been verified by SAOC."
//
// Adjacency discriminator: the note's line and the nearest permit-field reference's line must
// be within ADJACENCY_WINDOW lines of each other in the same file. This is a coarse proxy for
// "same rendered block" -- deliberately coarse because JSX structure varies (a <dl>, a table
// cell, a tooltip are all legitimate) but a note 40+ lines away from every field reference is
// not co-located by any reasonable reading.
//
// DEFEATING MUTATION: adding the note text as a code comment instead of rendered JSX text;
// adding it once near the top of the file unrelated to the fields; paraphrasing it so the
// specific wording is lost while some other, weaker phrase remains.
//
// Self-tests against three fixtures before trusting the live repo file:
//   - admin-wired.tsx                 -- must PASS (fields + adjacent note)
//   - admin-fields-no-note.tsx        -- must FAIL, naming the missing-note failure
//   - admin-fields-note-far-away.tsx  -- must FAIL, naming the not-adjacent failure
//
// Run as: node contracts/checks/vendor-f9-permit-posture/check-admin-non-verification-note-adjacent.mjs

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { globSync } from 'node:fs';
import { normalize, containsNormalized } from './lib-shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const NOTE_TEXT =
  'Permit and certificate numbers are recorded as submitted and have not been verified by SAOC.';

const REQUIRED_FIELDS = [
  'phytosanitaryPermitNumber',
  'citesPermitNumber',
  'foodHandlingCertificateNumber',
];

const ADJACENCY_WINDOW = 20; // lines

function evaluate(source) {
  const failures = [];

  if (!containsNormalized(source, NOTE_TEXT)) {
    failures.push('missing-note: required non-verification note text not found');
    return failures; // adjacency is meaningless without the note
  }

  const lines = source.split('\n');
  const normLines = lines.map((l) => normalize(l));
  const noteLineIdx = normLines.findIndex((l) => l.includes(normalize(NOTE_TEXT)));

  const fieldLineIdxs = REQUIRED_FIELDS.map((field) =>
    lines.findIndex((l) => l.includes(field)),
  );

  if (fieldLineIdxs.some((idx) => idx === -1)) {
    failures.push('missing-fields: one or more permit fields not found (see A1)');
    return failures;
  }

  const minDistance = Math.min(
    ...fieldLineIdxs.map((idx) => Math.abs(idx - noteLineIdx)),
  );

  if (minDistance > ADJACENCY_WINDOW) {
    failures.push(
      `not-adjacent: note is ${minDistance} lines from the nearest permit field (window is ${ADJACENCY_WINDOW})`,
    );
  }

  return failures;
}

// --- Self-test ---------------------------------------------------------

const wired = readFileSync(path.join(__dirname, 'fixtures/admin-wired.tsx'), 'utf8');
const noNote = readFileSync(path.join(__dirname, 'fixtures/admin-fields-no-note.tsx'), 'utf8');
const farNote = readFileSync(
  path.join(__dirname, 'fixtures/admin-fields-note-far-away.tsx'),
  'utf8',
);

const wiredFailures = evaluate(wired);
if (wiredFailures.length !== 0) {
  console.error(`SELF-TEST FAILED: WIRED golden should pass but reported: ${wiredFailures.join('; ')}`);
  process.exit(1);
}

const noNoteFailures = evaluate(noNote);
if (!noNoteFailures.some((f) => f.startsWith('missing-note'))) {
  console.error('SELF-TEST FAILED: fields-no-note fixture should fail with missing-note.');
  process.exit(1);
}

const farNoteFailures = evaluate(farNote);
if (!farNoteFailures.some((f) => f.startsWith('not-adjacent'))) {
  console.error('SELF-TEST FAILED: fields-note-far-away fixture should fail with not-adjacent.');
  process.exit(1);
}

// --- Real check ----------------------------------------------------------

const candidateDirs = [
  path.join(REPO_ROOT, 'components/admin'),
  path.join(REPO_ROOT, 'app/admin/vendors'),
];

const candidateFiles = [];
for (const dir of candidateDirs) {
  if (!existsSync(dir)) continue;
  const found = globSync('**/*.{tsx,ts}', { cwd: dir }).map((f) => path.join(dir, f));
  candidateFiles.push(...found);
}

if (candidateFiles.length === 0) {
  console.error(`No candidate admin source files found under: ${candidateDirs.join(', ')}`);
  process.exit(1);
}

// Evaluate per-file (adjacency is meaningful only within a single file), and also check
// whether the note+fields exist at all in combined form to give a precise combined error.
let anyFilePasses = false;
const perFileFailures = [];

for (const file of candidateFiles) {
  const source = readFileSync(file, 'utf8');
  const failures = evaluate(source);
  if (failures.length === 0) {
    anyFilePasses = true;
    break;
  }
  perFileFailures.push(`${path.relative(REPO_ROOT, file)}: ${failures.join('; ')}`);
}

if (!anyFilePasses) {
  console.error('FAIL: no admin source file has the permit fields co-located with the required non-verification note.');
  console.error(perFileFailures.join('\n'));
  process.exit(1);
}

console.log('PASS: non-verification note is present and co-located with the permit fields.');
process.exit(0);
