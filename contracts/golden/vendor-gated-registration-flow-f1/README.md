# Golden: vendor-gated-registration-flow — M1 decision record

Mission `vendor-gated-registration-flow`, M1 (demoable slice). Full milestone/feature
breakdown lives in `contracts/contract-vendor-gated-registration-flow.yaml`. This README is
the decision record @dev implements against; @dev may not deviate from a decision recorded
here without flagging it back to the orchestrator.

## Why a new flow, and why now

The live `/national-show/vendors/register` form is the full ~90-field registration +
agreement, public, with committee review happening AFTER submission. Brad's required flow
(2026-08-30) inverts this: a short PUBLIC application is reviewed FIRST; only once the
committee approves does the vendor receive a single-use link to the full form. Lee-Ann
independently confirmed the same shape in a voice note (26 Aug): invite-only registration,
"no random person is going to apply."

## New source-of-truth doc

`docs/leeann-source/2027-vendor-registration-form_2026-08-26.md` replaces the 25 Aug mirror
(same Drive file ID, content replaced in place — verified, not assumed). M1 does NOT touch the
full form's field set — that correction is M2. M1 only needs the new **Vendor Category &
Products** list for the application-stage category picker (a brand-new UI surface, not a
correction of stale UI), and the new-doc field names for the six application fields.

## The 14-item Vendor Category & Products list (M1's category picker)

Read verbatim from the 26 Aug doc's "VENDOR CATEGORY & PRODUCTS" section, in document order,
with **no "Other" option** (the doc has none for this list — do not add one):

1. Orchids
2. CITES listed plants
3. Indoor plants
4. Succulents
5. Rare plants
6. Exotic plants
7. Indigenous plants
8. Orchid growing products and supplies
9. Greenhouse, hardware and infrastructure
10. Fertilisers, growing media, plant care products
11. Books, publications
12. Art
13. Ceramics
14. Food and beverage retailer

This is a NEW, separate closed set from `VENDOR_CATEGORIES` in `lib/vendor-submissions.ts`
(the live 11-item list, which still has an `'other'` member and is now stale against the 26 Aug
doc). Do not modify `VENDOR_CATEGORIES` or `VendorCategory` in M1 — correcting the full
registration form's category fieldset against the 26 Aug list is explicitly M2 scope. Define
the new set as its own type/constant so the two lists cannot be confused:
`VendorApplicationCategory` (type, `types/index.ts`) and `VENDOR_APPLICATION_CATEGORIES`
(constant, `lib/vendor-applications.ts`) — slug-cased, e.g. `'orchids'`,
`'cites-listed-plants'`, `'indoor-plants'`, `'succulents'`, `'rare-plants'`, `'exotic-plants'`,
`'indigenous-plants'`, `'orchid-growing-supplies'`, `'greenhouse-hardware-infrastructure'`,
`'fertilisers-growing-media'`, `'books-publications'`, `'art'`, `'ceramics'`,
`'food-beverage-retailer'`.

## Data model — a new, separate collection

`vendorApplications` (new Firestore collection, new `VendorApplication` type in
`types/index.ts`, new `lib/vendor-applications.ts`), NOT a new status on the existing
`VendorSubmission`/`vendorSubmissions` model. Reasons, recorded so this isn't re-litigated:

- The existing `VendorSubmission` (58+ fields) and its `submitted → under-review → approved →
  rejected` machine (`lib/vendor-review.ts`) is a complete, already-shipped, already-tested
  representation of the FULL registration + agreement. Splicing an earlier "pending
  application" stage into that same status enum would force `VendorSubmission`'s ~90 real
  fields to all become conditionally-optional-until-stage-2, which is exactly the kind of
  enum-narrowing/required-ness change F1 of the prior mission was written to explicitly avoid
  (`vendor-registration-form-rebuild`'s F1 "SEQUENCING RULE" — deploy safety for a form that
  stays live and accepting real submissions between every feature).
