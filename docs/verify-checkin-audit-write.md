# verify-checkin-audit-write.ts — Verification Script

**Location:** `scripts/verify-checkin-audit-write.ts`  
**Mission:** `checkin-attempts-write-verification` (F1)  
**Status:** ✓ PASS — 0 orphans found in live Firestore, 2026-08-25

## What this script does

Verifies that door-scanner check-ins actually produce `checkinAttempts` audit records in live Firestore. The script is **read-only** — it queries the `tickets` and `checkinAttempts` collections without writing or mutating anything.

### The empirical method

When a ticket position is admitted at the door:

1. `lib/checkin.ts` sets `status: 'checked-in'` + `checkedInAt` on the ticket (independent of whether the audit write succeeds).
2. `lib/checkin-audit.ts` calls `recordCheckinAttempt()` to write a `checkinAttempts` document with `outcome: 'admit'`.

This script cross-references these two signals:
- Query all `tickets` where `status === 'checked-in'`
- For each one, look for a matching `checkinAttempts` record with `outcome === 'admit'`
- Report any ticket with no matching admit record (**orphan** — the audit write failed)

### Join logic (critical)

**Primary key: `bookingRef`** — the unique identifier of a single ticket position, and the exact key check-in scans against (`checkInByBookingRef()`, `app/api/admin/checkin/route.ts:87`).

**Fallback: `orderId`** — only for legacy/malformed documents with no `bookingRef` (not known to be reachable in real data).

**Why not orderId-first:** orderId is shared across every sibling ticket position in the same multi-item order (`lib/checkout-reservation.ts:284,297`). An orderId-primary join would report a ticket as "verified" merely because a *sibling* position had a genuine admit record — masking exactly the class of failure this script exists to detect.

The `hasMatchingAudit()` function explicitly filters `outcome === 'admit'` itself (not relying on caller pre-filtering) to guard against non-admit records (e.g. `'already-checked-in'`) masking missing admit writes in fixture mode.

## Usage

### Live mode (against real Firestore)

```bash
pnpm exec tsx scripts/verify-checkin-audit-write.ts
```

Requires `.env.local` with:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY` (with literal `\n` chars, not escaped)

**Exit codes:**
- `0` — ALL CLEAR. Every checked-in ticket has a matching admit audit record (including zero checked-in tickets, which it reports explicitly).
- `1` — FAIL. One or more checked-in tickets have no matching audit record. The script lists each one with its `bookingRef`, `orderId`, and `checkedInAt` timestamp.

### Fixture mode (offline testing)

```bash
pnpm exec tsx scripts/verify-checkin-audit-write.ts --fixture <path>
```

Reads a JSON file shaped:
```json
{
  "tickets": [
    { "id": "...", "bookingRef": "...", "orderId": "...", "checkedInAt": "ISO8601 timestamp" }
  ],
  "checkinAttempts": [
    { "id": "...", "bookingRef": "...", "orderId": "...", "outcome": "admit|already-checked-in|..." }
  ]
}
```

No Firebase credentials required. See `scripts/fixtures/verify-checkin-audit-write/` for examples:
- `matching-pair.json` — one checked-in ticket, one matching admit record (exit 0)
- `orphaned-checkin.json` — one checked-in ticket, no matching record (exit 1)
- `non-admit-outcome-masks-missing-write.json` — ticket matches on orderId to a non-admit record; correctly reported as orphan (exit 1)
- `orderid-shared-across-siblings-masks-orphan.json` — two siblings sharing orderId; only one has admit record; orphan sibling correctly identified (exit 1)
- `bookingref-match-wins-despite-orderid-mismatch.json` — bookingRef match overrides orderId mismatch; correctly reported as matched (exit 0)

## Output format

**All clear:**
```
ALL CLEAR — 0 checked-in tickets found; nothing to cross-reference.
```

or:
```
Checked-in tickets scanned: 42. Matched to an 'admit' audit record: 42.
ALL CLEAR — every checked-in ticket has a matching checkinAttempts 'admit' record.
```

**Failure (orphan found):**
```
Checked-in tickets scanned: 42. Matched to an 'admit' audit record: 41.
FAIL: found 1 checked-in ticket(s) with NO matching audit record:
  ticket=<doc-id> bookingRef=<ref> orderId=<id> checkedInAt=<ISO8601>
```

## The gap it closes

Mission `ticketing-foundation` (F7) proved the audit-write code path is correct by inspection and offline testing. However, F7's own contract explicitly documented a gap: all assertions run offline against fabricated in-memory data; none prove a document actually lands in live Firestore on a real door scan.

This mission closes that gap empirically. The live run (A6 in the contract) found **0 orphans**, confirming:
- ✓ Admitted tickets are actually written to `checkinAttempts`
- ✓ No backlog "write failed" incidents exist (yet)
- ✓ The write path is functioning correctly in production

## Regression protection

Structural contract assertions (A3–A4) lock the wiring that makes this work:
- `app/api/admin/checkin/route.ts` still `await`s the audit closure on every outcome branch
- `lib/checkin-audit.ts` still logs (never silently swallows) write failures via `logAuditWriteFailure()`

If either regresses, the gate fails and the issue surfaces immediately, not months later in production.

## When to run it

- **After a door-scan incident** — if someone reports no audit record appearing, run this script to check for widespread orphans vs. an isolated bug.
- **Regularly in CI** — optional, since it's read-only and overhead is minimal. Provides continuous proof the write path is still working.
- **Before/after auth provisioning changes** — if Firebase security rules change or admin credentials rotate, re-run to confirm writes still work.

## Implementation notes

- **No `dotenv` package** — credentials are read directly from `.env.local` by hand-rolled parsing, same as `scripts/scan-firestore-residue.ts`. This guards against a prior credential-corruption incident (see `project_secret_corruption_class` memory).
- **Read-only construction** — the script contains no `.set()`, `.update()`, `.delete()`, `.add()`, `commit()`, `batch()`, or `runTransaction()` calls. This guarantee is structural, enforced by contract assertion A2.
- **Error handling** — credential/init failures during live mode cause the script to exit `1` with an error message, not silently pass. The missing-credential case is treated as a finding to report, not a special case to paper over.
