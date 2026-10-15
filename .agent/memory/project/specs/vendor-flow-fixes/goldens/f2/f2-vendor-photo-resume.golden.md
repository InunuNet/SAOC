# F2 golden: vendor photo-resume link

Bug (P1, 2026-10-14, beta): the registration code is single-use and is consumed when the full
/national-show/vendors/register form is submitted. The 3 required product photos are uploaded
afterwards, on the success panel. A vendor who leaves early can never return (vendor
8TvyaRDdN8BFPcAkktOE is stuck at 0/3).

## Decisions

| Question | Decision |
|---|---|
| Mechanism | Signed, scoped resume link in the "registration received" email, landing on a new page `/national-show/vendors/photos?token=...` that renders ONLY the product-photo upload fields. |
| Token | New module `lib/vendor-photo-resume-token.ts`, modelled on `lib/vendor-stand-payment-token.ts`: payload `{u, e, n}` (`u` = vendorSubmissionId, `e` = expiry epoch ms, `n` = 128-bit nonce), `${base64url(payload)}.${hmacSha256Hex}`. Pure, caller-supplied `now`, reuses `constantTimeEqual`/`isWellFormedHexDigest` from `lib/recovery-token.ts`. |
| Secret | Reuses the already-provisioned `VENDOR_STAND_PAYMENT_TOKEN_SECRET`. No new Secret Manager entry, no `apphosting.yaml` change (a P1 must not wait on provisioning). Domain separation is by payload key (`u`, not `s`/`a`/`o`) AND by an HMAC domain prefix, so the shared secret cannot make a stand-payment or registration token redeemable here, or the reverse. |
| Expiry | 30 days (same as stand-payment). |
| Single-use? | No. Valid until expiry; each page load re-reads the submission's CURRENT photo state. Once all 3 photos are in, the page shows the completion line and no upload fields, so a still-valid link then offers nothing. |
| Authority | The token authorises exactly one thing: the page renders upload fields for the token's own submission id. It cannot re-submit the form, cannot read another submission, and the page shows no PII. |
| Upload API | `POST /api/vendors/[id]/marketing-asset` is deliberately public and keyed by submission id (F18, unchanged). The token is NOT consulted there and the route is not modified. The token gates only the page that reveals the id and upload UI. |
| Invalid / expired / forged / rejected / missing / secret unset | One generic message, enumeration-blind, identical to the stand-payment page's wording. |
| All 3 present | Completion line, no fields. |
| Logo | Not on the resume page (optional; stays on the success panel). |
| Stuck vendor / lost email | New admin route `POST /api/admin/vendors/[id]/resend-photo-link` (same `getAdminSession` + `review-vendor-applications` gate as `resend-payment-link`). Always mints a FRESH link and returns `{ success: true, photoUrl }`. Sends no email (no new template, no dependence on Resend deliverability), writes nothing. 409 if rejected or already 3/3. Surfaced in `VendorReviewTable` as a button shown only while photos are incomplete. The admin copies the link to the vendor. |
| No existing reissue path | `reissue-code` is for applications and cannot help a consumed submission; `resend-payment-link` requires status `approved`. Hence the new route. |

## Resolver contract (`lib/vendor-photo-resume-gate.ts`)

`resolveVendorPhotoResumeState({ token, secret, now, loadSubmission })` returns exactly one of
`{kind:'invalid'}`, `{kind:'complete'}`, `{kind:'upload', vendorSubmissionId, missingSlots, uploadedCount}`.
`loadSubmission(id)` is injected; it is never called unless the token verifies, and only ever with
the token's id. The result never echoes any field of the loaded document. See
`resume-state-matrix.json` for the 16 required cases.

Pure module, relative `./x.ts` imports only (no `@/` alias, no firebase), so
`contracts/checks/vendor-photo-resume/*.mjs` can load it with plain `node`. The same applies to
`lib/vendor-photo-resume-token.ts` and `lib/vendor-photo-resume-link.ts`
(`VENDOR_PHOTO_UPLOAD_PATH`, `buildVendorPhotoUploadUrl`, `mintVendorPhotoUploadUrl`).

## Files @dev touches

New: `lib/vendor-photo-resume-token.ts`, `lib/vendor-photo-resume-link.ts`,
`lib/vendor-photo-resume-gate.ts`, `app/(marketing)/national-show/vendors/photos/page.tsx`,
`app/api/admin/vendors/[id]/resend-photo-link/route.ts`, `components/admin/VendorPhotoLinkControl.tsx`.

Edited: `lib/vendor-registration-confirmation.ts` (optional `vendorSubmissionId` in the input; mint
link; keep its no-logging guarantee; omit the link silently if the secret is unset),
`lib/vendor-registration-handler.ts` (pass `vendorSubmissionId: writeResult.id` in the step-7 call
only), `emails/VendorRegistrationConfirmation.tsx` (optional `photoUploadUrl` block),
`components/admin/VendorReviewTable.tsx` (button + handler, shown when `!uploadsComplete`),
route registries `scripts/generate-nos-route-manifest.ts` (then re-run it to regenerate
`content/national-show-routes.json`) and `scripts/checks/verify-show-page-m4.ts` (entry:
`group: 'exhibit-trade', listed: false, dynamic: false, indexable: false, owner: 'saoc-eb'`;
manifest entry mirrors `/national-show/vendors/payment`, next `order`).