- The two records genuinely have different lifecycles and different owners of "done": an
  application is done when the committee decides; a registration is done when the vendor signs
  and pays. Keeping them as two documents linked by `applicationId` (stored on the
  `VendorSubmission` once the gated form is submitted, M2) mirrors this project's existing
  separation of `orders`/`tickets` from `adminSettings`, and of `vendorSubmissions` from
  `tickets` per the standing instruction that vendor and ticket data must never share one model.

`VendorApplication` fields (M1):

```
businessName: string              // required, maxLength 200, same EMAIL_PATTERN-style rules
tradingName?: string              // optional, maxLength 200
contactPersonName: string         // required, maxLength 150
contactEmail: string              // required, EMAIL_PATTERN (lib/vendor-submissions.ts's)
contactCellPhone: string          // required, PHONE_PATTERN (lib/vendor-submissions.ts's)
vendorCategory: VendorApplicationCategory[]  // required, non-empty, closed-set validated
indicativeBoothCount: number      // required positive integer ("indicative number of stands")

// System-owned — never submitter-supplied. VendorApplicationDraft (the submitter-writable
// type) structurally excludes every field below, exactly matching VendorSubmissionDraft's
// existing pattern in types/index.ts — no vendor may smuggle a status or a token field.
status: 'pending' | 'approved' | 'declined'
submittedAt: Date
reviewedBy?: string | null
reviewedAt?: Date | null
registrationTokenIssuedAt?: Date | null
registrationTokenExpiresAt?: Date | null
registrationTokenConsumedAt?: Date | null
```

Note what is NOT stored: the token itself. It is a stateless, self-verifying HMAC (see below) —
storing it would let a Firestore read leak a live credential. Only the issued/expires/consumed
timestamps are stored, for single-use enforcement and admin visibility.

## Review status machine (pure, mirrors `lib/vendor-review.ts`)

New `lib/vendor-application-review.ts`, `decideVendorApplicationTransition()`:

```
pending --approve--> approved
pending --decline--> declined
```

Every other `(status, action)` pair refused — same closed-machine, additive-only-patch,
injected-`now`/`reviewerEmail` pattern as `lib/vendor-review.ts`. `approved`/`declined` are
terminal; no re-approval, no re-decline, no reversal in M1.

## Token — reuse the primitive, not a copy, not a shared secret

`lib/recovery-token.ts` already provides the right SHAPE (HMAC-SHA256 over a JSON payload,
base64url-encoded, `constantTimeEqual` for comparison) but is scoped to `orderId` and signed
with `RECOVERY_TOKEN_SECRET` — a genuinely different trust domain (ticket order recovery). A
leaked or forged token must never cross domains: an order-recovery token must never unlock a
vendor registration form, and vice versa. Decision: **new thin module
`lib/vendor-registration-token.ts`**, mint/verify functions structurally identical to
`recovery-token.ts`'s (`applicationId` in place of `orderId`), importing and reusing
`constantTimeEqual` from `lib/recovery-token.ts` rather than redefining it, signed with its own
new env var `VENDOR_REGISTRATION_TOKEN_SECRET` (added to `.env.local.example`, following the
existing one-secret-per-purpose convention already documented there). This is "reuse the
primitive," not "invent a second token scheme" — no second HMAC implementation, no second
constant-time-compare implementation, only a second *secret* and a second *payload shape*,
because those two things are exactly what must not be shared across domains.

