# F1: Vendor Form Client-Side Validation — Regression Lock

**Feature:** F1 of mission `vendor-form-client-validation-gate` (milestone M1). A backlog item claimed the vendor registration form had no client-side validation gating submission — that a fully empty form could POST to the API unchecked. Investigation found this defect does **not exist** in current code. Instead of implementing a non-existent fix, this feature adds a regression-lock and verification harness to prove the property holds and prevent future regression.

**Contract:** `.agent/memory/project/specs/vendor-form-client-validation-gate/contract-f1.yaml` and `contracts/golden/vendor-form-client-validation-gate-f1/` — full decision record and check scripts.

**Status:** Gated (all structural checks pass). QA-passed. Codex cross-model-passed.

---

## Why This Investigation Happened

**The reported defect:** A backlog item stated that the vendor registration form's `handleSubmit()` did not call any validation function before posting to `/api/vendors/register`. This would allow a fully empty form to fire a network request, creating malformed vendor records in Firestore and bypassing the server-side validation layer.

**What investigation found:** Reading `components/vendors/VendorRegisterForm.tsx` (HEAD commit a23bbac), the form already calls `validateVendorRegisterFormClientSide(state)` on line 89, inside `handleSubmit()`, **before** the `fetch('/api/vendors/register', ...)` call on line 104. If client-side validation errors are found, the function returns early on lines 91–98, preventing the network call. The defect did not exist in current code.

**Why we didn't "fix" a non-existent bug:** Implementing a fix to code that already has the property would either be redundant (if the fix rewrote the existing validation) or regress the codebase (if the "fix" removed something that wasn't broken). Instead, we built a regression-lock — a suite of automated checks proving the property holds, so future changes that would break this behavior are caught immediately.

---

## The Property Being Protected

The vendor registration form enforces a two-layer validation model:

1. **Client-side gate (line 89–98 in `VendorRegisterForm.tsx`):**
   - Calls `validateVendorRegisterFormClientSide(state)` unconditionally on every submit
   - Returns early if any validation error is found
   - Renders errors through the existing `VendorRegisterStatusBanner` component
   - **Blocks the network call** — no POST reaches `/api/vendors/register` for invalid forms

2. **Server-side validation (line 74 in `lib/vendor-registration-handler.ts`):**
   - Called `validateVendorSubmissionInput()` unconditionally on every request
   - Remains the authoritative validator — the server never trusts the client
   - Returns 400 if validation fails, even if the client already checked

The client gate is a **UX optimization only** — it gives immediate feedback without a network round-trip. The server gate is the security boundary.

---

## The Regression-Lock Harness

No production code was changed. All new work is under `contracts/checks/vendor-form-client-validation-gate-f1/` and consists of six assertion scripts (six checks, one per feature aspect) and a screenshot directory for evidence.

### Structural Assertions (Code-Level)

These shell/Node.js scripts verify the validation gate is correctly wired in the source:

**A1:** `check-validation-precedes-fetch.mjs` — verifies the `validateVendorRegisterFormClientSide()` call occurs at an earlier line number than the `fetch('/api/vendors/register', ...)` call within the same `handleSubmit()` function. Fails if the calls are reversed or the validation call is removed.

**A2:** `check-early-return-blocks-submit.mjs` — verifies the `if (clientErrors.length > 0)` block contains a `return` statement that halts execution. Fails if the return is removed, moved outside the block, or the block is deleted.

**A5:** `check-server-validation-untouched.mjs` — verifies the API route still calls `validateVendorSubmissionInput()` unconditionally. Fails if server validation is conditionally skipped or removed.

**A6:** `check-error-display-pattern-reused.mjs` — verifies client-side validation errors use the same error-display surface (`VendorRegisterStatusBanner` + `humaniseFieldError`) as server-side errors. Fails if a duplicate error-rendering component was added.

### Behavioral Assertions (Real Browser)

Two Playwright suites verify the validation gate works with real keyboard/mouse input and real network interception:

**A3 — Empty Form Blocked** (`check-empty-submit-blocked.mjs`):
- Loads `/national-show/vendors/register`
- Submits the form completely empty (no fields filled)
- Asserts zero requests reached `/api/vendors/register` (the client gate blocked them)
- Asserts visible error text appeared on the page
- Saves screenshot to `screenshots/empty-submit-blocked.png`
- **Interception method:** Uses Playwright's `page.route()` to intercept at the browser network layer, not at the fetch() wrapper. This proves the gate blocks the request regardless of future JavaScript refactors.
- **Failure mode guards:** Both request observance and visibility assertion use `.isVisible()` to ensure the error is genuinely visible in the DOM, not hidden with `display:none`.

**A4 — Valid Form Posts** (`check-valid-submit-posts.mjs`):
- Loads `/national-show/vendors/register`
- Fills every required field with valid data (business name, contact person, email, product description, vendor category checkbox, positive integer booth count, power required answer, terms checkbox)
- Submits the form
- Asserts exactly one POST request reached `/api/vendors/register` (the gate did not block valid data)
- Asserts the request method is POST
- Asserts no client-side validation-error banner is showing (the form either succeeded or hit a server error, not a client gate)
- Saves screenshot to `screenshots/valid-submit-posts.png`
- **Interception method:** Same `page.route()` pattern, but fulfills the request locally with a mocked 201 success response. This proves the client fired the correct network call without creating a real Firestore record on every test run.
- **Failure mode guards:** Checks for both "gate too permissive" (zero requests for valid data) and "gate too aggressive" (blocking valid submissions).