Page shape: copy `vendors/payment/page.tsx` (metadata via `buildPageMetadata` noIndex,
`force-dynamic`, `NosHero image="/images/orchid-yellow.jpg" eyebrow="National Show"`, container
`mx-auto max-w-2xl px-6 py-16 sm:px-8 sm:py-20`, body text `font-sans text-[15px]` classes as on
the success panel). Reuse `VendorMarketingUploadField` unchanged. Admin control: clone
`VendorPaymentLinkControl.tsx` styling verbatim. No new colours, fonts, or components.

## Amendment 1: live count and completion (beta c11b51bd defect)

On the resume page the server-rendered "N of 3 product photos uploaded." and the "not complete"
sentence never changed after uploads (page.tsx rendered `state.uploadedCount`; the fields had no
`onUploaded`). Required behaviour: after each successful upload the count increments, and after
the third the page shows "All 3 required product photos have been uploaded." with no reload.
Mirrors `VendorRegisterSuccess` from 8f3ae6e4 (seed, then `onUploaded` per slot).

- New pure module `lib/vendor-photo-resume-progress.ts` (relative imports only):
  `REQUIRED_PRODUCT_PHOTO_COUNT = 3`, `addUploadedSlot(prev: ReadonlySet<string>, slot)` -> NEW Set,
  `computeResumeProgress({serverUploadedCount, missingSlots, uploadedNowSlots})` ->
  `{uploadedCount, complete}` (only slots in the SEEDED `missingSlots` count; capped at 3).
- New client component `components/vendors/VendorPhotoResumeUploads.tsx` (`'use client'`, props
  `submissionId`, `missingSlots`, `serverUploadedCount`): `useState` set of uploaded slots; renders
  the "not complete" and "N of 3" lines while incomplete, the completion sentence once complete;
  maps fields from the SEEDED `missingSlots` (never filtered by live progress, so each field stays
  mounted and keeps its own "Uploaded." feedback); every `VendorMarketingUploadField` gets
  `onUploaded={() => add(<its own slot>)}`. Product photos only, no logo, no fetch, no PII.
- `page.tsx` upload state now renders `<VendorPhotoResumeUploads submissionId={state.vendorSubmissionId}
  missingSlots={state.missingSlots} serverUploadedCount={state.uploadedCount} />`; the invalid and
  server-`complete` branches are unchanged. The static "N of 3" line leaves the page.
- `VendorMarketingUploadField.tsx` needs optional `onUploaded?: () => void`, called right after
  `setStatus('success')`. If the branch lacks it (e8bd5bd4 does; 8f3ae6e4 has it), apply exactly
  that hunk so the merge with the completion-message session is a no-op. Same for nothing else in
  that file.
- No new copy. Moved strings are re-pointed in `copy-strings.json`; the completion sentence is the
  page's existing server-complete sentence. Do NOT adopt the success page's "Your registration is
  complete." tail.
- Proof: A6 (unit, `live-progress-matrix.json`), the 1b block of A3 (static: client component,
  every field passes `onUploaded` bound to its own slot, fields mapped from seeded slots, count
  line renders live `uploadedCount`, completion conditional), A4 (strings). In-browser behaviour
  is for the deployed-site browser check: on a fresh test submission, upload photos 1-3 and assert
  the count line reads 1, 2, 3 of 3 and then the completion sentence, with no reload.

## Must NOT change (proved by diff against base 77e50788)

`app/api/vendors/[id]/marketing-asset/route.ts`, `lib/vendor-marketing-upload-handler.ts`,
`lib/vendor-marketing-upload.ts`, `lib/vendor-stand-payment-token.ts`,
`lib/vendor-registration-token.ts`, `lib/vendor-registration-token-claim.ts`,
`app/api/vendors/register/route.ts`, `app/(marketing)/national-show/vendors/register/page.tsx`.
The registration code stays single-use; this fix adds a second, narrower door, it does not reopen
the first.

## Merge overlap with the other session

That session owns the post-3-photos completion message and the form's `method="post"` /
hydration guard. F2 does not touch `components/vendors/VendorRegisterSuccess.tsx`,
or `components/vendors/VendorRegisterForm.tsx`; `VendorMarketingUploadField.tsx` only gains the 8f3ae6e4 `onUploaded` hunk (Amendment 1).
Shared files with possible hunks: `lib/vendor-registration-handler.ts` (F2 edits only the
`sendConfirmationEmail({...})` argument object, ~line 107) and `components/admin/VendorReviewTable.tsx`
(F2 adds one handler, one state map, one control in the Actions cell). The resume page has its
own completion line (copy-strings.json); if the other session standardises the completion
wording, reconcile that one string.

## What this does not prove

The upload API remains id-gated, not token-gated: anyone holding a submission id (shown only to
the submitter, never listed publicly) can still POST photos to it, exactly as before. Email
delivery is not proven (inbox check belongs to the verification triad on the deployed site).
Link expiry after 30 days needs an admin re-issue.
