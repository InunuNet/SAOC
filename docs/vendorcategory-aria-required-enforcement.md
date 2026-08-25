# F1: Vendor Category Required-Group Enforcement — Regression Lock

**Feature:** F1 of mission `vendorcategory-aria-required-enforcement` (milestone M1). A backlog item claimed the vendor registration form's vendorCategory checkbox group reported `aria-required=true` but had no enforcement — that checkboxes themselves lacked `required`, and client-side validation didn't block empty selections. Investigation found this defect does **not exist** in current code. Instead of implementing a non-existent fix, this feature adds a regression-lock and verification harness to prove the property holds and prevent future regression.

**Contract:** `.agent/memory/project/specs/vendorcategory-aria-required-enforcement/contract-f1.yaml` and `contracts/golden/vendorcategory-aria-required-enforcement-f1/` — full decision record and check scripts.

**Status:** Gated (all 8 assertions pass). QA-passed. Codex cross-model-passed (after one weak-check fix).

---

## Why This Investigation Happened

**The reported defect:** A backlog item stated that the vendorCategory checkbox group in the vendor registration form claimed `aria-required=true` but none of its 8 checkboxes had the `required` attribute, and client-side validation did not block submission with an empty selection.

**What investigation found:** Reading the vendor registration form source (HEAD commit d74bfc1), the vendorCategory field is already protected by a complete two-layer enforcement model:
1. Client-side validation blocks empty selections before the network call
2. Server-side validation re-checks independently
3. The ARIA contract is backed by real enforcement on both sides

The defect did not exist in current code. It was fixed as a side effect of the already-closed `vendor-form-client-validation-gate` mission.

**Why we didn't "fix" a non-existent bug:** Implementing a fix to code that already has the property would either be redundant (rewriting existing validation) or regressive (removing something that wasn't broken). Instead, we built a regression-lock — a suite of automated checks proving the property holds, so future changes that would break this behavior are caught immediately.

---

## The Property Being Protected

The vendor registration form enforces vendorCategory validation across a complete chain:

**Client-side gate** (`lib/vendor-register-form-validation.ts:38-40`):
- `validateVendorRegisterFormClientSide()` checks `state.vendorCategory.length === 0` and pushes an error string containing `'vendorCategory is required and must be a non-empty array'` into the errors array if true.

**Form submission guard** (`components/vendors/VendorRegisterForm.tsx:89-98`):
- `handleSubmit()` calls the validator unconditionally on every submit and returns early inside an `if (clientErrors.length > 0)` block before reaching `fetch('/api/vendors/register', ...)`.
- An empty selection (which the validator now flags) genuinely halts submission rather than merely setting error state.

**Error humanization** (`lib/vendor-register-response.ts`):
- `VENDOR_FIELD_LABELS.vendorCategory = 'Vendor category'` ensures the raw validator message is humanized into readable copy for users.

**Error display** (`components/vendors/VendorRegisterStatusBanner.tsx:19`):
- The error banner renders the `'validation-error'` descriptor kind's `fieldErrors` inside a `<div role="alert">` container, making the error perceivable.

**Server-side defence-in-depth** (`lib/vendor-submissions.ts`):
- `validateVendorSubmissionInput()` independently rejects an empty `vendorCategory` array server-side. The server does not rely solely on the client-side gate.

**ARIA truthfulness** (`components/vendors/VendorCategoryFieldset.tsx:40` / `components/vendors/VendorCheckboxGroupField.tsx:44`):
- `VendorCategoryFieldset` passes `required` to `VendorCheckboxGroupField` for the vendorCategory field.
- `VendorCheckboxGroupField` renders `aria-required="true"` on the outer `<fieldset>` when `required` is true.
- This ARIA contract is now backed by real enforcement on both sides of the form.

---

## The Regression-Lock Harness

No production code was changed. All new work is under `contracts/checks/vendorcategory-aria-required-enforcement-f1/` and consists of seven assertion scripts (five structural, two behavioral) and a screenshot directory for evidence.

### Structural Assertions (Code-Level)

