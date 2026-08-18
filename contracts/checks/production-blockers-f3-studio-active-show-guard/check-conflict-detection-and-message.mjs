#!/usr/bin/env node
// Behavioural proof of lib/active-show-guard.ts's findConflictingActiveShow() and
// formatActiveShowConflictMessage(), run against the fixtures in
// contracts/golden/production-blockers-f3-studio-active-show-guard/fixtures/. Real
// function calls — no source grep. This is the logic the Studio `active` field's
// Rule.custom() validator calls; proving it here, against fixtures, means the guard's
// decision and wording are verified without writing to a live Sanity dataset (see
// README "Why a pure module, not a live-dataset check").
//
// Run as: node --import tsx/esm
//   contracts/checks/production-blockers-f3-studio-active-show-guard/check-conflict-detection-and-message.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  findConflictingActiveShow,
  formatActiveShowConflictMessage,
} from '../../../lib/active-show-guard.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(
  __dirname,
  '../../golden/production-blockers-f3-studio-active-show-guard/fixtures'
);

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'));
}

const failures = [];

// Case 1: no other show is active — ticking Active here must be allowed.
{
  const others = loadFixture('no-other-active.json');
  const result = findConflictingActiveShow(others);
  if (result !== null) {
    failures.push(`no-other-active.json: expected null, got ${JSON.stringify(result)}`);
  }
}

// Case 2: exactly one other show is already active — the conflict must name it and
// report zero additional conflicts.
{
  const others = loadFixture('one-other-active.json');
  const result = findConflictingActiveShow(others);
  if (!result || result.conflict._id !== 'show-19-2027' || result.additionalCount !== 0) {
    failures.push(
      `one-other-active.json: expected conflict show-19-2027 with additionalCount 0, got ${JSON.stringify(result)}`
    );
  }
  const message = formatActiveShowConflictMessage(result);
  const requiredSubstrings = [
    '19th SAOC National Show',
    '2027',
    'Only one show can be Active at a time',
  ];
  for (const substring of requiredSubstrings) {
    if (!message.includes(substring)) {
      failures.push(`one-other-active.json message missing "${substring}": got "${message}"`);
    }
  }
  if (message.includes('other show')) {
    failures.push(
      `one-other-active.json message must not mention "other show(s)" when additionalCount is 0: got "${message}"`
    );
  }
}

// Case 3: two other shows are simultaneously active (pre-existing ambiguous state) —
// the message must name the first and count the remainder, not silently drop it.
{
  const others = loadFixture('two-others-active.json');
  const result = findConflictingActiveShow(others);
  if (!result || result.conflict._id !== 'show-19-2027' || result.additionalCount !== 1) {
    failures.push(
      `two-others-active.json: expected conflict show-19-2027 with additionalCount 1, got ${JSON.stringify(result)}`
    );
  }
  const message = formatActiveShowConflictMessage(result);
  if (!message.includes('1 other show')) {
    failures.push(`two-others-active.json message must mention "1 other show": got "${message}"`);
  }
}

// Case 4: the conflicting show has no title/year set (a sparsely-filled draft) — the
// message must still be comprehensible, falling back to the document id rather than
// rendering "null" or throwing.
{
  const others = loadFixture('one-other-active-no-title.json');
  const result = findConflictingActiveShow(others);
  const message = formatActiveShowConflictMessage(result);
  if (message.includes('null') || message.includes('undefined')) {
    failures.push(`one-other-active-no-title.json message leaked a raw null/undefined: got "${message}"`);
  }
  if (!message.includes('show-14-2012')) {
    failures.push(`one-other-active-no-title.json message must fall back to the _id: got "${message}"`);
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: findConflictingActiveShow() and formatActiveShowConflictMessage() behave correctly across all four fixtures.'
);
process.exit(0);
