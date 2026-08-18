#!/usr/bin/env node
// F6 (vendor-registration) — A8, THE F8-LESSON ASSERTION. Same technique as
// contracts/checks/ticketing-show-window-lookup/check-comp-route-wiring.mjs: proves each of
// the three gated production files actually calls the capability gate (and, for the review
// route, actually reuses the real transition function and an additive Firestore write) --
// not merely that hasCapability()/decideVendorStatusTransition() work as pure functions in
// isolation.
//
// THE ONE DELIBERATE SOURCE-LEVEL EXCEPTION IN THIS CONTRACT, same justification as F3's A8
// and ticketing-show-window-lookup's A9: invoking the real route/layout behaviourally would
// require mocking next/headers' cookies(), Firebase session-cookie verification, and
// Firestore -- heavier than this contract's offline/credential-free constraint permits, and
// orthogonal to what this assertion needs to prove (that the CALL SITE is wired correctly,
// not that the whole route works end to end -- A9 in this same contract covers the HTTP-level
// fail-closed behaviour).
//
// This check does NOT trust its own regex by assertion alone: for each file, it first runs
// the SAME discriminator against a frozen KNOWN-UNWIRED fixture (must reject) and this
// contract's own architect-authored WIRED golden (must accept), and refuses to check the live
// repository file at all unless the discriminator passes both self-tests.
//
// DEFEATING MUTATION (see contract A8 description for the full list): deleting the
// hasCapability call entirely (falling back to admin/page.tsx's or admin/door/layout.tsx's
// existing session-only pattern); swapping 'review-vendor-applications' for a more widely
// held capability; omitting the `opts` argument or passing an inline `() => null` lookup;
// reimplementing the transition decision inline instead of calling
// decideVendorStatusTransition(); or writing via ref.set(...) instead of ref.update(...).
//
// Run as: node --import tsx/esm contracts/checks/vendor-f6-review-workflow/check-route-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

const failures = [];

function isCapabilityGated(source) {
  const importsHasCapability =
    /import\s*\{[^}]*\bhasCapability\b[^}]*\}\s*from\s*['"]@\/lib\/admin-auth['"]/.test(source);

  const importsResolver =
    /import\s*\{[^}]*\bresolveShowWindowLookup\b[^}]*\}\s*from\s*['"]@\/lib\/show-window-lookup['"]/.test(
      source,
    );

  const awaitsRealCall = /const\s+lookupShowWindow\s*=\s*await\s+resolveShowWindowLookup\s*\(\s*NATIONAL_SHOW_ID\s*,\s*now\s*\)/.test(
    source,
  );

  const callsHasCapability =
    /hasCapability\(\s*session\.decodedToken\s*,\s*NATIONAL_SHOW_ID\s*,\s*'review-vendor-applications'\s*,\s*\{\s*now\s*,\s*lookupShowWindow\s*\}\s*\)/.test(
      source,
    );

  return importsHasCapability && importsResolver && awaitsRealCall && callsHasCapability;
}

function isAdditiveTransitionWiring(source) {
  const importsTransition =
    /import\s*\{[^}]*\bdecideVendorStatusTransition\b[^}]*\}\s*from\s*['"]@\/lib\/vendor-review['"]/.test(
      source,
    );
  const callsTransition = /decideVendorStatusTransition\(\s*\{/.test(source);
  const updatesNotSets = /ref\.update\(\s*decision\.patch\s*\)/.test(source) && !/ref\.set\(/.test(source);

  return importsTransition && callsTransition && updatesNotSets;
}

function checkFile({ label, realPath, unwiredFixturePath, wiredGoldenPath, extraPredicate }) {
  const unwired = readFileSync(unwiredFixturePath, 'utf8');
  const wired = readFileSync(wiredGoldenPath, 'utf8');

  const predicate = (source) => isCapabilityGated(source) && (extraPredicate ? extraPredicate(source) : true);

  if (predicate(unwired)) {
    failures.push(
      `${label}: SELF-TEST FAILED — the discriminator reports the KNOWN-UNWIRED fixture as wired. ` +
        'The discriminator is broken and cannot be trusted against the real file.',
    );
    return;
  }
  if (!predicate(wired)) {
    failures.push(
      `${label}: SELF-TEST FAILED — the discriminator reports this contract's own architect-authored ` +
        'WIRED golden as unwired. The discriminator is broken and cannot be trusted against the real file.',
    );
    return;
  }

  let realSource;
  try {
    realSource = readFileSync(realPath, 'utf8');
  } catch (error) {
    failures.push(`${label}: could not read ${realPath}: ${error.message}`);
    return;
  }

  if (!predicate(realSource)) {
    failures.push(
      `${label}: ${realPath} does not pass the capability-gate discriminator. Compare against ` +
        `${wiredGoldenPath} for the exact expected wiring.`,
    );
  }
}

checkFile({
  label: 'app/api/admin/vendors/route.ts',
  realPath: path.join(REPO_ROOT, 'app/api/admin/vendors/route.ts'),
  unwiredFixturePath: path.join(__dirname, 'fixtures/vendors-list-route-unwired.fixture.ts.txt'),
  wiredGoldenPath: path.join(
    REPO_ROOT,
    'contracts/golden/vendor-f6-review-workflow/vendors-list-route-wired.expected.ts.txt',
  ),
});

checkFile({
  label: 'app/api/admin/vendors/[id]/review/route.ts',
  realPath: path.join(REPO_ROOT, 'app/api/admin/vendors/[id]/review/route.ts'),
  unwiredFixturePath: path.join(__dirname, 'fixtures/vendors-review-route-unwired.fixture.ts.txt'),
  wiredGoldenPath: path.join(
    REPO_ROOT,
    'contracts/golden/vendor-f6-review-workflow/vendors-review-route-wired.expected.ts.txt',
  ),
  extraPredicate: isAdditiveTransitionWiring,
});

checkFile({
  label: 'app/admin/vendors/layout.tsx',
  realPath: path.join(REPO_ROOT, 'app/admin/vendors/layout.tsx'),
  unwiredFixturePath: path.join(__dirname, 'fixtures/vendors-layout-unwired.fixture.tsx.txt'),
  wiredGoldenPath: path.join(
    REPO_ROOT,
    'contracts/golden/vendor-f6-review-workflow/vendors-layout-wired.expected.tsx.txt',
  ),
});

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: all three gated files (list route, review route, /admin/vendors layout) import ' +
    'hasCapability, await a real resolveShowWindowLookup() call, and pass the result into ' +
    "hasCapability(..., 'review-vendor-applications', { now, lookupShowWindow }) verbatim. " +
    'The review route additionally imports and calls the real decideVendorStatusTransition() ' +
    '(never reimplemented inline) and applies its patch via ref.update(), never ref.set(). ' +
    'Every discriminator passed its self-test (rejects the known-unwired fixture, accepts the ' +
    'architect-authored wired golden) before checking the real file.',
);
process.exit(0);
