> **SUPERSEDED 2026-08-18 — archived for its decision record only, not a live contract.**
>
> This was orphaned scaffolding at `contracts/contract-vendor-form-submit-visibility-fix.yaml`
> (+ `contracts/checks/vendor-form-submit-visibility-fix/` + this README's original location at
> `contracts/golden/vendor-form-submit-visibility-fix/`) — never committed (`git ls-files`
> returned nothing for any of it), from an earlier, abandoned pass at the same "submit did
> nothing" bug this README diagnoses. Codex's cross-model review of the `vendor-page-fixes`
> diff caught it as a live tripwire: its check script imports `validateBoothCount` from
> `lib/vendor-register-form-payload.ts`, an export that this codebase's *shipped* fix
> deliberately does not create, so running that check throws a module-instantiation
> `SyntaxError` rather than failing meaningfully.
>
> Both defects this README diagnoses are independently closed today, by a different,
> already-implemented design:
> - **Defect 1** (`boothCount` → `NaN` → `null` → opaque server rejection) is fixed by
>   `vendor-page-fixes/contract-f1.yaml`'s `validateVendorRegisterFormClientSide()` in
>   `lib/vendor-register-form-validation.ts` — an array-returning validator covering all of the
>   form's required/format-constrained fields (not a single-purpose `validateBoothCount()`), using
>   a strict `^\d+$` regex rather than `Number.parseInt`. It reuses the server's exact error
>   vocabulary the same way this README's Decision 1 does, just through a different function
>   shape. See `vendor-page-fixes/goldens/field-validation.golden.json`.
> - **Defect 2** (the error banner rendering off-screen) was already fixed in the tree by the
>   time this orphaned contract was written — `VendorRegisterForm.tsx`'s `bannerRef` +
>   `scrollIntoView`/`focus()` `useEffect`, guarded by `contract-f1.yaml`'s A18 regression check.
>
> The untracked `contracts/contract-vendor-form-submit-visibility-fix.yaml`,
> `contracts/checks/vendor-form-submit-visibility-fix/`, and
> `contracts/golden/vendor-form-submit-visibility-fix/` were deleted outright (never committed,
> so no `rm` history to preserve) after this README was copied here. This copy exists solely
> because its root-cause analysis and the reasoning behind Decisions 1 and 2 below have real
> archival value — a different, real design was seriously considered and rejected here; nothing
> below should be treated as describing current, live code.

---

# Vendor registration form — submit visibility fix — decision record

**DO NOT IMPLEMENT.** This contract is architecture only. `@dev` implements against the golden
files and assertions below; nothing under `app/`, `components/`, or `lib/` was touched while
writing this contract, except reading them to verify the root cause independently (see below).

Follow-up to the closed `vendor-form-ui` mission (`contracts/contract-vendor-form-ui.yaml`, all
features `done`). Brad hit a real bug on the live registration form: he typed `"e1"` into the
booth-count field, clicked Submit, and nothing visible happened. This contract fixes both
compounding defects behind that.

---

## Root cause — independently verified, not taken on faith

### Defect 1 — `boothCount` bypasses the form's own validation pattern

`lib/vendor-register-form-payload.ts:59-64` defines `toOptionalInt(value)`, used by
`tableCount` (line 101), `chairCount` (line 102), and `staffPerDay` (line 106) — all three
route blank/garbage input to `undefined` before it ever reaches the wire. `boothCount` at
line 99 instead calls `Number.parseInt(state.boothCount, 10)` directly, with no guard. Feeding
it `"e1"` produces `NaN`; `JSON.stringify` silently drops a `NaN` property value or turns it
to `null` depending on context — here, as a plain object property, it serialises to `null` in
the POST body sent from `VendorRegisterForm.tsx:84`.

Server-side, `lib/vendor-submissions.ts:77` calls
`validatePositiveInteger(record.boothCount, 'boothCount', errors)` (defined lines 140-144),
which correctly rejects `null` (`typeof value !== 'number'`) with the exact string
`"boothCount is required and must be a positive integer"` (confirmed verbatim against the real
fixture at `contracts/checks/vendor-form-ui/fixtures/api-response-validation.fixture.json`).
This is *correct* server behaviour — `boothCount` is genuinely required
(`types/index.ts:486` per the dispatch brief; confirmed structurally via
`validatePositiveInteger`, which has no `undefined`-early-return unlike
`validateOptionalNonNegativeInteger` at line 146). The bug is not the rejection — it's that nothing
tells the submitter this happened.

