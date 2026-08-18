/**
 * F6 (vendor-registration) — pure vendor-application review status-transition machine. See
 * contracts/golden/vendor-f6-review-workflow/README.md for the full decision record.
 *
 * Pure, side-effect-free, authorization-blind module — no Firestore, no firebase-admin, no
 * lib/admin-auth.ts, no lib/admin-roles.ts import. Mirrors F7 checkin-audit's and F8
 * comp-tickets' injected-time, additive-only-patch pattern: `now` and `reviewerEmail` are
 * always taken verbatim from the caller, never read from `Date.now()`/`new Date()`
 * internally. The capability check that gates who may call this lives only in the route/
 * layout files (app/api/admin/vendors/route.ts, app/api/admin/vendors/[id]/review/route.ts,
 * app/admin/vendors/layout.tsx) — never here.
 */

import type { VendorSubmissionStatus } from '@/types/index';

export type VendorReviewAction = 'start-review' | 'approve' | 'reject';

export interface VendorReviewDecisionInput {
  currentStatus: VendorSubmissionStatus;
  action: VendorReviewAction;
  reviewerEmail: string;
  now: Date;
}

export interface VendorReviewPatch {
  status: VendorSubmissionStatus;
  reviewedBy: string;
  reviewedAt: Date;
}

export type VendorReviewDecision =
  | { ok: true; patch: VendorReviewPatch }
  | { ok: false; error: string };

// The closed machine, exactly: submitted --start-review--> under-review;
// under-review --approve--> approved; under-review --reject--> rejected. Every other
// (currentStatus, action) pair — including submitted going straight to approved/rejected,
// and any action at all from approved or rejected — is refused. Keyed by currentStatus,
// then by action, to the next status; a missing key at either level means "refused."
const TRANSITIONS: Partial<
  Record<VendorSubmissionStatus, Partial<Record<VendorReviewAction, VendorSubmissionStatus>>>
> = {
  submitted: {
    'start-review': 'under-review',
  },
  'under-review': {
    approve: 'approved',
    reject: 'rejected',
  },
};

/**
 * Decides whether `action` may be applied to a submission currently at `currentStatus`. On
 * success, returns a structurally additive-only 3-key patch — `{status, reviewedBy,
 * reviewedAt}`, nothing else — so a caller applying it via Firestore's `.update()` can never
 * overwrite any of the 31 submitted fields. `now`/`reviewerEmail` are copied verbatim from
 * `input`, never derived internally, so two calls sharing an identical explicit `now`
 * produce an identical `reviewedAt` regardless of real wall-clock time elapsed between them.
 */
export function decideVendorStatusTransition(
  input: VendorReviewDecisionInput,
): VendorReviewDecision {
  const nextStatus = TRANSITIONS[input.currentStatus]?.[input.action];

  if (!nextStatus) {
    return {
      ok: false,
      error: `Cannot apply action '${input.action}' to a submission with status '${input.currentStatus}'.`,
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