These Node.js scripts verify the enforcement wiring in the source:

**A1:** `check-validator-rejects-empty-category.mjs` — verifies `lib/vendor-register-form-validation.ts` contains a conditional on `state.vendorCategory.length === 0` inside `validateVendorRegisterFormClientSide` that pushes an error string containing `'vendorCategory'` into the returned errors array. Fails if the check is removed, weakened (e.g., only a warning, not an error), or moved out of the pure validator into something that can be bypassed.

**A2:** `check-early-return-blocks-submit.mjs` — verifies the call to `validateVendorRegisterFormClientSide(state)` inside `components/vendors/VendorRegisterForm.tsx` `handleSubmit()` occurs at an earlier line number than the `fetch('/api/vendors/register', ...)` call, and the `if (clientErrors.length > 0)` block contains a `return` statement. Proves an empty vendorCategory genuinely halts submission rather than falling through.

**A3:** `check-error-display-pattern.mjs` — verifies `lib/vendor-register-response.ts` contains a `VENDOR_FIELD_LABELS` map with a `'vendorCategory'` key and non-empty label, and `components/vendors/VendorRegisterStatusBanner.tsx` renders the `'validation-error'` descriptor kind's `fieldErrors` through `humaniseFieldError` inside a `role="alert"` container. Fails if the label is removed (causing the raw error string to leak) or the alert is removed.

**A4:** `check-server-validates-category.mjs` — verifies `lib/vendor-submissions.ts` `validateVendorSubmissionInput()` independently rejects an empty `vendorCategory` array server-side. Proves defence-in-depth stays intact and the server does not rely solely on the client-side gate.

**A5:** `check-aria-required-backed.mjs` — verifies `components/vendors/VendorCategoryFieldset.tsx` passes `required` to its `VendorCheckboxGroupField` for the vendorCategory field, and `components/vendors/VendorCheckboxGroupField.tsx` renders `aria-required="true"` on the outer `<fieldset>` when `required` is true. Proves the ARIA contract is now backed by real enforcement on both sides of the form.

### Behavioral Assertions (Real Browser)

Two Playwright suites verify the enforcement works with real keyboard/mouse input and real network interception:

**A6 — Empty Category Blocked** (`check-empty-category-blocked.mjs`):
- Loads `/national-show/vendors/register`
- Fills every other required field (businessName, contactPersonName, contactCellPhone, contactEmail, productDescription, boothCount, powerRequired, termsAccepted) with valid data
- Leaves all 8 vendorCategory checkboxes unchecked
- Submits the form
- Asserts zero requests reached `/api/vendors/register` (the client gate blocked the submit)
- Asserts a visible `[role="alert"]` region renders text mentioning vendor category (case-insensitive match on "vendor category" or "vendorCategory")
- Saves screenshot to `contracts/checks/vendorcategory-aria-required-enforcement-f1/screenshots/empty-category-blocked.png`
- **Interception method:** Uses Playwright's `page.route()` to abort the route, preventing any real POST from reaching the live server.
- **Failure mode guards:** Checks for both the blocked request and visible error text.

**A7 — One Category Posts Successfully** (`check-one-category-posts.mjs`):
- Loads `/national-show/vendors/register`
- Fills every other required field with valid data (same as A6)
- Checks exactly ONE vendorCategory checkbox (e.g., `"plant-sales"`)
- Submits the form
- Asserts exactly one request reached `/api/vendors/register`
- Asserts the request method is POST
- **Codex fix:** Inspects the actual POST request body to verify `vendorCategory: ['plant-sales']` is present (not just counting requests — a weak-check fix that prevents false positives from duplicate requests or malformed payloads)
- Asserts the client-side `"Please check the highlighted fields."` validation-error banner is NOT visible after submit (the gate does not over-trigger when exactly one category is selected)
- Saves screenshot to `contracts/checks/vendorcategory-aria-required-enforcement-f1/screenshots/one-category-posts.png`
- **Interception method:** Uses `page.route()` with a mocked 201 response, preventing any real Firestore document from being created on test runs.
- **Failure mode guards:** Catches both "gate too permissive" (zero requests) and "gate too aggressive" (blocking valid one-category selections).

