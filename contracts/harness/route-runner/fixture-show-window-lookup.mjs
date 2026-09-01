// Overrides '@/lib/show-window-lookup' (route-runner harness). Was a permanent stub whose
// resolveShowWindowLookup() returned a lookup function that always answered `null` (no check
// exercised its return value behaviourally); extended by vendor-stand-early-bird-pricing (F1)
// with a settable current window so the vendor stand-payment initiate route's real
// cutoff-derivation dependency on the active show's startDate can be exercised end-to-end.
// Default remains `null` -- unchanged behaviour for every existing caller that never calls
// setShowWindowFixture(). Signature matches the real lib/show-window-lookup.ts export:
// resolveShowWindowLookup(showId, now) => Promise<(queryShowId) => ShowWindow | null>.
let currentWindow = null;

export function setShowWindowFixture(window) {
  currentWindow = window;
}

export async function resolveShowWindowLookup(_showId, _now) {
  return (_queryShowId) => currentWindow;
}