Grep across `lib/vendor-register-form-payload.ts` confirms `boothCount` is the *only* field
that goes straight from raw form string to `Number.parseInt` with no coercion helper — no other
field has this gap.

### Defect 2 — the rejection is invisible

`VendorRegisterStatusBanner` renders once, at the very top of the form
(`VendorRegisterForm.tsx:104`), immediately inside `<form onSubmit>`, before all five fieldsets
(contact, category, booth/logistics, marketing, payment — lines 106-110). There is no
scroll-into-view or focus management anywhere in `handleSubmit` (lines 67-94) or the banner
component (`VendorRegisterStatusBanner.tsx`) on a status transition to `'error'`. A submitter
who has scrolled to the bottom submit button on this five-section form gets an error that
renders entirely above their current scroll position. `role="alert"` (line 19) means a screen
reader announces it — but a sighted mouse/keyboard user, which is what Brad was, sees no change
at all. That symmetry gap (screen readers handled, everyone else not) is the actual accessibility
defect, not the presence or absence of `role="alert"` itself.

---

## Decision 1 — a dedicated `validateBoothCount()` pre-submit check, not a generic `toRequiredInt()`

The dispatch brief floated a `toRequiredInt()`-shaped helper generalising `toOptionalInt()`.
Rejected in favour of a single-purpose `validateBoothCount(value: string): string | undefined`
in `lib/vendor-register-form-payload.ts`, for two reasons:

