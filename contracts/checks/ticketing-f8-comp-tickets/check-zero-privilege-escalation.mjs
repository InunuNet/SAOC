#!/usr/bin/env node
// F8 (ticketing-foundation) — zero privilege escalation (mission brief: "holding or issuing a
// comp ticket must never grant a capability"). Mirrors F6's A8
// (check-zero-authorization-meaning.mjs) and F5's A3/A4 — the SAME real
// hasCapability()/resolveRoleCapabilitiesForShow() (lib/admin-auth.ts, F4), applied to two
// identity shapes a comp introduces that must carry no such meaning:
//
//   1. The comp's ATTENDEE — the person admitted by it. Nothing about being the subject of a
//      comp position document (attendeeEmail) is ever fed into an authorization decision; a
//      DecodedIdToken-shaped object built from only what that identity could plausibly carry
//      (no admin claim, no roles claim) must refuse every one of the seven capabilities.
//   2. The STAFF MEMBER recorded as compedBy on this position, checked with NO admin/roles
//      claim of their own on the token being tested — proving mere appearance as an ISSUER
//      recorded in a document is not itself a source of authorization; only a real Firebase
//      custom claim on the token being checked ever is.
//   3. Negative control (same shape as F5's A4 / F6's A4): the SAME harness, given a genuinely
//      admin+owner-role-shaped token, IS granted — proving (1)/(2)'s refusals aren't vacuous.
//
// No live Firebase, no network, no Firestore write.
//
// hasCapability() gates on isAdminToken() FIRST, which requires isEmailAllowlisted(decoded.email)
// — case (3)'s owner token (owner@example.com) must be on ADMIN_EMAIL_ALLOWLIST or it is refused
// before role resolution ever runs, which would make case (3) a false negative-control failure
// unrelated to what it claims to test. Cases (1)/(2) carry no admin claim at all, so they are
// refused regardless of allowlist status — only (3)'s email needs to be listed.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f8-comp-tickets/check-zero-privilege-escalation.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.com,owner@example.com';

import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES } from '../../../lib/admin-roles.ts';
import { buildCompOrderInput } from '../../../lib/comp-tickets.ts';

const failures = [];
const NOW = new Date('2027-02-10T09:00:00Z');
const GENEROUS_LOOKUP = (showId) =>
  showId === 'nationalShow' ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') } : null;

const built = buildCompOrderInput({
  showId: 'nationalShow',
  attendeeName: 'Comped Attendee',
  attendeeEmail: 'comped-attendee@example.com',
  ticketType: 'general-admission',
  issuedByEmail: 'manager@example.com',
  bookingRef: 'SAOC-2027-ZEROPRIV01',
  now: NOW,
});

function identityToken(email, overrides = {}) {
  return { uid: `uid-for-${email}`, email, email_verified: true, ...overrides };
}

// (1) The comp's attendee, no admin/roles claim of their own.
{
  const t = identityToken(built.attendeeEmail);
  const capsWildcard = resolveRoleCapabilitiesForShow(undefined, '*', { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
  const capsShow = resolveRoleCapabilitiesForShow(undefined, 'nationalShow', { now: NOW, lookupShowWindow: GENEROUS_LOOKUP });
  if (capsWildcard.size !== 0) failures.push(`(1a) attendee identity resolved ${capsWildcard.size} org-wide capabilities, expected 0.`);
  if (capsShow.size !== 0) failures.push(`(1b) attendee identity resolved ${capsShow.size} show-scoped capabilities, expected 0.`);
  for (const capability of CAPABILITIES) {
    if (hasCapability(t, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP }) !== false) {
      failures.push(`(1c) hasCapability(compAttendeeToken, 'nationalShow', '${capability}') returned true, expected false.`);
    }
  }
}

// (2) The staff member recorded as compedBy on this position, but checked with NO admin/roles
// claim of their own — proves the compedBy string on a document is inert data, never itself
// consulted by the authorization decision.
{
  const t = identityToken(built.compedBy);
  for (const capability of CAPABILITIES) {
    if (hasCapability(t, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP }) !== false) {
      failures.push(`(2) hasCapability(claimlessTokenMatchingCompedByEmail, 'nationalShow', '${capability}') returned true, expected false.`);
    }
  }
}

// (3) Negative control: the SAME harness, given a genuinely admin+owner-role-shaped token, IS
// granted every capability — proving (1)/(2)'s refusals aren't vacuous.
{
  const t = identityToken('owner@example.com', { admin: true, roles: { '*': ['owner'] } });
  for (const capability of CAPABILITIES) {
    if (hasCapability(t, 'nationalShow', capability, { now: NOW, lookupShowWindow: GENEROUS_LOOKUP }) !== true) {
      failures.push(`(3) hasCapability(ownerToken, 'nationalShow', '${capability}') returned false, expected true — (1)/(2)'s refusals may be vacuous.`);
    }
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: neither a comp position's attendee identity nor its recorded compedBy issuer email " +
    'resolves to any capability under the real hasCapability()/resolveRoleCapabilitiesForShow() ' +
    'when checked with no admin/roles claim of their own, while a genuinely admin+owner-role-' +
    'shaped token IS granted under the identical harness — issuing or holding a comp ticket ' +
    'carries zero authorization meaning.',
);
process.exit(0);
