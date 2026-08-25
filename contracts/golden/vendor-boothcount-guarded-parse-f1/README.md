# Golden: vendor-boothcount-guarded-parse F1

## Defect

`lib/vendor-register-form-payload.ts:117` builds the wire payload's `boothCount`
field with a raw `Number.parseInt(state.boothCount, 10)` while every other numeric
field in the same function (`tableCount`, `chairCount`, `staffPerDay`) routes through
the local `toOptionalInt()` helper. This is a parse-path inconsistency, not a live
functional bug: `components/vendors/VendorRegisterForm.tsx`'s `handleSubmit` already
calls `validateVendorRegisterFormClientSide(state)` and returns early on any client
error *before* `buildVendorRegistrationPayload()` is ever invoked, and that validator's
`STRICT_INTEGER_PATTERN` (`/^\d+$/`) already rejects `"1.5"`, `"1e3"`, `"e1"`, and blank
`boothCount` values. So in the normal submit flow, `state.boothCount` is always already
a genuine whole-number string by the time line 117 runs.

The fix is a one-line consistency/defense-in-depth change: swap the raw `Number.parseInt`
call for `toOptionalInt(state.boothCount)`, matching the other three numeric fields.
`toOptionalInt('')` returns `undefined` (vs. `Number.parseInt('', 10)`'s `NaN`) —
`lib/vendor-submissions.ts`'s `validatePositiveInteger()` already rejects both
(`typeof value !== 'number'` catches `undefined`; `!Number.isInteger(value)` catches
`NaN`), so server-side behaviour is unchanged either way. No other file needs to change.

## Expected diff (lib/vendor-register-form-payload.ts)

```diff
-    boothCount: Number.parseInt(state.boothCount, 10),
+    boothCount: toOptionalInt(state.boothCount),
```

Nothing else in this file, `lib/vendor-register-form-validation.ts`,
`lib/vendor-submissions.ts`, or `components/vendors/VendorRegisterForm.tsx` should
need to change to close this defect.

## The 4 Codex findings from the abandoned prior attempt (backlog.md) — how each applies here

These were raised against a from-scratch redesign attempt that touched more surface
than this fix needs. They are recorded here as **regression guards**, not as things
this fix must newly implement — this fix does not touch the banner effect, the
regex, the early-return wiring, or the `tabindex` DOM structure at all.

1. **React batches same-event `setDescriptor` calls; an unmount/remount-dependent
   banner effect can fail to rerun on a second consecutive failure.**
   `VendorRegisterForm.tsx`'s `useEffect(() => { ... }, [descriptor])` at line 68
   already reruns correctly today because every `setDescriptor({...})` call passes a
   *new* object literal, so referential identity always changes between submissions.
   This fix must not introduce any memoization, object reuse, or dependency-array
   change to that effect. A2/A6 (below) prove a second consecutive invalid submission
   still shows a visible error.

2. **`"1.5"` and `"1e3"` must not be treated as valid — do not silently truncate.**
   `STRICT_INTEGER_PATTERN = /^\d+$/` in `lib/vendor-register-form-validation.ts`
   already rejects both (and `toOptionalInt`'s own `Number.parseInt` is never reached
   with either string in the real submit flow, because validation runs first). A1
   proves the regex is untouched; A5/A6 prove it live in a real browser.

3. **A wiring check must prove the return is CONDITIONAL on validation actually
   failing — not merely that some `return` statement exists somewhere in the
   function.** Reuses the existing, already-passing structural checks from the
   `vendor-form-client-validation-gate` contract
   (`check-validation-precedes-fetch.mjs`, `check-early-return-blocks-submit.mjs`),
   which assert ordering (`validateVendorRegisterFormClientSide` call precedes the
   `fetch` call) and assert the `return` sits inside the
   `if (clientErrors.length > 0)` block body specifically — not a bare grep for the
   word `return`.

4. **A `tabindex="-1"` check must target the specific ref'd root element the code
   manipulates, not just grep the whole rendered HTML.** The element in question is
   the `<div ref={bannerRef} tabIndex={-1}>` wrapper around
   `<VendorRegisterStatusBanner>` at `VendorRegisterForm.tsx:128` — the one div that
   is both scrolled into view and focused by the effect. A7 must resolve that
   specific element (e.g. the ancestor `div[tabindex="-1"]` of the `role="alert"`
   node, or `document.activeElement` after the scroll/focus effect runs) rather than
   `document.querySelectorAll('[tabindex="-1"]')` unscoped.

## Scope

Expected file changes: `lib/vendor-register-form-payload.ts` only.
Everything else referenced above is verified, not modified.