1. **It's the only required numeric field.** The grep above is conclusive: `tableCount`,
   `chairCount`, `staffPerDay` are all optional server-side
   (`validateOptionalNonNegativeInteger`, `lib/vendor-submissions.ts:146-153`); `boothCount` is
   the sole `validatePositiveInteger` field in the whole schema. A generic `toRequiredInt()`
   would have exactly one call site — that's the premature abstraction this project's own
   coding rules forbid (`.claude/rules/coding.md` — "Three similar lines is better than a
   premature abstraction").
2. **Catching it before the request is strictly better than catching it after**, which the
   brief itself already concluded. That means the check has to run on the *raw string* state
   value, before `buildVendorRegistrationPayload()`'s coercion step — a `toRequiredInt()`
   living inside the payload builder (parallel to `toOptionalInt`) would still only run at
   payload-build time, i.e. after the user has already clicked Submit, which is exactly the
   same timing as today. The fix has to be a validation step the form calls and can act on
   *before* `fetch()` — a coercion helper alone doesn't give the form anywhere to hang a
   field-named error message.

`validateBoothCount()` returns the *exact same error string* the real server validator would
produce for the same bad input — `'boothCount is required and must be a positive integer'` —
not a newly-invented message. This is a deliberate zero-duplication choice: that string is
already wired through the real `humaniseFieldError()` (`lib/vendor-register-response.ts:140-159`,
matched via `VENDOR_FIELD_LABELS.boothCount = 'Number of booths'` at line 109, and the
`.includes('is required')` branch at line 152) to produce `"Number of booths is required."` —
so the client-side pre-flight rejection and a server-side rejection of the same bad input render
*identical* copy, through the same humanisation function, with no second copy of the message
text anywhere.

`VendorRegisterForm.tsx`'s `handleSubmit` calls `validateBoothCount(state.boothCount)` before
the `fetch()` call. On a failure, it sets `descriptor` to
`{ kind: 'validation-error', message: 'Invalid vendor registration submission.', fieldErrors: [error] }`
— reusing the server's own top-level message text (`lib/vendor-registration-handler.ts:78`) —
and `status` to `'error'`, and returns without calling `fetch()`.

`buildVendorRegistrationPayload()` itself is **not** changed — it stays exactly as documented
in its own header comment, a pure coercion step that assumes valid input, matching the existing
`vendor-form-ui` architecture decision that this module's only job is shape coercion, not
validation. The validation gate sits in the caller, same as the honeypot check already does
(`VendorRegisterForm.tsx:71-75`).

## Decision 2 — scroll-to-banner, not scroll-to-field

The brief asked which is better UX, conditional on whether field-level errors exist to scroll
to after Decision 1. They don't, structurally: `VendorRegisterStatusBanner` renders
`descriptor.fieldErrors` as a single `<ul>` inside one banner div
(`VendorRegisterStatusBanner.tsx:22-27`) — there is no per-field DOM slot next to each input.
None of the five fieldset components (`VendorContactFieldset`, `VendorCategoryFieldset`,
`VendorBoothFieldset`, `VendorMarketingFieldset`, `VendorPaymentFieldset`) accept an error prop
or render inline field-level error text; they take only `{ state, onFieldChange, disabled }`
(confirmed by their usage in `VendorRegisterForm.tsx:106-110`).

Wiring scroll-to-first-invalid-field would mean adding error props and inline error rendering
to all five fieldset components and every leaf input inside them — precisely the "form rewrite"
and "don't touch other fields' existing correct behaviour" the dispatch brief ruled out. It's
also unnecessary: `boothCount` is the only field this fix touches, and its error already renders,
named, inside the one banner that already exists.

**Fix: scroll the banner into view and move focus to it on every fresh render of an error
descriptor.** Because `VendorRegisterForm.handleSubmit` calls `setDescriptor(null)` before every
submit attempt (line 78), the banner element unmounts (descriptor `null` → `VendorRegisterForm`
renders nothing where the banner was) and remounts fresh on the next error — so a mount-time
effect fires on every distinct submission failure, including two consecutive validation errors
in a row, with no extra dependency tracking needed.

Implementation shape: `VendorRegisterStatusBanner` gets a `ref` on its root `<div>`, adds
`tabIndex={-1}` (programmatically focusable, not tab-reachable — it's not a control), and a
`useEffect` that runs once on mount, calling a small exported pure function
`focusAndScrollToBanner(el)` with the ref's current element. Extracting that call into its own
exported function (rather than inlining `el.scrollIntoView(...); el.focus();` directly in the
effect body) is what makes it checkable without a DOM engine — see A3 below, which calls the
real function with a plain stub object exposing spy `scrollIntoView`/`focus` methods, mirroring
this codebase's established pattern (`lib/vendor-registration-handler.ts`, `vendor-form-ui`'s
A1/A5) of pulling logic that touches the outside world into small pure functions provable by
direct invocation, not simulation.

Visible focus indicator: reuse the existing `border` token already in `bannerClass`
(`VendorRegisterStatusBanner.tsx:9`, `border-accent/40`) rather than inventing a ring — add
`focus:border-accent focus:outline-none`, following the same `focus:border-*` convention already
used on every form field (`components/vendors/VendorFormField.tsx:18`,
`focus:border-ink/40`). No new visual token, no new styling concept.

---

## What this contract cannot prove offline

Consistent with `vendor-form-ui`'s own README: this project has no jsdom/vitest/testing-library
dependency, and every existing check in this codebase proves either (a) pure functions by direct
invocation, or (b) SSR structural output via `react-dom/server` (no effects, no real DOM, no
`scrollIntoView`). This contract follows the same constraint rather than introducing a new test
runtime dependency for one fix:

- **A3 proves `focusAndScrollToBanner()` is a real, correct pure function** (calls
  `scrollIntoView` then `focus`, exactly once each, tolerates a `null` element) by direct
  invocation with a stub object — it does **not** prove the `useEffect` wiring inside the real
  browser actually fires it at the right moment, or that smooth-scroll behaviour looks right at
  320/375/1440px. That needs a real browser (BrowserAgent / manual check), same limitation this
  project already accepts for keyboard-navigation and viewport checks elsewhere.
- **A1 proves `validateBoothCount()`'s output text is correct and matches server wording** by
  direct invocation and by running the output through the real `humaniseFieldError()` — it does
  not prove `handleSubmit` actually calls it before `fetch()` in the running app (no
  jsdom/mocked-fetch client-render harness exists in this repo). A4 closes part of that gap
  structurally (source-level proof that `handleSubmit` calls `validateBoothCount` before its
  `fetch()` call, and returns early on failure) but is still a source-shape proof, not a live
  DOM interaction proof.
