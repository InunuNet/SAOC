# payfast-m1-residue-cleanup

Two linked defects confirmed live by Brad on 2026-08-16, both against the
`tickets` Firestore collection:

## Defect 1 — payfast-m1 behavioural checks leak fixtures into live Firestore

Running `contract-payfast-m1.yaml`'s gate created 7 ticket documents that
were never removed (`tickets` 5 -> 12). Full evidence and disposition:
`leaked-docs-2026-08-16.md` in this directory.

Code review as of this contract's authoring (after `f87bcb3` "prove ITN
validation by behaviour and AST, not grep") shows the four Firestore-mutating
payfast-m1 checks (`check-itn-amount-tamper-rejected.mts`,
`check-itn-server-confirm-and-status-gating.mts`,
`check-itn-atomic-idempotent-write.mts`,
`check-itn-source-ip-validation.mts`) already wrap their bodies in
`contracts/checks/ticketing-hardening/_shared.mjs`'s `withCleanup()`, which
sweeps every doc carrying the `@harden-check.invalid` sentinel domain in a
`finally` block and polls `assertNoResidue()` afterwards. **F1 below is a
regression guard, not a first-time fix**: it exists so that if a future check
in this directory is added without `withCleanup()`, or an existing one is
edited to bypass it, the gate catches the leak the same day rather than
someone finding 7 more strays a month later.

## Defect 2 — the residue scanner cannot see them

`scripts/scan-firestore-residue.ts` (contract:
`contracts/contract-firestore-residue-guard.yaml`) reports a fixed hit count
because the 7 leaked documents carry Firestore auto-IDs (no marker-shaped
`bookingRef`) and `attendeeName: 'Proof'`, which is in no pattern in
`contracts/golden/firestore-residue-guard/marker-catalogue.md`. **An
unchanged hit count means the scanner is blind, not that the database is
clean** — this is the exact false-assurance failure mode the guard exists to
prevent (see that contract's own goal statement, "2026-08-15 residue
detection gap").

Reading every Firestore-mutating check script in
`contracts/checks/{payfast-m1,d6-door-checkin,ticketing-hardening,
admin-auth-hardening}/` turned up a SECOND, independent, already-existing gap
that predates this task: `contracts/checks/d6-door-checkin/_shared.mjs`
stamps its own deliberate markers on every ticket it creates —
`attendeeEmail` ending `@d6-door-checkin-check.invalid`,
`attendeeName: 'D6 Door Checkin Check'`, `bookingRef` prefixed
`D6-NOAUTH-` / `D6-ADMIN-` / `D6-NONADMIN-` — none of which the scanner's
`MARKER_PATTERNS` array recognises. d6-door-checkin's own cleanup
(`deleteTicketFixture()` in a `finally` block in all three of its checks) is
correct and not in question; this is purely a scanner-coverage gap on a
suite that already announces its fixtures properly. `admin-auth-hardening`
writes no Firestore documents (confirmed: no `collection(` call anywhere in
that directory) — its `@saoc-contract-check.invalid` probe emails identify
Firebase Auth users only, the same "auth-only, out of scope for this
Firestore-only guard" category the catalogue already documents for
`ADMIN_TEST_EMAIL`. `ticketing-hardening`'s own markers (`harden-check.invalid`,
`Harden Check`/`Harden Filler`, `HARDEN-` prefix) are already covered.

## F2 specification — stamp + detect, both halves

Per the task brief's stated preference ("a fixture should announce itself"):
d6-door-checkin already does this correctly on the fixture side — no change
needed there. F2 is scanner-side only: add 3 new pattern-family entries to
`MARKER_PATTERNS` in `scripts/scan-firestore-residue.ts` tracing to
`contracts/checks/d6-door-checkin/_shared.mjs`, and a new literal
`KNOWN_RESIDUE_DOC_IDS` set for the 7 `leaked-docs-2026-08-16.md` document
IDs (matched via the same `id` fieldPath the scanner already walks — see
`walk(id, 'id', collection, id, hits)` in `scan-firestore-residue.ts`).

New pattern families (add to `MARKER_PATTERNS`, and document in
`marker-catalogue.md` with the same file:line-traced style as the existing
five):

```
{ name: 'D6-SENTINEL-EMAIL-DOMAIN', regex: /@d6-door-checkin-check\.invalid\b/i },
{ name: 'D6-BOOKING-REF',           regex: /^D6-(NOAUTH|ADMIN|NONADMIN)-/i },
{ name: 'D6-ATTENDEE-NAME',         regex: /^D6 Door Checkin Check$/i },
```

New literal allowlist:

```
const KNOWN_RESIDUE_DOC_IDS: ReadonlySet<string> = new Set([
  'CrF2gcbRQCMPGRKSn8Da', 'MbnMi9tAL7WiFXTMKufc', 'HorxzPqpPWfo7sw1w3Hx',
  'diLuP0fkUEXhv9P2f21D', 'kPxuUXcKF8jTw0IczYI4', 'OXauVpRMw6CX2bPeYjrY',
  'W7yyX5eB63WYKxspuR5I',
]);
```

