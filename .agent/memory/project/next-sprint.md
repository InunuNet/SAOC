# Next Sprint — ordered plan (written 2026-09-02 by @maintainer)

Read this first after compacting. Ordered by urgency; each item states what "done" looks like.
Full backlog remains the source of truth for everything not listed here — see `backlog.md`.

---

## 1. @dev implementation of `vendor-flow-notifications` (M1/F1) — HIGHEST PRIORITY

Why first: the contract and 7 RED-verified checks are already written
(`contracts/contract-vendor-flow-notifications.yaml`,
`contracts/golden/vendor-flow-notifications/README.md`) — this mission is contract-ready, not
started. No production code has been written yet.

Done = the five new files and three wiring edits described in the contract exist, every send is
wrapped in the real `deliverConfirmationEmailAfterCommit` (an admin-notify failure must NEVER
block or fail the vendor's own action), the gate goes green, @qa passes, and the mandatory Codex
GPT-5.5 pass runs clean (`workflow.md`). Mission file:
`.agent/memory/project/missions/2026-09-01-vendor-flow-notifications.md`.

## 2. E2E vendor flow run — blocked all evening, still outstanding

Why second: the live vendor flow (application → admin approval → gated registration → stand
payment) has not been proven end to end against the deployed site since the serialization fix
and the App Hosting secret-access fix landed. Verify via a real run against the live deployment,
not a re-read of gate output — confirm the live revision actually changed first
(`gcloud run services describe saoc-prod --region=europe-west4 --format='value(status.latestReadyRevisionName)'`,
see `learned.md` "App Hosting builds can fail silently for hours").

Done = a real run with screenshots or BrowserAgent evidence, not an inference from a green build.

## 3. A60 rewrite (P1, `contracts/checks/vendor-gated-registration-flow-m3/check-initiate-is-transactionally-idempotent.mjs`)

Why third: confirmed vacuous by mutation testing and independently by Codex GPT-5.5 — it stays
green even with `db.runTransaction()` deleted outright, because the fixture-Firestore Map keys
every write to one document regardless of locking. See `backlog.md` "Contract & test
infrastructure" and `learned.md` "A60 is vacuous and is still unfixed" for the two rewrite paths
already scoped (a genuine lost-update-race fixture, or an assertion isolating the in-transaction
re-check).

Done = the check fails on the same mutation it currently survives, and passes against the real
code unmodified.

## 4. Vendor test-data cleanup decision (P1, new 2026-09-01)

Five test vendor applications sit in the live `vendorApplications` collection
(`JZfHPoxnTSMytCzQgxib`, `UhUGhAjrdRrrl1LSrVDw`, `hi2Figor34cBTwqq76Wm`, `rWSrLFyINIxn3uVSo2gg`,
`injKWpwqvHjOgsVRO6Ye`) — two share the slug `demoorchidnursery`, two share
`zzqslugcollisiontestnursery` (deliberately created to exercise the P0 shared-slug defect). Needs
a delete-or-mark-as-fixture decision from Brad before real vendors use the system — this is data
cleanup, not a code change, so flag rather than delete unilaterally.

## 5. Restore the deferred legacy-order `tier` check for stand pricing (P2, already in backlog)

Real stand payments are now live-capable; the deferred RED check proving a pre-existing
`tier`-less `vendorStandOrders` document still settles and renders identically should land before
the first real vendor payment, not after.

## 6. Register Society — society profile intake + registration flow (P2, blocked)

Blocked on Lee-Ann for the affiliation/approval half — do not scope that half from the
website-information form alone (it only covers content, not affiliation). The profile field set
IS captured and unblocked; an @architect pass on the profile-content model only (public form →
Firestore → admin review, reusing the vendor pipeline's proven shape) can proceed.

---

## Also worth a look, not blocking the above (from backlog, unranked)

- P1 items blocked on Brad (human action): live PayFast credentials, DNS cutover, the 53MB zip in
  git history, the live `roles`-claim migration, rotating `FIREBASE_ADMIN_PRIVATE_KEY`.
- P1 items blocked on the council/Lee-Ann: ticket prices/capacities (draft estimates per standing
  instruction, already partly done), refund/cancellation terms (draft ourselves), POPIA
  Information Officer implementation, Stellenbosch travel content, the two vendor T&Cs
  contradictions.
- P2 cosmetic: `/admin/vendors` is titled "Vendor Applications" but its empty state and list
  actually cover full registrations — reads as a bug when it's telling the truth (new
  2026-09-01).
- P2: no per-application admin detail page (`/admin/vendors/applications/{id}`) exists — the
  notifications contract had to point review links at flat list pages instead (new 2026-09-01).
- These are unchanged from before this session — see `backlog.md`'s "Blocked on Brad" and
  "Blocked on the council / Lee-Ann" sections for full detail. Nothing here needs re-triage this
  sprint unless Brad or Lee-Ann has answered something.
