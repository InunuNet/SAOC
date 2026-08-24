# F1: Ticketing Pricing Migration — Merge Early-Bird and Regular Pricing

**Feature:** F1 of mission `ticketing-flow-redesign` (milestone M1). Merge early-bird and regular pricing into one ticket-type document per product via a new `regularPrice` field, and fix the VIP price from R300 to R480.

**Contract:** `contracts/golden/ticketing-flow-redesign-f1/README.md` — the full design record; this doc is the guide.

**Status:** Implemented, QA-passed, Codex cross-model-passed. Migration script written and ready to run against live Sanity dataset.

---

## The Problem: Two Documents, Silent Drift

Before F1, early-bird and regular pricing were two *separate* Sanity documents, with no structural link:

- `early-bird-weekend-pass` (R380, early-bird only, capacity 150)
- `weekend-pass` (R400, always-on, capacity 300)

These were never truly separate products — a Weekend Pass buyer occupies one Weekend Pass seat regardless of price. But the two Sanity documents could diverge independently (capacity, name, description, `active` flag). A buyer couldn't "upgrade" from early-bird to regular pricing — the entire `early-bird-weekend-pass` product became 409 Conflict after the cutoff, forcing buyers to the separate `weekend-pass` document if any remained.

---

## The Solution: One Product, Price Changes at Cutoff

**One ticketType document now carries both prices:**

```ts
{
  slug: "weekend-pass",
  name: "Weekend Pass",
  price: 380,           // early-bird rate (before cutoff)
  regularPrice: 400,    // regular rate (after cutoff)
  earlyBirdCutoff: "2027-07-31",
  capacity: 300,
  // ... other fields
}
```

After 2027-07-31, the same product stays on sale at R400 instead of disappearing. Capacity is one pool (300), not fragmented. An editor has one document to maintain.

---

## How the Price is Resolved: `resolveEffectivePrice()`

`lib/checkout-reservation.ts` exports a pure function that decides which price applies:

```ts
export function resolveEffectivePrice(input: {
  price: number;
  regularPrice: number | null;
  earlyBirdCutoff: string | null;
  now: Date;
}): number | null;
```

**Truth table:**

| earlyBirdCutoff | within window? | regularPrice | Result |
|---|---|---|---|
| `null` | — | any | `price` |
| `"2027-07-31"` | ✓ yes | any | `price` (early-bird rate) |
| `"2027-07-31"` | ✗ no | `400` | `400` (regular rate) |
| `"2027-07-31"` | ✗ no | `null` | `null` (refuses with 409) |

**In checkout:** `app/api/tickets/checkout/route.ts` calls `resolveEffectivePrice()` for every distinct ticket type. If the result is `null`, the whole request is refused with HTTP 409 ("Early-bird pricing for this ticket type has closed.") — same message and status as before, byte-identical behavior for any product that keeps `regularPrice` unset.

---

## VIP Price Fix: R300 → R480

VIP was priced at R300 — cheaper than Weekend Pass (R400), despite being the top tier ("Reception access plus full-weekend admission").

**Corrected:** VIP is now R480 in `lib/provisional-figures.ts` (the sole source of truth), maintaining the tier hierarchy: Day Visitor (R150) < Weekend Pass (R380–400) < VIP (R480).

---

## What Changed in the Code

### `lib/provisional-figures.ts`

Single source of truth for all five admission products. The Weekend Pass and VIP entries now carry the corrected values:

```ts
export const ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[] = [
  // ...
  {
    slug: 'weekend-pass',
    name: 'Weekend Pass',
    price: 380,           // was 400; now the early-bird rate
    regularPrice: 400,    // new field; post-cutoff rate
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    capacity: 300,
    // ...
  },
  {
    slug: 'vip',
    name: 'VIP Ticket',
    price: 480,           // was 300; now R480 to stay top tier
    // ... regularPrice: unset (no early-bird window for VIP)
  },
];
```

### `sanity/schemas/documents/ticketType.ts`

Adds one new optional field:

```ts
regularPrice: Rule.required().min(0).optional().null(),
```

### `lib/checkout-reservation.ts`

New pure export:

