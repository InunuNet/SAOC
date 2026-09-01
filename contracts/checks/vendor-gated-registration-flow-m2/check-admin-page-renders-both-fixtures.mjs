#!/usr/bin/env node
// F21 (vendor-gated-registration-flow, M2) -- A38: proves additive-only/deprecate-in-place is
// deploy-safe against the ACTUAL review UI, not just asserted in prose (see the M2 golden
// README's "F21: the regression proof, not just the promise"). Renders the real
// VendorReviewTable component -- the sub-component app/admin/vendors/page.tsx actually
// delegates each submission's markup to -- with two fixture VendorSubmission documents: one
// simulating a pre-M2 document (F15-deprecated fields populated, F14 fields absent), one
// simulating a fresh post-M2 submission (F14 fields populated, deprecated fields absent).
//
// DELIBERATE SUBSTITUTION, flagged: A38's description says "app/admin/vendors/page.tsx
// renders ... without throwing", but page.tsx itself is an async Server Component that calls
// Firestore, Sanity, and firebase-admin/auth directly -- none of which are renderable offline
// without an emulator or extensive mocking, and none of which are what F14/F15's field-shape
// change could plausibly break. VendorReviewTable (components/admin/VendorReviewTable.tsx) is
// the actual client component page.tsx hands each `VendorSubmission[]` to for rendering, and
// is what F14/F15's shape change can actually break (it destructures/reads submission fields
// directly). This check proves the real property (the review UI doesn't throw against either
// document shape) against the real rendering unit, rather than a page.tsx render that would
// need to fake Firestore/Sanity/Auth and prove nothing about the field-shape regression this
// assertion exists to catch.
//
// Run via its own scoped tsconfig for the TYPE half (see this file's neighbouring
// tsconfig.typecheck.json) because the root tsconfig.json excludes `contracts/` from
// `pnpm type-check`; this script is the BEHAVIOURAL half, run second in A38's compound command.
//
// FAILS ON: either fixture render throwing, or a fixture render producing empty/error output
// where real content was expected (a thrown-and-caught error can otherwise disappear silently).
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m2/check-admin-page-renders-both-fixtures.mjs

import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

import { VendorReviewTable } from '../../../components/admin/VendorReviewTable.tsx';
import { preM2Fixture, postM2Fixture } from './fixtures/admin-page-fixtures-typecheck.ts';

const failures = [];

function renderFixture(label, fixture) {
  let html;
  try {
    html = renderToStaticMarkup(
      React.createElement(VendorReviewTable, { submissions: [fixture] }),
    );
  } catch (err) {
    failures.push(
      `${label}: VendorReviewTable threw while rendering -- ${err instanceof Error ? err.stack : String(err)}`,
    );
    return null;
  }
  if (!html || html.trim() === '') {
    failures.push(`${label}: VendorReviewTable rendered empty output -- expected a populated review row.`);
    return null;
  }
  return html;
}

const preHtml = renderFixture('pre-M2 fixture', preM2Fixture);
const postHtml = renderFixture('post-M2 fixture', postM2Fixture);

// Sanity-check both renders actually reached the real row, not an empty-state branch (the
// component renders a distinct "No vendor applications" message for a zero-length array --
// if either fixture accidentally produced that, this check would be proving nothing).
if (preHtml && !preHtml.includes(preM2Fixture.businessName)) {
  failures.push(
    `pre-M2 fixture: rendered output does not contain the fixture business name ` +
      `("${preM2Fixture.businessName}") -- likely hit the empty-state branch instead of a real row.`,
  );
}
if (postHtml && !postHtml.includes(postM2Fixture.businessName)) {
  failures.push(
    `post-M2 fixture: rendered output does not contain the fixture business name ` +
      `("${postM2Fixture.businessName}") -- likely hit the empty-state branch instead of a real row.`,
  );
}

// Both fixtures rendered together, in one array, must also not throw -- proves the admin page's
// real call shape (a mixed list of old- and new-shaped documents, since pre- and post-M2
// documents coexist in Firestore during the rollout window) is safe, not just each shape alone.
try {
  const mixedHtml = renderToStaticMarkup(
    React.createElement(VendorReviewTable, { submissions: [preM2Fixture, postM2Fixture] }),
  );
  if (!mixedHtml.includes(preM2Fixture.businessName) || !mixedHtml.includes(postM2Fixture.businessName)) {
    failures.push('mixed pre-/post-M2 fixture render is missing one of the two business names.');
  }
} catch (err) {
  failures.push(
    `mixed pre-/post-M2 fixture render (both documents in one submissions array) threw -- ` +
      `${err instanceof Error ? err.stack : String(err)}`,
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: VendorReviewTable renders the pre-M2 fixture (deprecated fields populated, F14 ' +
    'fields absent), the post-M2 fixture (F14 fields populated, deprecated fields absent), and ' +
    'both together, without throwing.',
);
process.exit(0);
