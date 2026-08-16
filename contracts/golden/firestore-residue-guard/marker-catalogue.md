# firestore-residue-guard — marker catalogue

Every entry below is traced to the specific file/line that writes it. Do not invent
new patterns and do not drop any of these without updating this file and the
contract's A4/A9/A10 assertions together.

## Regex pattern families (8)

1. **SENTINEL-EMAIL-DOMAIN** — `/@harden-check\.invalid\b/i`
   Source: `contracts/checks/ticketing-hardening/_shared.mjs:387`
   (`export const SENTINEL_EMAIL_DOMAIN = 'harden-check.invalid';`), reused at
   `:389` (`ADMIN_TEST_EMAIL`), `:397-399` (`sentinelEmail()`), `:401-403`
   (`isSentinelEmail()`). `.invalid` is RFC 2606-reserved and can never be a real
   attendee address. Every ticket doc `withCleanup()` creates carries this domain
   in `attendeeEmail`. Also covers `_round2.mjs:64`'s `sentinelEmail('f2-...')` —
   same domain, different local-part prefix.

2. **HARDEN-BOOKING-REF** — `/^HARDEN-/i`
   Source: `contracts/checks/ticketing-hardening/_shared.mjs:461-462`
   (`fillReservedSeats`: `` const bookingRef = `HARDEN-${label}-${created + i}`; ``),
   used again at `:472` as `m_payment_id`. Capacity-filler tickets carry this
   prefix on both `bookingRef` and `m_payment_id`.

3. **HARDEN-ATTENDEE-NAME** — `/^Harden (Check|Filler)$/i`
   Source: `_shared.mjs:440` (`createTicketDoc` default `attendeeName: 'Harden
   Check'`), `_shared.mjs:466` (`fillReservedSeats` `attendeeName: 'Harden
   Filler'`).

4. **M2-CHECK-ITN-PROBE** — `/^m2-check-itn-\d+-[a-z0-9]+$/i`
   Source: `contracts/checks/m2-next16-upgrade/check-routes.mjs:226`
   (`` const probeId = `m2-check-itn-${Date.now()}-${Math.random().toString(36).slice(2)}`; ``),
   written into a ticket's `m_payment_id` field via a live ITN POST at `:249`,
   read back at `:245`/`:251`.

5. **EPOCH-MS-NONCE (catch-all, heuristic, numeric-leaf vehicle)** —
   `/(?<!\d)\d{13}(?!\d)/`
   No current Firestore write path plants a bare 13-digit millisecond epoch as a
   raw numeric field — `check-routes.mjs:226`'s `Date.now()` is always embedded
   inside the `m2-check-itn-...` string (already caught by #4), never written as
   a standalone number. This pattern is carried anyway, deliberately, for two
   reasons: (a) parity with the sibling Sanity guard's own EPOCH-MS-NONCE
   pattern, which exists for exactly the incident class this guard defends
   against (a raw timestamp probe id planted as residue); (b) it is the vehicle
   the contract uses to prove non-string (numeric) leaf coercion actually works
   (A9) — the documented QA gap #2 on the Sanity guard ("`walk()` only branches
   on `typeof value === 'string'` and silently drops every non-string
   primitive leaf") must not be repeated here on day one. False-positive risk
   is low: no real `tickets` field is a 13-digit number (capacity ~50, amount in
   cents/rand under 6 digits, all timestamps stored as Firestore `Timestamp`,
   never a raw epoch-ms integer).

6. **D6-SENTINEL-EMAIL-DOMAIN** — `/@d6-door-checkin-check\.invalid\b/i`
   Source: `contracts/checks/d6-door-checkin/_shared.mjs:33`
   (`const SENTINEL_EMAIL_DOMAIN = 'd6-door-checkin-check.invalid';`), stamped onto every
   ticket fixture's `attendeeEmail` by `createPaidTicketFixture()` at `:70-82` via
   `sentinelEmail()` (`:38-40`). `.invalid` is RFC 2606-reserved, same reasoning as
   pattern #1. d6-door-checkin's own cleanup (`deleteTicketFixture()` in a `finally`
   block in each of its three checks) is correct and not in question — this closes a
   scanner-coverage gap on a suite that already announces its fixtures properly.

