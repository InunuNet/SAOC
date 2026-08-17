#!/usr/bin/env node
// ticketing-show-window-lookup (A9) — proves app/api/admin/tickets/comp/route.ts, the ONE
// existing production call site of hasCapability(), actually passes a REAL lookupShowWindow
// (sourced from resolveShowWindowLookup()) rather than the pre-contract call with no `opts`
// at all — which silently refuses every per-show capability grant regardless of the token's
// roles claim (backlog: "[P1, ESCALATED, BLOCKS F13] No live Sanity-backed ShowWindowLookup
// implementation exists anywhere"). Building the lookup function correctly (A1-A8) is
// necessary but not sufficient — an implementation nothing calls is the exact defect this
// contract exists to fix.
//
// THE ONE DELIBERATE SOURCE-LEVEL EXCEPTION IN THIS CONTRACT, same justification as F3's A8
// (contracts/golden/ticketing-f3-admin-roles/README.md, "Can this be asserted at all"):
// invoking the real POST handler behaviourally would require mocking next/headers'
// cookies(), Firebase session-cookie verification, and Firestore — heavier than this
// contract's hard offline/credential-free constraint permits, and orthogonal to what this
// assertion needs to prove (that the CALL SITE passes the lookup through, not that the whole
// route works end to end — A9 in F8's own contract already covers the route's HTTP-level
// fail-closed behaviour). "Is `resolveShowWindowLookup`'s result actually threaded into
// `hasCapability`'s third argument" is a source-shape property, not a runtime one, exactly
// like F3's "is manager's bundle hand-listed, not derived."
//
// This check does NOT trust its own regex by assertion alone: it first runs the SAME
// discriminator against two frozen fixtures — the real pre-contract unwired file content,
// and this contract's own architect-authored wired golden — and refuses to run against the
// live repository file at all unless the discriminator correctly rejects the former and
// accepts the latter. A discriminator that can't tell wired from unwired on KNOWN inputs is
// not trustworthy against the real file either.
//
// DEFEATING MUTATION: reverting the call site to `hasCapability(session.decodedToken,
// body.showId, 'issue-comp')` with no third argument; passing a `lookupShowWindow` that is a
// literal `() => null` or any inline closure not sourced from `resolveShowWindowLookow`;
// importing `resolveShowWindowLookup` but never actually calling it; or calling it without
// `await`ing it (a stray un-awaited Promise passed as `lookupShowWindow` — which is not a
// function at all — would still satisfy a looser regex that only checked for the identifier's
// presence, so the discriminator below requires the `await resolveShowWindowLookup(` shape
// explicitly, not just the identifier's presence anywhere in the file).
//
// Run as: node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-comp-route-wiring.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REAL_ROUTE_PATH = path.resolve(__dirname, '../../../app/api/admin/tickets/comp/route.ts');
const UNWIRED_FIXTURE_PATH = path.resolve(__dirname, 'fixtures/comp-route-unwired.fixture.ts.txt');
const WIRED_FIXTURE_PATH = path.resolve(
  __dirname,
  '../../golden/ticketing-show-window-lookup/comp-route-wired.expected.ts.txt',
);

/** Returns true only if the source both imports resolveShowWindowLookup from the real
 *  module, awaits a call to it assigned to `lookupShowWindow`, and threads that exact
 *  identifier into hasCapability's third (opts) argument alongside `now`. Every sub-check
 *  must hold — this is an AND, not an OR, of independently-defeatable properties. */
function isWired(source) {
  const importsResolver =
    /import\s*\{[^}]*\bresolveShowWindowLookup\b[^}]*\}\s*from\s*['"]@\/lib\/show-window-lookup['"]/.test(
      source,
    );

  const awaitsRealCall = /const\s+lookupShowWindow\s*=\s*await\s+resolveShowWindowLookup\s*\(/.test(source);

  const passesIntoHasCapability =
    /hasCapability\(\s*session\.decodedToken\s*,\s*body\.showId\s*,\s*'issue-comp'\s*,\s*\{\s*now\s*,\s*lookupShowWindow\s*\}\s*\)/.test(
      source,
    );

  return importsResolver && awaitsRealCall && passesIntoHasCapability;
}

const unwiredFixture = readFileSync(UNWIRED_FIXTURE_PATH, 'utf8');
const wiredFixture = readFileSync(WIRED_FIXTURE_PATH, 'utf8');

const failures = [];

if (isWired(unwiredFixture)) {
  failures.push(
    'SELF-TEST FAILED: the discriminator reports the KNOWN-UNWIRED fixture as wired. The ' +
      'discriminator is broken and cannot be trusted against the real file — fix the regex ' +
      'before trusting any result below.',
  );
}

if (!isWired(wiredFixture)) {
  failures.push(
    'SELF-TEST FAILED: the discriminator reports this contract\'s own architect-authored ' +
      'WIRED golden as unwired. The discriminator is broken and cannot be trusted against ' +
      'the real file — fix the regex before trusting any result below.',
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} self-test failure(s) — refusing to check the real file.`);
  process.exit(1);
}

// Self-test passed: the discriminator is proven to distinguish wired from unwired on known
// inputs. Now, and only now, check the real repository file.
let realSource;
try {
  realSource = readFileSync(REAL_ROUTE_PATH, 'utf8');
} catch (error) {
  console.error(`FAIL: could not read ${REAL_ROUTE_PATH}: ${error.message}`);
  process.exit(1);
}

if (!isWired(realSource)) {
  console.error(
    'FAIL: app/api/admin/tickets/comp/route.ts does not pass a real, awaited ' +
      "resolveShowWindowLookup() result as hasCapability()'s lookupShowWindow. Per-show " +
      'capability grants (e.g. Lee-Ann\'s manager role, F13) will be refused unconditionally. ' +
      'See contracts/golden/ticketing-show-window-lookup/comp-route-wired.expected.ts.txt for ' +
      'the exact expected call site.',
  );
  process.exit(1);
}

console.log(
  'PASS: app/api/admin/tickets/comp/route.ts imports resolveShowWindowLookup, awaits a real ' +
    "call to it, and threads the result into hasCapability()'s lookupShowWindow option. " +
    'Discriminator self-test (rejects the known-unwired fixture, accepts the architect-authored ' +
    'wired golden) passed first.',
);
process.exit(0);
