/**
 * vendor-invite M1/F1 -- admin "Invite a vendor" duplicate-eligibility decision. Mirrors
 * lib/vendor-application-review.ts's own stated pattern exactly: pure, side-effect-free,
 * authorization-blind -- no Firestore, no firebase-admin, no lib/admin-auth.ts import. The
 * capability check that gates who may call this lives only in the route file
 * (app/api/admin/vendors/applications/invite/route.ts) -- never here.
 *
 * See .agent/memory/project/specs/vendor-invite/goldens/README.md "Duplicate-invite
 * eligibility" for the full decision record.
 */

import type { VendorApplicationStatus } from '@/types/index';

export interface VendorApplicationInviteCandidate {
  id: string;
  status: VendorApplicationStatus;
  contactEmail: string;
}

export type VendorApplicationInviteEligibilityDecision =
  | { ok: true }
  | { ok: false; error: string; conflictingId: string };

/**
 * Compares `contactEmail` against each candidate's `contactEmail`, case-insensitively (an
 * admin may type -- or an earlier applicant may have submitted -- the same address in a
 * different case). A candidate whose status is `pending` or `approved` blocks the invite: a
 * `pending` candidate should be reviewed via the existing approve/decline action instead of
 * creating a parallel document, and an `approved` candidate already has a live code -- the
 * existing reissue-code action is the correct tool to resend it. A candidate whose status is
 * `declined` does NOT block the invite -- a decline is a point-in-time committee decision, not
 * a permanent blacklist, and the new invite is a fully independent document. No match at all
 * allows the invite.
 */
export function decideVendorApplicationInviteEligibility(
  contactEmail: string,
  candidates: VendorApplicationInviteCandidate[],
): VendorApplicationInviteEligibilityDecision {
  const typedEmail = contactEmail.toLowerCase();

  for (const candidate of candidates) {
    if (candidate.contactEmail.toLowerCase() !== typedEmail) {
      continue;
    }

    if (candidate.status === 'pending') {
      return {
        ok: false,
        error: `An application from this email is already pending review (id: ${candidate.id}). Approve or decline it instead of creating a duplicate invite.`,
        conflictingId: candidate.id,
      };
    }

    if (candidate.status === 'approved') {
      return {
        ok: false,
        error: `An approved application from this email already exists (id: ${candidate.id}) with a live registration code. Use Reissue code to resend it instead of creating a duplicate invite.`,
        conflictingId: candidate.id,
      };
    }

    // status === 'declined' -- not a conflict, see the function doc comment above.
  }

  return { ok: true };
}
