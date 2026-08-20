// Shared between server (app/(marketing)/tickets/page.tsx, checkout route) and client
// (TicketPurchaseForm) code — kept free of firebase-admin/Sanity imports so it is safe
// to pull into a 'use client' bundle. Matches the pinned nationalShow singleton _id
// (sanity/structure.ts): the document's own _id equals its schema type name.
export const NATIONAL_SHOW_ID = 'nationalShow';

/** How long an unpaid reservation holds its seat. Must comfortably exceed the time a
 *  buyer needs at PayFast; 30 minutes is ~10x the observed sandbox round-trip. */
export const RESERVATION_TTL_MINUTES = 30;

/**
 * Resource-exhaustion ceiling on the number of distinct line items a single checkout
 * request may carry — NOT the council's 5-tickets-per-booking business rule (that is
 * mission F6/Stage 4's job, unrelated). Lives here, not in
 * app/api/tickets/checkout/route.ts, so both the server (which enforces it) and any
 * client code (which pre-checks it for UX only) import the SAME symbol — see
 * contracts/golden/ticketing-line-item-cap-drift-guard/README.md.
 */
export const MAX_LINE_ITEMS = 20;