### Evidence Persistence

**A8:** `test -s contracts/checks/vendorcategory-aria-required-enforcement-f1/screenshots/empty-category-blocked.png && test -s contracts/checks/vendorcategory-aria-required-enforcement-f1/screenshots/one-category-posts.png` — verifies both BrowserAgent screenshots exist on disk and are non-empty files, proving the real-browser verification pass actually happened.

---

## The Codex Fix: Weak-Check Hardening

**What Codex found:** The original `check-one-category-posts.mjs` asserted that exactly one request reached `/api/vendors/register` by counting the requests intercepted, but did not inspect the request body. A malformed payload (e.g., `vendorCategory: []` despite one checkbox being checked) would still count as one request and pass the assertion — a false positive. The test proved "a request was sent" but not "the correct data was sent."

**The fix:** The check now inspects the actual POST request body after interception:

```javascript
const requestBody = JSON.parse(await route.request().postData());
if (!requestBody.vendorCategory || !Array.isArray(requestBody.vendorCategory) || 
    requestBody.vendorCategory.length !== 1 || 
    requestBody.vendorCategory[0] !== 'plant-sales') {
  failures.push('FAIL: POST body does not contain vendorCategory: ["plant-sales"]');
}
```

This proves not just that a request was sent, but that it carries the correct validated data. The assertion now catches both "no request sent" (gate too strict) and "wrong data sent" (client-side mutation/corruption of the form state).

**Lesson:** For form submission checks, always inspect the request body, not just the request count. A request that was sent is not proof that the correct form state was serialized.

---

## Verification

All 8 assertions passed:

- **A1–A5:** Structural checks — all five code properties verified in source.
- **A6:** Behavioral — empty selection blocked; zero requests observed; visible error text found.
- **A7:** Behavioral — one selection posts exactly one request with correct body; no validation-error banner shown.
- **A8:** Evidence — both screenshot files exist and are non-empty.

Screenshots captured and saved. Codex cross-model review found and fixed the weak-check in A7 before first run.

---

## Why This Feature Exists

The vendor registration form is a critical user-facing surface for exhibitors at the national show. An earlier investigation (`vendor-form-client-validation-gate` mission) added a general client-side validation gate to provide immediate feedback on submission errors. This mission verifies that one specific field — vendorCategory — is correctly gated and cannot be silently omitted even if a user bypasses the UI.

The backlog complaint was likely filed based on incomplete testing or a stale state of the code. By the time this mission was opened, the defect was already fixed. Rather than discovering that through human code review (which would be fragile), we built an automated regression-lock that proves the property on every future commit.

---

## Scope & Non-Changes

- **No production code was changed** — the feature already existed; we built verification, not implementation.
- **No new dependencies added** — check scripts use only Playwright (already a dev dependency).
- **No component structure changes** — form layout, fieldsets, error display, and validation vocabulary remain unchanged.
- **No API changes** — `/api/vendors/register` route is unchanged.
- **No database schema changes** — Firestore collection is unchanged.

---

## Deployment Notes

**This is a regression-lock, not a feature.** No server-side deployment needed. The check scripts run locally and in CI to guard against accidental regressions. Once committed, future PRs that modify the vendor form, validation logic, or category field will run these checks automatically and fail if the enforcement is broken.

---

## Related Features

- **F1 (Vendor Form Client-Side Validation Gate):** The mission that fixed the defect this regression-lock guards. Proves the general client-side validation gate exists and blocks invalid submissions (`docs/vendor-form-client-validation-gate.md`).
- **F1 (Vendor Form Booth Count Guarded Parse):** Another regression-lock for vendor form consistency; uses similar Playwright harness pattern (`docs/vendor-boothcount-guarded-parse.md`).
- **F5 (Vendor Registration):** The actual feature that added vendor registration; this mission guards one specific aspect of its validation chain.
- **Mobile Menu Focus Trap** (`docs/mobilemenu-focus-trap.md`): Similar regression-lock pattern for a different accessibility feature.
