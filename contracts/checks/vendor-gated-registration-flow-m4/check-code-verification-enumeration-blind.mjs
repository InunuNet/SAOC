#!/usr/bin/env node
// vendor-gated-registration-flow M4/F22 — real, executed proof of
// verifyVendorRegistrationCode() (lib/vendor-registration-code.ts). Expected shape (see the M4
// golden README's "Verification, rate limiting, and lockout thresholds"):
//
//   verifyVendorRegistrationCode(
//     { typedNameSlug: string, typedCodeId: string },
//     candidates: VendorRegistrationCodeCandidate[],   // already fetched by ONE query, by slug
//     now: Date,
//   ): { ok: true; applicationId: string } | { ok: false }
//
// Proves two properties this feature exists for:
//   A. The ONLY way to succeed is: an approved, unlocked, unconsumed, unexpired candidate whose
//      registrationCodeId matches the typed 4 digits.
//   B. Every failure path returns the EXACT SAME shape -- no reason field, no distinguishing
//      property -- whether the cause is "no candidate at all", "wrong code", "locked",
//      "consumed", "expired", or "not approved". A caller that could tell these apart from the
//      return value alone would have an enumeration oracle even if the HTTP layer never
//      surfaces it.
// Also source-checks that constantTimeEqual is IMPORTED from lib/recovery-token.ts (reused, per
// this project's established rule), not redefined.
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m4/check-code-verification-enumeration-blind.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { verifyVendorRegistrationCode } from '../../../lib/vendor-registration-code.ts';

const failures = [];
const NOW = new Date('2027-02-01T00:00:00Z');
const FUTURE = new Date('2027-06-01T00:00:00Z');
const PAST = new Date('2026-01-01T00:00:00Z');
const SLUG = 'fynbospottery';
const CODE = '4821';

function baseCandidate(overrides = {}) {
  return {
    id: 'app-1',
    status: 'approved',
    registrationCodeId: CODE,
    registrationCodeNameSlug: SLUG,
    registrationCodeExpiresAt: FUTURE,
    registrationCodeConsumedAt: null,
    registrationCodeLockedAt: null,
    ...overrides,
  };
}

function verify(typedCodeId, candidates) {
  return verifyVendorRegistrationCode({ typedNameSlug: SLUG, typedCodeId }, candidates, NOW);
}

// A. The success path: correct code against one eligible candidate.
{
  const result = verify(CODE, [baseCandidate()]);
  if (!result.ok || result.applicationId !== 'app-1') {
    failures.push(`Correct code against one eligible candidate should succeed with applicationId 'app-1'; got ${JSON.stringify(result)}.`);
  }
}

// Collect every failure-path result to prove they're all the same shape.
const failureResults = [];

failureResults.push(['no candidates at all (name slug matched nothing)', verify(CODE, [])]);
failureResults.push(['wrong code against one eligible candidate', verify('0000', [baseCandidate()])]);
failureResults.push(['locked candidate, correct code', verify(CODE, [baseCandidate({ registrationCodeLockedAt: PAST })])]);
failureResults.push(['already-consumed candidate, correct code', verify(CODE, [baseCandidate({ registrationCodeConsumedAt: PAST })])]);
failureResults.push(['expired candidate, correct code', verify(CODE, [baseCandidate({ registrationCodeExpiresAt: PAST })])]);
failureResults.push(['pending (not yet approved) candidate, correct code', verify(CODE, [baseCandidate({ status: 'pending' })])]);
failureResults.push(['declined candidate, correct code', verify(CODE, [baseCandidate({ status: 'declined' })])]);
failureResults.push(['candidate with no code ever issued, correct-looking guess', verify(CODE, [baseCandidate({ registrationCodeId: null, registrationCodeExpiresAt: null })])]);

for (const [label, result] of failureResults) {
  if (result.ok) {
    failures.push(`${label}: expected a refusal, but verification succeeded with ${JSON.stringify(result)}.`);
  }
}

// B. Every failure result must be byte-identical in shape -- no reason/error/status leaking why.
{
  const shapes = new Set(failureResults.map(([, r]) => JSON.stringify(r)));
  if (shapes.size > 1) {
    failures.push(`Failure results are not all identical -- found ${shapes.size} distinct shapes: ${[...shapes].join(' | ')}. This is an enumeration oracle.`);
  }
  const [[, sample]] = failureResults;
  const keys = Object.keys(sample).sort();
  if (keys.join(',') !== 'ok') {
    failures.push(`A refusal result must contain ONLY the 'ok' key (ok:false); found keys [${keys.join(', ')}] -- an extra key is a place a distinguishing reason could leak.`);
  }
}

// Multiple candidates sharing a name slug: only the one with the matching code succeeds, and
// the others do not block it.
{
  const decoy = baseCandidate({ id: 'app-decoy', registrationCodeId: '1111' });
  const real = baseCandidate({ id: 'app-real', registrationCodeId: CODE });
  const result = verify(CODE, [decoy, real]);
  if (!result.ok || result.applicationId !== 'app-real') {
    failures.push(`With two candidates sharing a slug, the one with the matching code should win; got ${JSON.stringify(result)}.`);
  }
}

// Source-level: constantTimeEqual is IMPORTED from lib/recovery-token.ts, never redefined.
{
  const modulePath = fileURLToPath(new URL('../../../lib/vendor-registration-code.ts', import.meta.url));
  const source = readFileSync(modulePath, 'utf8');
  if (!/import\s*\{[^}]*constantTimeEqual[^}]*\}\s*from\s*['"].*recovery-token['"]/.test(source)) {
    failures.push("lib/vendor-registration-code.ts must import constantTimeEqual FROM lib/recovery-token.ts (reuse, matching lib/vendor-registration-token.ts's own rule) -- import not found.");
  }
  if (/function\s+constantTimeEqual/.test(source)) {
    failures.push('lib/vendor-registration-code.ts redefines its own constantTimeEqual instead of reusing lib/recovery-token.ts\'s.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: verifyVendorRegistrationCode() only succeeds against an approved/unlocked/unconsumed/unexpired candidate with a matching code, every failure path returns an identical ok:false shape (no enumeration oracle), and constant-time comparison is reused, not reimplemented.');
process.exit(0);
