// =============================================================
// SAOC — lib/data/exhibitor-keydates-note.ts
// R77 #3 (launch-weekend F18). A key-dates row whose status is pending already says so in its
// chip ("To be confirmed by the show committee"). When the row's dateNote only RESTATES that the
// date is unset, the sentence is dropped and the chip stays; a dateNote that carries information
// (a pointer, a research value) is kept. research, question and confirmed rows are never touched.
// The pattern is measured against the live Sanity rows (goldens/f18/exhibitors-tbc.json).
// =============================================================

const UNSET_PHRASING = /(\bnot (yet )?set\b|\bto be set\b|will confirm)/i;

// The statuses the exhibitor marker renders on its own; any other value (pending, missing or
// unrecognised) resolves to the pending marker, exactly as StatusMarker does.
const NON_PENDING_STATUSES: ReadonlySet<string> = new Set(['confirmed', 'research', 'question']);

export function restatesPending(
  note: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (!note || note.trim() === '') return false;
  if (status && NON_PENDING_STATUSES.has(status)) return false;
  return UNSET_PHRASING.test(note);
}
