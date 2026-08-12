// Shared between server (app/(marketing)/tickets/page.tsx, checkout route) and client
// (TicketPurchaseForm) code — kept free of firebase-admin/Sanity imports so it is safe
// to pull into a 'use client' bundle. Matches the pinned nationalShow singleton _id
// (sanity/structure.ts): the document's own _id equals its schema type name.
export const NATIONAL_SHOW_ID = 'nationalShow';

/** How long an unpaid reservation holds its seat. Must comfortably exceed the time a
 *  buyer needs at PayFast; 30 minutes is ~10x the observed sandbox round-trip. */
export const RESERVATION_TTL_MINUTES = 30;
