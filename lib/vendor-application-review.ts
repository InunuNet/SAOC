/**
 * F2 (vendor-gated-registration-flow) -- pure vendor-application review status-transition
 * machine. See contracts/golden/vendor-gated-registration-flow-f1/README.md for the full
 * decision record. Mirrors lib/vendor-review.ts's injected-time, additive-only-patch,
 * closed-machine pattern exactly.
 *
 * Pure, side-effect-free, authorization-blind module -- no Firestore, no firebase-admin, no
 * lib/admin-auth.ts, no lib/admin-roles.ts import. The capability check that gates who may
 * call this lives only in the route files
 * (app/api/admin/vendors/applications/route.ts,
 * app/api/admin/vendors/applications/[id]/review/route.ts) -- never here.
 */

import type { VendorApplicationStatus } from '@/types/index';

export type VendorApplicationReviewAction = 'approve' | 'decline';

export interface VendorApplicationReviewDecisionInput {
  currentStatus: VendorApplicationStatus;
  action: VendorApplicationReviewAction;
  reviewerEmail: string;
  now: Date;
}

export interface VendorApplicationReviewPatch {
  status: VendorApplicationStatus;
  reviewedBy: string;
  reviewedAt: Date;
}

export type VendorApplicationReviewDecision =
  | { ok: true; patch: VendorApplicationReviewPatch }
  | { ok: false; error: string };

// The closed machine, exactly: pending --approve--> approved; pending --decline--> declined.
// Every other (currentStatus, action) pair -- including any action at all from approved or
// declined -- is refused. Keyed by currentStatus, then by action, to the next status; a
// missing key at either level means "refused."
const TRANSITIONS: Partial<
  Record<VendorApplicationStatus, Partial<Record<VendorApplicationReviewAction, VendorApplicationStatus>>>
> = {
  pending: {
    approve: 'approved',
    decline: 'declined',
  },
};

/**
 * Decides whether `action` may be applied to an application currently at `currentStatus`. On
 * success, returns a structurally additive-only 3-key patch -- `{status, reviewedBy,
 * reviewedAt}`, nothing else -- so a caller applying it via Firestore's `.update()` can never
 * overwrite any of the application's other fields. `now`/`reviewerEmail` are copied verbatim
 * from `input`, never derived internally.
 */
export function decideVendorApplicationTransition(
  input: VendorApplicationReviewDecisionInput,
): VendorApplicationReviewDecision {
  const nextStatus = TRANSITIONS[input.currentStatus]?.[input.action];

  if (!nextStatus) {
    return {
      ok: false,
      error: `Cannot apply action '${input.action}' to an application with status '${input.currentStatus}'.`,
    };
  }

  return {
    ok: true,
    patch: {
      status: nextStatus,
      reviewedBy: input.reviewerEmail,
      reviewedAt: input.now,
    },
  };
}
