# F1: Vendor Form boothCount Parse-Path Consistency

**Feature:** F1 of mission `vendor-boothcount-guarded-parse` (milestone M1). A consistency fix to `lib/vendor-register-form-payload.ts:117` — the `boothCount` field was routing through a raw `Number.parseInt()` while every other numeric field in the same function (`tableCount`, `chairCount`, `staffPerDay`) routed through the local `toOptionalInt()` helper. This is a defense-in-depth consistency improvement, not a live functional bug (client-side validation already blocks malformed values before this code path runs). The mission's real substance: closing out **4 regression guards** from Codex GPT-5.5 that were identified during a prior, abandoned implementation attempt — proving those properties hold and preventing future regression.

**Contract:** `.agent/memory/project/specs/vendor-boothcount-guarded-parse/contract-f1.yaml` and `contracts/golden/vendor-boothcount-guarded-parse-f1/` — full decision record and check scripts.

**Status:** Gated (all 11 assertions pass). QA-passed. Codex cross-model-passed.

---

## The Defect: Parse-Path Inconsistency

**What was wrong:** `lib/vendor-register-form-payload.ts:117` built the wire payload's `boothCount` field with:

```typescript
boothCount: Number.parseInt(state.boothCount, 10),
```

The other three numeric fields in the same function (`tableCount`, `chairCount`, `staffPerDay`) use:

```typescript
tableCount: toOptionalInt(state.tableCount),
chairCount: toOptionalInt(state.chairCount),
staffPerDay: toOptionalInt(state.staffPerDay),
```

This is not a live bug — it's a parse-path inconsistency and a defense-in-depth gap.

**Why it's not a live functional bug:** The vendor registration form already enforces two-layer validation:

1. **Client-side gate** (`components/vendors/VendorRegisterForm.tsx`, line 89): `handleSubmit()` calls `validateVendorRegisterFormClientSide(state)` *before* calling `buildVendorRegistrationPayload()`. If validation fails, the function returns early, preventing the network call. The validation's `STRICT_INTEGER_PATTERN` (`/^\d+$/`) already rejects `"1.5"`, `"1e3"`, `"e1"`, blank strings, and any malformed value — so `state.boothCount` is always a genuine whole-number string by the time line 117 runs.

2. **Server-side gate** (`lib/vendor-submissions.ts`): `validatePositiveInteger(record.boothCount, 'boothCount', errors)` is called unconditionally on every request, treating both `NaN` and `undefined` as validation failures — the server never trusts the client.

So in the normal flow, malformed values never reach line 117. But a defense-in-depth posture means: normalize the parse path anyway. If future refactors move the client validation, remove it entirely, or introduce new callers that skip it, the server-side validation boundary still holds.

**The fix:**

```diff
-    boothCount: Number.parseInt(state.boothCount, 10),
+    boothCount: toOptionalInt(state.boothCount),
```

