#!/usr/bin/env node
// F4 (ticketing-foundation) — AND-only composition proof (spec §5.4): admin:true AND
// capability(resolve(roles, S)) ⊇ {required}. Every check here is a REAL hasCapability() call
// against a fabricated DecodedIdToken-shaped object — no live Firebase, no network. Sets
// ADMIN_EMAIL_ALLOWLIST to a single fixed email before import; (a)-(d) all use that exact
// email, so hasCapability()'s allowlist branch is satisfied identically in every one of them
// and none of those four alone proves the allowlist is consulted at all (see (d)'s comment for
// what it proves instead) — (e) is the one case that varies the email, and is the only case
// that closes that gap.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-and-only-composition.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'test@example.com';

import { hasCapability } from '../../../lib/admin-auth.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');
const NO_WINDOW_LOOKUP = () => null;
const BASE = { email: 'test@example.com', email_verified: true };

function check(label, decoded, showId, capability, expected) {
  const actual = hasCapability(decoded, showId, capability, {
    now: NOW,
    lookupShowWindow: NO_WINDOW_LOOKUP,
  });
  if (actual !== expected) {
    failures.push(`${label}: hasCapability() returned ${actual}, expected ${expected}.`);
  }
}

// (a) admin:true + verified + allowlisted + roles {'*': ['owner']} grants export-buyer-data.
check(
  '(a) full owner grant',
  { ...BASE, admin: true, roles: { '*': ['owner'] } },
  'nationalShow',
  'export-buyer-data',
  true,
);

// (b) SAME roles claim, admin:false — a role never substitutes for admin:true.
check(
  '(b) admin:false with owner roles claim',
  { ...BASE, admin: false, roles: { '*': ['owner'] } },
  'nationalShow',
  'export-buyer-data',
  false,
);

// (c) admin:true + verified + allowlisted, NO roles claim at all — admin:true alone never
// satisfies a capability requirement.
check(
  '(c) admin:true with no roles claim',
  { ...BASE, admin: true, roles: undefined },
  'nationalShow',
  'scan-checkin',
  false,
);

// (d) admin:true but email_verified:false, same owner roles claim — hasCapability must reuse
// isAdminToken's full gate (admin AND verified AND allowlisted), not a weakened admin-only
// check that skips straight to role resolution.
check(
  '(d) admin:true, email_verified:false, owner roles claim',
  { ...BASE, admin: true, email_verified: false, roles: { '*': ['owner'] } },
  'nationalShow',
  'export-buyer-data',
  false,
);

// (e) admin:true, email_verified:true, owner roles claim — but a DIFFERENT email than the one
// set in ADMIN_EMAIL_ALLOWLIST above. Closes the gap where (a)-(d) all share BASE.email and so
// never exercise the allowlist branch of isAdminToken: a mutant hasCapability that checks only
// `admin === true && email_verified === true` (dropping isAdminToken, and with it the
// allowlist check) would pass (a)-(d) unchanged, because none of them varies the email. This
// case is the only one in this file that proves the allowlist is actually consulted, not just
// that email_verified and admin are.
check(
  '(e) admin:true, verified, owner roles claim, email NOT on ADMIN_EMAIL_ALLOWLIST',
  { admin: true, email_verified: true, email: 'not-allowlisted@example.com', roles: { '*': ['owner'] } },
  'nationalShow',
  'export-buyer-data',
  false,
);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: hasCapability() composes admin:true AND role-derived capability with no substitution ' +
    "in either direction, and reuses isAdminToken's full gate (verified email AND allowlist) " +
    '— proven live against fabricated tokens, including one whose email is not on the allowlist.',
);
process.exit(0);
