# Next Sprint — ordered plan (written 2026-09-02 by @maintainer)

Read this first after compacting. Ordered by urgency; each item states what "done" looks like.
Full backlog remains the source of truth for everything not listed here — see `backlog.md`.

---

## 1. E2E vendor flow run — blocked on Brad approving 5 test applications

Why first: the live vendor flow (application → admin approval → gated registration → stand
payment) has not been proven end to end against the deployed site since the serialization fix,
the App Hosting secret-access fix, and now `vendor-flow-notifications` all landed. The blocker is
concrete, not vague — Brad needs to approve (or otherwise dispose of) the five test applications
sitting in `vendorApplications` at
`https://beta.saoc.co.za/admin/vendors/applications` (see item 5 below for the same IDs; approving
some of them IS the unblock, so this and item 5 are two sides of one decision). Once at least one
is approved, run the flow through to a settled stand payment against the live deployment — verify
via a real run with screenshots or BrowserAgent evidence, not an inference from a green build.
Confirm the live revision actually changed first
(`gcloud run services describe saoc-prod --region=europe-west4 --format='value(status.latestReadyRevisionName)'`,
see `learned.md` "App Hosting builds can fail silently for hours").

## 2. Structural guard against handler-deps drift (P1, new 2026-09-02)

Why second: this is the direct, cheap follow-up to the defect class that cost four Codex
GPT-5.5 review rounds during `vendor-flow-notifications`. @architect's recommendation, ~1-2
hours: (a) extend a contracts-wide typecheck config to cover every fixture constructing a handler
deps object; (b) a shared `makeVendorRegistrationDeps()` helper whose default `onEmailError`
captures and asserts zero calls unless a test explicitly expects them. Full detail in
`backlog.md` "Vendor registration". Do this before the next feature touches any vendor handler's
deps shape, or the same defect class recurs on the next dep addition.

## 3. A60 rewrite (P1, `contracts/checks/vendor-gated-registration-flow-m3/check-initiate-is-transactionally-idempotent.mjs`)

Why third: confirmed vacuous by mutation testing and independently by Codex GPT-5.5 — it stays
green even with `db.runTransaction()` deleted outright, because the fixture-Firestore Map keys
every write to one document regardless of locking. See `backlog.md` "Contract & test
infrastructure" for the two rewrite paths already scoped (a genuine lost-update-race fixture, or
an assertion isolating the in-transaction re-check).

Done = the check fails on the same mutation it currently survives, and passes against the real
code unmodified.

## 4. G2/G3/G4 — vendor return access, QR/booking ref, vendor door check-in (still unbuilt)

Why fourth: these are the remaining gaps from the `vendor-flow-gaps` spec after G1
(`vendor-flow-notifications`, DONE 2026-09-02) shipped. No contract or mission exists yet for any
of the three. Needs an @architect pass reading
`.agent/memory/project/specs/vendor-flow-gaps/README.md` before dispatch — do not assume scope
from the gap names alone.

## 5. Vendor test-data cleanup decision (P1, still open, new 2026-09-01)

Five test vendor applications sit in the live `vendorApplications` collection
(`JZfHPoxnTSMytCzQgxib`, `UhUGhAjrdRrrl1LSrVDw`, `hi2Figor34cBTwqq76Wm`, `rWSrLFyINIxn3uVSo2gg`,
`injKWpwqvHjOgsVRO6Ye`) — two share the slug `demoorchidnursery`, two share
`zzqslugcollisiontestnursery` (deliberately created to exercise the P0 shared-slug defect). Needs
a delete-or-mark-as-fixture decision from Brad before real vendors use the system — this is data
cleanup, not a code change, so flag rather than delete unilaterally. Same items as item 1's
blocker: approving them (or some of them) is how item 1 unblocks.

## 6. Restore the deferred legacy-order `tier` check for stand pricing (P2, already in backlog)

Real stand payments are now live-capable; the deferred RED check proving a pre-existing
`tier`-less `vendorStandOrders` document still settles and renders identically should land before
the first real vendor payment, not after.

## 7. Register Society — society profile intake + registration flow (P2, blocked)

Blocked on Lee-Ann for the affiliation/approval half — do not scope that half from the
website-information form alone (it only covers content, not affiliation). The profile field set
IS captured and unblocked; an @architect pass on the profile-content model only (public form →
Firestore → admin review, reusing the vendor pipeline's proven shape) can proceed.

---

## Also worth a look, not blocking the above (from backlog, unranked)

- P1: `deliverConfirmationEmailAfterCommit()` cannot distinguish a code bug from a delivery
  failure (new 2026-09-02) — see `backlog.md` "Vendor registration".
- P1 items blocked on Brad (human action): live PayFast credentials, DNS cutover, the 53MB zip in
  git history, the live `roles`-claim migration, rotating `FIREBASE_ADMIN_PRIVATE_KEY`.
- P1 items blocked on the council/Lee-Ann: ticket prices/capacities (draft estimates per standing
  instruction, already partly done), refund/cancellation terms (draft ourselves), POPIA
  Information Officer implementation, Stellenbosch travel content, the two vendor T&Cs
  contradictions.
- P2 cosmetic: `/admin/vendors` is titled "Vendor Applications" but its empty state and list
  actually cover full registrations — reads as a bug when it's telling the truth (2026-09-01).
- P2: no per-application admin detail page (`/admin/vendors/applications/{id}`) exists — the
  notifications contract had to point review links at flat list pages instead (2026-09-01).
- P2: F5 A9 (`check-http-rate-limit-per-ip.sh`) blocked by a long-lived local `next dev` process
  (new 2026-09-02) — see `needs-human.md`.
- P2: `check-vendor-category-other-not-persisted.mjs`'s header comment documents a run command
  that fails (new 2026-09-02) — see `backlog.md` "Vendor registration".
- These are unchanged from before this session unless flagged "new 2026-09-02" — see
  `backlog.md`'s "Blocked on Brad" and "Blocked on the council / Lee-Ann" sections for full
  detail. Nothing else here needs re-triage this sprint unless Brad or Lee-Ann has answered
  something.
