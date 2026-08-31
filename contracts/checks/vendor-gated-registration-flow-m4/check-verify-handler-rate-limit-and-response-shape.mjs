#!/usr/bin/env node
// vendor-gated-registration-flow M4/F23 — real, executed proof of
// handleVendorRegistrationCodeVerification() (lib/vendor-registration-code-verify-handler.ts),
// the pure handler behind POST /api/vendors/register/verify-code. Mirrors
// contracts/checks/vendor-f5-register-route/check-rate-limit-shields-write.mjs's exact
// technique (a pre-seeded rate-limit key, zero-calls proof on the I/O dependency) for the same
// design constraint: rate limiting must be checked BEFORE any Firestore lookup.
//
// Also proves the POPIA-relevant response-shape constraint from the M4 golden README: the JSON
// body returned to the browser is byte-identical in shape across every failure branch, and the
// success body is `{ok:true}` and nothing else -- no VendorApplication field, and no session
// token, ever appears inside the JSON body (the session artifact travels only as a handler
// RESULT field the route layer uses to set an HttpOnly cookie, never serialised into `body`).
//
// Run as: node --import tsx/esm contracts/checks/vendor-gated-registration-flow-m4/check-verify-handler-rate-limit-and-response-shape.mjs

import { handleVendorRegistrationCodeVerification } from '../../../lib/vendor-registration-code-verify-handler.ts';

const failures = [];
const NOW = new Date('2027-02-01T00:00:00Z');
const REAL_CANDIDATE = {
  id: 'app-1',
  status: 'approved',
  registrationCodeId: '4821',
  registrationCodeNameSlug: 'fynbospottery',
  registrationCodeExpiresAt: new Date('2027-06-01T00:00:00Z'),
  registrationCodeConsumedAt: null,
  registrationCodeLockedAt: null,
};

function makeDeps({ priorAttempts = [], candidates = [] } = {}) {
  const findCandidatesCalls = [];
  const recordFailedAttemptCalls = [];
  return {
    now: NOW,
    rateLimitKey: 'vendor-register-code-verify-ip:198.51.100.7',
    getPriorAttempts: () => priorAttempts,
    recordAttempt: () => {},
    findCandidates: async (nameSlug) => {
      findCandidatesCalls.push(nameSlug);
      return candidates;
    },
    recordFailedAttempt: async (applicationId) => {
      recordFailedAttemptCalls.push(applicationId);
    },
    mintSession: () => ({ token: 'internal-session-artifact', expiresAt: new Date(NOW.getTime() + 30 * 60 * 1000) }),
    _findCandidatesCalls: findCandidatesCalls,
    _recordFailedAttemptCalls: recordFailedAttemptCalls,
  };
}

// 1. Rate limiting shields the Firestore lookup -- a key already at/over the limit must be
// refused BEFORE findCandidates is ever called, even for a well-formed input.
{
  const priorAttempts = Array.from({ length: 10 }, (_, i) => ({ key: 'k', at: new Date(NOW.getTime() - i * 1000) }));
  const deps = makeDeps({ priorAttempts, candidates: [REAL_CANDIDATE] });
  const result = await handleVendorRegistrationCodeVerification({ businessName: 'Fynbos Pottery', codeId: '4821' }, deps);
  if (result.status !== 429) {
    failures.push(`A rate-limited key should be refused with 429; got status ${result.status}.`);
  }
  if (deps._findCandidatesCalls.length !== 0) {
    failures.push(`Rate limiting did not shield the Firestore lookup -- findCandidates was called ${deps._findCandidatesCalls.length} time(s) after the limit was already hit.`);
  }
}

// 2. Every failure branch (not rate-limited) returns the SAME response body shape, and it is
// exactly the one generic error string -- no PII, no distinguishing reason.
const failureCases = [
  ['no candidates for this name slug', []],
  ['wrong code against the real candidate', [REAL_CANDIDATE]],
  ['locked candidate, correct code', [{ ...REAL_CANDIDATE, registrationCodeLockedAt: new Date('2027-01-01T00:00:00Z') }]],
];
const failureBodies = [];
for (const [label, candidates] of failureCases) {
  const deps = makeDeps({ candidates });
  const codeId = label.startsWith('wrong') ? '0000' : '4821';
  // eslint-disable-next-line no-await-in-loop
  const result = await handleVendorRegistrationCodeVerification({ businessName: 'Fynbos Pottery', codeId }, deps);
  if (result.status !== 403) {
    failures.push(`${label}: expected status 403, got ${result.status}.`);
  }
  const keys = Object.keys(result.body).sort();
  if (keys.join(',') !== 'error') {
    failures.push(`${label}: response body must contain ONLY an 'error' key; found [${keys.join(', ')}].`);
  }
  for (const value of Object.values(result.body)) {
    if (typeof value === 'string' && /fynbos|pottery|@|\d{4,}/i.test(value) && !/^That code didn't match/.test(value)) {
      failures.push(`${label}: response body value '${value}' looks like it may leak submitted/PII data instead of the fixed generic message.`);
    }
  }
  failureBodies.push(JSON.stringify(result.body));
  if (candidates.length > 0 && candidates[0].registrationCodeLockedAt === undefined) {
    // no-op branch guard, keeps lint happy about unused var patterns across cases
  }
}
if (new Set(failureBodies).size > 1) {
  failures.push(`Failure response bodies differ across branches: ${failureBodies.join(' | ')} -- this is an enumeration oracle at the HTTP layer.`);
}

// 3. Success: body is exactly {ok:true}; the session artifact is NEVER in the body, only in a
// separate result field the route layer uses to set a cookie.
{
  const deps = makeDeps({ candidates: [REAL_CANDIDATE] });
  const result = await handleVendorRegistrationCodeVerification({ businessName: 'Fynbos Pottery', codeId: '4821' }, deps);
  if (result.status !== 200) {
    failures.push(`A correct match should return status 200; got ${result.status}.`);
  }
  const keys = Object.keys(result.body).sort();
  if (keys.join(',') !== 'ok' || result.body.ok !== true) {
    failures.push(`Success response body must be exactly {ok:true}; got ${JSON.stringify(result.body)}.`);
  }
  if (JSON.stringify(result.body).includes('internal-session-artifact')) {
    failures.push('The session artifact leaked into the JSON response body -- it must travel only as a separate result field for the route to set as an HttpOnly cookie.');
  }
  if (!result.sessionToken) {
    failures.push('A successful verification did not produce a sessionToken result field for the route to set as a cookie.');
  }
}

// 4. A failed match records the failed attempt against every candidate returned for that name
// slug (so the per-application lockout counter actually advances).
{
  const deps = makeDeps({ candidates: [REAL_CANDIDATE] });
  await handleVendorRegistrationCodeVerification({ businessName: 'Fynbos Pottery', codeId: '0000' }, deps);
  if (!deps._recordFailedAttemptCalls.includes('app-1')) {
    failures.push('A wrong-code attempt did not record a failed attempt against the matched candidate application.');
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log('PASS: handleVendorRegistrationCodeVerification() checks the per-IP rate limit before any Firestore lookup, returns an identical generic body across every failure branch, never leaks the session artifact into the response body, and records failed attempts against matched candidates.');
process.exit(0);