7. **D6-BOOKING-REF** — `/^D6-(NOAUTH|ADMIN|NONADMIN)-/i`
   Source: `contracts/checks/d6-door-checkin/_shared.mjs`'s three checks each build a
   `bookingRef` with one of these three literal prefixes before calling
   `createPaidTicketFixture(bookingRef)`. Exact-anchored to exactly the three suffixes
   used in real source (not a wildcard `D6-` prefix) so a real bookingRef can never
   collide — no bookingRef issued by `/api/tickets/checkout` (format
   `SAOC-<year>-<10-char base36>`, see #6 below) starts with `D6-` at all, and a
   near-miss like `D60-REAL-...` is deliberately not matched (proven in
   `contracts/golden/payfast-m1-residue-cleanup/fixture-d6-and-known-residue.json`). See
   item #9 below for the real bookingRef shape this is guaranteed never to collide with.

8. **D6-ATTENDEE-NAME** — `/^D6 Door Checkin Check$/i`
   Source: `contracts/checks/d6-door-checkin/_shared.mjs:76`
   (`createPaidTicketFixture`: `attendeeName: 'D6 Door Checkin Check'`). Exact-anchored
   (`^...$`, not a substring match) so a real attendee whose name merely contains the
   phrase, e.g. `D6 Door Checkin Checked Out Guest`, is never flagged — proven by the
   same fixture referenced above, per the 2099-price false-positive precedent this task
   was explicitly warned against repeating.

## Literal known-residue allowlist (not a pattern — exact string match)

9. **KNOWN-RESIDUE-BOOKING-REF** — exact match against:
   `SAOC-2027-E8WND2SM4HTD`, `SAOC-2027-JG6Q598FG0QD`, `SAOC-2027-5H63FBAE8AHP`,
   `SAOC-2027-C584G82Z7F6D`.
   These four `tickets` documents were created by real, successful sandbox
   checkout POSTs during manual PayFast diagnostic testing on 2026-08-12 — see
   `.agent/memory/project/missions/2026-08-12-sandbox-ticket-proof.md`, feature
   F3 inline_brief ("Test data to clean up before UAT: 4 ticket documents
   [...], all still 'reserved'"). Because they were written by the real
   `/api/tickets/checkout` route, not a test harness, their `bookingRef` has the
   exact same shape as a genuine customer's (`SAOC-<year>-<10-char base36>`) —
   no regex can distinguish them from real production data. They can only be
   named literally. **Do not generalise this into a regex** — a pattern that
   matched "any `SAOC-2027-*` ref" would flag every real ticket sold.
   `.agent/memory/project/backlog.md` (P3 item, lines 96-99) independently
   documents only 2 of these 4 refs plus "two more" unnamed — the mission file
   is the more complete source and is what this catalogue uses. Report this
   discrepancy, do not silently reconcile it.

10. **KNOWN-RESIDUE-DOC-ID** — exact match against the Firestore document ID itself
    (`fieldPath: 'id'`, not a data field): `CrF2gcbRQCMPGRKSn8Da`, `MbnMi9tAL7WiFXTMKufc`,
    `HorxzPqpPWfo7sw1w3Hx`, `diLuP0fkUEXhv9P2f21D`, `kPxuUXcKF8jTw0IczYI4`,
    `OXauVpRMw6CX2bPeYjrY`, `W7yyX5eB63WYKxspuR5I`.
    These 7 `tickets` documents were created during the `contract-payfast-m1.yaml` gate
    run on 2026-08-16 (`tickets` went 5 -> 12) and were never removed. Every carries
    `attendeeName: 'Proof'` and a Firestore auto-generated ID — no marker-shaped
    `bookingRef`, so unlike the `KNOWN-RESIDUE-BOOKING-REF` entries above they can only
    be named by document ID. Full evidence, including the timestamp table and the
    documented gap in explaining their origin (`git log --all -p` and a full-repo
    `grep -rl "Proof"` turn up no committed source that ever wrote `attendeeName:
    'Proof'`), is in
    `contracts/golden/payfast-m1-residue-cleanup/leaked-docs-2026-08-16.md`. **These 7
    documents, and the 5 pre-existing ones, are awaiting Brad's decision — do not
    delete.** Adding them here is why the scanner's hit count is expected to rise from
    12 to 19; a rising count is the scanner becoming able to see documents it was
    previously blind to, not a regression.

## Explicitly NOT pattern-detectable (documented gap, not a silent omission)

- **Two `contactSubmissions` diagnostic documents** (same 2026-08-12 PayFast
  probing session, per the same backlog item) were written directly through
  the real `/api/contact` route with no test harness, no sentinel domain, and
  no distinguishing marker of any kind recorded anywhere in this repo's memory.
  No pattern can find them. This is a structural detection gap, not an
  oversight: `scripts/scan-firestore-residue.ts` cannot report on documents it
  has no marker for. They remain an open finding for a human to locate and
  judge in the Firestore console — see the golden README's "Known findings
  awaiting Brad's decision" section. Do not invent a heuristic (e.g. "any
  `contactSubmissions` doc") to paper over this — that would flag every real
  enquiry.

## Auth-only markers — deliberately out of scope for this Firestore-only guard

`ADMIN_TEST_UID = 'harden-check-admin'` and `ADMIN_TEST_EMAIL =
'admin@harden-check.invalid'` (`_shared.mjs:388-389`) identify a Firebase Auth
user, not a Firestore document. Confirmed by reading `lib/checkin.ts` — no
admin identity (uid or email) is ever written into a `tickets` document by the
check-in transaction. If `ADMIN_TEST_EMAIL` ever did leak into a Firestore
field, pattern #1 (SENTINEL-EMAIL-DOMAIN) would still catch it, since it
shares the same `@harden-check.invalid` domain. A Firebase-Auth-user residue
guard is a distinct, unbuilt tool — out of scope here, note as a backlog
candidate in the golden README.