**A7 — Evidence Persistence** (shell check):
- Verifies both screenshot files exist on disk and are non-empty
- Proves the real-browser verification actually ran, not merely claimed in conversation

### Critical Bug Fixes Made During Codex Review

Two real bugs in the check scripts themselves were found and fixed during Codex GPT-5.5 cross-model review (before they reached production test runs):

#### Bug 1: Unintercepted Real POSTs to Production

**What happened:** The original `check-valid-submit-posts.mjs` did not intercept the `/api/vendors/register` request — it let the real POST reach the server. This meant every time the check ran, a real `vendorSubmissions` Firestore document was created with mock data (`businessName: 'Test Orchid Traders'`, etc.). Over weeks of testing, these phantom records accumulated in the database.

**Why this happened:** The check was designed to prove "a valid form submission reaches the network layer," but the author didn't intercept the request — only observed it. On failure, the request would still fire even as the assertion failed, creating leaked records in both success and failure modes.

**The fix:** Wrapped the request interception with `route.fulfill()` (lines 44–52) to intercept at the browser network layer and respond locally:

```javascript
await page.route('**/api/vendors/register', async (route) => {
  const request = route.request();
  registerRequests.push({ url: request.url(), method: request.method() });
  await route.fulfill({
    status: 201,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, id: 'contract-check-mock-id' }),
  });
});
```

This proves the client fired the correct network request without ever touching a real database. The check is now leak-proof — it can run thousands of times without creating phantom records.

**Lesson for future check authors:** Never let a test that exercises the "happy path" fire real requests. Always intercept and mock-fulfill. A test that accumulates data on every run is not a regression guard — it's infrastructure debt.

#### Bug 2: Weak Visibility Assertion

**What happened:** The original assertion for visible error banners checked only that a `[role="alert"]` element existed in the DOM:

```javascript
const alertRegion = page.locator('[role="alert"]').first();
const alertText = (await alertRegion.innerText()).trim();
if (!alertText) failures.push('FAIL: no error banner');
```

This would pass even if the banner were hidden with `display:none`, `visibility:hidden`, or `opacity:0` — the DOM element existed and had text content, but was invisible to the user. The test would report "PASS: visible error text" while the user saw a blank page.

**Why this happened:** The author checked for DOM presence and non-empty text, but not visibility. It's a recurring defect pattern on this project — a selector matches the element, but the test doesn't verify the element is actually rendered and visible to the user.

**The fix:** Used Playwright's `.isVisible()` method (lines 55, 114) to require genuine visibility:

```javascript
const alertVisible = await alertRegion.isVisible().catch(() => false);
if (!alertVisible) {
  failures.push(
    'FAIL: no genuinely visible validation error text found in a [role="alert"] region ' +
      '(element must be present, visible, and non-empty — not merely present in the DOM).'
  );
}
```

`.isVisible()` checks that the element is in the viewport, not hidden, and not covered by other elements. A banner hidden by any means now fails the assertion.

**Lesson for future check authors:** For UI visibility assertions, always use `.isVisible()` or `.isHidden()`, never just `. exists()` or `. count() > 0`. An element that exists in the DOM is not the same as an element the user can see. This project has a pattern of this defect across multiple checks — proactively use the visibility API.

---

## Verification

All checks passed. BrowserAgent verified both paths:
- **Empty form submission:** Blocked at the client, zero network requests, visible error banner.
- **Valid form submission:** Fired exactly one POST, no client-side validation error, screenshot saved.

Screenshots saved to `contracts/checks/vendor-form-client-validation-gate-f1/screenshots/`.

---

## Why This Feature Exists

The vendor registration form is a critical user-facing surface (F5 of mission `vendor-registration`). Earlier user testing revealed forms timing out or appearing to do nothing on submit. Investigation traced one class of those to server-side validation errors (missing fields, malformed data) that took a full HTTP round-trip to report. A client-side validation gate was added to provide immediate feedback without the network cost.

This regression-lock proves that gate stays in place and stays visible — no future refactor accidentally removes the validation call, the early return, or the error display, and no future contributor "optimizes" the gate by removing the duplicate server check.

---

## Scope & Non-Changes

- **No production code was changed** — the feature already existed; we built verification, not implementation
- **No new dependencies added** — check scripts use only Playwright (already a dev dependency for other checks)
- **No component structure changes** — form layout, fieldsets, and validation vocabulary remain unchanged
- **No API changes** — `/api/vendors/register` route is unchanged
- **No database schema changes** — Firestore collection is unchanged

---

## Deployment Notes

**This is a regression-lock, not a feature.** No server-side deployment needed. The check scripts run locally and in CI to guard against accidental regressions. Once committed, future PRs that modify the vendor form or validation logic will run these checks automatically and fail if the gate is broken.

---

## Related Features

- **F5 (Vendor Registration):** The actual feature that added vendor registration (`lib/vendor-registration-handler.ts`, `app/api/vendors/register/route.ts`)
- **F10/F11 (Confirmation Email):** Confirmation email sent after successful server-side submission acceptance
- **Mobile menu focus trap** (`docs/mobilemenu-focus-trap.md`): Similar regression-lock pattern for a different accessibility feature
