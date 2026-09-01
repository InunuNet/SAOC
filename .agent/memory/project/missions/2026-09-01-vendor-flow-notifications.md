---
schema: athanor.mission/v1
slug: vendor-flow-notifications
goal: vendor-flow-notifications
created_at: '2026-09-01T19:32:52.639249+00:00'
started_at: '2026-09-01T19:32:52.639249+00:00'
last_active_at: '2026-09-01T23:13:39.735406+00:00'
status: done
cost_estimate:
  features: 1
  milestones: 1
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: F1
  ts: '2026-09-01T23:13:31.683619+00:00'
features:
- id: F1
  status: done
  completed_at: '2026-09-01T23:13:31.683476+00:00'
milestones:
- id: M1
  status: done
  gate_ran_at: '2026-09-01T23:13:35.123465+00:00'
  gate_result: pass
completed_at: '2026-09-01T23:13:39.734870+00:00'
---

# Mission: vendor-flow-notifications

## Context

Fills G1 from `.agent/memory/project/specs/vendor-flow-gaps/README.md`: admin notification
emails for the three mission events (application submitted, registration submitted, stand
payment initiated/settled), plus the previously-missing vendor-facing "we received your
application" confirmation email, folded in as G1's fifth gap.

## Status as of 2026-09-02 close-out

**Contract + 7 RED-verified checks are written; NO implementation yet.**
`contracts/contract-vendor-flow-notifications.yaml` (F1) specifies five new files
(`lib/vendor-admin-notify-recipients.ts`, `lib/vendor-application-confirmation.ts` +
`emails/VendorApplicationConfirmation.tsx`, `lib/vendor-application-admin-notice.ts` +
`emails/VendorApplicationAdminNotice.tsx`, `lib/vendor-submission-admin-notice.ts` +
`emails/VendorSubmissionAdminNotice.tsx`, `lib/vendor-payment-admin-notice.ts` +
`emails/VendorPaymentAdminNotice.tsx`) and three wiring edits (`app/api/vendors/apply/route.ts`;
`lib/vendor-registration-handler.ts` + `app/api/vendors/register/route.ts`;
`lib/vendor-stand-payment-notification.ts`). Full decision record and everything the contract
does NOT prove: `contracts/golden/vendor-flow-notifications/README.md`.

Known judgement call baked into the contract: the spec names a per-application admin detail page
that does not exist in this repo (see `backlog.md` "No per-application admin detail page exists"),
so every review link in the notification emails points at the real, existing flat LIST pages
instead.

**Next step: @dev implementation against this contract and its golden files.** See
`next-sprint.md` item 1.

## Notes

