#!/usr/bin/env node
// F8 (ticketing-foundation) — the capability requirement for issuing a comp ticket is
// GENUINELY required, not incidentally satisfied. This is the third time the mission brief
// warns about this exact defect shape: F4's A3 and F5's A3 both originally shipped assertions
// whose stated claim was broader than what their cases actually varied, and both let a real
// mutation survive undetected until a later fix (F5's own case (5),
// contracts/checks/ticketing-f5-buyers/check-buyer-empty-capability-set.mjs). Every case below
// is a real call to hasCapability()/resolveRoleCapabilitiesForShow() (lib/admin-auth.ts, F4)
// for the 'issue-comp' capability specifically — never a source-grep, never a stub.
//
// The dimension that must NOT stay constant across every case: whether the token holds a role
// bundle that actually contains 'issue-comp'. Case (4) below is the one that isolates this —
// admin:true with NO roles claim at all — because every OTHER capability check in this mission
// (F3/F4/F5's own suites) already proves admin:true is necessary; what's missing from those
// suites, and what a naive "does this route require admin" reviewer could miss, is a case that
// proves admin:true is NOT SUFFICIENT on its own for a capability-gated route. A mutant that
// checks `isAdminToken(decoded)` alone (the exact shape checkin's route uses, since checkin is
// gated only on session validity, not a capability) would pass cases (1)-(3)/(5)/(6) below
// unchanged but incorrectly grant case (4) — that is the "any admin can comp" mutation named in
// the mission brief, and this is the case designed to die on it.
//
// No live Firebase, no network, no Firestore write.
//
// hasCapability() gates on isAdminToken() FIRST, which requires
// isEmailAllowlisted(decoded.email) as one of its three ANDed conditions — every fabricated
// email used by a case below that is meant to reach the role-resolution logic (i.e. every case
// except (4), which is deliberately refused for a different reason) must be present on
// ADMIN_EMAIL_ALLOWLIST, or hasCapability() refuses it before ever consulting `roles`, and the
// case proves nothing about capability resolution at all. Listed once, comma-separated, so a
// case can never silently drift out of sync with it.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f8-comp-tickets/check-capability-required-for-comp.mjs

process.env.ADMIN_EMAIL_ALLOWLIST =
  'door@example.com,manager@example.com,owner@example.com,admin@example.com,manager2@example.com,manager3@example.com';

import { hasCapability } from '../../../lib/admin-auth.ts';

const failures = [];
const NOW = new Date('2027-02-10T09:00:00Z');

// Deliberately generous for 'nationalShow' only — a show window returning null for every other
// id, so a per-show grant scoped to a DIFFERENT show has nothing to be granted by accident.
const NATIONAL_SHOW_ONLY_LOOKUP = (showId) =>
  showId === 'nationalShow' ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') } : null;

// A window for 'nationalShow' that has already closed relative to NOW — simulates a lapsed
// per-show grant (F4's date-window mechanism).
const LAPSED_NATIONAL_SHOW_LOOKUP = (showId) =>
  showId === 'nationalShow' ? { startDate: new Date('2025-01-01'), endDate: new Date('2025-06-01') } : null;

function token(overrides = {}) {
  return { email_verified: true, admin: true, ...overrides };
}

function expect(actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label}: hasCapability() returned ${actual}, expected ${expected}.`);
  }
}

// (1) door-staff, scoped to nationalShow: refused issue-comp. The SAME token IS granted
// scan-checkin on the SAME harness — a not-vacuous positive control proving (1)'s refusal isn't
// because hasCapability() is broken/always-false for this token.
{
  const t = token({ uid: 'door-1', email: 'door@example.com', roles: { nationalShow: ['door-staff'] } });
  expect(
    hasCapability(t, 'nationalShow', 'issue-comp', { now: NOW, lookupShowWindow: NATIONAL_SHOW_ONLY_LOOKUP }),
    false,
    '(1a) door-staff token, issue-comp',
  );
  expect(
    hasCapability(t, 'nationalShow', 'scan-checkin', { now: NOW, lookupShowWindow: NATIONAL_SHOW_ONLY_LOOKUP }),
    true,
    '(1b) door-staff token, scan-checkin (not-vacuous control)',
  );
}

// (2) manager, scoped to nationalShow: IS granted issue-comp.
{
  const t = token({ uid: 'manager-1', email: 'manager@example.com', roles: { nationalShow: ['manager'] } });
  expect(
    hasCapability(t, 'nationalShow', 'issue-comp', { now: NOW, lookupShowWindow: NATIONAL_SHOW_ONLY_LOOKUP }),
    true,
    '(2) manager token, issue-comp',
  );
}

// (3) owner, org-wide ('*'): IS granted issue-comp — including for a show id that has NO entry
// in the window lookup at all (org-wide grants are never date-limited).
{
  const t = token({ uid: 'owner-1', email: 'owner@example.com', roles: { '*': ['owner'] } });
  expect(
    hasCapability(t, 'nationalShow', 'issue-comp', { now: NOW, lookupShowWindow: () => null }),
    true,
    '(3) owner token, issue-comp, no window lookup entry',
  );
}

// (4) THE critical case: admin:true, NO roles claim whatsoever. Refused. This is what an "any
// admin can comp" mutation would incorrectly grant — see file header.
{
  const t = token({ uid: 'admin-no-roles-1', email: 'admin@example.com' });
  expect(
    hasCapability(t, 'nationalShow', 'issue-comp', { now: NOW, lookupShowWindow: NATIONAL_SHOW_ONLY_LOOKUP }),
    false,
    "(4) admin:true with NO roles claim, issue-comp — the 'any admin can comp' case",
  );
}

// (5) manager role held for a DIFFERENT show than the one being requested: refused. Proves
// per-show scoping is real, not "any capability held anywhere grants it everywhere".
{
  const t = token({ uid: 'manager-2', email: 'manager2@example.com', roles: { 'show-19-2027': ['manager'] } });
  expect(
    hasCapability(t, 'nationalShow', 'issue-comp', {
      now: NOW,
      lookupShowWindow: (showId) =>
        showId === 'show-19-2027' || showId === 'nationalShow'
          ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') }
          : null,
    }),
    false,
    "(5) manager role scoped to a different show ('show-19-2027'), requesting 'nationalShow', issue-comp",
  );
}

// (6) manager role held for the CORRECT show, but the show's date window has already lapsed:
// refused. Proves the capability grant respects F4's date-window mechanism rather than treating
// "role name present in the claim" as sufficient on its own.
{
  const t = token({ uid: 'manager-3', email: 'manager3@example.com', roles: { nationalShow: ['manager'] } });
  expect(
    hasCapability(t, 'nationalShow', 'issue-comp', { now: NOW, lookupShowWindow: LAPSED_NATIONAL_SHOW_LOOKUP }),
    false,
    '(6) manager role for the correct show, but a lapsed date window, issue-comp',
  );
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: hasCapability(..., 'issue-comp') genuinely requires the capability, not merely " +
    'admin:true — a door-staff token is refused while granted scan-checkin on the same ' +
    'harness, manager/owner tokens are granted, an admin:true token with NO roles claim at ' +
    "all is refused (the 'any admin can comp' case), and per-show scoping plus the date-window " +
    'lapse mechanism are both proven to actually gate the grant.',
);
process.exit(0);
