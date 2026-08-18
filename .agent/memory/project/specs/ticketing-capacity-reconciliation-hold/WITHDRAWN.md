# WITHDRAWN — 2026-08-19

**This contract's F1 (the seat-hold-on-reconciliation-alert feature) was implemented,
gated green, then withdrawn before shipping to production, after @qa found the premise
itself was false.** Do not re-implement this feature from this contract's goal/README
without reading this file first — the evidence that motivated it does not mean what it
was assumed to mean, and the mechanism it proposed cannot work as designed under this
codebase's current write paths.

## What was built (and then reverted)

- `lib/data/tickets.ts`'s `stillHoldsSeat()` gained a branch: `if
  (data['reconciliationAlertedAt']) return true;` — hold the seat unconditionally once a
  human had been alerted. **This branch has been REVERTED** — `stillHoldsSeat` is back to
  its pre-contract form (status + expiry only), and `git diff` against the last commit
  before this contract touched the file is empty.
- `lib/reconciliation.ts`'s `markOrdersAlerted` was widened to also write
  `reconciliationAlertedAt` onto every `tickets/{id}` position sharing an alerted order's
  `orderId`, not just the order doc. **This write was KEPT** (see "What was kept" below)
  — it shipped in commit 5738f61, is gated by order-reconciliation's own A3/A4, and
  removing it would require unpicking assertions that still hold for reasons unrelated to
  this withdrawal.
- `types/index.ts` gained `Ticket.reconciliationAlertedAt?: Timestamp | null` — kept,
  since the write above is kept.
- Three goldens (`check-stillholdsseat-truth-table.mjs`, in the withdrawn dir but same
  file name as order-reconciliation's own — check the `import` line to tell them apart;
  `check-markordersalerted-writes-positions.mjs`; `check-live-reconciliation-holds-seat.mjs`)
  and this dir's `contract-f1.yaml` are being left in place, unexecuted, as the historical
  record — not deleted, not silently abandoned. They no longer describe the shipped
  system.

## Why: the premise was false, not just the implementation incomplete

This contract's goal file and README cited three (later found to be four) "known
stranded" order ids — `SAOC-2027-5KYDSBMT38KX`, `SAOC-2027-R06HZ12P06EY`,
`SAOC-2027-G08QJQK278NY`, and (found by A3's live query) `SAOC-2027-7HHE9QN51RH4` — as
evidence of real buyers whose payment had gone through at PayFast while the ITN failed
to confirm it, stranding a paid seat. **The "real buyers" half of that evidence was
wrong — the "payment went through, ITN failed" half, for two of the four, was not.** All
four are E2E test fixtures (`buyerEmail: "e2e-test@example.com"`, verified directly in
live Firestore 2026-08-19), not real customers — nobody was actually charged, nothing is
owed. But per the P1 backlog entry's own record, two of them (R06HZ12P06EY, G08QJQK278NY)
were genuine near-misses of exactly the scenario this feature targets: Cloud Logging
correlation showed a real sandbox PayFast payment was collected and its ITN was wrongly
rejected by the (now-fixed) source-IP bug. The other two look, in Firestore, identical to
an ordinary abandoned cart. **That is the actual point:** all four are indistinguishable
from each other, and from an ordinary abandoned cart, using only what Firestore records —
the evidence that told two of them apart from the other two came entirely from manual
Cloud Logging archaeology outside this data model, not from any field an automated
process could read. See the backlog and `docs/ticketing-position-expiry-write.md`
corrections made the same day for the accurate framing (the *mechanism* they motivated,
`ticketing-position-expiry-write`'s `expiresAt` fix, was itself real and correctly
shipped — only the "four real customers affected"
claim was wrong).

More importantly, the same investigation established the false premise is not fixable by
picking a better trigger field: **no field this system records can distinguish
"genuinely paid, ITN failed" from "an ordinary abandoned cart" on a `reserved`
order/position, and none can under the current write paths.**

- `gatewayPaymentId` (on `orders`) and `pf_payment_id` (on `tickets`) are written in
  exactly one place: `markOrderAndPositionPaidByPaymentId` (`lib/orders.ts`), called only
  from `app/api/tickets/itn/route.ts`, in the SAME Firestore transaction that flips
  `status` to `'paid'`. A document that is still `status: 'reserved'` therefore
  **cannot** carry either field — not "usually doesn't", structurally cannot, by
  construction of the only code path that ever sets them.
- There is no intermediate "payment attempt" or "buyer reached PayFast" signal recorded
  anywhere: no PayFast pre-ITN webhook, no server-side tracking of the `return_url` hit,
  nothing in `lib/recovery-token.ts` (that mechanism lets a buyer resume/view their own
  reservation; it records nothing about payment state).
- Consequence: `order-reconciliation`'s `findStrandedOrders` — `status == 'reserved' AND
  expiresAt < now` — matches a genuinely-failed-ITN order and an abandoned cart
  identically. `order-reconciliation`'s own goldens/README already documented this and
  called the abandoned-cart case "completely benign" — true, as long as the only
  consequence was an unnecessary alert email. This contract repurposed the exact same
  ambiguous signal (`reconciliationAlertedAt`) as a seat-hold trigger, which turns that
  same benign false positive into a **permanent seat leak**: `RESERVATION_TTL_MINUTES` is
  30, the reconciliation cron is hourly, so virtually every abandoned cart gets
  `reconciliationAlertedAt` stamped within the hour, automatically, with no human
  judgment before the write — and nothing in this codebase can ever clear that stamp
  short of a real payment settling it (which, for an abandoned cart, never arrives). @qa
  confirmed no settle route, no cancel route, no override exists anywhere in `app/api/admin`
  or `lib/orders.ts` beyond the ITN-only paid-transition path.

So the mechanism doesn't fail occasionally — it holds a seat forever for every abandoned
cart that happens to still be `reserved` an hour after it was created, which in practice
is most of them. That is worse than the problem it was meant to solve.

## What was kept, and why

`lib/reconciliation.ts`'s per-position `reconciliationAlertedAt` write was **not**
reverted. With the hold gone, nothing currently reads it — but it is a legitimate,
disclosed, correctly-atomic (`db.batch()`, see that function's own "PER-ORDER ATOMICITY"
docstring) per-position record that a human was alerted about that specific seat. It is
the natural substrate for a future, human-gated manual-settle action (see "What actually
fixes this" below) and removing it would mean unpicking order-reconciliation's own
already-green A3/A4 assertions for no functional gain. See `docs/order-reconciliation.md`
"reconciliationAlertedAt on positions" for where this is documented as
deliberately-written-but-currently-unread, so a future reader doesn't mistake it for dead
code and rip it out.

`order-reconciliation` itself (detect + alert a human by email, never auto-settle, never
auto-hold) is unaffected by this withdrawal and remains the correct, shipped posture for
data this ambiguous — see that contract's own goldens/README.md, unchanged.

## What actually fixes the underlying risk (not built here; proposed to Brad separately)

The real risk this contract was reaching for — a genuinely-paid buyer's seat getting
resold because the ITN never confirmed it — is real and still open. It cannot be closed
automatically with data this system holds. The only sound fix is a deliberate, audited,
human-gated action: an admin checks PayFast's own merchant dashboard out-of-band, and
only then takes an explicit "mark this specific order paid" action through a new,
narrowly-scoped admin route (gated the same way `/admin` already gates admin actions,
logged, never automatic, never inferred from `reconciliationAlertedAt` or any other
in-band signal). This is new scope — it moves money on a human's say-so — and was
reported to Brad as a proposal rather than built unattended. Not part of this contract,
not a co-requisite; a future one.

## For the next reader

If you are here because Brad (or anyone) asks for "hold seats for orders that might
actually be paid" again: re-read this file first. The distinguishing signal does not
exist today and cannot exist without either (a) a new PayFast integration point that
records something before the ITN, which PayFast does not offer today, or (b) a human
in the loop. Do not reconstruct the `reconciliationAlertedAt`-as-hold-trigger design from
this contract's goal.md/README.md alone — read this file, they are the wrong-premise
version.
