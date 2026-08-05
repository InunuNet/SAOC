// F4 (cms-loop-and-wiring): target constants for the `award` type round trips.
// Reuses contracts/checks/f6-prove-cms-loop/_shared.mjs's parameterised helpers
// (readDatasetField, fetchPublicPageContains, openAuthenticatedDoc, callRevalidate,
// setFieldAndPublish) — same pattern F2 established, not forked.
//
// TARGET DOCUMENT: award-am-saoc ("Award of Merit", AM/SAOC). Chosen — not an
// arbitrary pick — because docs/f4-orphaned-types-recon.md found its `_updatedAt` is
// 23 days after `_createdAt` while the other five awards' timestamps are identical:
// someone already edited this exact document in Studio and the site did not change.
// Proving THIS document's edits now reach the live site directly closes the gap that
// already caused a real, observed problem, not a hypothetical one.
//
// `award` is a plain COLLECTION type in sanity/structure.ts (S.documentTypeListItem),
// like societyEvent — NOT a pinned singleton — so its Studio deep link needs the
// `type;documentId` pattern (openAuthenticatedDoc's `structurePath` param, added
// during F2's contract authoring for exactly this reason).
export const AWARD_DOC_ID = 'award-am-saoc';
export const AWARD_STRUCTURE_PATH = `award;${AWARD_DOC_ID}`;
export const AWARD_PAGE_PATH = '/judging';
export const AWARD_REVALIDATE_TYPE = 'award';

// `threshold` does not exist on the `award` schema today (sanity/schemas/documents/
// award.ts) — this is the exact field docs/f4-orphaned-types-recon.md found was
// silently dropped during the 2026-06-30 bulk seed (the schema never had it, so the
// mapper couldn't carry it over). @dev's mandate (team-lead brief) is to add this
// field to the schema AND backfill the six real values verbatim from
// lib/data/awards.ts. Until that lands, this field will not exist in the Studio at
// all — the round trip's Studio step is EXPECTED to hard-fail with "field not found"
// for that reason alone (see contract header "EXPECTED PRE-FIX RESULTS").
export const AWARD_THRESHOLD_FIELD = 'threshold';

// The correct, backfilled production value for award-am-saoc.threshold, taken
// verbatim from lib/data/awards.ts (AM/SAOC: '80–89 pts'). Unlike F6/F2, whose target
// fields started EMPTY, this field's correct steady state is non-empty real content —
// so the round trip's baseline precondition is "equals this exact string", and
// cleanup restores THIS value (not empty), then verifies the sentinel — never this
// value — is what's checked for absence post-cleanup (see check script comments).
export const AWARD_AM_THRESHOLD_VALUE = '80–89 pts'; // en dash, matches source verbatim

// `order` does not exist on the `award` schema today either. team-lead's brief
// requires an explicit `order` field (AM, FCC, HCC, CCM, CBR, JC — the curated,
// non-alphabetical display sequence already live via the static array) so this is
// the second field this contract's round trips exercise. Curated order maps
// AM/SAOC -> 1 ... JC/SAOC -> 6 (see check-award-order-reaches-site.mjs for the
// full map and why AM is moved to the END, not just changed, as the test mutation).
export const AWARD_ORDER_FIELD = 'order';
export const AWARD_AM_ORDER_VALUE = 1;
export const AWARD_ORDER_SENTINEL_VALUE = 99; // moves AM/SAOC to render last

// Full curated code sequence, for asserting rendered order (both in the dynamic
// round trip and the static steady-state check). Verbatim from lib/data/awards.ts —
// this is the array order the current static import already renders correctly today,
// which is exactly why order alone can't be trusted as proof of Sanity wiring (see
// contract header "WHY A STATIC ORDER/CONTENT CHECK ALONE PROVES NOTHING").
export const CURATED_AWARD_CODES = ['AM/SAOC', 'FCC/SAOC', 'HCC/SAOC', 'CCM/SAOC', 'CBR/SAOC', 'JC/SAOC'];

// Verbatim from lib/data/awards.ts. CBR/SAOC and JC/SAOC intentionally have '—' —
// components/judging/AwardsGrid.tsx only renders the threshold paragraph when
// `award.threshold && award.threshold !== '—'`, so these two must NOT be expected to
// appear literally as rendered threshold text (asserting them would be a wrong
// assertion, not a strict one — the '—' rows correctly render nothing there).
export const CURATED_AWARD_THRESHOLDS = {
  'AM/SAOC': '80–89 pts',
  'FCC/SAOC': '90+ pts',
  'HCC/SAOC': '75–79 pts',
  'CCM/SAOC': '80+ pts',
  'CBR/SAOC': null,
  'JC/SAOC': null,
};
