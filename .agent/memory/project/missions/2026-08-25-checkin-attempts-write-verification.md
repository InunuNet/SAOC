---
schema: athanor.mission/v1
slug: checkin-attempts-write-verification
goal: Confirm a checkinAttempts document is actually written on a real scan. Path
  is wired (app/api/admin/checkin/route.ts:60 -> recordCheckinAttempt), but the paused
  mission prove-ticket-purchase-works-end-to-end-b M1 gate observed no document after
  a live scan. Query Firestore directly to determine the actual current behavior.
  If the write genuinely fails, it fails silently (lib/checkin-audit.ts:143 logs and
  swallows) -- find and fix the root cause if broken. Must survive the Stage 5 per-day
  check-in rewrite; re-verify current code paths, not stale assumptions.
created_at: '2026-08-25T12:47:37.300138+00:00'
started_at: null
status: close_out
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
  status: pending
  tier: standard
  title: Empirically verify checkinAttempts is actually written on real Firestore,
    and lock the regression
  inline_brief: null
  contract: .agent/memory/project/specs/checkin-attempts-write-verification/contract-f1.yaml
  golden_files:
  - contracts/golden/checkin-attempts-write-verification-f1/README.md
  completed_at: null
  spec: .agent/memory/project/specs/checkin-attempts-write-verification/contract-f1.yaml
milestones:
- id: M1
  status: done
  features:
  - F1
  gate_ran_at: '2026-08-25T13:25:05.367445+00:00'
  gate_result: pass
---





# Mission: Confirm a checkinAttempts document is actually written on a real scan. Path is wired (app/api/admin/checkin/route.ts:60 -> recordCheckinAttempt), but the paused mission prove-ticket-purchase-works-end-to-end-b M1 gate observed no document after a live scan. Query Firestore directly to determine the actual current behavior. If the write genuinely fails, it fails silently (lib/checkin-audit.ts:143 logs and swallows) -- find and fix the root cause if broken. Must survive the Stage 5 per-day check-in rewrite; re-verify current code paths, not stale assumptions.

## Context

Architect investigation (2026-08-25) read the current write path end to end (post Stage 5
per-day rewrite -- confirmed still current, no drift):

- `app/api/admin/checkin/route.ts`'s `audit()` closure (defined ~line 48, called at every
  outcome branch including the final `admit` at the bottom of the file) calls
  `await recordCheckinAttempt(store, {...})` -- always awaited, never fire-and-forget.
- `lib/checkin-audit.ts`'s `recordCheckinAttempt()` is NOT a silent swallow: it catches a
  rejection from the store and returns `{ recorded: false, error }`; the route then calls
  `logAuditWriteFailure()`, which `console.error`s the full context (bookingRef, showId,
  outcome, error) at ERROR level -- the one sanctioned console.error in this feature, per its
  own doc comment. A genuine live failure would be loud in Cloud Logging, not silent. The
  mission brief's "fails silently" characterization (from `lib/checkin-audit.ts:143`, the
  `logAuditWriteFailure` function itself) is describing the swallow-and-log design choice
  (never re-throw, never block the door response), not an absence of logging.
- `lib/checkin-audit-store.ts`'s `createFirestoreCheckinAttemptsStore()` is a 6-line adapter:
  `db.collection('checkinAttempts').add(record)`, nothing else. No security-rules exposure --
  this write goes through the Admin SDK (service-account credentials), which bypasses
  Firestore security rules entirely, so a rules misconfiguration cannot be the failure mode.
- This is feature F7 of mission `ticketing-foundation` (contract:
  `contracts/contract-ticketing-f7-checkin-audit.yaml`, golden:
  `contracts/golden/ticketing-f7-checkin-audit/README.md`). That golden README's own "What
  this contract does NOT prove" section (item 1) **already names this exact gap**: F7's 8
  assertions are all offline, against a fabricated in-memory store, and explicitly never prove
  the route calls `recordCheckinAttempt()` on a real path, nor that a document lands in live
  Firestore. It recommends exactly what the backlog now asks for: a live check against the
  real Firestore project. This mission is that follow-through, not a new investigation from
  scratch.
- No `scripts/` file already queries `checkinAttempts` directly. `scripts/scan-firestore-residue.ts`
  is the closest existing pattern for read-only Admin SDK access using credentials read
  straight from `.env.local` (no `dotenv` package, per that script's own header comment about a
  prior credential-corruption incident) -- @dev should model the new verification script on it.
- **Empirical cross-reference available with no side effects and no human scan required**:
  `lib/checkin.ts` (~line 93-96) sets `status: 'checked-in'` and a `checkedInAt` Firestore
  Timestamp on the ticket position, in the SAME transaction as the admission decision, for
  every real admit. This is a durable, independent signal of "a real check-in happened" that
  exists whether or not the audit write succeeded. A read-only script can query `tickets` for
  documents where `status == 'checked-in'` and cross-reference each one's `orderId`/`bookingRef`
  against `checkinAttempts` for a matching `outcome: 'admit'` record. If every checked-in
  ticket has a matching audit record, the live write path works and F7's own documented gap is
  closed with real evidence. If any checked-in ticket has NO matching audit record, that is
  the first hard proof of a live failure, and points at exactly which write is going missing
  (rather than a general "no doc observed" report with no failure signature).
- Read-only only: this script must never write, and must not require queuing a human scan
  (backlog's explicit instruction). It only needs the credentials already in `.env.local`
  (see reference_saoc_credentials_inventory memory).

## Notes

