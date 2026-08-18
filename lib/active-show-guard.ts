// F3 (production-blockers): Studio-side guard against a second Sanity `show` document
// being marked `active`. Pure functions only — no Sanity client import, no
// firebase-admin import — same shape as lib/show-resolution.ts, so the behavioural
// logic is testable against fixtures with zero network access. See
// contracts/golden/production-blockers-f3-studio-active-show-guard/README.md.
//
// This module does not replace lib/show-resolution.ts's resolveActiveShow() as the
// code-side fail-closed backstop — Studio validation is bypassable via the raw Mutate
// API — it is a second, independent layer that stops the mis-click before it is ever
// published. See the README's "Studio validation is bypassable" section.

export interface ActiveShowCandidate {
  _id: string;
  title?: string | null;
  year?: number | null;
}

export interface ActiveShowConflict {
  conflict: ActiveShowCandidate;
  additionalCount: number;
}

/**
 * Returns the first other active show as a conflict (with a count of any further
 * conflicting shows), or `null` when `otherActiveShows` is empty — nothing else is
 * active, so ticking Active here is fine.
 */
export function findConflictingActiveShow(
  otherActiveShows: ActiveShowCandidate[]
): ActiveShowConflict | null {
  if (otherActiveShows.length === 0) return null;
  return {
    conflict: otherActiveShows[0],
    additionalCount: otherActiveShows.length - 1,
  };
}

/**
 * Formats the editor-facing name of a show: `"title" (year)` when both are set,
 * falling back to the bare `_id` when either is missing, so the message never renders
 * the literal string "null" or "undefined".
 */
function formatShowLabel(show: ActiveShowCandidate): string {
  if (show.title && show.year) return `"${show.title}" (${show.year})`;
  return show._id;
}

/**
 * Editor-facing wording for a detected active-show conflict. Written for Lee-Ann, the
 * non-technical Council secretary — names the conflicting show and tells her what to do
 * next, rather than a generic "validation failed". Appends "(and N other shows)" when
 * more than one other show is already (wrongly) active, never silently dropping the
 * count.
 */
export function formatActiveShowConflictMessage(result: ActiveShowConflict): string {
  const label = formatShowLabel(result.conflict);
  const otherShowsSuffix =
    result.additionalCount > 0
      ? ` (and ${result.additionalCount} other show${result.additionalCount === 1 ? '' : 's'})`
      : '';
  return (
    // Deliberately avoids the word "Another" — "Another show" contains the substring
    // "other show", which would spuriously trip the "(and N other shows)" detection
    // when additionalCount is 0 (see check-conflict-detection-and-message.mjs).
    `A show is already marked Active: ${label}${otherShowsSuffix}. Only one show can be ` +
    `Active at a time — untick Active on ${label} before ticking it here, or contact ` +
    `the site developer if you're not sure which show should be active.`
  );
}

/**
 * Strips a leading `drafts.` prefix from a Sanity document id; returns the input
 * unchanged if absent.
 */
export function getPublishedId(id: string): string {
  const DRAFT_PREFIX = 'drafts.';
  return id.startsWith(DRAFT_PREFIX) ? id.slice(DRAFT_PREFIX.length) : id;
}

/**
 * True when `idA` and `idB` refer to the same document once draft/published prefixes
 * are normalised away — used so a document's own draft/published id pair never
 * conflicts with itself in the "other active shows" query result.
 */
export function isSameDocument(idA: string, idB: string): boolean {
  return getPublishedId(idA) === getPublishedId(idB);
}
