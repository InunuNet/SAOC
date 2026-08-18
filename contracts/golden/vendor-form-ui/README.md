# Vendor registration form UI — decision record

Follow-up to the closed `vendor-registration` mission
(`.agent/memory/project/missions/2026-08-17-vendor-registration.md`, F1-F9, all `done`). F5
(`contracts/contract-vendor-f5-register-route.yaml`) built and contract-locked
`POST /api/vendors/register` — the pure `handleVendorRegistration()` orchestrator, the real F4
validator/builder, rate limiting, confirmation email — but no feature in that mission ever
specified the public HTML form that calls it. This contract is that missing piece.

**DO NOT IMPLEMENT.** This contract is architecture only. `@dev` implements against the golden
files and assertions below; nothing under `app/`, `components/`, or `lib/` was touched while
writing this contract, except reading them.

---

## Source, re-read for this contract

Same source as F1-F5: Lee-Ann's "South African Exhibitors" brief, plain-text extract at
`/private/tmp/claude-501/-Users-vetus-ai-SAOC/2c295099-ca67-4f9d-92bd-0939c89c932a/scratchpad/exhibitors.txt`.
The registration form itself (source lines 27-91, "2027 SAOC NATIONAL SHOW VENDOR REGISTRATION
FORM") is 31 numbered fields across 5 sections. `field-spec.golden.json`'s labels are these 31
items verbatim, with only the leading number/asterisk/checkbox glyph stripped.

---

## Naming — no conflict, just two different sub-pages using two different words

The dispatch brief's naming rule ("public copy uses Lee-Ann's 'Exhibitors' wording verbatim;
internal names stay `vendor*`") describes the showcase page (`/national-show/vendors`, F3),
whose own page title is already "Exhibiting Nurseries". The registration **form**, in the same
source document, is headed "VENDOR REGISTRATION FORM" in Lee-Ann's own words — not "Exhibitor
Registration". Both are Lee-Ann's verbatim wording; they are simply two different phrases for two
different sub-pages of the same programme. This contract's page heading is "Vendor Registration"
because that is what section 27-28 of the source literally says, not because internal naming
leaked into public copy. Do not rename it to "Exhibitor Registration" to force consistency with
F3 — that would contradict the source document, which the project's "not to be rewritten,
paraphrased, or 'improved'" rule for Lee-Ann's copy already forbids.

The existing `app/(marketing)/national-show/exhibitors/` route (F1's disambiguation target — show
*entry*/judging for growers entering plants in classes) is unrelated to this feature and is not
touched, referenced, or linked from anywhere in this contract.

---

## Why two new pure lib modules instead of inlining logic in the client component

`lib/vendor-registration-handler.ts` (F5) established this codebase's working pattern for
untestable-by-default code: pull every piece of *logic* out of the thing that talks to the
outside world (there, Firestore/Resend; here, `fetch` and React state) into small, pure,
independently-callable functions, and prove those against fixtures with plain `npx tsx` — no
browser, no DOM simulation, no jsdom dependency this project doesn't already have. This contract
does the same on the client side:

- `lib/vendor-register-form-payload.ts`'s `buildVendorRegistrationPayload()` — the ONLY place
  form-state coercion happens (string → number, string → boolean). A1/A11 gate it directly by
  feeding its output to the REAL `validateVendorSubmissionInput()` — not an assumed shape.
- `lib/vendor-register-response.ts`'s `describeVendorRegistrationResponse()` — the ONLY place
  the four real API response shapes get turned into UI-legible text. A5 gates it directly against
  real fixture response bodies (the 400 case's `fieldErrors` were captured by an actual call to
  the real F4 validator, not hand-typed — see `fixtures/api-response-validation.fixture.json`'s
  own `_comment`).

Everything downstream of those two functions — the fieldsets, the status banner, the success
state — is presentational and stateless, so A4/A6/A7 can render it directly with
`react-dom/server`'s `renderToStaticMarkup()` against fixture props, exactly like F3's
`VendorIntro`/`VendorGrid`/`VendorEmptyState` split did for the showcase page. Only
`VendorRegisterForm.tsx` itself — the `useState` + `fetch` orchestrator wiring these pieces
together — is untestable offline in this contract, for the same reason F3's `page.tsx` wiring
(A4 there) was only statically checked: no injectable seam for `fetch`, and simulating a real
`onChange`/`onSubmit` event sequence needs a real DOM (jsdom/Playwright), which this project does
not currently depend on. See "What this contract does NOT prove" below.

---

## Field ↔ API mapping, id contract, and component structure

`field-spec.golden.json` is the single source of truth for all 31 fields: `key` (the exact
`VendorSubmissionDraft` property name), `section` (which fieldset renders it), `label` (Lee-Ann's
verbatim text), `htmlType`, `required`, and `options` for the four enum-backed fields
(`vendorCategory`, `boothType`, `paymentMethodsAccepted`, plus the two Yes/No booleans). The 31
keys and the 9 required keys are both **derived from real code**, not eyeballed — see A2 (derived
from `buildVendorSubmission`'s actual return-object-literal source) and A3 (derived from repeated
real calls to `validateVendorSubmissionInput`). Both derivations were run live while writing this
contract and confirmed to match the golden before it was committed.

**Excluded on purpose:** the source document's `Signature`/`Date`/office-use block (booth number,
payment received, confirmed by) are physical-paperwork artifacts and admin-only fields
respectively — not part of `VendorSubmissionDraft`'s public 31, and not rendered by this form.

