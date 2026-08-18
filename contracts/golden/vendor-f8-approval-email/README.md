# F8 (vendor-registration) — vendor approval confirmation email: decision record

Full source: mission brief inline F8
(`.agent/memory/project/missions/2026-08-17-vendor-registration.md`), the shipped F6 review
route (`app/api/admin/vendors/[id]/review/route.ts`), F7's booth-allocation admin route
(`app/api/admin/vendors/[id]/payment/route.ts`), F5's confirmation-email pattern
(`lib/vendor-registration-confirmation.ts` + `emails/VendorRegistrationConfirmation.tsx`), and
`lib/confirmation-email.ts`'s `deliverConfirmationEmailAfterCommit` (ticketing-foundation
F10/F11's write-commits-first posture).

## What this feature is

Two new files and one edit: `lib/vendor-approval-confirmation.ts` (the injectable-mailer send
function, mirroring F5's `lib/vendor-registration-confirmation.ts` exactly),
`emails/VendorApprovalConfirmation.tsx` (the template, with two exported pure formatting
helpers), and a wiring edit to `app/api/admin/vendors/[id]/review/route.ts` that calls the send
strictly after the status-transition write commits, through the real
`deliverConfirmationEmailAfterCommit`. No new capability, no new `VendorSubmission` field, no
change to `lib/vendor-review.ts`'s closed transition machine.

## Trigger point — approve only, never booth allocation — the judgement call

The mission brief's own F8 title is unambiguous: "sent on F6 approval." This contract reads
that literally: the email fires from the **F6 review route's `approve` action**, not from F7's
separate booth-allocation/payment route. This was not a free choice — it follows directly from
how F6 and F7 already ship:

- F7's `decideVendorPaymentUpdate()` refuses office-use fields (including `boothNumber`) unless
  `currentStatus === 'approved'` already. A submission cannot reach `approved` without first
  passing through F6's `approve` action. So **approval always happens strictly before booth
  allocation**, never after or concurrently — there is no code path where booth allocation
  could itself be the trigger for an "on approval" email, because by the time a booth number
  exists the submission has already been `approved` for some (possibly long) time.
- Re-reading the brief's own "Done" line closely — "email sends on approval, contains the
  allocated booth number and the vendor's own submitted logistics for verification" — confirms
  the email is expected to exist at approval time, and to *contain* a booth number *if one is
  allocated*, not to wait for one to exist first. Nothing in F6, F7, or the mission brief
  describes a second "booth allocated" email as a distinct event.

**Consequence, addressed head-on rather than assumed away:** at the moment F8's email actually
sends, `boothNumber` on the just-approved submission will typically still be `null`/`undefined`
— booth allocation is a separate, later admin action via F7's route. The email must therefore
be honest about "not yet allocated" rather than silently rendering a blank or, worse, the
literal string `"undefined"`. This is exactly what `formatBoothNumber()` /
`BOOTH_NUMBER_PENDING_LABEL` ('To be confirmed') exist to guarantee — see "The undefined gate"
below. This was flagged explicitly in the team lead's own dispatch as a gate this contract must
not skip, and A4 is built specifically to prove it.

**Not built, and deliberately not built:** a second "your booth has been allocated" email fired
from F7's payment route when `boothNumber` transitions from unset to set. The mission brief
names exactly one email for F8 ("Vendor confirmation and booth-allocation email, sent on F6
approval" — singular, one trigger). Firing a second email from a different route on a different
field's first-write would be a materially different feature (its own trigger condition, its own
idempotency question — what if an admin corrects a typo'd booth number after the fact, does
that resend?) that no numbered feature in this mission currently owns. If Lee-Ann/the committee
want vendors notified specifically when a booth number lands, that is a follow-up feature, not
a silent addition to this one.

## Rejection — no email — the judgement call

**Decision: a `reject` action sends nothing.** Three reasons, in order of weight:

1. **The brief's own title scopes F8 to exactly one event.** "Vendor confirmation and
   booth-allocation email, sent on F6 approval" names one trigger. It does not ask for a
   rejection notice, and none of F8's "Done" criteria mention one.
2. **A rejection notice is a materially different email with its own content questions this
   contract has no brief to answer** — does it explain why (F6's `decideVendorStatusTransition`
   carries no "reason" field at all, only `status`/`reviewedBy`/`reviewedAt`); does it invite a
   re-application; is it even Lee-Ann/the committee's preference to notify by automated email at
   all, versus a personal call for something as sensitive as a declined vendor application. None
   of this is decidable from the source document or the mission brief, and inventing an answer
   would be exactly the kind of unrequested content decision this codebase's `CLAUDE.md`
   already warns against ("no invented brand assets" generalizes here to "no invented vendor-
   facing copy for an unscoped event").
3. **Precedent**: F5's own template file already documents its scope boundary as "plain
   acknowledgement copy only... no regulatory permit non-verification note (that is F9's later
   edit)" — this codebase's established pattern is to ship exactly what's asked and name the gap
   explicitly, not to speculatively cover an adjacent case.

This is recorded here as a decision, not an oversight: A5's route-wiring discriminator proves,
as a first-class defeating mutation, that a build which sends the approval email on `reject`
too (or on `start-review`) is caught and rejected by the gate — "no email on reject" is an
enforced invariant of this contract, not merely an unstated assumption. If Brad/Lee-Ann later
want a rejection notice, that is a new F-number with its own content brief, not a retroactive
edit smuggled into this one.

## Email failure must never block or roll back the status transition

Identical posture to F5/F10's confirmation email and to ticketing-foundation's own order-
confirmation email: the review route's `ref.update(decision.patch)` — the actual authoritative
state change — already happens, and its own try/catch already returns before any email logic is
reached, in the shipped F6 route. F8's edit inserts the email call strictly **after** that
`await ref.update(...)` succeeds, and never inside a code path that could still fail the HTTP
response for an email-only reason. This is not a new isolation mechanism — it is the REAL,
already-shipped `deliverConfirmationEmailAfterCommit` (`lib/confirmation-email.ts`,
ticketing-foundation F10/F11) reused verbatim, exactly as F5's route already reuses it for the
public registration confirmation. A6 proves this specific composition (this function + this
mailer shape) still resolves without throwing on a rejecting mailer and still calls `onError`
exactly once — it does not re-derive `deliverConfirmationEmailAfterCommit`'s own generic
contract, which is already proven elsewhere and out of scope to re-litigate here.

## The "undefined" gate — never render a missing field as the literal word "undefined"

This is the single most concrete gate the team lead's dispatch called out by name, and the
contract treats it as such. `emails/VendorApprovalConfirmation.tsx` exports two pure formatting
functions — `formatBoothNumber` and `formatOptionalField` — and every one of the seven
recap fields (`boothNumber`, `boothType`, `staffPerDay`, `powerRequired`, `waterRequired`,
`loadInSlot`, `loadOutSlot`) is routed through one of them before it reaches JSX text. Neither
function ever produces the substring `"undefined"` for a `null`/`undefined`/empty-string input:

- `formatBoothNumber(value)`: trims the value; a non-empty result is returned as-is; anything
  else (missing, `null`, empty, or whitespace-only) returns `BOOTH_NUMBER_PENDING_LABEL` ('To be
  confirmed') — a deliberately vendor-facing-honest label, not a blank.
- `formatOptionalField(value)`: `null`/`undefined`/empty-string → `LOGISTICS_NOT_SPECIFIED_LABEL`
  ('Not specified'); `boolean` → `'Yes'`/`'No'` (so `powerRequired`/`waterRequired` never render
  as the literal words `true`/`false`); anything else → `String(value)`.

A4 proves this with a COMBINED-FAILURE case — every optional field missing at once — precisely
because a formatter that happens to work when only one field is missing (e.g. because of
short-circuit evaluation order) could still fail once several are missing simultaneously; the
combined case is the one that actually stresses the "route every field through the helper,
independently" property the contract requires. It additionally proves the boothNumber-alone and
empty-string-boothNumber cases independently, so a fix that only handles the combined case by
accident (rather than by routing every field through the helpers) cannot pass.

## Route-wiring discriminator — two known-unwired fixtures, not one

F6's own README already documents "the F8 lesson" (ironically, a different F8 — the ticketing-
foundation comp-tickets feature) for exactly this class of gap: a contract that proves a pure
function works but never proves the route actually calls it. This contract's A5 applies that
same lesson to itself. Two independent KNOWN-UNWIRED fixtures are used, because there are two
independent ways to fail:

1. `vendors-review-route-unwired-no-email.fixture.ts.txt` — the email call is missing
   entirely (the route looks exactly like the real, shipped F6 file with no F8 edit at all).
2. `vendors-review-route-unwired-both-actions.fixture.ts.txt` — the email call exists, but
   sits OUTSIDE the `if (body.action === 'approve')` guard (e.g. hoisted to run for every
   action, or duplicated into the `reject` branch too) — the direct encoding of "no email on
   reject" being violated.

Both must be rejected by the discriminator, and the architect-authored WIRED golden
(`vendors-review-route-wired.expected.ts.txt`) must be accepted, before the discriminator is
ever trusted against the real repository file — same self-test-before-trust technique as F6's
A8 and F7's A9.

## No new capability, no new field, no touched F7 file

F8 does not add a capability to `lib/admin-roles.ts`'s `CAPABILITIES` array (the existing
`review-vendor-applications` gate, already checked earlier in the same route handler before
F8's code ever runs, is sufficient — sending a confirmation email is not a new access-control
surface). F8 does not add a field to `VendorSubmission` — every value the email needs
(`businessName`, `contactPersonName`, `contactEmail`, `boothNumber`, `boothType`,
`staffPerDay`, `powerRequired`, `waterRequired`, `loadInSlot`, `loadOutSlot`) already exists on
the document, set by F4/F5's submission builder or F7's payment route. F8 does not touch
`app/api/admin/vendors/[id]/payment/route.ts` or `lib/vendor-payment.ts` at all — A11 proves
this by re-running F7's own regression suite unchanged.

## Reusing the snapshot already in hand — no second Firestore read

The shipped F6 review route already fetches `snapshot = await ref.get()` before deciding the
transition (it needs `currentStatus` from that same read). F8's edit reads the recap fields from
that SAME `snapshot.data()` object — it does not issue a second `ref.get()` call. This keeps the
route's Firestore read count unchanged from what F6 already shipped.

## What this contract does NOT prove

- **A real Resend send actually delivers an email.** Every check here (A2-A6) uses a fixture
  `VendorApprovalConfirmationMailer`, never `lib/email.ts`'s real `sendEmail`/Resend client —
  offline, credential-free, matching F5/F11's own stated limits exactly. A9 proves the module
  never touches Resend directly itself; it does not and cannot prove the real send succeeds.
  This is the mission brief's own F10 human-proof job, not this contract's.
- **That a genuine admin session approving a genuine submission over live HTTP actually
  triggers the email end to end.** A5's discriminator is source-level, for the same reason F6's
  A8/F7's A9 are: proving the real POST handler's behaviour over HTTP requires a live Firebase
  Auth session and a live Firestore project, outside this contract's offline constraint. F10's
  human-proof step is where this gets exercised for real.
- **The exact visible copy/subject line wording, or any visual/HTML-email-client rendering
  quirk** (Outlook's historical handling of certain CSS, dark-mode inversion, etc.) — A3/A4
  prove the rendered HTML is structurally correct and contains the right text; they cannot
  prove what a specific mail client's rendering engine does with that HTML. Same limit F11's
  own README already names for the QR/order-confirmation email.
- **What happens if an admin re-runs the approve action against an already-'approved'
  submission** (F6's closed machine already refuses this — `under-review --approve--> approved`
  is the only edge, and `approved` is terminal, so a second `approve` call 409s before F8's code
  is ever reached). Not re-derived here; already proven by F6's own A5.
- **Whether a future "booth allocated" notification should exist.** Recorded above as a
  deliberate non-decision, not silently dropped.
