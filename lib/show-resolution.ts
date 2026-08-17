// F1 (ticketing-foundation): decides which Sanity `show` document is currently
// sellable — a genuinely new question, decoupled from lib/tickets-constants.ts's
// NATIONAL_SHOW_ID (a Firestore showId scoping value, unrelated to any Sanity
// document _id). See contracts/golden/ticketing-f1-show-collision/README.md,
// "Resolver contract".
//
// Kept free of firebase-admin/Sanity client imports so it stays a pure function,
// testable against fixtures without a live dataset (see check-active-show-resolver.mjs).

export interface ShowActivationFields {
  _id: string;
  active?: boolean | null;
}

/**
 * Returns the `_id` of the one show document with `active === true`, or `null` if
 * none (or more than one — malformed data must never silently pick one). Never falls
 * back to a hardcoded id: an empty/ambiguous result is a real "no active show" state
 * that callers must handle explicitly (checkout treats it as `unusableTicketType`).
 */
export function resolveActiveShow(shows: ShowActivationFields[]): string | null {
  const activeShows = shows.filter((show) => show.active === true);
  if (activeShows.length !== 1) return null;
  return activeShows[0]._id;
}