**ID contract** (required for A4/A7 to find and validate controls — this is real markup
structure, not a test-only attribute):

| Control kind | Markup |
|---|---|
| Single text/tel/email/url/number/textarea, single checkbox | `id="vendor-register-<key>"` + `<label htmlFor="vendor-register-<key>">` |
| Group (checkbox-group / boolean-radio / select-radio) | outer `<fieldset id="vendor-register-<key>">` + `<legend>` (label text) + `aria-required="true"` iff required; each option `<input id="vendor-register-<key>-<optionValue>">` + its own `<label htmlFor>` |

**Component tree:**

```
VendorRegisterForm.tsx (client, orchestrator, ≤150 lines)
├── VendorContactFieldset.tsx      (fields 1-10, section "contact")
├── VendorCategoryFieldset.tsx     (fields 11-16, section "category")
├── VendorBoothFieldset.tsx        (fields 17-27, section "booth")
├── VendorMarketingFieldset.tsx    (field 28, section "marketing")
├── VendorPaymentFieldset.tsx      (fields 29-31, section "payment")
├── VendorRegisterStatusBanner.tsx (error/validation-error/rate-limited)
└── VendorRegisterSuccess.tsx      (success — replaces the fieldsets, not a modal)
```

Each fieldset is built from 5 new generic leaf inputs
(`VendorFormField`/`VendorCheckboxGroupField`/`VendorBooleanRadioField`/`VendorRadioGroupField`/
`VendorCheckboxField`), mirroring `components/tickets/TicketFormField.tsx`'s existing
labelled-input convention rather than inventing a new one. Styling tokens (`font-mono`
uppercase labels, `border-rule`/`bg-ivory`/`text-ink` etc.) must be the same ones already used in
`ContactForm.tsx`/`TicketFormField.tsx` — no new colour/spacing/typography token, per the "No
invented brand assets" project rule. This is not mechanically gated beyond A10's `eslint` pass —
same named gap F3's own README called out for its grid card styling.

A honeypot field (mirrors `ContactForm.tsx`'s own `_hp` pattern exactly: visually hidden,
`tabIndex={-1}`, `aria-hidden`, stripped before the real POST body is built) belongs in
`VendorRegisterForm.tsx` itself, not in any fieldset — it is anti-spam plumbing, not one of the
31 real fields, and deliberately outside A4/A7's scope (which only render the 5 fieldsets).