`toOptionalInt('')` returns `undefined` (whereas `Number.parseInt('', 10)` returns `NaN`), but server-side validation already rejects both:
- `typeof undefined !== 'number'` passes the first check (`validatePositiveInteger`'s type guard)
- `!Number.isInteger(undefined)` catches it in the second check

No other file needs to change.

---

## The 4 Codex Findings: Regression Guards

This mission existed specifically to close out 4 regression guards that Codex GPT-5.5 identified during an earlier, abandoned implementation attempt. This fix does not *modify* any of these properties — it defends them against future regression. Each is codified in the contract as an assertion.

### Finding 1: Effect Rerun on Consecutive Failures

**The concern (Codex finding):** React batches `setState` calls within the same event. If an error banner's visibility depends on an effect rerunning, and the effect's dependency array is not properly configured, a second consecutive invalid submission might not trigger a rerender — the banner would persist from the first submission, rather than being hidden and reshown.

**How this fix guards it:** `VendorRegisterForm.tsx`'s error effect (line 68) is dependency-based:

```typescript
useEffect(() => {
  if (descriptor && descriptor.errors.length > 0) {
    bannerRef.current?.focus();
    bannerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [descriptor]);
```

Every `setDescriptor({...})` call passes a *new* object literal, so referential identity changes between submissions. The effect re-runs on every submission, reliably. This fix does not introduce any memoization, object reuse, or dependency-array change that would break this.

**Verified by:** Contract assertions A7 (real browser, second invalid submit triggers visible error) and A6 (first invalid submit triggers visible error).

### Finding 2: No Silent Coercion of `"1.5"` or `"1e3"`

**The concern (Codex finding):** The parse operation must reject strings like `"1.5"` (decimal) and `"1e3"` (scientific notation) rather than silently coercing them to integers. A `Number.parseInt("1.5", 10)` returns `1` (truncating, not rounding). A `Number.parseInt("1e3", 10)` returns `1`. These are silent lossy coercions, not rejections. The user entered something ambiguous, and we silently changed the meaning without telling them.

**How this fix guards it:** `lib/vendor-register-form-validation.ts` defines the guard pattern:

```typescript
export const STRICT_INTEGER_PATTERN = /^\d+$/;
```

The `boothCount` validation branch tests the raw trimmed string against this pattern *before* any numeric coercion:

```typescript
if (!STRICT_INTEGER_PATTERN.test(boothCount)) {
  errors.boothCount = 'Booth count must be a whole number (e.g., 1, 2, 3)';
}
```

This pattern rejects `"1.5"` (contains `.`), `"1e3"` (contains `e`), `""` (empty), and any non-digit character. The parse operation at line 117 is never reached with these values in the normal flow.

This fix does not touch the pattern or the validation logic — it only normalizes the parse path. If a future refactor tries to remove the pattern check or loosen the pattern, the regression-lock assertions will catch it.

**Verified by:** Contract assertions A4 (static: pattern unchanged), A6 (behavioral: `"1.5"` and `"1e3"` blocked in real browser).

### Finding 3: Early Return Must Be Conditional on Validation Failure

**The concern (Codex finding):** A weak structural check might find the word `return` somewhere in the function and incorrectly report "validation gates exist" even if the return is unconditional, in a different code path, or unrelated to validation. The check must prove that the return *blocks* the network call — i.e., the return sits inside the `if (clientErrors.length > 0)` block.

**How this fix guards it:** `components/vendors/VendorRegisterForm.tsx`'s `handleSubmit()` gates the network call:

```typescript
const handleSubmit = async (state: FormState) => {
  const clientErrors = validateVendorRegisterFormClientSide(state);
  
  if (clientErrors.length > 0) {
    setDescriptor({
      fieldErrors: clientErrors,
      message: 'Please fix the errors above and try again.',
    });
    return; // ← INSIDE the if-block
  }

  // Only reached if clientErrors.length === 0
  const payload = buildVendorRegistrationPayload(state);
  const response = await fetch('/api/vendors/register', { ... });
  // ...
};
```

This fix does not touch this wiring — it only changes the parse path. To defend against future regressions, the contract reuses two proven structural checks from the already-passing `vendor-form-client-validation-gate-f1` contract:
- `check-validation-precedes-fetch.mjs`: Verifies the `validateVendorRegisterFormClientSide` *call* appears at an earlier line number than the `fetch` call.
- `check-early-return-blocks-submit.mjs`: Verifies the `return` statement is *inside* the `if (clientErrors.length > 0)` block body (not just present somewhere in the file).

**Verified by:** Contract assertions A5 (reused structural checks) and A9 (behavioral: valid submissions still POST).

### Finding 4: Focus Management Must Target the Specific Element

**The concern (Codex finding):** A weak DOM check might grep the entire rendered HTML for `[tabindex="-1"]` and pass if *any* such element exists, even if it's unrelated to the error banner (e.g., a skip link, a honeypot, a modal overlay). The check must prove that the *specific* ref'd ancestor element — the one the effect actually manipulates — is focused.

**How this fix guards it:** The error banner is wrapped in a specific, ref'd div:

```typescript
<div ref={bannerRef} tabIndex={-1}>
  <VendorRegisterStatusBanner ... />
</div>
```

The effect scrolls and focuses this specific element:

```typescript
useEffect(() => {
  if (descriptor && descriptor.errors.length > 0) {
    bannerRef.current?.focus();  // Focus THIS element
    bannerRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
}, [descriptor]);
```

This fix does not touch the DOM structure or the effect. To defend against future regressions, the contract includes an assertion that proves this:
- `check-banner-tabindex-target.mjs`: Resolves the *specific* `[tabindex="-1"]` ancestor of the visible `role="alert"` element (using `closest()`), then verifies that element is `document.activeElement` after the effect settles. Fails if the resolved element is different, if multiple `[tabindex="-1"]` elements exist on the page and the wrong one is focused, or if no ancestor-scoped element is found.

**Verified by:** Contract assertion A8 (behavioral: correct element focused after error).

---

## The Regression-Lock Harness

**Production changes:** One line in `lib/vendor-register-form-payload.ts`.

**Test/verification infrastructure:** Five check scripts under `contracts/checks/vendor-boothcount-guarded-parse-f1/` and two evidence screenshots:

- `check-malformed-boothcount-blocked.mjs` — Real browser, network interception: Try four malformed values (`"1.5"`, `"1e3"`, `"e1"`, blank) for boothCount; assert zero requests to `/api/vendors/register` and visible error banner for each. (Defends Finding 2.)
- `check-second-invalid-submit-still-errors.mjs` — Real browser: After the first invalid submission shows an error, change boothCount to a different invalid value and submit again; assert the error banner is still visible in the live DOM. (Defends Finding 1.)
- `check-banner-tabindex-target.mjs` — Real browser: After an invalid submission, resolve the specific `[tabindex="-1"]` ancestor of the visible error banner and assert it is `document.activeElement`. (Defends Finding 4.)
- `check-validation-precedes-fetch.mjs` (reused) — Structural: Verify `validateVendorRegisterFormClientSide()` call precedes `fetch()` call. (Defends Finding 3.)
- `check-early-return-blocks-submit.mjs` (reused) — Structural: Verify the early `return` is inside the `if (clientErrors.length > 0)` block. (Defends Finding 3.)

**Screenshots:**
- `malformed-boothcount-blocked.png` — Evidence of the `"1.5"` malformed-value case being rejected.
- `second-invalid-submit-still-errors.png` — Evidence of the error banner reappearing on a second consecutive failure.

All checks run with proper network interception at the browser level (using Playwright's `page.route()`) to prevent real requests from being sent to `/api/vendors/register` during test runs — a critical lesson from the prior `vendor-form-client-validation-gate` mission.

---

## Verification

All 11 contract assertions passed:

- **A1:** Structural — `boothCount` now calls `toOptionalInt()`, raw `Number.parseInt()` removed.
- **A2:** Regression guard — Other numeric fields (`tableCount`, `chairCount`, `staffPerDay`) still use `toOptionalInt()`.
- **A3:** Regression guard — Server-side validation still calls `validatePositiveInteger()` on the field.
- **A4:** Structural — `STRICT_INTEGER_PATTERN` unchanged, pattern-test for `boothCount` still present.
- **A5:** Reused structural — Validation call precedes fetch; early return inside the if-block.
- **A6:** Behavioral — Four malformed values (`"1.5"`, `"1e3"`, `"e1"`, blank) blocked at client; visible error for each.
- **A7:** Behavioral — Error banner reappears on second consecutive invalid submission.
- **A8:** Behavioral — Specific ref'd `[tabindex="-1"]` ancestor is focused after error.
- **A9:** Behavioral — Valid boothCount (`"3"`) posts exactly one request; gate not too strict.
- **A10:** Durable evidence — Both screenshot files exist and are non-empty.
- **A11:** Type safety — No TypeScript errors introduced.

Screenshots captured and saved.

---

## Why This Mission Existed

An earlier implementation attempt touched more surface (form validation redesign) and triggered deep scrutiny from Codex GPT-5.5, which identified 4 critical regression guards that needed to be codified. That attempt was abandoned when the scope expanded, but the 4 findings remained valid and important. This mission took a much narrower path — just the one-line consistency fix — and built regression-lock assertions around all 4 findings, proving they hold and preventing future breakage. The boothCount field is a proxy for a broader principle: when client-side validation and server-side validation are both present, normalize the parse paths, and guard the key properties that make both layers work.

---

## Scope & Non-Changes

- **Production changes:** `lib/vendor-register-form-payload.ts:117` only.
- **No changes to validation logic** — `STRICT_INTEGER_PATTERN`, client-side gate, or server-side checks.
- **No changes to component structure** — Form layout, error display, or focus management remain unchanged.
- **No new dependencies** — Check scripts use only Playwright (already a dev dependency).
- **No API changes** — `/api/vendors/register` route is unchanged.
- **No database schema changes** — Firestore collection is unchanged.

---

## Deployment Notes

**This is a consistency fix, not a feature.** The production change is one line. The check scripts run locally and in CI to guard against accidental regression of the 4 findings. Once committed, future PRs that modify the vendor form, validation logic, or error-display machinery will run these checks automatically and fail if any of the guarded properties breaks.

---

## Related Features

- **F5 (Vendor Registration):** The actual feature that added vendor registration (`lib/vendor-registration-handler.ts`, `app/api/vendors/register/route.ts`)
- **F1 (Vendor Form Client-Side Validation Gate):** The regression-lock that proved the client validation gate exists and blocks invalid submissions (`docs/vendor-form-client-validation-gate.md`). This mission reuses two of its check scripts.
- **F10/F11 (Confirmation Email):** Confirmation email sent after successful server-side submission acceptance
- **Mobile Menu Focus Trap** (`docs/mobilemenu-focus-trap.md`): Similar regression-lock pattern for a different focus-management feature
