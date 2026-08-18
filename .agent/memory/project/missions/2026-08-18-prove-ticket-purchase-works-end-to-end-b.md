---
schema: athanor.mission/v1
slug: prove-ticket-purchase-works-end-to-end-b
goal: 'Prove ticket purchase works end-to-end: browse -> checkout -> PayFast sandbox
  payment -> ITN confirmation -> confirmation email/QR -> door check-in. Checkout
  and ITN were both found broken and fixed this session (missing RECOVERY_TOKEN_SECRET;
  App Hosting not auto-deploying on push; ITN source-IP allowlist rejecting genuine
  PayFast notifications; missing-passphrase signature downgrade). A real browser-driven
  sandbox purchase got as far as PayFast payment success and redirect back to the
  confirmation page before the ITN bugs were found -- that run needs repeating now
  that all four fixes are deployed, and the flow needs to continue through to a real
  door check-in scan. All work must go through the full chain (@architect contract+goldens
  -> @dev -> @qa -> Codex cross-model review -> @docs -> gate -> @maintainer) -- the
  orchestrator does not implement, review, or deploy directly for any of this (hard
  rule, see project memory feedback_orchestrator_only_hard_rule).'
created_at: '2026-08-18T20:01:20.444841+00:00'
started_at: null
last_active_at: null
status: pending
cost_estimate:
  features: 0
  milestones: 0
  total_calls: 0
last_checkpoint:
  milestone: null
  feature: null
  ts: null
features:
- id: F1
  title: Verify App Hosting auto-deploy is actually healthy after the tsconfig fix
  status: pending
  inline_brief: 'Prove (via gcloud/firebase CLI + Cloud Logging, not assumption) that a push
    at or after commit 0c577dc triggered an automatic Cloud Build that succeeded and is what
    is actually serving saoc-prod today -- the tsconfig fix explains why prior pushes silently
    failed to deploy but does not itself prove any push since has succeeded. Record the
    verified build id/revision/timestamp. Verification-only unless the pipeline is found still
    broken, in which case the specific failure becomes a new dev-fixable item.'
- id: F2
  title: Fresh browser-driven sandbox purchase reaches a real 'paid' order + confirmation page
  status: pending
  inline_brief: 'Run a real browser-driven purchase (/tickets -> checkout -> PayFast sandbox
    payment -> redirect) and prove the confirmation page''s poll actually reaches
    state===confirmed, cross-checked against Firestore (order AND position both status:paid,
    per markOrderAndPositionPaidByPaymentId''s two-write contract) and Cloud Logging (ITN
    signature/amount/server-confirm/COMPLETE checks all passed for this m_payment_id). Record
    the real booking reference -- F4 depends on it. Verification-only unless a guard actually
    fails, in which case that failure becomes its own dev-fixable feature.'
- id: F3
  title: Confirmation email/QR delivery attempt is verified (or its failure verified graceful)
  status: pending
  inline_brief: 'Using F2''s purchase, check Cloud Logging for the post-commit
    deliverConfirmationEmailAfterCommit outcome. tickets.saoc.co.za/forms.saoc.co.za DNS is
    known not yet live (Brad-owned blocker, project_domain_migration_resend_sequencing) so a
    Resend failure is expected -- confirm it is DNS/domain-verification-shaped, not a code
    defect, and confirm the isolation held (order stayed paid, no rollback, no thrown error
    reaching the ITN response) under a REAL failure, not just a unit test. Record whichever
    outcome actually occurred. Do not attempt to fix DNS under this mission.'
- id: F4
  title: Real door check-in scan flips the order to 'checked-in' with a correct audit trail
  status: pending
  inline_brief: 'Provision or confirm a real test-admin identity (scripts/admin-grant.ts for
    the admin claim, AND live membership of the deployed ADMIN_EMAIL_ALLOWLIST -- the script
    deliberately does not touch the allowlist, both are required). Sign in at /admin/login,
    reach /admin/door, submit F2''s real booking reference (manual entry is an acceptable
    substitute for a camera scan). Confirm POST /api/admin/checkin succeeds, Firestore shows
    the terminal status from lib/checkin.ts''s real admission-rule naming, a checkinAttempts
    audit doc is written, and a SECOND submission of the same ref is correctly refused. If no
    agent can safely obtain interactive Firebase Auth credentials, this resolves to a
    documented manual protocol Brad runs himself with exact assertions supplied by
    @architect -- not a silent skip.'
