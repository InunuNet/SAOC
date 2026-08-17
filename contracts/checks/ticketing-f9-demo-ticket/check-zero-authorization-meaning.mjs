#!/usr/bin/env node
// F9 (ticketing-foundation) — zero authorization meaning (mirrors F6's A8 exactly, per the
// architect brief: "Mirror F6's A8 against the real
// hasCapability()/resolveRoleCapabilitiesForShow()"). Holding a demo ticket — or, defensively,
// a token a future bug mistakenly bridged demo-ticket data onto — must never grant a single
// capability. Every check below is a REAL call to
// hasCapability()/resolveRoleCapabilitiesForShow() (lib/admin-auth.ts), never a
// reimplementation.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f9-demo-ticket/check-zero-authorization-meaning.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'admin@example.com';

import { hasCapability, resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { CAPABILITIES } from '../../../lib/admin-roles.ts';
import { DEMO_TICKET_TYPE_SLUG } from '../../../lib/demo-ticket-type.ts';

const failures = [];
const NOW = new Date('2027-01-05T00:00:00Z');

// A real show-window lookup that WOULD grant a live window for 'show-19-2027' — deliberately
// generous, so a failure here can only be explained by the token itself carrying no grantable
// role, never by an accidentally-closed show window masking the real property.
const GENEROUS_LOOKUP = (showId) =>
  showId === 'show-19-2027'
    ? { startDate: new Date('2026-01-01'), endDate: new Date('2028-01-01') }
    : null;

// A plain buyer token holding a demo ticket — no admin claim, no roles claim. Buying a demo
// ticket changes nothing about the token itself; same shape as F5's fakeBuyerToken().
function demoBuyerToken(overrides = {}) {
  return {
    uid: 'demo-buyer-uid-001',
    email: 'demo-buyer@example.com',
    email_verified: true,
    ...overrides,
  };
}

// (1) resolveRoleCapabilitiesForShow() with no roles claim at all.
{
  const caps = resolveRoleCapabilitiesForShow(undefined, 'show-19-2027', {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (caps.size !== 0) {
    failures.push(
      `(1) resolveRoleCapabilitiesForShow(undefined, 'show-19-2027', ...) returned ${caps.size} capabilities for a demo-ticket-buyer-shaped identity, expected 0.`,
    );
  }
}

// (2) hasCapability() with a demo-ticket-buyer-shaped token must refuse EVERY one of the seven
// defined capabilities, on the real live show.
for (const capability of CAPABILITIES) {
  const actual = hasCapability(demoBuyerToken(), 'show-19-2027', capability, {
    now: NOW,
    lookupShowWindow: GENEROUS_LOOKUP,
  });
  if (actual !== false) {
    failures.push(`(2) hasCapability(demoBuyerToken, 'show-19-2027', '${capability}') returned true, expected false.`);
  }
}

// (3) Defensive mutation guard: a token a FUTURE bug mistakenly bridged demo-ticket data onto
// directly (e.g. `demo: true`, `ticketType: DEMO_TICKET_TYPE_SLUG` fields sitting alongside
// the real claims, simulating "someone tried to grant door-staff to demo-ticket holders for
// testing convenience") — neither hasCapability() nor resolveRoleCapabilitiesForShow() reads
// any such field, so this must resolve exactly as empty as cases (1)/(2).
for (const capability of CAPABILITIES) {
  const actual = hasCapability(
    demoBuyerToken({ demo: true, ticketType: DEMO_TICKET_TYPE_SLUG }),
    'show-19-2027',
    capability,
    { now: NOW, lookupShowWindow: GENEROUS_LOOKUP },
  );
  if (actual !== false) {
    failures.push(
      `(3) hasCapability() granted '${capability}' to a token carrying stray demo/ticketType fields — these fields must never enter an authorization decision.`,
    );
  }
}

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  'PASS: a demo-ticket-buyer-shaped identity — including one a hypothetical future bug ' +
    'bridged stray demo/ticketType fields onto — resolves to the empty capability set under ' +
    'the real hasCapability()/resolveRoleCapabilitiesForShow(), for every one of the seven ' +
    'live capabilities.',
);
process.exit(0);