**400 field errors are not mapped per-input, and must never reach the submitter raw.**
`fieldErrors` from the real validator is a flat array of schema-flavoured, camelCase strings
(e.g. `"businessName is required and must be a non-empty string"`) — internal validator
language, not copy meant for a public visitor, and not a `{field: message}` object the way
`TicketPurchaseForm`'s hand-written client-side errors are. Parsing a field name back out of
that prose to highlight one specific input would be fragile (the message wording is F4's to
change, not this contract's to freeze), so `VendorRegisterStatusBanner` renders the full list as
a legible summary above the fieldsets instead — but **humanised**, via `lib/vendor-register-
response.ts`'s `humaniseFieldError()` + `VENDOR_FIELD_LABELS`, never the raw string. This was
tightened after an earlier pass: BrowserAgent's real-browser check caught the literal camelCase
validator strings (`businessName`, `vendorCategory`, `termsAccepted`, …) being shown to the
public, which A6 originally didn't catch because it only asserted the raw fixture string
appeared in the rendered output — the exact leak it should have been gating against. A6 now
computes the expected humanised text by calling the real `humaniseFieldError()` (same
real-function-round-trip technique A1 uses) and separately asserts none of the 31 raw camelCase
field keys appear anywhere in the rendered banner. A client-side pre-submit check mirroring the
9 required fields (cheap UX only, same "API is still source of truth" comment `ContactForm.tsx`
already carries) is recommended but not itemised as its own assertion — the server-side round
trip via A1/A5/A6 is what's actually gated.

---

## Assertion list, each with its named defeating mutation

See `contracts/contract-vendor-form-ui.yaml`'s own per-assertion `description` fields — kept in
sync there rather than duplicated here to avoid drift between the two documents.

---

## What this contract does NOT prove

- **No live render of `VendorRegisterForm.tsx` itself, and no simulated user interaction.**
  `useState`/`onChange`/`onSubmit` event sequences need a real DOM (jsdom or a headless browser),
  which this project does not currently depend on. A1/A5/A6 prove the pure logic each event
  handler will call; A4/A7 prove the presentational pieces render correctly in isolation. The
  actual wiring — does typing in a field really update state, does clicking submit really call
  `fetch` with the right body, does a 429 response really flip the status state machine to show
  the banner instead of silently swallowing it — is real code a human or QA must read and, per
  the dispatch brief, verify with **BrowserAgent screenshots at 1440px, 375px, and 320px against
  a running dev server** before the feature is called done. This is not optional polish; it is
  the only place this contract's "no simulated interaction" gap gets closed.
- **No real HTTP round trip against the live `/api/vendors/register` route.** F5's own contract
  already proves the route end-to-end (including its A9 real-server rate-limit test); this
  contract only proves the client sends a body that route's real validator accepts (A1) and
  handles every shape that route can really return (A5/A6). Whether the browser's `fetch` call
  actually reaches a running Next server with the right headers/CORS is unverified here.
- **No visual/aesthetic verification.** Per the dispatch brief, "no invented brand styling" is a
  structural/lint-level check (A10) plus a human/BrowserAgent read against `ContactForm.tsx`'s
  existing look — not something a compiler-driven check can judge.
- **No genuine keyboard-navigation or focus-order proof.** A7 is a structural proxy (native tags,
  no negative `tabIndex`, a `focus:` class declared) exactly like F3's A7 was for its responsive
  grid — real Tab-key traversal order and real visible-focus-ring rendering need a browser.
- **No proof the honeypot actually blocks a bot**, or that the client-side required-field
  pre-check (if implemented) matches the golden's 9 keys — neither is itemised as its own
  assertion; both are recommended in the "Field ↔ API mapping" section above but left to
  code review.
- **No route-collision guard beyond A9's link + F3-regression check.** If some other in-flight
  feature also lands at `/national-show/vendors/register` concurrently, this contract cannot
  detect that.
- **No accessibility check beyond label/id association, `role="alert"`/`role="status"`, and
  keyboard-reachability proxies** — no colour-contrast check, no screen-reader announcement
  timing check, no full WCAG audit.
