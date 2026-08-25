# vendorcategory-aria-required-enforcement — F1 golden

## Investigation finding

The backlog item this mission was opened against read: "vendorCategory group claims
aria-required=true but none of its 8 checkboxes has required and client-side validation
doesn't block on an empty selection either."

As of commit `d74bfc1` (current HEAD at mission open), this defect does **not** exist in
committed source. It was fixed as a side effect of the already-closed
`vendor-form-client-validation-gate` mission, which added a general client-side pre-submit
validator covering every required field — `vendorCategory` included, not carved out as a
special case.

Evidence read directly from source before this contract was written:

- `lib/vendor-register-form-validation.ts:38-40` — `validateVendorRegisterFormClientSide`
  pushes `'vendorCategory is required and must be a non-empty array'` when
  `state.vendorCategory.length === 0`.
- `components/vendors/VendorRegisterForm.tsx:89-98` — `handleSubmit` calls that validator
  and `return`s before reaching `fetch('/api/vendors/register', ...)` whenever any client
  error (including the vendorCategory one) is present.
- `lib/vendor-register-response.ts` — `VENDOR_FIELD_LABELS.vendorCategory = 'Vendor
  category'`, so the raw validator message is humanised into readable copy in the banner.
- `components/vendors/VendorRegisterStatusBanner.tsx:19` — all error kinds, including
  `'validation-error'`, render inside a `<div role="alert">`.
- `lib/vendor-submissions.ts` — `validateVendorSubmissionInput` independently rejects an
  empty `vendorCategory` server-side too, so the client gate is not the only line of
  defence.
- `components/vendors/VendorCategoryFieldset.tsx:40` /
  `components/vendors/VendorCheckboxGroupField.tsx:44` — `aria-required="true"` on the
  fieldset is now backed by real enforcement on both sides of the form.

No production code changes are made or required by this mission.

## Regression-lock suite purpose

Because the defect is already fixed, F1 adds a **regression-lock** contract only: structural
greps proving each of the six facts above stays true, plus real-browser (Playwright)
behavioral checks with the network intercepted via `page.route()` (never a real POST) that
prove, end to end:

1. Submitting the vendor registration form with every other required field valid and all 8
   category checkboxes left unchecked fires **zero** requests to `/api/vendors/register` and
   shows a visible `role="alert"` error mentioning vendor category.
2. Selecting exactly one category with everything else valid and submitting fires **exactly
   one** POST to `/api/vendors/register` — the "gate too aggressive" failure mode is treated
   as seriously as the "gate too permissive" one.

If any of these checks ever fail in the future, that is a genuine regression to report, not
something to patch around by loosening an assertion.
