#!/usr/bin/env node
// F5 (ticketing-foundation) — the hard security boundary, part 1 (spec §8.4(1)): a freshly
// self-registered buyer account resolves to the EMPTY capability set. Every check here is a
// REAL call to hasCapability() / resolveRoleCapabilitiesForShow() from lib/admin-auth.ts — the
// same functions F4 shipped and A4 of THIS contract proves are non-vacuous — against a
// fabricated DecodedIdToken-shaped object matching exactly what a self-registered Firebase Auth
// buyer account looks like: no `admin` claim, no `roles` claim, nothing else admin-flavoured.
// No live Firebase, no network, no Firestore write of any kind.
//
// A buyer account is never "checked against lib/admin-roles.ts" directly in this file — the
// brief is explicit that the proof must run through hasCapability()/
// resolveRoleCapabilitiesForShow(), which is what a real route calls. lib/admin-roles.ts's
// CAPABILITIES list is imported only to enumerate every capability that must be refused, not
// re-implemented.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f5-buyers/check-buyer-empty-capability-set.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.com';

import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES } from '../../../lib/admin-roles.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');

// A real show-window lookup that WOULD grant a live window for 'nationalShow' — deliberately
// generous, so a failure here can only be explained by the buyer token itself carrying no
// grantable role, never by an accidentally-closed show window masking the real property.
const GENEROUS_LOOKUP = (showId) =>
  showId === 'nationalShow'
    ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') }
    : null;

function fakeBuyerToken(overrides = {}) {
  // Exactly what Firebase Auth mints for a fresh, unprivileged, self-registered account:
  // email_verified may be true (the buyer verified their own email per §8.3) but there is no
  // `admin` custom claim and no `roles` custom claim at all — self-signup never sets either.
  return {
    uid: 'buyer-uid-001',
    email: 'buyer@example.com',
    email_verified: true,
    ...overrides,
  };
}

// (1) A buyer token with no admin/roles claims at all: resolveRoleCapabilitiesForShow() must
// return the empty set for the org-wide scope AND for a real, live show.
{
  const capsWildcard = resolveRoleCapabilitiesForShow(undefined, '*', {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  const capsShow = resolveRoleCapabilitiesForShow(undefined, 'nationalShow', {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (capsWildcard.size !== 0) {
    failures.push(`(1a) resolveRoleCapabilitiesForShow(undefined, '*', ...) returned ${capsWildcard.size} capabilities, expected 0.`);
  }
  if (capsShow.size !== 0) {
    failures.push(`(1b) resolveRoleCapabilitiesForShow(undefined, 'nationalShow', ...) returned ${capsShow.size} capabilities, expected 0.`);
  }
}

// (2) hasCapability() with a buyer-shaped token (no admin claim) must refuse EVERY one of the
// seven defined capabilities, on the real live show. This is the function real routes call.
for (const capability of CAPABILITIES) {
  const decoded = fakeBuyerToken();
  const actual = hasCapability(decoded, 'nationalShow', capability, {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (actual !== false) {
    failures.push(`(2) hasCapability(buyerToken, 'nationalShow', '${capability}') returned true, expected false.`);
  }
}

// (3) A buyer whose Firebase account happens to have admin:false explicitly set (rather than
// merely absent) must also be refused — a mutant that fail-opens on `admin === undefined` but
// fail-closes on `admin === false` (or vice versa) is caught here.
for (const capability of CAPABILITIES) {
  const decoded = fakeBuyerToken({ admin: false });
  const actual = hasCapability(decoded, 'nationalShow', capability, {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (actual !== false) {
    failures.push(`(3) hasCapability(buyerToken with admin:false, 'nationalShow', '${capability}') returned true, expected false.`);
  }
}

// (4) A buyer token that is ALSO on the admin email allowlist and email_verified (i.e. the
// buyer's own email happens to coincide with an allowlisted admin email — plausible if the same
// human has both a staff account and a personal buyer account) is STILL refused, because there
// is no `admin` claim on this particular token. This is the case that would catch a mutant that
// grants capabilities based on `isEmailAllowlisted(email)` alone, without checking `admin`.
{
  process.env.ADMIN_EMAIL_ALLOWLIST = 'buyer@example.com';
  const decoded = fakeBuyerToken({ email: 'buyer@example.com' });
  const actual = hasCapability(decoded, 'nationalShow', 'view-admin-dashboard', {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (actual !== false) {
    failures.push('(4) hasCapability() granted a capability to an allowlisted-email buyer token with no admin claim, expected false.');
  }
}

// (5) The case that actually isolates "the admin claim is required" from "the capability set
// happened to be empty anyway" (see golden README, "Why case (5) exists" — this is the same
// defect shape F4's own A3(e) had to add once, for the identical reason: every case above that
// varies the allowlist dimension, (4), does so on a token with NO roles claim, so
// resolveRoleCapabilitiesForShow() returns empty regardless of whether the allowlist gate is
// consulted at all — a mutant that grants a capability whenever `isAdminToken`'s allowlist check
// alone passes (skipping the `admin === true` requirement) would pass (1)-(4) unchanged, because
// none of them gives such a mutant anything to grant. This case gives it exactly that: admin
// absent, email_verified true, an ALLOWLISTED email, AND a live `{'*': ['owner']}` roles claim,
// checked against a generous show window. If hasCapability() ever grants a single capability
// here, the admin gate has been bypassed by an allowlist-only check — the only thing that can
// explain a grant, since the roles claim is real and would resolve to the full capability set
// for a genuinely admin-shaped token (as A4 proves).
{
  process.env.ADMIN_EMAIL_ALLOWLIST = 'buyer-with-roles@example.com';
  for (const capability of CAPABILITIES) {
    const decoded = fakeBuyerToken({
      email: 'buyer-with-roles@example.com',
      roles: { '*': ['owner'] },
    });
    const actual = hasCapability(decoded, 'nationalShow', capability, {
      now: NOW,
      lookupShowWindow: GENEROUS_LOOKUP,
    });
    if (actual !== false) {
      failures.push(
        `(5) hasCapability(allowlisted-email token with admin absent but roles {'*':['owner']}, 'nationalShow', '${capability}') returned true, expected false — the admin gate was bypassed by allowlist status alone.`,
      );
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a self-registered buyer token (no admin claim, no roles claim) resolves to the empty ' +
    'capability set under resolveRoleCapabilitiesForShow() and is refused every one of the ' +
    'seven defined capabilities under hasCapability() — proven live, including when admin is ' +
    'explicitly false, when the buyer email coincides with an allowlisted admin email, and when ' +
    'that allowlisted-email buyer token ALSO carries a live owner roles claim (case 5) — the ' +
    'admin claim itself, not merely allowlist status or the accidental absence of a roles claim, ' +
    'is what is missing and what the gate is proven to require.',
);
process.exit(0);