`matchesAnyPattern()` must also check `KNOWN_RESIDUE_DOC_IDS.has(value)`
alongside the existing `KNOWN_RESIDUE_BOOKING_REFS.has(value)` check.

### False-positive guard (the 2099-price precedent)

The task brief explicitly flags that the scanner already false-positived once
on a plausible `ticketType.price` of 2099 — new patterns must not repeat
that. `D6-BOOKING-REF` and `D6-ATTENDEE-NAME` are both **exact-anchored**
(`^...$` where applicable, or an anchored prefix followed by one of exactly
three literal suffixes chosen from real source, not a wildcard) specifically
so a real attendee's name or booking reference can never collide:
- No real bookingRef issued by `/api/tickets/checkout` (format
  `SAOC-<year>-<10-char base36>`, per `marker-catalogue.md` #6) starts with
  `D6-`.
- No real attendee is named exactly `D6 Door Checkin Check` — the fixture
  `real-ticket-near-miss-*` entries in `fixture-d6-and-known-residue.json`
  prove a near-identical but non-matching name/ref (`D60-REAL-99999999`,
  `D6 Door Checkin Checked Out Guest`) is correctly ignored.
- `KNOWN_RESIDUE_DOC_IDS` matches only by exact string equality against a
  Firestore auto-generated 20-character ID — these are drawn from a space of
  ~2^120 combinations; collision with a real document's auto-ID is not a
  realistic risk, same reasoning already accepted for
  `KNOWN_RESIDUE_BOOKING_REFS`.

## F1 specification — regression guard against future leaks

New script: `contracts/checks/payfast-m1/check-suite-leaves-no-ticket-residue.mjs`.

Two independent halves, so the check has real coverage even without local
credentials (CI has none for this suite, same LOCAL-ONLY convention as
A18/A19/A20/A30 in `contract-payfast-m1.yaml`):

1. **Pure self-test, always runs, no credentials needed.** A pure function
   `judgeResidue(before, after)` returns `null` when `before === after` and a
   descriptive problem string otherwise. Self-tested against synthetic pairs
   (`judgeResidue(5, 5)` must be `null`; `judgeResidue(5, 12)` must be
   truthy) before anything live runs — same "detector proves it can still
   discriminate" convention as
   `check-paid-write-inside-transaction-scope.mjs`'s `judge()` self-test. If
   this self-test fails, exit 1 loudly: the comparison logic itself is
   broken and nothing downstream can be trusted.
2. **Live full-suite proof, LOCAL-ONLY, skips honestly when credentials are
   absent** (reuse `credentialsAvailable()` / `skipForMissingCredentials()`
   from `_itn-harness.mts`). Reads `tickets` count via
   `db.collection('tickets').count().get()` before running the four
   behavioural payfast-m1 checks as real child processes (`pnpm exec tsx
   <file>`, one per script, via `node:child_process`), then reads the count
   again after. Runs `judgeResidue(before, after)` on the real numbers. A
   child script's own PASS/FAIL is irrelevant to this check — only the
   before/after ticket count matters, because a script can fail its
   assertion for reasons unrelated to cleanup while its `withCleanup()`
   `finally` block still ran correctly. This script itself must never call
   `.delete(` — it only counts and delegates cleanup to the sub-scripts'
   existing `withCleanup()`.

Wire it into `contract-payfast-m1.yaml` as a new assertion (`A34`) alongside
the existing A18/A30-style behavioural checks, `command: 'pnpm exec tsx
contracts/checks/payfast-m1/check-suite-leaves-no-ticket-residue.mjs'`.

### Manual proof of the live half (documented here, not committed as a permanent code path)

Because the live half exercises real Firestore state, its "catches a real
leak" proof is a one-off manual run, following the exact precedent already
established for `ITN_ROUTE_IMPORT_OVERRIDE` in `_itn-harness.mts`'s
`loadItnPost()`: temporarily comment out the `finally { await
shared.sweepSentinels(); ... }` block inside `withCleanup()` in
`contracts/checks/ticketing-hardening/_shared.mjs` on a **scratch, uncommitted
copy**, point `check-suite-leaves-no-ticket-residue.mjs` at it, run it, and
show the residue assertion FAILS with a nonzero count delta; then discard the
scratch copy and re-run unmodified to show it PASSES. Never disable cleanup
against the real, committed `_shared.mjs`. Dev/QA must report the actual
terminal output of both runs as evidence, not just a claim.

## Assertion IDs in this contract

See `contracts/contract-payfast-m1-residue-cleanup.yaml`. F1 = A1-A4 (cleanup
regression guard, structural + behavioural). F2 = A5-A10 (marker catalogue +
scanner extension, functional proof via fixture, false-positive guard).
