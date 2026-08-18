#!/usr/bin/env node
// Behavioural proof of lib/active-show-guard.ts's getPublishedId() / isSameDocument().
// The Studio validator queries for OTHER active shows and must not treat a document's
// own draft/published pair as a conflict with itself — Sanity gives drafts the id
// `drafts.<publishedId>`. Proves the id-normalisation the GROQ query's exclusion list
// depends on, without needing a live dataset or an actual draft document.
//
// Run as: node --import tsx/esm
//   contracts/checks/production-blockers-f3-studio-active-show-guard/check-published-draft-dedup.mjs

import {
  getPublishedId,
  isSameDocument,
} from '../../../lib/active-show-guard.ts';

const failures = [];

const cases = [
  { a: 'show-19-2027', b: 'show-19-2027', expected: true, label: 'identical published ids' },
  { a: 'drafts.show-19-2027', b: 'show-19-2027', expected: true, label: 'draft vs its own published id' },
  { a: 'show-19-2027', b: 'drafts.show-19-2027', expected: true, label: 'published vs its own draft id (reversed)' },
  { a: 'drafts.show-19-2027', b: 'drafts.show-19-2027', expected: true, label: 'identical draft ids' },
  { a: 'drafts.show-19-2027', b: 'show-18-2024', expected: false, label: 'draft vs a genuinely different show' },
  { a: 'show-19-2027', b: 'show-18-2024', expected: false, label: 'two genuinely different published shows' },
];

for (const testCase of cases) {
  const result = isSameDocument(testCase.a, testCase.b);
  if (result !== testCase.expected) {
    failures.push(
      `isSameDocument(${JSON.stringify(testCase.a)}, ${JSON.stringify(testCase.b)}) [${testCase.label}]: expected ${testCase.expected}, got ${result}`
    );
  }
}

if (getPublishedId('drafts.show-19-2027') !== 'show-19-2027') {
  failures.push(
    `getPublishedId('drafts.show-19-2027'): expected 'show-19-2027', got ${JSON.stringify(getPublishedId('drafts.show-19-2027'))}`
  );
}
if (getPublishedId('show-19-2027') !== 'show-19-2027') {
  failures.push(
    `getPublishedId('show-19-2027') (no drafts. prefix): expected unchanged 'show-19-2027', got ${JSON.stringify(getPublishedId('show-19-2027'))}`
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: getPublishedId() and isSameDocument() correctly dedupe draft/published id pairs.');
process.exit(0);
