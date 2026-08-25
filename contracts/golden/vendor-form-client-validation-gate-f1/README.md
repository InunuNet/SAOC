# Vendor registration form client-side validation gate — investigation finding

## DO NOT IMPLEMENT AS A FIX — the described defect does not exist in current code

The dispatching brief described a defect: "checkValidity()/client validation flags empty
required fields, but nothing in the submit handler checks it before firing the POST — a fully
empty form currently POSTs and only gets rejected server-side."

Read against the actual committed source (`git diff HEAD` on the files below is empty — this is
not stale local edits, it is `HEAD`, last touched by commit `a23bbac` "fix: backlog sweep 2 —
dead links, events.ics redirect, a11y archive links, vendor email validation"), that description
does not match reality:

`components/vendors/VendorRegisterForm.tsx` `handleSubmit()` (lines 79-117) already:

1. Runs `validateVendorRegisterFormClientSide(state)` (`lib/vendor-register-form-validation.ts`)
   BEFORE the `fetch('/api/vendors/register', ...)` call (line 89, vs. the fetch at line 104).
2. On any client error, sets `status: 'error'` and a `validation-error` descriptor carrying
   `fieldErrors`, then `return`s — the function never reaches the `fetch` call (lines 90-98).
3. Renders those errors through the form's one existing error-display surface,
   `VendorRegisterStatusBanner` (`components/vendors/VendorRegisterStatusBanner.tsx`), via
   `humaniseFieldError()` (`lib/vendor-register-response.ts`) — the same component/path used for
   server-side validation errors, rate-limit errors, and network errors. No parallel or
   duplicate error-display pattern exists.
4. Scrolls to and focuses that banner (`useEffect` at lines 68-73) so the error is visible even
   on this 30+ field form, per the comment at line 65-67 referencing this exact "submit did
   nothing" UX failure mode.
5. A honeypot check (lines 83-87) also short-circuits before validation, unrelated to this gate.

Server-side validation (`lib/vendor-submissions.ts` `validateVendorSubmissionInput()`, called from
`app/api/vendors/register/route.ts`) remains the authoritative check, untouched by any of the
above — the client gate is a pure UX backstop, exactly as the mission goal requires.

**Conclusion: no code fix is needed.** What has actual, unmet value from the mission goal is the
*proof* — there is no existing automated (or BrowserAgent) test in this repo asserting, in a real
browser, that an empty/invalid submit fires **zero** network requests and a fully valid submit
still fires exactly one. `contracts/contract-vendor-form-ui.yaml`'s existing assertions
(A1-A11, `check-response-descriptor.mjs`, `check-status-banner-render.mjs`, etc.) test the pure
functions and the banner's render logic in isolation — none of them intercepts the network layer
in a live browser. This contract exists to close that gap: a **regression-lock and verification**
feature, not an implementation feature.

## What @dev actually does against this contract

1. Write the check scripts named in `contract-f1.yaml`'s assertions (structural + Playwright
   behavioral). No production source file under `app/`, `components/`, or `lib/` should need to
   change to pass A1-A6 — if a check script fails, that is new information (a real regression
   introduced since this README was written) and should be reported, not silently patched around
   by weakening the assertion.
2. Run a real BrowserAgent pass (per mission goal) exercising both paths — empty/invalid submit
   blocked with visible errors, and a fully valid submit successfully POSTing — and save
   screenshots to `contracts/checks/vendor-form-client-validation-gate-f1/screenshots/`. A6
   checks those files exist as the durable record that this pass actually happened.

## Reference — the exact current (correct) gating logic

See `handleSubmit.expected.tsx.txt` in this directory — a byte-for-byte snapshot of
`components/vendors/VendorRegisterForm.tsx` lines 79-117 as of commit `a23bbac`. If a future
change alters this logic, diff against this golden to see exactly what moved.
