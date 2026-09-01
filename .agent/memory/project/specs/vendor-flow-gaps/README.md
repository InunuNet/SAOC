# Vendor Flow Gaps — Spec & Decision Record

Brad's expected flow, and where it actually breaks down today. This is a planning document —
no code, no contracts. Four gaps, each scoped as its own mission-sized (or milestone-sized)
piece of work.

Brad's full flow, gaps in **bold**:

> vendor registers → **[G1] admin notified, link to approve** → admin approves → **[G2] vendor
> logs in** → gated form → submit → **[G1] admin notified** → admin approves → **[G2] vendor
> logs in**, pays → vendor gets email **[G3] with QR / payment details** → **[G1] admin
> notified vendor paid** → admin **confirms payment logged, for refunds** → admin **[G4] door
> check-in via QR + booking reference**.

---

## G1 — Admin notification emails

### What exists

Three vendor-facing send sites, all vendor-only `to:`:
- `lib/vendor-registration-confirmation.ts:42` — sent from `app/api/vendors/register/route.ts`
  on **full-registration** submit (writes to `VENDOR_SUBMISSIONS_COLLECTION`, gated by the M1
  registration token). The short application form (`app/api/vendors/apply/route.ts`, writes to
  `VENDOR_APPLICATIONS_COLLECTION`) currently sends **no** vendor-facing confirmation at all —
  a fifth gap worth folding into this mission's scope, not a separate one: it's the same
  "confirm receipt" pattern, just missing at the earlier step.
- `lib/vendor-approval-confirmation.ts:73` — sent when admin approves (application or full
  submission), from `app/api/admin/vendors/applications/[id]/review/route.ts` and
  `app/api/admin/vendors/[id]/review/route.ts`.
- `lib/vendor-stand-payment-notice.ts:41` — sent from
  `app/api/admin/vendors/[id]/resend-payment-link/route.ts` (and the review route's approval
  path) when the stand-payment link is minted.

Nothing sends anywhere on: application submitted, full registration submitted, or payment
received. `ADMIN_EMAIL_ALLOWLIST` (`lib/admin-auth.ts:31`, `.env.local.example:17`) already
exists as an env-var comma list of admin emails, gating `/admin` login — the only present
notion of "who is an admin" in this codebase. It is authorization state, not a notification
list, but it is the only existing source of admin addresses and reusing it (read-only, never
gating on it for notification purposes) avoids inventing a second admin-roster.

### What must build

Three new sender modules — `lib/vendor-application-admin-notice.ts`,
`lib/vendor-submission-admin-notice.ts`, `lib/vendor-payment-admin-notice.ts` — following the
exact injectable-mailer pattern every existing vendor-email module already uses (`deps.mailer`
default to real `sendEmail`, POPIA no-logging rule, from `FORMS_FROM_ADDRESS`). Each is called
from the same route that already fires the vendor-facing email, immediately after it, so one
mission event never sends only one side of the pair:
- `app/api/vendors/apply/route.ts` → send both a new vendor-facing "we received your
  application" confirmation (missing today, see above) AND notify admin, with an admin-review
  link (`/admin/vendors/applications/{id}`, gated by the existing session auth).
- `app/api/vendors/register/route.ts` (full-registration submit) → also notify admin, review
  link.
- stand-payment webhook / success handler (wherever `VendorStandOrder.status` flips to `paid`)
  → also notify admin.

Recipients: parse `ADMIN_EMAIL_ALLOWLIST` and send to all of them (or a dedicated
`VENDOR_NOTIFY_EMAIL_ALLOWLIST` if Brad wants a narrower list than full admin login access —
open question below). Failure mode matters: an admin-notify email must never block or fail the
vendor-facing transaction — same "log loudly, never throw" pattern `app/api/admin/checkin/
route.ts:60-73`'s audit-write failure handling already uses for a non-critical side-effect.

### Testable assertions
- Application submit, full-registration submit, and payment-confirmed each produce exactly one
  admin-addressed send in addition to the existing vendor-addressed send (grep the route for
  two `mailer.send`/two sender-module calls, or golden-file assert on call count in a route
  test with an injected fake mailer).