milestones:
- id: M1
  title: Deploy pipeline trusted and a real purchase reaches 'paid'
  status: pending
  features: [F1, F2]
- id: M2
  title: Confirmation delivery and door check-in verified; mission proven end-to-end
  status: pending
  features: [F3, F4]
---

# Mission: Prove ticket purchase works end-to-end: browse -> checkout -> PayFast sandbox payment -> ITN confirmation -> confirmation email/QR -> door check-in. Checkout and ITN were both found broken and fixed this session (missing RECOVERY_TOKEN_SECRET; App Hosting not auto-deploying on push; ITN source-IP allowlist rejecting genuine PayFast notifications; missing-passphrase signature downgrade). A real browser-driven sandbox purchase got as far as PayFast payment success and redirect back to the confirmation page before the ITN bugs were found -- that run needs repeating now that all four fixes are deployed, and the flow needs to continue through to a real door check-in scan. All work must go through the full chain (@architect contract+goldens -> @dev -> @qa -> Codex cross-model review -> @docs -> gate -> @maintainer) -- the orchestrator does not implement, review, or deploy directly for any of this (hard rule, see project memory feedback_orchestrator_only_hard_rule).

## Context

Verified against current source before writing this (not taken on faith from the session
summary):

- `app/api/tickets/itn/route.ts` — source-IP check is confirmed log-only (guard 2, `console.warn`,
  never rejects); `PAYFAST_SANDBOX_PASSPHRASE` guard confirmed hard-reject (`return acknowledge()`
  before signature computation if unset). Both fixes are live in the tree.
- `tsconfig.json` `exclude` confirmed to include `functions`; `apphosting.yaml` confirmed to wire
  `RECOVERY_TOKEN_SECRET`, `PAYFAST_SANDBOX_MERCHANT_ID/KEY`, `PAYFAST_SANDBOX_PASSPHRASE`,
  `RESEND_API_KEY`, `RESEND_FROM_TICKETS`, `RESEND_FROM_FORMS` as Secret Manager-backed vars.
- Root cause of the non-deploying backend (commit `0c577dc`) was NOT a broken Cloud Build
  trigger — it was `next build`'s typecheck failing on every push since the self-signup Cloud
  Function (`functions/src/index.ts`) was added, because the root tsconfig's unfiltered
  `**/*.ts` include swept it in. The commit message states this "is why the site had not
  actually redeployed since 2026-08-18 16:12 UTC despite several merged fixes" — but no commit
  in this range actually **proves** a push after the fix produced a successful, auto-triggered
  Cloud Build that is now serving `saoc-prod`. That proof is F1 below.
- Confirmation email/QR (F11) is NOT a stub — `lib/confirmation-email.ts`'s `sendConfirmationEmail`
  really does call `generateBookingRefQrDataUri` per position and really does call
  `lib/email.ts`'s `sendEmail`, which really does call Resend (`resend.emails.send`). BUT project
  memory (`project_domain_migration_resend_sequencing`, `project_gateway_deadline...` — actually
  see `reference_leeann_drive_folder`-adjacent note) records that `tickets.saoc.co.za` /
  `forms.saoc.co.za` DNS records are **not yet added** (blocked on Brad, nameservers still on old
  cPanel) even though the code and `RESEND_FROM_TICKETS` secret are wired. A real purchase today
  will very likely attempt a Resend send that fails (unverified sending domain) — this must be
  OBSERVED and confirmed non-blocking (`deliverConfirmationEmailAfterCommit` isolates the
  failure, per its own doc comment: never rethrows, never rolls back the payment), not assumed.
