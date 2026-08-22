#!/usr/bin/env node
// A2 — providerId VALIDATION IS FAIL-CLOSED: A 400 ON MISSING/INVALID, NEVER A SILENT PAYFAST
// DEFAULT. This is the explicit @architect decision (spec §3, M2/F3) the mission brief calls out
// as "not left to @dev's judgement" and demands as "a positive contract assertion" — proof it
// 400s, not merely that valid ids work.
//
// THE OFFLINE TRICK: with NEXT_PUBLIC_SANITY_PROJECT_ID unset, `client` (sanity/lib/client.ts) is
// `null`, and checkout/route.ts's OWN existing code already refuses with 500 "CMS is not
// configured" the moment it reaches `if (!client)`. That refusal is a real, pre-existing landmark
// this feature does not add. Requiring providerId validation to run BEFORE that landmark — not
// merely "somewhere before the reservation write" — makes the two failure modes MUTUALLY
// OBSERVABLE without touching Firestore/Sanity at all: a bad providerId must produce a 400 with
// this feature's own error text, and a valid providerId (with the CMS still unconfigured) must
// produce the PRE-EXISTING 500, proving the code actually walked past the providerId gate rather
// than the gate being unreachable/decorative. If providerId validation were placed AFTER the
// Sanity fetch (or omitted entirely), every case below would return the SAME 500, and cases 1-6
// would not discriminate between "the providerId check ran and passed" and "the providerId check
// never ran" — the CMS-not-configured control at the bottom of this script exists specifically to
// rule that out.
//
// WHAT MAKES THIS FAIL: providerId omitted, empty, wrong-case, or an unrecognised string ever
// returning anything other than 400; a 400 for a bad providerId that is indistinguishable from the
// existing showId/lineItems 400 (case 7 requires provider-specific response text, so a client can
// tell the two apart); a valid providerId ('payfast' or 'ozow') failing to reach the CMS-not-
// configured 500 (would mean the gate never ran, or ran and wrongly rejected something valid);
// EITHER 'payfast' or 'ozow' rejected (the allow-list must include BOTH, not just the new one).
//
// Run as: NEXT_PUBLIC_SANITY_PROJECT_ID= npx tsx contracts/checks/ozow-m1-f2/check-providerid-fail-closed.mjs

process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = '';
// Deliberately absent so ANY code path that reaches Firestore throws loudly rather than hanging
// or silently succeeding against a real project.
delete process.env.FIREBASE_ADMIN_PROJECT_ID;
delete process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
delete process.env.FIREBASE_ADMIN_PRIVATE_KEY;

const { POST } = await import('../../../app/api/tickets/checkout/route.ts');
const { NATIONAL_SHOW_ID } = await import('../../../lib/tickets-constants.ts');

const failures = [];
const ok = (name, cond, detail = '') => {
  if (!cond) failures.push(`${name}${detail ? `\n    ${detail}` : ''}`);
};

const VALID_LINE_ITEMS = [
  { ticketType: 'day-visitor', attendeeName: 'Test Buyer', attendeeEmail: 'buyer@example.com' },
];

let idempotencyCounter = 0;
function nextIdempotencyKey() {
  idempotencyCounter += 1;
  return `00000000-0000-4000-8000-${String(idempotencyCounter).padStart(12, '0')}`;
}

async function callCheckout(bodyOverrides) {
  const body = { showId: NATIONAL_SHOW_ID, lineItems: VALID_LINE_ITEMS, ...bodyOverrides };
  const request = new Request('http://localhost/api/tickets/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': nextIdempotencyKey(),
    },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  const json = await response.json().catch(() => null);
  return { status: response.status, json };
}

// Cases 1-6: invalid providerId values must all 400, never anything else (never 500, never a
// 2xx that would mean a purchase silently proceeded against a default gateway).
const invalidCases = [
  ['omitted', {}],
  ['empty string', { providerId: '' }],
  ['unrecognised string', { providerId: 'stripe' }],
  ['wrong case', { providerId: 'PayFast' }],
  ['null', { providerId: null }],
  ['non-string (number)', { providerId: 1 }],
];
for (const [label, overrides] of invalidCases) {
  const { status, json } = await callCheckout(overrides);
  ok(`case (${label}): providerId=${JSON.stringify(overrides.providerId)} returns 400`,
    status === 400, `actual status: ${status}, body: ${JSON.stringify(json)}`);
}

// Case 7: the providerId-specific 400 carries its own distinguishable error text — not the
// generic showId/lineItems message, so a client (and this check) can tell WHICH validation failed.
{
  const { json } = await callCheckout({ providerId: 'stripe' });
  const message = String(json?.error ?? '');
  ok('case 7: invalid-providerId 400 has its own error text (mentions providerId)',
    /providerId/i.test(message), `actual error: ${JSON.stringify(message)}`);
}

// Cases 8-9 (THE CONTROL): a VALID providerId must walk PAST the providerId gate and reach the
// pre-existing "CMS is not configured" 500 — proving the gate ran and passed, not that it was
// skipped or unreachable. Without this control, cases 1-6 all returning 400 could just as easily
// mean "everything 400s regardless of providerId" (e.g. a route that 400s before parsing the body
// at all) rather than "the providerId gate specifically discriminates."
for (const providerId of ['payfast', 'ozow']) {
  const { status, json } = await callCheckout({ providerId });
  ok(`case (control, providerId=${providerId}): passes the providerId gate and reaches the CMS-not-configured 500`,
    status === 500 && /CMS is not configured/i.test(String(json?.error ?? '')),
    `actual status: ${status}, body: ${JSON.stringify(json)}`);
}

if (failures.length > 0) {
  console.error(`FAIL — ${failures.length} case(s):\n\n${failures.join('\n\n')}`);
  process.exit(1);
}
console.log('PASS — providerId validation is fail-closed (400 on missing/invalid) with no silent PayFast default.');
