# checkout-error-summary (P1 a11y, design review 2026-10-28 F4 F1/F2)

Worktree .tmp/sandbox/checkout-summary, branch fix/checkout-error-summary off origin/main 48d74378.

## Findings that shape the work
1. The checkout renders on one host only. app/(nos)/tickets/[slug]/page.tsx is the only user of TicketPurchaseForm; there is no app/(marketing)/tickets route. proxy.ts routeSaocHost 308-redirects /tickets/* to the NOS origin. So "SAOC and NOS" reduces to: NOS renders it, SAOC redirects (asserted).
2. The form always sits inside NosThemeScope, so the vendor token `--status-error` resolves (nos-theme.css:204-233, #8f2834 on light). No NOS colour gap on the ticket page. Separate gap: `--status-error` is defined only in nos-theme.css, so the vendor summary on the SAOC host (VendorApplyForm) has an undefined border and heading colour. Not in this scope; report to SAOC lead.
3. Today validation (useTicketCart.submit) sets per-row attendeeErrors, never clears them until the next submit, and focuses nothing. handleSubmit returns early on a missing day (r45b: focus the picker) before attendee validation runs, so a buyer sees one class of error at a time.
4. F4's ":invalid 5 vs aria-invalid 2" is the `required` attribute matching empty fields before any submit (form is noValidate). Not a defect once aria-invalid tracks errors; no change.

## Specification (for @dev)
Reference: components/vendors/VendorApplyForm.tsx (SUMMARY_ID, summaryRef, rAF focus, summary markup, focusField).

TicketPurchaseForm.tsx
- `SUMMARY_ID = 'checkout-error-summary'`; `SUMMARY_HEADING = 'Please check the highlighted fields.'` with the same sourcing comment as the vendor form (humaniseFieldError fallback). No new string.
- Submit validates everything in one pass: missing day (if requiresDaySelection), then attendee rows. If any error: render the summary, `requestAnimationFrame(() => summaryRef.current?.focus())`, do not submit. This supersedes r45b's "focus the picker" for the missing-day case; the picker keeps its inline TicketFieldAlert (exactly one, not duplicated) and the summary's day entry links to the picker (focus first enabled radio, as the current code does).
- Entries, in DOM order: day ("Choose a day", TICKET_COPY.chooseDay), then each attendee error (existing validateAttendees strings). When quantity > 1 compose the entry as "Attendee {n}, {type name}: {existing field message}" (NOS Design ruling: comma and colon, no em dash) so entries are distinct; quantity 1 uses the bare message.
- Summary markup and classes copied from the vendor form verbatim: outer `div#id tabIndex={-1}` with `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`, inner `role="alert"` box `border border-[var(--status-error)] bg-bone`, heading `text-[var(--status-error)]`, `ul.list-disc`, links `underline underline-offset-2`. No new colours or classes. Check on NOS: bg-bone resolves to #f3f2d6 inside nos-theme (nos-theme.css:49), visually verify at 1280/390; if the plate fails to separate from the page ground, record a gap for NOS Design and do not pick a colour.
- Scroll clearance: the summary wrapper needs scroll-margin-top so focus() does not land under the sticky stack (F4 measured 145px = 48 test bar + 97 header). Derive from existing header tokens where they exist (globals.css --scroll-padding-top is 6.5rem = 104, too small for NOS); do not invent a new token if one exists. Field links use `focusField`-style `focus()` + `scrollIntoView({block:'center'})`.
- Day: `dayInvalid` stays derived (dayRequested && day === null), so choosing a day clears both the inline alert and its summary entry.
- Server path: the checkout route returns a single `error` string, no field map, so there are no per-field server errors to link. The existing form-level TicketFieldAlert for cart.errorMessage moves inside a wrapper with the same id and tabIndex -1 and is focused the same way when status becomes 'error' (message verbatim, no heading, no links). The 409 day-race path keeps focusing the day picker (it already does); do not steal focus there.
- Unchanged: zero-quantity buy hint (hintRef focus), hydration-gated submit, redirect notice.

useTicketCart.ts / cartValidation.ts
- After a failed submit, re-validate on every attendee edit and keep only rows/fields that were already flagged (vendor handleChange pattern): a fixed field loses its alert, aria-invalid and summary entry; unflagged fields never gain errors while typing. Expose a stable error list (key, message, field id) for the summary, in row order.

TicketFormField.tsx / CartAttendeeFields.tsx
- When `error` is set: `aria-describedby={`${id}-error`}` on the input and `id` on the TicketFieldAlert (it already accepts one). aria-invalid already follows error.
- Summary link hrefs are `#attendee-{slug}-{index}-name|email` (existing ids).

## Test inputs (already written, do not edit)
- e2e/checkout-error-summary.spec.ts (copy in goldens/): real form via fixture route; 9 tests x {1280, 390} plus SAOC redirect, buy-hint guard, and a live-route test gated on E2E_TICKET_SLUG.
- app/ticket-fixtures/buy/page.tsx: `?type=day` adds a day-selection product (test scaffold only).
- package.json/pnpm-lock.yaml: axe-core 4.12.0 devDependency (already in the lockfile transitively; no new package).
- Run env: TICKET_FIXTURES=1, SANITY_FIXTURE_MODE=replay with an empty SANITY_FIXTURE_DIR (the fixture route reads no Sanity), K_SERVICE unset, both NEXT_PUBLIC_*_SITE_URL set. The checkout POST is route-mocked; no payment, no Ozow call.

## Overlap with PR #127 (fix/checkout-attendee-field-limits)
#127 touches TicketFormField.tsx (adds `maxLength` prop and `maxLength={maxLength}` on the input), CartAttendeeFields.tsx (adds maxLength props to both TicketFormField calls) and app/api/tickets/checkout/route.ts. This work edits the same two components: expect trivial textual conflicts on the props interface, destructuring and input attribute lines in TicketFormField, and the two JSX prop lists in CartAttendeeFields. Whichever merges second rebases; no semantic interaction. Keep edits to those files to added lines, not reflowed ones.

## Decisions taken (non-blocking) and DECISION NEEDED
- Taken: day-missing now joins the summary and focus goes to the summary (consistency with the vendor form) rather than the picker.
- Taken: axe-core as an exact-pinned devDependency.
- Taken: server refusal gets a focused wrapper only, no heading (nothing sourced says otherwise).
- RULED (NOS Design): entry text is "Attendee {n}, {type}: {existing message}"; day-missing joins the summary (summary takes focus, link focuses the picker, picker keeps its inline alert); colour unchanged (--status-error #8f2834 on bone 7.33:1).
- Gap, not ours: `--status-error` undefined on the SAOC host (point 2) affects the vendor application form.

## Limits of the proof
The sticky-stack assertions use a pinned 145px stand-in on the fixture route (it has no site chrome); the live-route test adds the real stack but only runs with E2E_TICKET_SLUG and a Sanity replay that contains that ticket. Axe is relative (no new violations vs the pristine page); the page's existing violations (landmark-one-main, page-has-heading-one, region on the chromeless fixture) are not asserted.

## Reviewer findings folded in (comms.md "[SAOC -> NOS Site] 2026-10-28 two NOS P1 findings", item 2)
- F4 F1 (P1): focus stays on the submit button, no summary, `:invalid` 5 vs `aria-invalid` 2, first error lands under the 145px sticky stack. Suggested fix: move focus to the first invalid field or a summary, plus scroll-margin for the sticky stack. Covered: summary focus, aria wiring, scroll-margin-top and the 145px clearance assertions. The `:invalid`/`aria-invalid` mismatch is the `required` attribute on empty fields before submit (noValidate form); aria-invalid now follows errors, no further change.
- F4 F2 (P2): "One shared pattern (summary + focus)". Decision: extracting a shared ErrorSummary component is OUT of scope for this PR and is a named follow-up. Reason: the vendor form owns its markup and tests, the checkout needs a different entry model (day + per-row attendee entries, server-message variant), and a shared extraction would touch VendorApplyForm and VendorRegisterForm (more conflict surface beside #127). This PR copies the vendor classes, id convention and rAF focus pattern verbatim so the later extraction is mechanical. Follow-up to backlog: shared `FormErrorSummary` used by VendorApplyForm, TicketPurchaseForm and VendorRegisterForm.
- Also out of scope, recorded for the SAOC lead: F4 F2's other half, /vendors/register step 1 is `noValidate` with no client check and posts an empty form to `/api/vendors/register/verify-code`. Same fix class, different form; not touched here.

## NOS Design QA gates (ruled 2026-10-28), mapped to tests
a. activeElement is the summary (tabindex=-1) with role=alert or aria-labelledby: test 1 (`empty submit mounts...`).
b. each entry is `<a href="#field-id">` focusing its field: test 1 (href) and `a summary link moves focus...`.
c. summary within the first screen at 390 and 1280: `the summary sits within the first screen...`.
d. fixed field gone after pressing submit again: `a fixed field is gone from the summary...`.

## Placement and scroll (NOS Design 2026-10-28, supersedes any "top of form" wording above)
- Placement: the summary sits directly above the submit button (NOS Design 2026-10-28), not at the top of the form. The vendor form keeps its top-of-form summary and is NOT migrated: VendorApplyForm.tsx must be byte-identical to origin/main in this diff (contract A12).
- Scrolling: `scroll-mt` on the summary plus `focus({ preventScroll: false })`. Gate (all in the e2e, 1280 and 390): after a failed submit the summary top is at least sticky-stack bottom + 8 and its bottom is at most the viewport height, for 1, 2 and 3 attendees (3 is the longest list, 6 entries).
- Re-submit with fewer errors: focus returns to the summary and the same top/bottom gate holds, so nothing jumps above it.
- The earlier "scroll-margin-top >= 145" wording is now the +8 gate above, measured against the real stack bottom.

## Sticky stack: measured, not assumed (lead request 2026-10-28)
- The gate measures the real stack: `stickyBottom()` takes the bottom of every position:fixed/sticky element pinned at the top (at least half the viewport wide). On the live NOS page that includes the TESTING ONLY bar. The fixture route has no chrome, so there it is measured against the pinned 145px stand-in, kept as the worst-case control.
- Live tests (E2E_TICKET_SLUG + Sanity replay): 2 viewports x {1, 3} attendees, same +8 / viewport gate, and each attaches a `sticky-stack-bottom` annotation with the measured pixels.
- Known from source, not yet measured: the bar is `sticky top-0` with min-height 44px (below md) or 48px (md and up) and wraps its text, so it can be taller than the minimum at 390; the header (`.nh`) is offset by the bar height (nos-chrome.css:95-98). The review measured 48 + 97 = 145 at desktop. `--scroll-padding-top` is 104px (globals.css:157) and is smaller than the stack.
- (Superseded by the measurement below.) MEASURED HEIGHTS were pending. Browser runs are barred in this worktree and the dev owns it; the dev (or lead) runs the live tests with a replay that has an on-sale ticket and records the 1280 and 390 `sticky-stack-bottom` here. scroll-mt-40 (160px) is sufficient only if both measured values are at most 152 (stack + 8); otherwise the class must grow.

### Measured (dev, NOS /tickets/vip, d5ebd32d)
Replay fixture from .tmp/sandbox/hub-tablet-fx with NEXT_PUBLIC_SANITY_PROJECT_ID=26yfbug4 and the dev's own server (not Playwright's webServer).
- 1280: stack = 145. The TESTING bar is sticky, bottom 48; the header is sticky, bottom 145.
- 390: stack = 44. The bar's bottom is 44; the header is position:relative and scrolls away.
- scroll-mt-40 (160px) holds: 145 is at most 152 (stack + 8).
- Summary after a failed submit (top / bottom / viewport height), all PASS:
  - 1280 x 1 attendee: 476 / 588 / 800
  - 1280 x 3 attendees: 424 / 639 / 800 (tightest, 279px spare)
  - 390 x 1 attendee: 413 / 525 / 844
  - 390 x 3 attendees: 440 / 786 / 844
- Spec bug found and fixed: `stickyBottom()` counted only elements with top <= 1, skipping the NOS header pinned at top 48 under the bar, so it read 48 instead of 145 at 1280 (97px under). It now chains from the elements at 0 and adds any fixed/sticky element whose top is within 1px of the stack bottom so far. The live tests assert it returns 145 at 1280 and 44 at 390.
- Why the live test is skipped in the default run: Playwright's webServer cannot wait on the replay fixture, because the SAOC home page misses it and returns a 500. That is a test-environment limit, not a code defect. Run the live tests against the dev's own server with E2E_TICKET_SLUG set.

### Dev code change recorded
`focusSummary()` now centres the summary after focusing it, which fixes a 0.23px clip at 2 attendees and 1280. The re-submit no-jump gate (A3) still passes 2/2.