- Door check-in (`/admin/door`) is gated by `app/admin/door/layout.tsx` via the shared
  `lib/admin-auth.ts` policy (admin claim + email_verified + live allowlist membership, all
  three, fail-closed). There is no unauthenticated or service-account path to it BY DESIGN — a
  real check-in scan needs a real, allowlisted Firebase-Auth admin identity that can complete an
  interactive Google/email-password sign-in. `scripts/admin-grant.ts` exists to mint the
  `admin: true` (and role) custom claim for a given email/uid — but the script explicitly does
  NOT touch `ADMIN_EMAIL_ALLOWLIST` (a separate, deployed env var) — both must line up for the
  gate to open. This is the credential-provisioning task under F4, not a code change.
- `app/api/admin/checkin/route.ts` confirmed to enforce auth first (before any Firestore read),
  delegate admission rules to `lib/checkin.ts`, and write an append-only `checkinAttempts` audit
  record via `lib/checkin-audit.ts` for every outcome (including refusals) — this route is
  already built and already has its own contract/goldens from a prior feature; F4 here is a
  fresh **live verification** run against a real paid order, not new checkin logic.

## Feature detail (for @architect / @dev / @qa handoff)

### F1 — Verify App Hosting auto-deploy is actually healthy
**Why:** the tsconfig fix explains why prior pushes silently failed to deploy; it does not
prove pushes since then succeeded. Trusting the pipeline is a precondition for every other
feature in this mission — no purchase test is meaningful if the deployed app predates the ITN
fixes.
**Acceptance criteria (objective, shell/CLI-checkable — gcloud and firebase CLIs are available
in this environment):**
- `gcloud builds list` (or the App Hosting-specific equivalent / Firebase console API) shows a
  SUCCESS build triggered automatically by a push, at or after commit `0c577dc`, with no manual
  `firebase apphosting:...` deploy invoked by the orchestrator to produce it.
- The live site's served bundle reflects the fix — e.g. hitting a real ITN with a known-bad
  source IP and confirming (via Cloud Logging) the new `console.warn(... 'logged only, not
  rejecting' ...)` line appears, not the old hard-reject error line.
- Record the verified backend revision / build ID / deploy timestamp in this mission's Notes.
**Chain implication:** likely no code change needed (pure verification) — @architect should
still produce a contract with these as shell/log-query assertions so @qa (not the orchestrator)
runs and certifies them, per the hard rule that the orchestrator does not verify this directly.

### F2 — Fresh browser-driven sandbox purchase reaches 'paid'
**Why:** this is the core proof the mission is named for. The prior run got to PayFast payment
success and redirect but never got beyond that before the ITN bugs were found.
**Acceptance criteria:**
- A BrowserAgent (or Brad) completes `/tickets` -> checkout -> PayFast sandbox payment form ->
  redirect to `/tickets/confirmation?ref=...`.
- The confirmation page's poll (`/api/tickets/status?ref=...`) reaches `state === 'confirmed'`
  (i.e. order status is `paid` or `checked-in`) within the page's own 20-attempt/60s budget —
  not just "PayFast said success," which is a client-side redirect and proves nothing about the
  server-side ITN.
- Independently confirm in Firestore (via `firebase firestore` CLI or the admin CSV export) that
  BOTH the order document and its child position document carry `status: 'paid'`, matching
  `markOrderAndPositionPaidByPaymentId`'s two-write contract.
- Cloud Logging shows the ITN handler's checks all passed (signature OK, amount matched, server
  confirm `VALID`, `payment_status === COMPLETE`) for this specific `m_payment_id` — not just an
  absence of errors elsewhere.
- Record the real booking reference produced — F4 depends on it.
**Chain implication:** verification-only unless a bug is found; if the purchase fails, the
specific failing guard becomes a new dev-fixable feature under this or a follow-up mission
rather than being patched ad hoc.