- Admin notice `to:` resolves from `ADMIN_EMAIL_ALLOWLIST`, never from anything the vendor
  submitted (no `contactEmail` reachable in the admin sender's `to` computation).
- A thrown/rejected admin-notify send does not propagate — the route's response and the
  vendor-facing send are unaffected (unit test with a mailer fake that always rejects).
- No PII (businessName/contactEmail/contactPersonName) reaches a `console.*` call anywhere in
  the three new files (matches the existing static-source check pattern the other three vendor
  email modules already carry).

### Scale estimate
Small — 3-4 days (was 2-3 for admin-only; +1 day for the missing application-submit vendor
confirmation folded in above). Four near-identical sender modules copied from an existing
three-file pattern, four call sites wired in, no new data model, no new UI screen.

---

## G2 — Vendor return access ("vendor logs in")

### What exists

No vendor accounts anywhere. Two separate short-lived, single-purpose credentials already
exist for different steps of the SAME flow:
- `lib/vendor-registration-code.ts` + `lib/vendor-registration-code-verify-handler.ts` —
  business-name + 4-digit code, 30-minute session, unlocks the gated full-registration form
  once (M2/F24).
- `lib/vendor-stand-payment-token.ts` — signed, 30-day, reusable (not single-use) HMAC token
  scoped to one `vendorSubmissionId`, delivered as a link, re-verifies submission state on
  every use (doc comment, lines ~18-24).

Brad's "vendor logs in" is not describing a login system — re-reading the flow, every point
where he says it, the vendor already holds a link mailed to them from the immediately-prior
step (approval email → registration link; payment-ready email → payment link). What he's
naming is **return access**: the ability to come back to that link later and still have it
work, which the stand-payment token already provides and the M1 registration-code session
(30-minute expiry) does not.

### The decision this needs, not a guess

Building vendor accounts (email+password or magic-link login, a session, a "my submissions"
page) would be a genuinely new, standing credential surface on a project that has already had
one self-signup security hole (`project_admin_auth_hole` memory — pre-registration against
`admin-grant.ts` was left open by an earlier gap). A second authentication system, sized to
~20-30 vendors per show, is a large security surface for a small population, and Brad's own
described flow never actually requires a vendor to *authenticate* generally — it requires them
to *reopen a specific link they were already emailed*. That is the recovery-token pattern
(`lib/recovery-token.ts`) this project already uses for ticket orders, not a login.

**Recommendation: extend the existing token-link pattern, don't build accounts.**
Concretely: mint the stand-payment token's long-TTL, re-verify-on-every-use pattern for BOTH
remaining gated steps too — a long-lived (e.g. 30-day) link back to "my application status"
and a long-lived link back to "my submission status", both re-verified against current
Firestore state on every load exactly like the payment token already is. No password, no
session cookie, no new Firebase Auth surface. This is consistent with `project_admin_auth_hole`
lesson: don't add a credential surface broader than the actual need.

The one open question genuinely for Brad/council, not an engineering call: **does a vendor
need to check status themselves before the next milestone email arrives, or is "we'll email you
at each step" (the current design) already sufficient?** If every step is going to email a
fresh link anyway (G1 covers the notify side), a persistent "vendor portal" adds a feature Brad
described in shorthand but may not need built. Confirm this before scoping it further — it
changes G2 from "3-4 days, extend an existing pattern" to "not needed at all."

### Testable assertions (if built)
- A status-recovery token verifies only against its own scoped id (`applicationId` /
  `vendorSubmissionId`) and expiry — same structural domain separation the three existing token
  modules already have (distinct payload key, distinct secret).
- Token re-verifies live Firestore state on every use, never trusts a cached status from mint
  time (matches the payment token's own documented rule).
- No token grants any `/admin` capability — reject any check that imports `lib/admin-auth.ts`
  or `lib/admin-roles.ts` from the new module (same rule `lib/recovery-token.ts`'s own comment
  states for itself).
- Expired or malformed token produces the same clean refusal shape used by the recovery-token
  and vendor-registration-token verifiers — no stack trace, no information leak.

### Scale estimate
3-4 days if built as token-link extension (reuses `lib/recovery-token.ts`'s primitives almost
directly). Would be 2-3 weeks if built as real accounts (Firebase Auth vendor tier, password
reset, session handling, a new `/vendor` authenticated area) — flagging the gap explicitly
because the two readings of "vendor logs in" are an order of magnitude apart in cost, which is
exactly why this is the one to confirm with Brad before either is built.

---

## G3 — QR code / payment details on the confirmation email

### What exists

`lib/qr.ts` already generates both a data-URI QR (`generateBookingRefQrDataUri`) and a raw PNG
buffer for Resend CID-inline attachment (`generateBookingRefQrPngBuffer`) — built for
`Ticket.bookingRef`, used by the ticket confirmation email and `DownloadTicketButton.tsx`.
`VendorStandOrder` (`types/index.ts:941`) already has `standOrderRef` (`VSO-{vendorSubmissionId}`
format, line ~958) — a booking-reference-shaped string, but nothing currently encodes it as a
QR or puts it in an email. No `VendorStandPaymentConfirmation`-type email exists at all today —
`lib/vendor-stand-payment-notice.ts` sends the *pay now* link, not a *you're paid, here's your
reference* confirmation.

### What must build

A new send site, fired when `VendorStandOrder.status` flips to `paid` (same webhook/handler
that will fire G1's payment admin-notice): a new email component + sender module
(`lib/vendor-stand-payment-confirmation.ts`) reusing `generateBookingRefQrPngBuffer` against
`standOrderRef` exactly as the ticket flow already does, CID-attached the same way.

### The decision this needs, not a guess

**Does a stand booking need a QR at all?** A ticket QR exists because a ticket is scanned once,
fast, in a queue of hundreds of general-admission attendees on a single door, and the scanner
already looks a booking up by `bookingRef` string match — the QR is purely an input-speed
optimization over typing a code. A vendor stand is a single load-in event per vendor (maybe ~20-
30 vendors total, per `project_vendor_ticket_linkage_open_question`), occupied for four days,
checked once at setup, likely by a human who already knows which vendor is arriving. A
booking reference vendor staff can read aloud or type may be entirely sufficient, and skipping
the QR removes one attack surface (a photographed/forwarded QR image) for a credential that
does not need scan speed. This is a genuine product call, not an implementation detail —
recommend surfacing exactly this trade to Brad rather than defaulting to "reuse the ticket
pattern because it's there."

If the answer is "reference only," this shrinks to formatting `standOrderRef` into the existing
`lib/vendor-stand-payment-notice.ts`-style email — no `lib/qr.ts` reuse, no CID attachment
plumbing, roughly half the estimate below.

### Testable assertions
- Confirmation email fires exactly once per `VendorStandOrder` transition to `paid` (not on
  every webhook retry — idempotency guard on `paidAt` already being set, matching whatever
  idempotency the stand-payment webhook route already uses for status transitions).
- If QR is built: the QR decodes back to exactly `standOrderRef`, verified in a round-trip
  check the same way `ticket-confirmation-email-qr-fix` presumably already tests the ticket
  QR (check that pattern before writing a new one).
- Email contains `standOrderRef` as plain, selectable text even when a QR is also present —
  never QR-only, so a scanner failure or forwarded-without-image email still has a usable
  reference.
- No PII beyond what the vendor already provided reaches the email; no log line contains it
  (same rule as every other vendor email module).

### Scale estimate
2-3 days if reusing the QR pattern (mostly copy-shape from the ticket email); 1-2 days if the
answer is reference-only. Either way, small — this is the cheapest of the four gaps.

---

## G4 — Vendor door check-in

### What exists

`app/admin/door/page.tsx`, `app/admin/door/layout.tsx`, and `app/api/admin/checkin/route.ts`
are entirely ticket-scoped — the route looks up `tickets` by `bookingRef`
(`lib/checkin.ts:64-66`), the admission decision table
(`contracts/golden/ticketing-hardening/checkin-admission-rules.golden.md`) only knows
`TicketStatus`, and the audit trail (`lib/checkin-audit.ts`, `recordCheckinAttempt`) is typed
around ticket outcomes (`wrong-show`, `unpaid`, etc.). Nothing in this path references
`vendorSubmissions` or `vendorStandOrders`.

### What must build

This is genuinely the largest of the four, because "reuse the scanner" is right in spirit but
wrong if done as a bolt-on — the admission decision table, the refusal codes, and the audit
outcome enum are all `Ticket`-shaped by design, and the golden README's own stated reasoning
(`lib/checkin.ts:8-18`, extracted specifically so admission rules can't drift between the
scanner and anything else) means a second, parallel vendor-only decision path is the wrong
shape; it would drift the same way the extraction was meant to prevent.

Correct shape: extend the SAME admission surface to a second lookup domain, not fork it.
- A new pure module mirroring `lib/checkin.ts`'s `admit()`/`refuse()` shape but keyed on
  `VendorStandOrder.standOrderRef` instead of `Ticket.bookingRef`, with its own decision table
  (paid → admit once; not paid → refuse; already checked in → refuse) — `VendorStandOrder` has
  no `checkedInAt` field today, so this is also a data-model addition (`checkedInAt: Date |
  null` on `VendorStandOrder`, mirroring `Ticket.checkedInAt`).
  `VendorStandOrderStatus` has no "already checked in" state distinct from `paid`, so
  `checkedInAt` (not a new status value) is the source of truth — consistent with how `Ticket`
  already does it (`status` stays `'paid'`; `checkedInAt` is the separate admitted-or-not
  field).
- `app/api/admin/checkin/route.ts` (or a sibling route, `app/api/admin/checkin-vendor/route.ts`
  — open question below) tries the vendor-order lookup when the scanned reference doesn't match
  the `VSO-` prefix pattern, or the UI offers an explicit ticket/vendor toggle before scanning —
  either way, one scanner screen, not two apps, since Brad's flow describes one door operation.
- The audit trail (`lib/checkin-audit.ts`) needs either a widened `CheckinAttemptOutcome`/
  `recordCheckinAttempt` shape that can carry `orderId: string | null` pointed at either
  collection, or a parallel `vendorCheckinAttempts` audit collection — reuse of the append-only
  audit *pattern*, a design decision on whether it's the same collection.

### Security properties (non-negotiable, matching the ticket scanner's existing guarantees)
- **Once-per-lifetime**: a `VendorStandOrder` already checked in (`checkedInAt !== null`)
  refuses on a second scan, exactly like `already-checked-in` for tickets — this must run
  inside the same kind of Firestore transaction `lib/checkin.ts`'s `admit()` uses, not a
  read-then-write with a race window.
- **Non-forgeable**: `standOrderRef` is looked up in Firestore, never trusted from the scanned
  string alone — an unpaid or fabricated reference must refuse, matching the `unpaid` /
  `not-found` refusal codes' existing behavior.
- **Auth-gated the same way**: this route sits behind the same `getAdminSession()` check
  (`app/api/admin/checkin/route.ts:41-45`) — no new, weaker auth path for "just the vendor
  door."
- **Audit parity**: every vendor check-in attempt (admit and every refusal) produces an
  append-only audit record with the same never-block-the-response guarantee
  (`app/api/admin/checkin/route.ts:60-73`'s pattern) — a vendor door failure must be exactly as
  recoverable and traceable as a ticket door failure, not a silent gap.

### Open questions for Brad
- One scanner screen with an auto-detecting reference format, or a manual toggle? (Affects UI
  scope slightly, not the security core.)
- Shared `checkinAttempts` audit collection with a `kind: 'ticket' | 'vendor'` discriminator, or
  a separate `vendorCheckinAttempts` collection? Either is defensible; picking one is an
  architect-level call at build time, not something to guess now.
- Depends entirely on G3's QR-vs-reference-only answer for what the scanner actually reads.

### Scale estimate
1-1.5 weeks. This is not "wire the existing scanner to a second collection" — it's a genuine
extension of a decision table and audit trail that were deliberately built narrow, plus a new
`checkedInAt` field, a new pure admission module, transactional once-per-lifetime enforcement,
and either an audit-schema widening or a new collection. Treat any estimate under a week for
this one as unrealistic given the transactional/audit rigor the ticket side already required.

---

## Sequencing recommendation

Show is September 2027; immediate need is a working demo. Order by (a) dependency and
(b) cost-to-value for demo purposes:

1. **G1 (admin notifications) first.** Smallest (2-3 days), zero new data model, and it's the
   piece Brad will notice missing on every single demo run-through — every approval step today
   requires someone to already know to go check `/admin`. Highest visible-broken-ness per hour
   spent.
2. **G3 (QR/payment confirmation) second**, but only after Brad answers the QR-vs-reference
   question — resolve that question in parallel with #1, don't block on it. Small, and it's the
   piece a demo audience visually associates with "this system works" (an email arriving with a
   real confirmation).
3. **G2 (return access) third** — genuinely depends on Brad's answer to whether it's needed at
   all (see G2's open question). If the answer is "no, email-at-each-step is enough," skip it
   entirely and the mission list shrinks to three. Don't build this speculatively.
4. **G4 (door check-in) last.** Largest and most security-sensitive; also the piece with the
   longest runway before it's actually needed — nobody checks a vendor in at a door until the
   show itself, seven months out. Building it under demo time-pressure is the wrong way to get
   the once-per-lifetime/non-forgeable guarantees right; it deserves the same unhurried,
   contract-and-golden-file rigor the ticket scanner got.

**Do not build G2 and G4 for a near-term demo.** Both are either possibly-unneeded (G2, pending
Brad's answer) or high-risk-if-rushed (G4). G1 and G3 alone close the two gaps Brad will
actually see in a walkthrough: admins finding out something happened, and vendors getting a
real confirmation.
