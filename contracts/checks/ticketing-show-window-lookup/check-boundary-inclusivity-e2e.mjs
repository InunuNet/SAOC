#!/usr/bin/env node
// ticketing-show-window-lookup (A8) — end-to-end boundary inclusivity, composing THIS
// module's date parsing with F4's ALREADY-PROVEN isWithinWindow()/
// resolveRoleCapabilitiesForShow() (lib/admin-auth.ts, `>=` / `<=`, contract
// ticketing-f4-roles-claim's own A5). This check does NOT re-prove isWithinWindow's
// inclusivity in the abstract — F4 owns that. It proves the DATE OBJECTS
// buildShowWindow()/resolveShowWindowLookup() hand to it round-trip through that boundary
// logic correctly — i.e. that nothing in this module's parsing introduces an off-by-one-ms,
// an off-by-one-second, or a timezone shift BEFORE the value ever reaches isWithinWindow.
//
// DEFEATING MUTATION: any rounding, truncation, or timezone adjustment in buildShowWindow()/
// parseUtcDatetime() that shifts the parsed startDate/endDate instant by even 1ms relative to
// the ISO string's true UTC instant — invisible to A3's per-field checks (which only assert
// non-null / correct-looking), but exposed here because the SAME instant is used both to
// build the window and as the boundary `now` value fed into the real gate function.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-show-window-lookup/check-boundary-inclusivity-e2e.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'test@example.com';

import { resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';
import { buildShowWindow, resolveShowWindowLookup, ShowWindowCache } from '../../../lib/show-window-lookup.ts';

const failures = [];

const window = buildShowWindow({
  startDate: '2027-01-15T08:00:00.000Z',
  endDate: '2027-01-20T18:00:00.000Z',
});
if (window === null) {
  console.error('FATAL: buildShowWindow() returned null for a valid, well-formed window — cannot run A8.');
  process.exit(1);
}

const ROLES = { nationalShow: ['door-staff'] };
const SHOW_ID = 'nationalShow';
const cache = new ShowWindowCache(async () => window);

async function expectCapability(label, now, expected) {
  await cache.ensureFresh(now);
  const lookup = await resolveShowWindowLookup(SHOW_ID, now, { cache });
  const caps = resolveRoleCapabilitiesForShow(ROLES, SHOW_ID, { now, lookupShowWindow: lookup });
  const has = caps.has('scan-checkin');
  if (has !== expected) {
    failures.push(`${label}: has('scan-checkin') was ${has}, expected ${expected}.`);
  }
}

// Exactly at startDate's instant — inclusive lower bound (>=), must be GRANTED.
await expectCapability('now === startDate exactly', new Date(window.startDate.getTime()), true);

// 1ms before startDate — must be REFUSED.
await expectCapability('now === startDate - 1ms', new Date(window.startDate.getTime() - 1), false);

// Exactly at endDate's instant — inclusive upper bound (<=), must be GRANTED.
await expectCapability('now === endDate exactly', new Date(window.endDate.getTime()), true);

// 1ms after endDate — must be REFUSED.
await expectCapability('now === endDate + 1ms', new Date(window.endDate.getTime() + 1), false);

// Comfortably inside — sanity check the whole chain isn't accidentally always-false.
await expectCapability(
  'now well inside the window',
  new Date(window.startDate.getTime() + 60_000),
  true,
);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: buildShowWindow()'s parsed Date instants round-trip correctly through the real, " +
    'already-proven resolveRoleCapabilitiesForShow() boundary check — both exact boundary ' +
    'instants are granted (inclusive), both 1ms-outside instants are refused.',
);
process.exit(0);
