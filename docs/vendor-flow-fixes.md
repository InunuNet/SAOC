# Vendor flow fixes

**Mission:** `vendor-flow-fixes`. **Integration branch:** `integ/vendor-flow-fixes` at `ecb8fe08`
(on origin and on beta). **Contracts and goldens:** `.agent/memory/project/specs/vendor-flow-fixes/`
(`contract-f2.yaml`, `contract-f4.yaml`, `contract-f5.yaml`, and `goldens/`). The contract check
scripts live under `contracts/checks/vendor-photo-resume/`, `contracts/checks/vendor-stand-return-url/`
and `contracts/checks/vendor-stand-sandbox-amount/`.

This document records what the fixes do and where they live. It does not record gate results.
Run the contract gate for the current state.

---

## Summary

| Area | Fix | Main files |
|---|---|---|
| Admin Storage bucket | Firebase Admin is initialised with the storage bucket when one is configured. Upload routes refuse cleanly when it is not. | `lib/firebase-admin.ts`, `app/api/vendors/[id]/proof-of-payment/route.ts`, `app/api/vendors/[id]/marketing-asset/route.ts` |
| Ozow `BankReference` | Vendor stand references are sent as `VSO-` plus 16 characters of the attempt id. Any other over-length reference throws. | `lib/payments/ozow.ts` |
| Gateway field caps | Every outbound Ozow field and the PayFast `item_name` are checked against documented caps. Over-length values throw before the request is signed. | `lib/payments/gateway-field-limits.ts`, `lib/payments/ozow.ts` |
| Stand return URLs | Initiate sends one short, token-free status URL, `/vsp?a=<attemptId>`, for success, cancel and error. | `lib/vendor-stand-return.ts`, `app/(marketing)/vsp/page.tsx`, `app/(marketing)/national-show/vendors/payment/status/page.tsx` |
| Ozow Sandbox Test Mode for stand payments (F5) | Initiate sends R0.01 to Ozow while the admin toggle is on, and settlement accepts that amount. The order keeps its real price. | `lib/vendor-stand-order-amount.ts`, `app/api/vendors/stand-payment/initiate/route.ts`, `lib/vendor-stand-payment-notification.ts`, `components/vendors/VendorStandPaymentForm.tsx` |
| Vendor photo-resume link (F2) | A signed link lets a vendor finish the 3 product-photo uploads after the single-use registration code is spent. Admins can re-issue it. | see [Vendor photo-resume link](#vendor-photo-resume-link-f2) |
| `/register` completion state | The success panel says registration is complete once all 3 product photos have uploaded. | `components/vendors/VendorRegisterSuccess.tsx`, `components/vendors/VendorMarketingUploadField.tsx` |
| `/register` native GET guard | The form uses `method="post"` and its submit button stays disabled until the form has hydrated. | `components/vendors/VendorRegisterForm.tsx` |

---

## Admin Storage bucket

`lib/firebase-admin.ts` exports `getStorageBucketName()`, which reads
`NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` and returns `undefined` when it is empty. `initAdmin()` passes
`storageBucket` to `initializeApp()` only when a name is returned, so an unset variable does not
produce an invalid app configuration.

The two vendor upload routes check the bucket before they touch Storage. When it is missing they log
the operation and return HTTP 500 with `File upload is temporarily unavailable.`. The log line names
the variable to set. Before this fix the routes failed inside the Storage call.

Check: `contracts/checks/vendor-storage-bucket/check-init-admin-storage-bucket.mjs` (committed at `77e50788`).

---

## Ozow `BankReference`

Ozow documents `BankReference` as `String(20)`, a hard cap. A vendor stand reference
(`VSO-<vendorSubmissionId>::<attemptId>`) is 42 characters, so Ozow rejected every stand payment
with a bare request error once `activeGateway` was `ozow`.

`deriveOzowBankReference()` in `lib/payments/ozow.ts` now handles three cases in order:

1. A booking reference (`BOOKING_REF_PREFIX`) keeps its existing derivation.
2. A vendor stand reference becomes `VSO-` plus the first 16 characters of the attempt id, which is
   exactly 20 characters. The attempt id is random per payment, so the value is unique on its own.
   The full reference still travels as `TransactionReference`, and settlement matches on that field.
   `BankReference` is never read back.
3. Any other reference longer than 20 characters throws. Truncation could make two payments share a
   `BankReference`, and an over-length value reproduces the silent rejection.

Check: `contracts/checks/ozow-vso-bankref/check-ozow-vso-bankref.mjs` (`a42694dc`).

---

## Gateway field caps

`lib/payments/gateway-field-limits.ts` holds the documented caps:

- `OZOW_FIELD_MAX_LENGTH` covers all 17 outbound Ozow fields plus `HashCheck`.
- `PAYFAST_FIELD_MAX_LENGTH` covers `item_name` and `m_payment_id`.

`findFieldLengthViolations()` lists the fields over their cap. `lib/payments/ozow.ts` calls it before
the hash is generated and throws an error that names each field and its length. The error does not
include the values, because they can carry URLs and references.

Two caps need a note:

- **`CancelUrl` is 150.** Ozow's main table prints `CancelUrl` as `String(50)`, but the sandbox
  evidence shows 150 is enforced, matching `ErrorUrl`. Commit `24123b74` briefly set 50 and
  `a560d5be` restored 150.
- **`clampToMaxLength()`** truncates to a maximum number of UTF-16 code units and never splits a
  surrogate pair. It is applied to the PayFast `itemName` (100 characters). A 200-character business
  name no longer makes the item name fail.

Checks: `contracts/checks/vendor-stand-return-url/check-ozow-field-limits.mjs` and
`check-initiate-route-urls.mjs`.

---

## Stand return URLs

### Before and after

Before this fix, the initiate route set `returnUrl` and `cancelUrl` to
`/national-show/vendors/payment?token=<stand token>&paid=1` (and without `&paid=1` for cancel). Those
URLs carried the token and were 239 to 246 characters, over Ozow's 150-character cap. The vendor
landed on `pay.ozow.com/request-error`.

After this fix, initiate sends the same URL for `returnUrl` and `cancelUrl`:

```
<siteUrl>/vsp?a=<attemptId>
```

`buildVendorStandReturnUrl()` in `lib/vendor-stand-return.ts` builds the URL. It throws unless the
attempt id matches `^[0-9a-f]{16}$`. The path and query are 23 characters, so any `siteUrl` up to 127
characters keeps the URL within 150.

### The status page

- `app/(marketing)/vsp/page.tsx` is a thin alias. It re-exports the metadata and the page from
  `national-show/vendors/payment/status/page.tsx`, and declares `dynamic = 'force-dynamic'` itself.
  `/vsp` exists because `CancelUrl` cannot fit a `/national-show/...` path under a 50-character reading.
- The status page is `force-dynamic` and `noIndex`. It reads only the `a` query parameter. It looks up
  `vendorStandOrders` by `attemptId` with `limit(1)` and reads only the `status` field. It mints no
  token, reads no submission, PII or amount, writes nothing and never redirects.
- `resolveVendorStandReturnState()` in `lib/vendor-stand-return.ts` returns one of three states:
  - `paid` only when the stored status is exactly `paid`;
  - `pending` when the stored status is exactly `pending`, or when the lookup throws, so a possibly
    paid vendor is never told to retry;
  - `not-completed` for every other value, a missing order or a malformed attempt id. The loader is
    not called for a malformed id.

The copy for each state is held in the status page's `COPY` table.

The old `/national-show/vendors/payment` page still exists and still handles the stand payment form.
Initiate no longer generates URLs that point to it.

Checks: `contracts/checks/vendor-stand-return-url/check-return-url-builder.mjs`,
`check-return-state.mjs`, `check-static-wiring.mjs` and `check-copy-strings.mjs`.

---

## Ozow Sandbox Test Mode for stand payments (F5)

The Ozow sandbox merchant account rejects any amount above R0.01. Ticket checkout already honours the
admin toggle `adminSettings/ozowSandboxTestMode`, and stand payments now honour it in the same way.

- **Initiate.** `POST /api/vendors/stand-payment/initiate` reads the flag once, before the Firestore
  transaction, with `isOzowSandboxTestModeEnabled()`. It derives the value with
  `resolveExpectedGatewayAmount(activeGateway, flag)`. For `ozow` with the flag on, the value is `0.01`.
  Otherwise it is `null`. The same value is stored on the order as `expectedGatewayAmount` and passed to
  `resolveOzowInitiateAmount()` to set the amount sent to Ozow. A re-initiate re-derives both values.
- **Stored fields.** `vendorStandOrders` gains `expectedGatewayAmount`, which is `null` for PayFast,
  for Ozow with the flag off, and for legacy orders. `order.amount` and the amount shown on the page
  remain the real price.
- **Settlement.** The shared settlement handler calls `vendorStandOrderAmountMatches(order, grossAmountCents)`
  (`lib/vendor-stand-order-amount.ts`) in two places: before the gateway confirm, and again inside the
  transaction. It compares against
  `expectedGatewayAmount ?? amount`, so an order with no expectation keeps the old behaviour. A
  non-finite value or a null gross amount never matches. In test mode a real-amount notification is
  rejected and a 1-cent notification settles.
- **Banner.** `VendorStandPaymentForm` renders the existing `OzowSandboxTestModeBanner`. Its text is
  not duplicated.

PayFast and the ticket path are unchanged.

Checks: `contracts/checks/vendor-stand-sandbox-amount/` (`check-amount-match.mjs`,
`check-initiate-test-mode.mjs`, `check-settlement-amounts.mjs`, `check-static-wiring.mjs`).

---

## Vendor photo-resume link (F2)

### Why

A vendor could leave before uploading all 3 product photos. The registration code is single-use and
is consumed when the full form is submitted, so a vendor had no route back to the upload step. The
photo-resume link gives a single-purpose URL that does not reopen the registration code.

### The token

`lib/vendor-photo-resume-token.ts`:

- Shape: `base64url(JSON({u, e, n})).hmacSha256Hex`. `u` is the vendor submission id, `e` is the
  expiry in epoch milliseconds and `n` is a 16-byte random nonce.
- The HMAC covers the prefix `vendor-photo-resume:v1:` followed by the payload segment.
- Default lifetime is 30 days. Expiry is exclusive.
- The token is not single-use. Each page load reads the submission's current photo state.
- The secret is `VENDOR_STAND_PAYMENT_TOKEN_SECRET`, the same secret the stand-payment token uses. The
  tokens are kept apart by the payload keys and by the HMAC prefix, so neither token can be used in the
  other's domain.
- The module is pure. The caller supplies the clock.

`lib/vendor-photo-resume-link.ts` builds the URL
`<siteUrl>/national-show/vendors/photos?token=<token>`.

### The resume page

`app/(marketing)/national-show/vendors/photos/page.tsx`:

- Takes only the `token` search parameter. It is `force-dynamic` and `noIndex`.
- `lib/vendor-photo-resume-gate.ts` resolves the state. It returns one of:
  - `invalid`, for a missing or unset secret, a token that fails verification, a missing submission or
    a rejected submission;
  - `complete`, when all 3 product-photo path fields are non-empty strings;
  - `upload`, with the missing slots and the uploaded count.
- The loader is only called with the verified token's own id. The resolved state is a closed shape and
  carries no PII or storage path.
- The page renders no registration form and no logo. The upload fields are `VendorPhotoResumeUploads`.
  The upload API is unchanged.

### Where the link is sent

- **Registration-received email.** `lib/vendor-registration-confirmation.ts` mints a fresh link when
  `vendorSubmissionId` is supplied and the secret is set. The link is passed to
  `emails/VendorRegistrationConfirmation.tsx` as `photoUploadUrl` and rendered as "Upload your product
  photos" when present. If the secret is unset, the link is omitted and the email still sends.
  The confirmation sender still does not log, because it carries submitter PII.
- **Admin re-issue.** `POST /api/admin/vendors/[id]/resend-photo-link` (`app/api/admin/vendors/[id]/resend-photo-link/route.ts`):
  - authenticates with `getAdminSession()` and checks the existing `review-vendor-applications`
    capability, with no new capability;
  - returns 404 for a missing submission, 409 for a rejected submission or one that already has all 3
    photos, and 503 when the secret is unset;
  - always mints a fresh link and returns `{ success, photoUrl }`. It sends no email and writes nothing.
- **Admin control.** `components/admin/VendorPhotoLinkControl.tsx` is mounted in `VendorReviewTable`. The
  button is shown only when `!uploadsComplete` and the row is not rejected. It is a copy button; the
  admin passes the link to the vendor by hand.

### Live progress (amendment 1)

The first version of the resume page showed "0 of 3 ... not complete" after three successful uploads
until the vendor reloaded (observed on beta, `c11b51bd`). The page now counts uploads as they succeed:

- `lib/vendor-photo-resume-progress.ts`, `computeResumeProgress()`, seeds the count from the server.
  Each successful upload adds its slot. Only slots in the seeded `missingSlots` count, so a slot already
  counted on the server is not counted twice, and the logo never counts. The count is capped at 3.
- `addUploadedSlot()` returns a new `Set`, so React sees the change.
- `components/vendors/VendorPhotoResumeUploads.tsx` uses both. The fix is committed as `c01e5f77`.

The unit check covers the progress module. The in-browser update is verified only by the deployed
browser check, because the repo has no DOM test runner and an upload on a live submission would change
live data.

Checks: `contracts/checks/vendor-photo-resume/` (`check-token-and-link.mjs`, `check-resume-gate.mjs`,
`check-static-wiring.mjs`, `check-copy-strings.mjs`, `check-live-progress.mjs`) and `tsc --noEmit`.

---

## `/register` completion state and native GET guard (`8f3ae6e4`)

- **Completion state.** `VendorRegisterSuccess` tracks the 3 product-photo uploads through the optional
  `onUploaded` callback of `VendorMarketingUploadField`. The logo does not count. When all 3 succeed,
  the "not complete" sentence is replaced with "All 3 required product photos have been uploaded. Your
  registration is complete." The wrapper's `role="status"` announces the change, so there is no nested
  live region.
- **Native GET guard.** Before this fix a pre-hydration submit could fall through to a native GET,
  which put every field, PII included, in the URL. `VendorRegisterForm` now sets `method="post"`. Its
  submit button is disabled until `useSyncExternalStore` reports that the form has hydrated.

Checks: `contracts/checks/vendor-register-p2-f1/check-completion-state.mjs` and
`check-no-native-get.mjs`.

---

## Resolved: Ozow sandbox settlement on beta

On beta, an Ozow sandbox payment returned `Complete` with `IsTest` set, but the `vendorStandOrders`
document stayed `pending`. Two causes were found from the beta logs and a live API probe. Both are
fixed on `integ/vendor-flow-fixes` (tip `4a57bb21`).

1. **The status lookup omitted `IsTest=true`.** `GetTransactionByReference` was called without the
   parameter, because `raw.IsTest === 'true'` was a strict comparison. Ozow returns 404 for test
   transactions without it. Fixed in `3ef1e100` with a case-insensitive comparison.
2. **Ozow's status API returns camelCase keys.** The response carries `transactionReference`,
   `transactionId`, `status` and `amount`, but the code read PascalCase. Fixed in `b7f76850`,
   `f7db03b9`, `3fd1f84c` and `4a57bb21`. A `statusField` accessor reads camelCase first and falls back
   to PascalCase. If a row that matches the reference carries the same key in both casings with
   different values, the whole lookup fails closed.

Verified end to end on beta at 2026-10-15 15:10Z:

- the order moved to `paid`, with gateway `ozow` and amount `0.01`;
- `/vsp` showed "Stand Payment Confirmed";
- the admin view showed Paid;
- the vendor email "Your SAOC National Show stand payment is confirmed" and the admin email "Vendor
  stand payment received — SAOC" both arrived.

The F5 checks prove the amount logic against fixtures and the in-memory route runner. The beta run is
the first end-to-end proof against Ozow's sandbox.

---

## Known limits of these fixes

- The contract checks prove static wiring and behaviour against fakes. None of them calls a gateway,
  Firestore, Storage or Sanity.
- The `SITE_URL` value and the `VENDOR_STAND_PAYMENT_TOKEN_SECRET` value in each environment are not
  verified by the checks. The status URL and the photo-resume link are built from them.
- A failed or hung email send does not block settlement. A crash between the Firestore commit and
  the sends loses those emails. Both behaviours are unchanged; see
  [vendor-stand-payment-settlement.md](vendor-stand-payment-settlement.md).

## Related

- [vendor-stand-payment-settlement.md](vendor-stand-payment-settlement.md): the settlement handler,
  including the F5 and BankReference notes.
- [vendor-gated-registration-flow.md](vendor-gated-registration-flow.md): the token-gated registration
  flow and the photo-resume link.
- [vendor-flow-notifications.md](vendor-flow-notifications.md): the admin and vendor emails.