### F3 — Confirmation email/QR delivery verified (success or graceful failure)
**Why:** the code path is real (not a stub) but the sending domain's DNS is very likely not yet
live, per project memory. The mission must not falsely claim "email works end-to-end" without
checking, nor treat an expected DNS-blocked failure as a mission-blocking regression.
**Acceptance criteria:**
- Using F2's real purchase, check Cloud Logging around the ITN's post-commit email hookup
  (`app/api/tickets/itn/route.ts` step 5's `deliverConfirmationEmailAfterCommit` call) for either
  a successful Resend send or a caught-and-logged failure matching the
  `'[tickets/itn] Confirmation email failed — payment already committed, not rolled back'` line.
- If it failed: confirm the failure is DNS/domain-verification-shaped (Resend error mentioning
  the sending domain), not a code defect, and confirm the order's `paid` status was unaffected
  (per F2) — i.e. the isolation actually held under a real failure, not just in a unit test.
- If it succeeded: confirm the email actually arrived with a scannable QR (bonus proof, not
  required for mission completion given the known DNS blocker).
- Either outcome gets recorded plainly in mission Notes — this is a known, Brad-owned blocker
  (`project_domain_migration_resend_sequencing`), not something this mission fixes.
**Chain implication:** verification-only; do not attempt to fix DNS/domain verification under
this mission — that is Brad's action item, tracked elsewhere.

### F4 — Real door check-in scan
**Why:** this is the one leg of the flow that has never been exercised for real, and the mission
goal explicitly includes it. `/admin/door` is auth-gated by design; there is no way to reach it
without a genuine allowlisted Firebase-Auth admin session.
**Acceptance criteria:**
- Provision (or confirm existing) a real test-admin identity: run `scripts/admin-grant.ts
  <email> [--existing]` to mint the `admin: true` custom claim, AND confirm that same email is
  currently present in the deployed `ADMIN_EMAIL_ALLOWLIST` secret/env var (both are required;
  the script deliberately does not touch the allowlist). Getting/using real credentials for this
  is a task for Brad or a documented manual step if no test credential can be safely provisioned
  by an agent alone — flag this explicitly rather than inventing a workaround.
- A session (BrowserAgent with real credentials, or Brad) signs in at `/admin/login`, reaches
  `/admin/door`, and submits F2's real booking reference (camera scan of the real QR from F3, or
  manual entry — manual entry is an acceptable substitute if no physical/simulated camera input
  is available to the agent).
- `POST /api/admin/checkin` returns success; Firestore shows the order/position now `checked-in`
  (or whatever `lib/checkin.ts`'s admission rules name the terminal state — confirm the exact
  string from that module rather than assuming `'checked-in'`).
- A `checkinAttempts` audit document exists for this scan with the correct outcome, `scannedByUid`,
  and `bookingRef`.
