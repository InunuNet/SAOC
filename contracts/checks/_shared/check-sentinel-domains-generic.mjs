// A14 — BEHAVIOURAL negative control: proves isKnownSentinelDomain() is genuinely
// parameterized, not hardcoded to today's two domains. See
// contracts/golden/payfast-m1-lock-cleanup-fix/README.md ("Point 3").
//
// No credentials, no network, no Firestore — pure function calls against a synthetic
// third domain that must never become a real sentinel domain.

import { SENTINEL_DOMAINS, isKnownSentinelDomain } from './sentinel-domains.mjs';

const ASSERTION_ID = 'A14';
const SYNTHETIC_THIRD_DOMAIN = 'not-yet-real-check.invalid';

const failures = [];

// Called with an explicit domains list that includes the synthetic third domain, an
// email at that domain must be recognised.
const domainsWithSynthetic = [...SENTINEL_DOMAINS, SYNTHETIC_THIRD_DOMAIN];
if (!isKnownSentinelDomain(`probe@${SYNTHETIC_THIRD_DOMAIN}`, domainsWithSynthetic)) {
  failures.push(
    `isKnownSentinelDomain() must recognise an email at a domain explicitly passed in the domains list.`
  );
}

// Called with the DEFAULT (no override), the same synthetic-domain email must NOT be
// recognised — proves the parameterization is real, not decorative (i.e. the function
// is not secretly always-true, and the default really is the real SENTINEL_DOMAINS
// array, not something that already includes the synthetic domain).
if (isKnownSentinelDomain(`probe@${SYNTHETIC_THIRD_DOMAIN}`)) {
  failures.push(
    `isKnownSentinelDomain() must NOT recognise the synthetic third domain when called with the default (unparameterized) domains list.`
  );
}

// Sanity: the real domains still work against the default.
for (const domain of SENTINEL_DOMAINS) {
  if (!isKnownSentinelDomain(`probe@${domain}`)) {
    failures.push(`isKnownSentinelDomain() must recognise a real sentinel domain (${domain}) against the default list.`);
  }
}

if (failures.length > 0) {
  console.error(`FAIL: ${ASSERTION_ID} isKnownSentinelDomain() parameterization check`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`PASS: ${ASSERTION_ID} isKnownSentinelDomain() is genuinely parameterized, not hardcoded`);
