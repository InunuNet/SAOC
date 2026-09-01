# Golden: stand-payment-link-visibility (hotfix, 2026-09-01)

Demo tomorrow morning. Email is broken (`forms.saoc.co.za` unverified in Resend), so the M3
stand-payment link -- minted by `POST /api/admin/vendors/[id]/review` on approve, and
re-mintable via `POST /api/admin/vendors/[id]/resend-payment-link` -- currently reaches nobody:
it is never persisted anywhere (`lib/vendor-stand-payment-token.ts` is deliberately pure, no
Firestore, no network -- do not change that) and the only existing delivery path is a broken
email send.

## What to build (smallest correct change, two files)

1. **`app/api/admin/vendors/[id]/resend-payment-link/route.ts`** -- keep every existing gate,
   status code, and refusal path (401/403/404/409/503) byte-identical. Two changes only:
   - Success response becomes `{ success: true, paymentUrl }` -- reuse the SAME
     `buildVendorStandPaymentUrl()` the review route already has (copy it verbatim into this
     file, or extract to a tiny shared helper if you prefer -- either is fine, do not invent a
     second URL shape).
   - Make the email send **non-fatal**: reuse `deliverConfirmationEmailAfterCommit` (already
     imported in the review route, same pattern) so a Resend failure logs and is swallowed
     instead of turning into a 500 -- the admin must get `paymentUrl` back even when the email
     fails to send. The route still ALWAYS mints a fresh token on every call ("reissue, not
     unlock" -- unchanged from M3).

2. **`components/admin/VendorReviewTable.tsx`** -- for a row that is `status === 'approved'`
   and `standPaymentStatusById[row.id] !== 'paid'`, add a button (next to the existing action
   buttons, same styling conventions as the rest of the table) that:
   - POSTs to `/api/admin/vendors/${id}/resend-payment-link` (the existing route, now reused
     for display too -- no new route).
   - Reads `paymentUrl` from the JSON response.
   - Copies it to the clipboard (`navigator.clipboard.writeText`, guarded -- not every browser
     context exposes it) AND shows the URL inline (e.g. a readonly text input or visible text)
     so the operator has a manual-copy fallback if the clipboard write is blocked.
   - Reuses the existing `error`/`pendingId` state pattern already in this component -- do not
     invent a second loading/error mechanism.

Do not persist the token. Do not add a new collection or field to `vendorSubmissions` /
`vendorStandOrders`. Do not change `lib/vendor-stand-payment-token.ts`.

## Authorisation -- the property that actually matters here

This URL grants payment access, so it must be exactly as protected as it already is on the
email path: the resend route's existing `getAdminSession()` → `hasCapability(...,
'review-vendor-applications', ...)` gate, unchanged. Do not add a second gate, a new
capability, or a public/token-based way to fetch it. `check-admin-obtains-url-non-admin-refused.mjs`
proves an unauthenticated/non-admin caller gets 401/403 with no `paymentUrl` and no raw token
anywhere in the response body, and that the route file never `console.log`s the token or URL.

## Route-runner harness note

`contracts/harness/route-runner/fixture-admin-auth.mjs` gained a `FIXTURE_ADMIN_DENIED=1` env
toggle (this session, 2026-09-01) so one script can exercise both the authenticated-admin and
the denied-caller path against the SAME imported route handler, in the same process, the way
the existing M3 checks already toggle `VENDOR_STAND_PAYMENT_TOKEN_SECRET` between calls.
Default behaviour (toggle unset) is byte-identical to before -- every existing check that never
sets it is unaffected (verified: `check-approval-mints-payment-link-and-resend.mjs` still
passes).

## Left unfinished / flagged to @dev

- Whether the copy affordance is a full "Copy" button with a distinct success state (e.g.
  "Copied!") or a simpler always-visible readonly input is a UI-polish call left to @dev --
  either satisfies the assertions below. Keep it small; this is a hotfix.
- Not in scope: fixing Resend/`forms.saoc.co.za` verification itself. This golden only adds an
  email-independent path to the same, already-correct token.
