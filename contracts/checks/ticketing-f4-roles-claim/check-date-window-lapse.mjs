#!/usr/bin/env node
// F4 (ticketing-foundation) — date-window lapse proof (spec §5.6 item 4 / §5.4's date-window
// note): a per-show role grant is honoured only while `now` is inside that show's own
// startDate/endDate window; a '*'-scoped grant is never date-limited. Injected `now` and an
// injected lookupShowWindow — no Date.now(), no network, no live Sanity/Firestore lookup.
//
// Run as: node --import tsx/esm contracts/checks/ticketing-f4-roles-claim/check-date-window-lapse.mjs

process.env.ADMIN_EMAIL_ALLOWLIST = 'test@example.com';

import { resolveRoleCapabilitiesForShow } from '../../../lib/admin-auth.ts';

const failures = [];

const SHOW_WINDOW = { startDate: new Date('2027-01-01T00:00:00Z'), endDate: new Date('2027-01-10T23:59:59Z') };
const lookupNationalShow = (showId) => (showId === 'nationalShow' ? SHOW_WINDOW : null);

function expectCapability(label, roles, showId, now, lookup, capability, expected) {
  const caps = resolveRoleCapabilitiesForShow(roles, showId, { now, lookupShowWindow: lookup });
  const has = caps.has(capability);
  if (has !== expected) {
    failures.push(
      `${label}: resolveRoleCapabilitiesForShow(...).has('${capability}') was ${has}, expected ${expected}.`,
    );
  }
}

// Inside the show's window: a per-show door-staff grant is honoured.
expectCapability(
  'inside window',
  { nationalShow: ['door-staff'] },
  'nationalShow',
  new Date('2027-01-05T00:00:00Z'),
  lookupNationalShow,
  'scan-checkin',
  true,
);

// Before the show's window: lapsed, refused.
expectCapability(
  'before window',
  { nationalShow: ['door-staff'] },
  'nationalShow',
  new Date('2026-12-01T00:00:00Z'),
  lookupNationalShow,
  'scan-checkin',
  false,
);

// After the show's window: lapsed, refused.
expectCapability(
  'after window',
  { nationalShow: ['door-staff'] },
  'nationalShow',
  new Date('2027-02-01T00:00:00Z'),
  lookupNationalShow,
  'scan-checkin',
  false,
);

// Per-show grant against a showId the lookup returns null for (show not found) — refused,
// not defaulted open.
expectCapability(
  'show not found',
  { unknownShowId: ['door-staff'] },
  'unknownShowId',
  new Date('2027-01-05T00:00:00Z'),
  () => null,
  'scan-checkin',
  false,
);

// A '*'-scoped grant is honoured regardless of the window — evaluated at a time outside the
// (irrelevant) show window above.
expectCapability(
  "'*' grant ignores the window",
  { '*': ['owner'] },
  'nationalShow',
  new Date('2027-02-01T00:00:00Z'),
  lookupNationalShow,
  'export-buyer-data',
  true,
);

// A '*'-scoped grant is honoured even when the lookup returns null for the showId being
// checked — '*' access never depends on any show existing at all.
expectCapability(
  "'*' grant ignores a null lookup",
  { '*': ['owner'] },
  'someUnrelatedShowId',
  new Date('2027-02-01T00:00:00Z'),
  () => null,
  'export-buyer-data',
  true,
);

if (failures.length > 0) {
  failures.forEach((f) => console.error(`FAIL: ${f}`));
  console.error(`\n${failures.length} assertion(s) failed.`);
  process.exit(1);
}

console.log(
  "PASS: per-show grants lapse outside the show's date window and are refused when the show " +
    "isn't found; '*' grants are never date-limited — proven live with injected time and an " +
    'injected show lookup.',
);
process.exit(0);
