// GENERIC active-show swap planner — deliberately NOT fictional-show-specific, despite living
// alongside the fictional-test-show feature that motivated it. See
// contracts/golden/fictional-test-show/README.md "Why the swap planner is generic, not
// fictional-show-specific" and A9/A10.
//
// resolveActiveShow() (lib/show-resolution.ts) is binary and fails closed: exactly one `show`
// document may carry `active: true` at a time, or nothing is sellable. Actually running an
// F12/F14-style live purchase test against the fictional show means briefly making it the SOLE
// active show — this module computes that swap as an auditable, reversible plan; it performs
// no write itself. scripts/swap-active-show.ts is the thin, real-Sanity-writing wrapper around
// it (unasserted, --apply-gated, human-run).
//
// Pure — no @sanity/client import, no I/O, no Date.now().

export interface ShowActivationRecord {
  _id: string;
  active?: boolean | null;
}

export type ActiveShowSwapPlan =
  | { safe: true; deactivate: string[]; activate: string }
  | { safe: false; reason: string };

/**
 * Plans deactivating every OTHER currently-active show and activating `targetShowId`, such
 * that applying the plan leaves EXACTLY one show active afterwards. `deactivate` is sorted by
 * `_id` so the plan is deterministic and diffable regardless of input order.
 *
 * Refuses (`safe: false`) if `targetShowId` is not present in `shows` at all — never silently
 * plans to activate a show the caller never confirmed exists.
 */
export function planActiveShowSwap(
  shows: ShowActivationRecord[],
  targetShowId: string
): ActiveShowSwapPlan {
  const target = shows.find((s) => s._id === targetShowId);
  if (!target) {
    return { safe: false, reason: `Target show '${targetShowId}' not found among the provided shows.` };
  }

  const deactivate = shows
    .filter((s) => s._id !== targetShowId && s.active === true)
    .map((s) => s._id)
    .sort();

  return { safe: true, deactivate, activate: targetShowId };
}
