// Fictional Test Show — a fictional, never-active National Show requested directly by Brad
// to isolate F12's and F14's human end-to-end ticket-purchase-and-check-in proofs away from
// the real 2027 show (`show-19-2027`), after F9's own dry-run resolved its demo ticket type
// against the real active show. See contracts/golden/fictional-test-show/README.md for the
// full decision record.
//
// The two marker classifiers below are dual-channel, mirroring lib/demo-ticket-type.ts's
// isDemoTicketTypeDoc() shape — OR across channels, never AND, because the purpose is finding
// every fictional-show artefact for cleanup/audit, where a false negative is the dangerous
// failure. isFictionalTestShowTicketTypeDoc() deliberately does NOT key off the shared `demo`
// boolean — F9's own real demo ticket type (scoped to the real active show) also carries
// `demo: true`, and using it here would misclassify F9's artefacts as this feature's own. See
// golden README "Why classification keys off show._ref, not the shared demo boolean".
//
// Pure — no @sanity/client import, no I/O, no Date.now().

export const FICTIONAL_SHOW_ID = 'show-fictional-test';
export const FICTIONAL_SHOW_SLUG = 'fictional-test-show';
export const FICTIONAL_SHOW_TITLE = 'Fictional Test Show (Do Not Use For Real Sales)';

// Deterministic, no `${activeShowId}` interpolation needed — the fictional show's own `_id`
// is itself fixed, unlike F9's demo ticket type whose `_id` is scoped to whichever real show
// is active. Deliberately DISTINCT from F9's DEMO_TICKET_TYPE_SLUG — see golden README "Why a
// different slug from F9's demo ticket type, not a reuse" for the collision this avoids.
export const FICTIONAL_SHOW_TICKET_TYPE_ID = 'ticketType-fictional-test-show-general-admission';
export const FICTIONAL_SHOW_TICKET_TYPE_SLUG = 'fictional-test-show-general-admission';
export const FICTIONAL_SHOW_TICKET_TYPE_NAME = 'General Admission (Fictional Test Show)';

// A placeholder, NOT Council-approved pricing — same nonzero PayFast comp-bypass reasoning as
// F9's DEMO_TICKET_TYPE_PLACEHOLDER_PRICE_ZAR. Must stay nonzero so a real-gateway proof
// against this show never takes checkout's R0 comp-bypass path.
export const FICTIONAL_SHOW_TICKET_TYPE_PRICE_ZAR = 10;
export const FICTIONAL_SHOW_TICKET_TYPE_CAPACITY = 50;

export interface FictionalShowMarkerFields {
  _id?: string | null;
  slug?: string | null;
  fictionalTestData?: boolean | null;
}

/**
 * Classifies a Sanity `show` document as the fictional test show if ANY of its three
 * independent channels says so — reserved `_id`, reserved `slug`, or `fictionalTestData ===
 * true`. OR across all three, mirroring F9's own OR-not-AND reasoning: a false negative here
 * (missing a real fictional-show document during cleanup) is the dangerous failure.
 */
export function isFictionalTestShowDoc(s: FictionalShowMarkerFields): boolean {
  return s._id === FICTIONAL_SHOW_ID || s.slug === FICTIONAL_SHOW_SLUG || s.fictionalTestData === true;
}

export interface FictionalShowTicketTypeMarkerFields {
  slug?: string | null;
  show?: { _ref: string } | null;
}

/**
 * Classifies a catalogue `ticketType` document as belonging to the fictional show if EITHER
 * its reserved slug matches, OR its `show._ref` points at FICTIONAL_SHOW_ID. Deliberately does
 * NOT inspect the shared `demo` boolean — see module header.
 */
export function isFictionalTestShowTicketTypeDoc(t: FictionalShowTicketTypeMarkerFields): boolean {
  return t.slug === FICTIONAL_SHOW_TICKET_TYPE_SLUG || t.show?._ref === FICTIONAL_SHOW_ID;
}

/**
 * EXACT match against FICTIONAL_SHOW_TICKET_TYPE_SLUG only — no prefix/substring matching.
 * This is the sole channel that survives onto a Firestore position's bare-string `ticketType`
 * field (identical reasoning to F9's isDemoTicketTypeSlug(), applied to this feature's own
 * reserved slug).
 */
export function isFictionalTestShowTicketTypeSlug(slug: string | null | undefined): boolean {
  return slug === FICTIONAL_SHOW_TICKET_TYPE_SLUG;
}