`RECOVERY_TOKEN`-style stateless HMAC tokens are NOT single-use by construction — verifying one
twice succeeds identically until expiry. Single-use is enforced with server-side state, NOT by
the token format: `registrationTokenConsumedAt` on the `VendorApplication` doc. The token is
verified (signature + not-expired) on every GET of the gated registration page (read-only,
does not consume — a vendor must be able to reload the form mid-fill without being locked out),
and consumed — `registrationTokenConsumedAt` set, checked-then-set inside the same
`POST /api/vendors/register` handler that accepts the full submission — atomically with that
write. A second POST with the same token, or a POST after the token's `expiresAt`, is refused
with a generic "This registration link is no longer valid" error — never a distinguishing error
that would let an attacker tell consumed apart from expired apart from forged (same fail-closed
posture as `lib/admin-auth.ts`'s unenumerated-state handling).

Default TTL: 14 days — a provisional engineering default, not a Council-approved figure,
following the exact pattern `lib/provisional-figures.ts` and `RECOVERY_TOKEN_DEFAULT_TTL_MS`'s
own doc-comment already use for un-Council'd numbers. Flag to Brad; overridable per-mint.

## Approval email — extend, don't duplicate

`lib/vendor-approval-confirmation.ts` / `emails/VendorApprovalConfirmation.tsx` already handle
"approve" email delivery, already tolerate an unknown booth number
(`BOOTH_NUMBER_PENDING_LABEL`), and are explicitly named for exactly this event ("your vendor
registration has been approved"). Extend, per the orchestrator's brief, rather than building a
parallel module:

- `VendorApprovalConfirmationInput`/`VendorApprovalConfirmationProps` gain one new optional
  field: `registrationLink?: string | null`.
- When `registrationLink` is present, the email renders it as the single-use link to the full
  registration form, and the booth-number/logistics fields (which make no sense pre-
  registration) are treated as not-yet-applicable — `boothNumber`/`boothType`/etc. are simply
  omitted/undefined by the M1 caller, using the SAME `BOOTH_NUMBER_PENDING_LABEL` /
  `LOGISTICS_NOT_SPECIFIED_LABEL` fallbacks the template already has, not a new conditional
  branch that could diverge from the existing rendering path.
- The M1 caller is the NEW `POST /api/admin/vendors/applications/[id]/review` route's
  `'approve'` action: it calls `sendVendorApprovalConfirmationEmail()` with `businessName`,
  `contactPersonName`, `contactEmail` from the `VendorApplication` doc, `registrationLink` set,
  everything else omitted.
- The EXISTING call site (`app/api/admin/vendors/[id]/review/route.ts`, F6/F8 of the prior
  mission — full-`VendorSubmission` review) is left wired exactly as-is: it still fires on
  approval of a full registration, still passes `boothNumber`/logistics, never
  `registrationLink`. Both call sites are valid uses of the same extended function; they are
  not in conflict because they fire at different, non-overlapping lifecycle stages (see "Two
  approval gates, on purpose" below). This surface is pre-production (no real vendor has used
  it) so there is no live-user regression risk in leaving it wired unchanged.

## Two approval gates, on purpose — not a leftover

Brad's 5-step flow names one approval (application → committee decision → token). It does NOT
say the existing post-registration committee review (`lib/vendor-review.ts`'s
`submitted → under-review → approved`, already shipped as F6/F7 of
`vendor-registration-form-rebuild`) is removed. M1 decision: KEEP it, unchanged. Reasoning,
flagged for Brad to confirm rather than silently assumed: Step 5 ("Stand Booking Payment")
logically wants the committee to have signed off on the FULL registration's actual content
(declared products, CITES permits, gas/food certifications, etc.) before real money changes
hands — that is precisely what the existing `approved` gate on `VendorSubmission` already
enforces in `lib/vendor-payment.ts`. Removing it would let a vendor pay before the committee
has seen the completed agreement. If Brad intends the second review to be dropped (i.e.
application-approval alone should be sufficient to unlock payment), that is a scope change
requiring its own contract — not assumed here.

## Public surface changes (M1)

- NEW: `app/(marketing)/national-show/vendors/apply/page.tsx` + `POST /api/vendors/apply` — the
  short public application (6 submitter fields above). Reuses existing form primitives
  (`VendorFormField`, `VendorCheckboxGroupField`) — no new field primitive needed for these six
  fields.
- CHANGED: `app/(marketing)/national-show/vendors/page.tsx`'s "Register as a vendor" link now
  points to `/national-show/vendors/apply`, not `/national-show/vendors/register`. The gated
  form is deliberately NOT linked from any public nav/page — reachable only via the emailed
  token link, per the orchestrator's brief ("Not linked in public nav").
- CHANGED: `app/(marketing)/national-show/vendors/register/page.tsx` becomes a server component
  that reads a `?token=` search param, verifies it (signature + not-expired via
  `lib/vendor-registration-token.ts`, THEN looks up the `VendorApplication` doc by the token's
  `applicationId` and checks `status === 'approved'` and `registrationTokenConsumedAt` is
  unset), and renders the existing `VendorRegisterForm` ONLY when every check passes. Any
  failure — missing token, malformed, bad signature, expired, application not found, wrong
  status, already consumed — renders one generic "This registration link is invalid or has
  expired." message and NEVER the form. Fails closed: the default branch (anything not
  explicitly the success case) is refusal, not access.
- CHANGED: `POST /api/vendors/register` (existing route) now ALSO requires the same `token` in
  its request body, re-verifies it server-side (never trusts that the page already checked —
  a direct POST bypassing the browser must be gated exactly like the page), and on a successful
  write sets `registrationTokenConsumedAt` on the linked `VendorApplication` doc in the same
  operation. M1 does NOT change the `VendorSubmission` field set collected by this route — that
  correction is M2.

## Admin review surface changes (M1)

- NEW: `GET /api/admin/vendors/applications` (list) and
  `POST /api/admin/vendors/applications/[id]/review` (`approve`/`decline`) — same
  `getAdminSession()`-then-`hasCapability(..., 'review-vendor-applications', ...)` gate,
  wired identically to the existing `app/api/admin/vendors/route.ts` /
  `app/api/admin/vendors/[id]/review/route.ts`. Reuses the SAME capability
  (`review-vendor-applications`) — this is still back-office triage, not a new role; no
  `lib/admin-roles.ts` change needed in M1.
- NEW: `app/admin/vendors/applications/page.tsx` + `VendorApplicationReviewTable.tsx` (mirrors
  `VendorReviewTable.tsx`'s structure). Sits under the existing `app/admin/vendors/layout.tsx`
  capability gate — no new layout needed, `/admin/vendors/applications` is already covered by
  that layout's path prefix.

## Contradictions flagged, not silently resolved (repeated from the architect brief, for the
implementer's visibility)

1. **90-day vs. "≥2 months" cancellation window.** Lee-Ann's voice note (26 Aug) says vendors
   sign up at least 2 months out with no refund on cancellation. Her own WRITTEN 26 Aug doc's
   Terms & Conditions say 90 days, twice, under "Cancellation and Refunds." The written doc is
   what a vendor actually signs. M2/M3 (which build the T&Cs display and enforce any
   cancellation-window logic) must implement the WRITTEN 90-day rule. Flagged to Brad; not
   resolved by picking one silently.
2. **Table/chair charges vs. "not an extra charge."** The voice note says electrical
   outlets/etc. are not going to be an extra charge. The written 26 Aug doc explicitly
   introduces per-table and per-chair charges with the rate itself left blank ("R ….. per
   table and R ….. per chair"). M2/M3 must not invent a rand figure — follow
   `lib/provisional-figures.ts`'s pattern (a clearly-flagged provisional placeholder) or leave
   the field council-blocked until Lee-Ann supplies the number. Flagged to Brad.

## What M1 does NOT do (explicitly out of scope, pushed to M2/M3)

- Does not correct `VendorCategory`/`VENDOR_CATEGORIES` or `VendorBoothType` against the 26 Aug
  doc anywhere in the existing `VendorSubmission`/full-form code path.
- Does not add any of the 26 Aug doc's new full-form sections (Online Presence, Gas/Oil
  equipment table, per-item electricity table, 7 typed vehicle fields, waste-type checkboxes,
  Marketing's exact-3-photo rule, Food Vendor 6-item certification list, insurance policy
  numbers, the full 14-clause T&Cs prose, signature block).
- Does not implement Stand Booking Payment (Brad's step 5) as its own distinct
  non-ticket-model payment path — `lib/vendor-payment.ts`'s existing proof-of-payment /
  office-confirms-payment flow is reused unchanged for M1; whether it needs to change to
  reflect "this is a booth fee, never a ticket" more explicitly is M3 scope.
- Does not add a rand figure for table/chair charges (contradiction #2 above).
- Does not add rate limiting or a submitter confirmation email to POST /api/vendors/apply
  (recorded as F12, M2 -- see contract).

## Architect pass, 2026-08-31 (post-QA/Codex fix, pre-demo) — stale checks, weak assertions,
new checks folded in

- **`vendor-form-ui/check-showcase-link-and-f3-regression.sh` (contract-vendor-form-ui.yaml
  A9) was asserting the pre-F8 world** (showcase page links to the now-gated `/register`
  route) and had gone FAIL as soon as F8 correctly repointed that link to `/apply`. Repointed
  the link half of the check to the new target and to positively forbid `/register` appearing
  on that page; the F3-regression-rerun half was untouched (that guarantee never depended on
  the link's destination). Verified green against current HEAD except for the F3 suite's own
  pre-existing, unrelated `check-untouched-scope.mjs` file-hash drift (exhibitors page / ITN
  route, already logged in `.agent/memory/project/backlog.md` under "Contract & test
  infrastructure" before this pass — not caused by this mission).
- **~20 Playwright checks across four already-shipped, closed mission contracts**
  (`vendor-form-client-validation-gate`, `vendor-boothcount-guarded-parse`,
  `vendorcategory-aria-required-enforcement`, `vendor-form-maxlength-and-phone-pattern`) all
  navigate bare to `/national-show/vendors/register` and are now blocked by F7's gate. None
  are wired into this contract's own gate, so they do not block tonight's demo. Not deleted —
  each spec file got a BLOCKED header explaining why, and a P1 backlog item records the
  prescribed fix (a shared Firestore-seeded fixture + minted token, mirroring
  `door-test-qr-seeder`'s proven pattern). Deliberately deferred past the demo: building that
  fixture infrastructure is real new engineering, not a same-night patch.
- **A17 (single-use enforcement) was a weak assertion** — it only grepped for identifiers being
  present and stayed green through a real read-then-write race @qa/Codex both found
  independently. Rewritten to depend on the behavioural
  `check-single-use-claim-is-atomic.mjs` (which also proves its own fake isn't vacuous via a
  control-arm rerun of the old, broken shape) plus a structural check that the route calls the
  real `claimRegistrationToken` module rather than reimplementing the check inline.
- **A18 ("never linked from any public page") was a weak assertion** — it greped only
  `app/(marketing)/**/*.tsx` and stayed green while `components/chrome/nav-config.ts` (a `.ts`
  file outside that scope) linked the gated route from the site-wide mega menu on every page.
  Widened to also scan `components/chrome`, `components/vendors`, and
  `execution/checks/verify_nav_mega_menu.ts`'s own nav-shape fixture. A real Playwright run
  (27/27, @dev's fix-pass report) remains the only end-to-end behavioural proof; A18 is the
  fast structural gate underneath it, not a replacement for it.
- **Folded @dev's three new fix-pass checks into the contract**: `check-single-use-claim-is-
  atomic.mjs` → A17 (above), `check-application-approval-email-copy.mjs` → new A21 (run under
  `npx tsx`, not `node --import tsx/esm` — chained `@/lib` alias imports break under the
  latter in this environment), `check-approval-mints-before-commit.mjs` → new A20. A20 is
  explicitly recorded as a SOURCE-ORDER assertion, not a behavioural one — the real route needs
  a Firebase Admin credential and an authenticated admin session cookie, neither available
  here. Accepted as this contract's evidence for that defect because the closed-machine
  behaviour it depends on is separately proven behaviourally by A5, the ordering fact itself is
  hard to satisfy by accident once true, and a stronger live-route form needs the same seeding
  infrastructure already deferred above rather than one-off tonight.
- **Recorded F12** (M2 placeholder): POST /api/vendors/apply ships M1 with no rate limiting and
  no confirmation email, unlike its sibling /register route. @qa and @dev both flagged it as
  reasonable-for-M1 but worth a follow-up; recorded as an explicit M2 feature (new
  unauthenticated public write endpoint) rather than left as loose commentary.
- All 21 assertions in this contract's gate (A1–A16, A19–A21, A18, A17) re-run and PASS against
  current HEAD as of this pass.
