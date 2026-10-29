# F2a: four small fixes

Surgical. Change only what is listed. No new copy beyond what is stated.

## 1. Payment-link button copies only, no email (decision: fix the behaviour, keep the label)
Evidence for the choice: Approve already emails the link; the control is labelled copy-only (`VendorPaymentLinkControl.tsx:34`, aria-label "...copy it to the clipboard"); the photo-link twin sends no email and is the in-repo precedent; the email path was only ever a hotfix side-effect when the mailer was broken (route header "Hotfix ... 2026-09-01"). Relabelling would leave the vendor receiving a duplicate email on every admin click.
- `app/api/admin/vendors/[id]/resend-payment-link/route.ts`: remove the email send and its three now-unused imports (`sendVendorStandPaymentNoticeEmail`, `deliverConfirmationEmailAfterCommit`, and any other orphaned import). Keep: admin session + capability gate, 404/409 guards, secret check, fresh token mint, `{ success: true, paymentUrl }`. Update the header comment: "reissue, no email". Keep the route path (renaming churns three legacy contract checks for no gain).
- Do not change `VendorPaymentLinkControl.tsx` copy.
- The legacy behavioural check `contracts/checks/vendor-gated-registration-flow-m3/check-approval-mints-payment-link-and-resend.mjs` currently asserts resend sends exactly one email (line ~100) and reads the resent token from that email. That is the behaviour being deliberately reversed. Update it: after resend assert `sentStandPaymentEmails.length === 0`, take the resent token from the response's `paymentUrl` (query param `token`), keep the fresh-bytes and verify assertions, keep the 409 cases. Update the matching A57 description in `contracts/contract-vendor-gated-registration-flow.yaml` ("sends the email again" -> "returns a fresh link and sends no email"). State the change in the dev result; this is a spec change, not a weakening.
- Run the other legacy checks that reference this route (`contracts/checks/vendor-stand-payment-link-visibility/*.mjs`, `contracts/checks/vendor-gated-registration-flow-m3/check-approval-mints-payment-link-and-resend.mjs`); they must still pass. If one asserts an email send from this route, report it, do not weaken it silently.
- `lib/vendor-stand-payment-notice.ts` stays (the review route still uses it on approval).

## 2. /register prefills "Vendor / business name"
- Source of truth is the verified application doc, NOT the `?name=` query param (the param is attacker-editable). In `register/page.tsx`, `isVendorRegistrationSessionUsable()` already loads the application snapshot; return its `businessName` (string, else '') alongside the boolean and pass it as `initialBusinessName` to `<VendorRegisterForm />`.
- `VendorRegisterForm` takes an optional `initialBusinessName?: string` prop and seeds `useState({ ...INITIAL_STATE, businessName: initialBusinessName ?? '' })`. Field stays editable. No other field is prefilled.
- If the gate fails, behaviour is unchanged (code-entry form).

## 3. Terms checkbox sits after the Declaration & Terms text
- Move the `termsAccepted` `VendorCheckboxField` out of `VendorPaymentFieldset.tsx` into `VendorDeclarationFieldset.tsx`, rendered after `<VendorTermsFieldset />` and before the signature block. Keep `fieldKey="termsAccepted"`, the label string, `required`, and state wiring identical so payload, validation and `VENDOR_FIELD_LABELS.termsAccepted` need no change.
- Remove the now-unused import from the payment fieldset only if orphaned.
- Check that the error-summary/focus order and any component test or e2e selector keyed on the field still resolves (id `vendor-register-termsAccepted`).

## 4. Server-side apply validation errors show labels
- Add a pure exported helper `humaniseVendorApplyError(raw: string): string` in `lib/vendor-apply-form-validation.ts`: finds the leading field key among `VENDOR_APPLY_FIELD_ORDER`, maps to the same labels the form already uses ("Business name", ...), returns "<Label> is required." / "<Label> is invalid."; an unknown key returns the generic "Please check the highlighted fields." (existing string).
- `VendorApplyForm.tsx:169`: `setFieldErrors((body?.fieldErrors ?? []).map(humaniseVendorApplyError))`, de-duplicated.
- Never render a camelCase key or the phrase "must be a non-empty string" to a user.

## Out of scope
(e) stand size duplication; the booth label in the approval email (already fixed); table layout (already fixed); any change to `/payment`.
