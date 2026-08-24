// Golden reference for the corrected postCheckout() in
// contracts/checks/ticketing-hardening/_shared.mjs (~line 437).
//
// BUG: the route (app/api/tickets/checkout/route.ts) has required
// { showId, lineItems: [{ ticketType, attendeeName, attendeeEmail, chosenDay? }] }
// since commit 6046bc0 (2026-08-21, "M2-F5 — pooled-capacity checkout"). postCheckout
// still POSTs the pre-6046bc0 flat shape { showId, ticketType, attendeeName, attendeeEmail }
// with no `lineItems` key at all. parseLineItems(undefined) fails the Array.isArray check
// and returns null, so the route 400s with "showId, lineItems (1-20 valid line items) are
// required." for EVERY call — this is not an edge case, it is unconditional.
//
// Fix: build the lineItems array server-side inside the helper. Keep the existing
// call signature (ticketType/email/name/idempotencyKey/showId) unchanged so all ~18
// existing call sites in contracts/checks/ticketing-hardening/*.mjs work without editing
// every caller.

export async function postCheckout({
  ticketType = TARGET_TICKET_TYPE,
  email,
  name = 'Harden Check',
  idempotencyKey,
  showId = NATIONAL_SHOW_ID,
} = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (idempotencyKey !== null) headers['Idempotency-Key'] = idempotencyKey ?? crypto.randomUUID();
  const res = await fetch(`${BASE_URL}/api/tickets/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      showId,
      lineItems: [{ ticketType, attendeeName: name, attendeeEmail: email }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