- A SECOND submission of the same booking reference is correctly refused as
  `already-checked-in` (or the module's real name for that refusal) — proving the admission
  rule, not just the happy path.
**Chain implication:** if no agent can safely obtain interactive Firebase Auth credentials (this
looks likely, per `project_admin_auth_hole` and the lack of any credentialed browser agent in
this session's roster), this feature should resolve to a documented manual test protocol Brad
runs himself, with the orchestrator/architect providing the exact steps and exact Firestore/log
assertions to check afterwards — not a silent skip.

## Milestones

- **M1** (F1, F2): the deploy pipeline is trusted and a real purchase reaches `paid`. Without
  this, nothing else in the mission is meaningful.
- **M2** (F3, F4): confirmation delivery is checked honestly (success or known-graceful-failure)
  and a real door check-in scan is exercised, completing the originally requested proof.

## Notes

Orchestrator-authored implementation directly on this mission is out of scope by hard rule (see
`feedback_orchestrator_only_hard_rule`) — every feature above goes through
@architect (contract+goldens) -> @dev (only if a real defect is found) -> @qa (adversarial,
fed by @architect/orchestrator, not by @dev) -> Codex GPT-5.5 cross-model review -> @docs ->
contract gate -> @maintainer, per `.claude/rules/workflow.md`. F1-F3 are expected to be
verification-only (no code changes) unless a live defect surfaces; F4 may resolve to a
documented manual protocol rather than an agent-executed step, depending on credential
availability — that determination belongs to @architect when F4's contract is written, not to
this stub.


### F1 — deploy health (2026-08-18)
- Proof build: `build-2026-08-18-028` (Cloud Build id `13104e6e-f309-4361-ab90-2deed7429ae4`),
  commit `ec4406df95a30ea64592853fe395e49088b269c9`, SUCCESS 20:21:49Z.
- Check `execution/checks/verify_autodeploy_build.py` currently returns exit 1: backend is
  serving `build-2026-08-18-026` (commit `a9818be4`), not 028.
- Root cause (@qa, live API evidence): FIFO rollout backlog, NOT broken auto-promotion. App
  Hosting runs one rollout at a time per backend; six pushes landed 20:09–20:22Z. A rollout
  WAS auto-created for 028 (`rollout-023`, QUEUED behind `rollout-022` which was PROGRESSING).
- Codex GPT-5.5 failed this check twice before it was sound; the original PASS (and @qa's
  first PASS) were artifacts of weak assertions, not real deploy proof. See learned.md.

### F2 — real sandbox purchase (2026-08-18)
- **Booking ref: `SAOC-2027-X8ZPQNYCVWGY`** — required by F3 and F4.
- Buyer: "Mission F2 Test" / mission-f2-test@saoc-qa.example.com. Ticket: Adult R150.00.
- PayFast sandbox payment completed; confirmation page's FIRST poll of
  `GET /api/tickets/status?ref=...` returned 200 `{"status":"paid"}` — real server-side
  confirmation, ITN had already landed. Not a redirect-only false positive.
- Screenshots in session scratchpad (01-tickets-page / 02-payfast-sandbox / 03-confirmation-paid).

### Golden correction needed (F2)
`goldens/f2-f4-purchase-and-checkin.golden.md` says proof requires the poll to report
`state === 'confirmed'`. That API shape does not exist: `app/api/tickets/status/route.ts`
returns `{ status }` carrying the raw Firestore value, which is `'paid'`. The golden text is
wrong, not the code. Must be corrected before F3/F4 are written against it.

### F2/F3 — live ITN evidence (2026-08-18, verbatim Cloud Logging)
- A7 verified independently: `verify_order_paid.py --booking-ref SAOC-2027-X8ZPQNYCVWGY` exit 0 —
  `orders/UGwNpfL4FAu57hJ7F2is` AND `tickets/SAOC-2027-X8ZPQNYCVWGY` both `status='paid'`
  (two-write transaction completed; partial-commit case explicitly distinguished by the check).
- ITN request: `20:38:11Z POST /api/tickets/itn → 200`, referer `https://www.payfast.co.za`, 0.97s.
- **F1 step-3 CLOSED.** New line observed for this purchase:
  `20:38:11.402973Z [tickets/itn] Source IP not in resolved PayFast host set (logged only, not
  rejecting) { m_payment_id: 'SAOC-2027-X8ZPQNYCVWGY', clientIp: '35.219.200.118' }`
  Decisive because 35.219.200.118 is the SAME IP hard-rejected pre-fix at 19:25:58Z / 19:26:55Z.
  Zero occurrences of the old reject line post-fix across both ITNs in the window.
- **F3 PASS (failure path).** `[tickets/itn] Confirmation email failed — payment already
  committed, not rolled back` … `Resend send failed: The tickets.saoc.co.za domain is not
  verified.` Domain-verification-shaped, NOT a code exception. Order remained paid.
  Isolation guarantee held under a real failure, not a fixture.
- CAVEAT (honest scope of the F2 guard claim): individual guard passes (signature match, amount
  match, validate=VALID, payment_status=COMPLETE) are NOT positively logged on success — the
  handler logs only on failure. Guard proof is therefore STRUCTURAL: zero reject/mismatch lines
  in 274 entries + a commit whose orderId matches the confirmed Firestore doc. Do not later
  restate this as "logs positively confirmed each guard" — they do not exist.
- Raw log dump: session scratchpad `logs.json`.
- Note: a second order `EM1BPQJTAN7Y` also delivered an ITN at 20:39:11Z in the same window.
