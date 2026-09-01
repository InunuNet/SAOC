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

## Status as of 2026-09-02 close-out — M1/F1 DONE

Shipped in `a5be7d49`: admin notices at three moments (application submitted, full registration
submitted, stand payment settled) plus the previously-missing vendor-facing "application
received" confirmation. Five new lib modules and four React Email templates
(`lib/vendor-admin-notify-recipients.ts`, `lib/vendor-application-confirmation.ts` +
`emails/VendorApplicationConfirmation.tsx`, `lib/vendor-application-admin-notice.ts` +
`emails/VendorApplicationAdminNotice.tsx`, `lib/vendor-submission-admin-notice.ts` +
`emails/VendorSubmissionAdminNotice.tsx`, `lib/vendor-payment-admin-notice.ts` +
`emails/VendorPaymentAdminNotice.tsx`), wired into `app/api/vendors/apply/route.ts`,
`lib/vendor-registration-handler.ts` + `app/api/vendors/register/route.ts`, and
`lib/vendor-stand-payment-notification.ts`. Admin recipients resolve from
`ADMIN_EMAIL_ALLOWLIST` only, deliberately not importing the `/admin` login authorization
modules. Every send goes through `deliverConfirmationEmailAfterCommit()` and fires strictly
after the Firestore write commits — a failed notification never fails the underlying request.

Known judgement call baked into the contract: the spec names a per-application admin detail page
that does not exist in this repo (see `backlog.md` "No per-application admin detail page exists"),
so every review link in the notification emails points at the real, existing flat LIST pages
instead.

Four defect classes found and fixed before merge (full detail in `a5be7d49`'s commit message and
`learned.md`): a Firestore transaction-retry stale-variable bug (`paidNotice` surviving an
aborted attempt into a retry that took a different branch); vacuous recipient assertions
(A5-A8 proved the resolver was called, never that its output reached the mailer unmodified — new
A10 closes this); six stale `vendor-f5-register-route` fixtures silently broken since M2 because
`tsconfig.json` excludes `contracts/`; and a swallowed `TypeError` where the failure-isolation
wrapper around `sendAdminNotice` hid a programming error from four `.mjs` fixtures.

Gates at close: `vendor-flow-notifications` 10/10 clean; `vendor-f5-register-route` 9 pass + A9
environmentally blocked (long-lived `next dev` process occupying the directory); the umbrella
`vendor-gated-registration-flow` 52 pass + 1 retired skip (A20). Codex GPT-5.5: PASS on the fifth
pass, after four rounds of real findings on earlier passes.

## Notes

