// F9 (ticketing-foundation): the reserved demo ticket type — one sellable, marker-tagged
// "General Admission (Demo)" `ticketType` document that F12's and F14's human end-to-end
// proofs purchase against a real PayFast SANDBOX gateway on a deployed host. See
// contracts/golden/ticketing-f9-demo-ticket/README.md for the full decision record.
//
// The marker is dual-channel because Firestore order/position documents never store the
// catalogue-level `demo` boolean at all — `app/api/tickets/checkout/route.ts` writes only
// `ticketType: input.ticketType` (the slug, a bare string per types/index.ts) onto a
// position. DEMO_TICKET_TYPE_SLUG is therefore the SOLE recoverability channel for every
// Firestore artefact this ticket type ever produces; the catalogue `demo` boolean is
// defence-in-depth that never reaches a position. See golden README "The marker mechanism".
//
// Pure — no @sanity/client import, no I/O, no Date.now().

export const DEMO_TICKET_TYPE_SLUG = 'demo-general-admission';
export const DEMO_TICKET_TYPE_NAME = 'General Admission (Demo)';

// A placeholder, NOT a Council-approved price. Must stay nonzero — a R0 ticket type takes
// checkout's comp-bypass path around PayFast entirely (spec §4.5), which would make F12's
// real-gateway proof hollow. See golden README "Price and capacity".
export const DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR = 10;
export const DEMO_TICKET_TYPE_PLACEHOLDER_CAPACITY = 50;

export interface TicketTypeCatalogueMarkerFields {
  slug?: string | null;
  demo?: boolean | null;
}

/**
 * Classifies a catalogue `ticketType` document as demo if EITHER channel says so — `demo ===
 * true` OR the slug is the reserved demo slug. OR, not AND: the purpose of this classifier is
 * finding every demo artefact for cleanup/audit, where a false negative (missing a real demo
 * document) is the dangerous failure. See golden README "Why OR, not AND".
 */
export function isDemoTicketTypeDoc(t: TicketTypeCatalogueMarkerFields): boolean {
  return t.demo === true || t.slug === DEMO_TICKET_TYPE_SLUG;
}

/**
 * EXACT match against DEMO_TICKET_TYPE_SLUG only — no prefix/substring matching. This is the
 * function a future cleanup query calls against a Firestore POSITION's `ticketType` string
 * field, since positions never carry the `demo` boolean at all — see module header.
 */
export function isDemoTicketTypeSlug(slug: string | null | undefined): boolean {
  return slug === DEMO_TICKET_TYPE_SLUG;
}

/**
 * Removes every demo-marked entry from a catalogue listing, preserving order for the rest.
 * Generic over any type that carries the marker fields, so callers (e.g. the public /tickets
 * page) don't have to narrow their real Sanity response shape down to the marker fields alone
 * first.
 */
export function filterPubliclyListableTicketTypes<T extends TicketTypeCatalogueMarkerFields>(
  types: T[]
): T[] {
  return types.filter((t) => !isDemoTicketTypeDoc(t));
}