```ts
export function resolveEffectivePrice(input: {
  price: number;
  regularPrice: number | null;
  earlyBirdCutoff: string | null;
  now: Date;
}): number | null {
  if (!input.earlyBirdCutoff) return input.price;
  if (isWithinEarlyBirdWindow(input.now, input.earlyBirdCutoff)) return input.price;
  return input.regularPrice;
}
```

### `app/api/tickets/checkout/route.ts`

Per-distinct-ticketType loop replaces the old early-bird 409 refusal with:

```ts
const effectivePrice = resolveEffectivePrice({
  price,
  regularPrice,
  earlyBirdCutoff,
  now: new Date()
});
if (effectivePrice === null) {
  return NextResponse.json(
    { error: 'Early-bird pricing for this ticket type has closed.' },
    { status: 409 }
  );
}
amountByType[slug] = effectivePrice;
```

### `sanity/queries.ts`

All queries that select ticket-type data (`activeTicketTypesQuery`, `activeTicketTypesByCategoryQuery`, `ticketTypeBySlugQuery`) now include `regularPrice` in their GROQ projection.

---

## Live Dataset Patch Script

**File:** `scripts/fix-vip-and-weekend-pass-pricing.ts`

Idempotent patch script that updates the live Sanity dataset. Three documents patched atomically:

1. `ticketType-vip`: `price: 300` → `price: 480`
2. `ticketType-weekend-pass`: `price: 400` → `price: 380`, add `regularPrice: 400`, add `earlyBirdCutoff: "2027-07-31"`, unset `releasedQuantity`
3. `ticketType-early-bird-weekend-pass`: `active: false` (retired, never deleted — pre-production dataset may reference it)

### Prerequisites

Requires `.env.local` with:
- `NEXT_PUBLIC_SANITY_PROJECT_ID`
- `NEXT_PUBLIC_SANITY_DATASET`
- `SANITY_API_TOKEN` (Editor or Admin role, write-enabled)

### Run the Patch

```bash
# Dry run (shows what would be patched, makes no writes)
npx tsx scripts/fix-vip-and-weekend-pass-pricing.ts --dry-run

# Execute the patch
npx tsx scripts/fix-vip-and-weekend-pass-pricing.ts

# Verify all fields were corrected
npx tsx scripts/fix-vip-and-weekend-pass-pricing.ts --verify
```

**Output example (dry run):**
```
Patching VIP/Weekend Pass pricing in Sanity dataset "production" (project 12345abc)
  ticketType-vip: would set price = 480
  ticketType-weekend-pass: would set price = 380, regularPrice = 400, earlyBirdCutoff = 2027-07-31; would unset releasedQuantity
  ticketType-early-bird-weekend-pass: would set active = false
Dry run complete — no documents were written.
```

The script is:
- **Idempotent:** running it twice against already-corrected documents is harmless.
- **Safe on old seeds:** `scripts/seed-ticketing.ts` uses `createIfNotExists`, so re-seeding a fresh dataset will use the corrected values from `ADMISSION_PRODUCTS` without needing this patch.
- **One-time only:** this is a historical correction for the live dataset; new Sanity instances seed from the corrected source.

---

## Open Question: Exhibition Ticket Post-Cutoff Behavior

`early-bird` (Early-Bird Exhibition Ticket) currently carries **no regular-price counterpart**. After 2027-07-31, it refuses with 409 — buyers cannot switch to a "regular Exhibition" ticket because none exists.

**Decision for F1:** leave it as-is (unchanged behavior). The schema supports adding a `regularPrice` later with zero migration effort.

**Follow-up for Brad/Lee-Ann:** does the Exhibition ticket need a post-cutoff regular rate, or is early-bird-only its intended design (seed early sales, then funnel remaining buyers to Day Visitor/Weekend Pass)?

---

## Related Docs

- [F4: Admission Products](f4-admission-products.md) — the ticket schema, field definitions, and provisioning process
- [`contracts/golden/ticketing-flow-redesign-f1/README.md`](../contracts/golden/ticketing-flow-redesign-f1/README.md) — full design record with rationale for each decision
- [`lib/provisional-figures.ts`](../lib/provisional-figures.ts) — source of truth for all product pricing and capacity
