# Golden: vendor-stand-early-bird-pricing — decision record

Mission `vendor-stand-early-bird-pricing`, M1/F1. Adds the early-bird/regular tier axis to
`lib/vendor-stand-pricing.ts`. This is an *additive* change to a shipped, green mechanism —
`vendor-gated-registration-flow` M3 (F26-F32, checks A55-A63 in
`contracts/contract-vendor-gated-registration-flow.yaml`). Read that golden's "The
missing-figure problem", "Initiate — server-derived amount, transactional idempotency", and
"Settlement" sections first; this document only records what changes on top of it.

@dev implements against this record. @dev may not deviate from a decision recorded here
without flagging it back to the orchestrator.

## Why this exists

Brad confirmed 2026-09-01 that vendor stand fees have early-bird and regular tiers. Today
`VENDOR_STAND_PRICE_ZAR` is `Record<BoothSize, number | null>` — one price per booth size, no
tier concept anywhere in the stand-payment path. Building the tier axis now, while every
figure is still null, is a schema decision. Doing it after real figures land is a data
migration. Per the mission brief: build it now.

## 1. Follow the ticketing pattern, don't invent a second one

Ticketing's F4/F1 (`docs/f4-admission-products.md`, `lib/checkout-reservation.ts`) already
solved "does a cutoff instant currently favour tier A or tier B":

```typescript
export function isWithinEarlyBirdWindow(now: Date, cutoffIso: string | null | undefined): boolean {
  if (cutoffIso === null || cutoffIso === undefined) return true;
  const cutoffEndExclusive = new Date(cutoffIso);
  cutoffEndExclusive.setUTCDate(cutoffEndExclusive.getUTCDate() + 1);
  return now.getTime() < cutoffEndExclusive.getTime();
}
```

`lib/vendor-stand-pricing.ts` **imports and calls this exact function** — it does not
reimplement cutoff-date comparison. Two independently-written "is this date before the
cutoff" functions is exactly the kind of drift (one exact-midnight, one end-of-day-inclusive)
this project's own incidents (CTICC venue, 18–21 September placeholder — see
`.agent/memory/project/provisional-figures.md`) warn against. `cutoffIso === null` already
means "no restriction" in the reused function, which is the correct behaviour for a
council-blocked, not-yet-set cutoff: with the cutoff null, every request lands in the
early-bird tier by definition — but that tier's price is *also* null today, so
`resolveVendorStandPrice` still refuses (see §3). The two nulls compose correctly for free;
no special-casing is needed for "cutoff not yet set."

**Deviation from the ticketing pattern, and why:** ticketing stores `earlyBirdCutoff` per
Sanity `ticketType` document (CMS-editable, per-product). Vendor stand pricing has no CMS
document to attach a cutoff to — `lib/vendor-stand-pricing.ts` is a flat TypeScript constants
module (M3's own deliberate choice, since there is no `vendorStandOrder`-shaped Sanity
schema and Council-blocked figures shouldn't round-trip through the CMS anyway). So the
cutoff is a second exported constant in the same file, `VENDOR_STAND_EARLY_BIRD_CUTOFF:
{ value: string | null }`, not a Sanity field — same *mechanism* (`isWithinEarlyBirdWindow`), different
*storage location*, consistent with M3's existing "flat constants module, council-blocked"
posture for the six prices.

## 2. The new shape

```typescript
export type VendorStandPricingTier = 'earlyBird' | 'regular';

// Council-blocked, same posture as the six prices below — do NOT invent a date. Wrapped in a
// one-key object, not a bare `string | null` export, for the SAME reason
// VENDOR_STAND_PRICE_ZAR's cells are objects rather than scalars: an ES module namespace
// object's exports are non-writable bindings from the importer's side, so a bare scalar
// constant cannot be swapped for a fixture value by any test/check that imports this module —
// only an object's OWN properties can be mutated externally. This is not a stylistic choice;
// A1/A3 (below) depend on being able to set a fixture cutoff the same way M3's own checks set
// fixture prices.
export const VENDOR_STAND_EARLY_BIRD_CUTOFF: { value: string | null } = { value: null };

export const VENDOR_STAND_PRICE_ZAR: Record<
  VendorStandBoothSizeValue,
  Record<VendorStandPricingTier, number | null>
> = {
  1: { earlyBird: null, regular: null },
  2: { earlyBird: null, regular: null },
  3: { earlyBird: null, regular: null },
};

export type VendorStandPriceResolution =
  | { ok: true; amount: number; tier: VendorStandPricingTier }
  | { ok: false; reason: 'not-configured' | 'invalid-booth-size' };

// Still pure — no Date.now()/new Date() call anywhere in this file. `now` is a REQUIRED
// parameter, supplied by the caller from a trusted server clock. This is the load-bearing
// property for §3 below: the pricing module itself has no clock, so it cannot be spoofed
// from inside — only a caller that wrongly threads a client-supplied value into `now` could
// spoof it, and there is exactly one production caller (see §3).
export function resolveVendorStandPrice(
  boothSize: unknown,
  now: Date,
): VendorStandPriceResolution {
  if (!isValidBoothSize(boothSize)) {
    return { ok: false, reason: 'invalid-booth-size' };
  }
  const tier: VendorStandPricingTier = isWithinEarlyBirdWindow(now, VENDOR_STAND_EARLY_BIRD_CUTOFF.value)
    ? 'earlyBird'
    : 'regular';
  const amount = VENDOR_STAND_PRICE_ZAR[boothSize][tier];
  if (amount === null) {
    return { ok: false, reason: 'not-configured' };
  }
  return { ok: true, amount, tier };
}
```

`VendorStandBoothSizeValue`, `VENDOR_STAND_BOOTH_SIZES`, `VENDOR_STAND_BOOTH_SIZE_LABELS`,
`isValidBoothSize` are all unchanged from M3.

## 3. The tier decision is server-side and unspoofable — where the discipline lives

`app/api/vendors/stand-payment/initiate/route.ts` already computes `const now = new Date();`
today, for token-expiry verification, before this mission touches it. The ONLY change to the
route's pricing call is:

```typescript
// before (M3):  resolveVendorStandPrice(boothSize)
// after (this mission):
const priceResolution = resolveVendorStandPrice(boothSize, now);
```

reusing that SAME `now` — not a second `new Date()` call, and never a value read from the
request body. The request-body allow-list is **unchanged**: `{ token, boothSize }`. There is
no third field, no `now`/`timestamp`/`clientTime`/`purchasedAt` key accepted anywhere in this
route today or after this change — A2 (below) both proves a forged field of that shape is
silently ignored, and statically proves the route only ever reads `{token, boothSize}` off
the body (extending, not replacing, M3's own A59 class assertion for this same route).

This is the same defect class this project fixed twice on 2026-09-01 (caller-supplied
`sizeBytes` trusted over the decoded length): the fix here is structural, not a runtime
check — the pricing module has no clock of its own to fool, and the one caller that has a
clock reuses the value it already derived from `new Date()` for an unrelated purpose (token
expiry), so there is only one place in the entire path a forged timestamp could even be
threaded through, and it is never wired to the body.

## 4. Refuse-on-null holds per tier, independently

`resolveVendorStandPrice` reads `VENDOR_STAND_PRICE_ZAR[boothSize][tier]` for the ONE tier
`isWithinEarlyBirdWindow` selected — never falls back to the other tier's figure. Concretely:
if `earlyBird: null, regular: 5000` and `now` is before the cutoff, the call refuses
`not-configured` even though `regular` has a real number — the vendor is not silently
overcharged (or undercharged) by falling through to whichever tier happens to be populated.
Symmetrically, `earlyBird: 4000, regular: null` refuses after the cutoff even though
`earlyBird` had a figure. A half-populated pricing table is exactly as blocked as a fully-null
one, per tier. This is the direct extension of M3's own `resolveVendorStandPrice` discipline
("never throws, never guesses, never falls back to a default price") to the new axis — see
`lib/vendor-stand-pricing.ts`'s existing docstring.

Both `not-configured` failures — flat (M3, both tiers absent from the concept entirely) and
tiered (this mission, the selected tier's cell is null) — share the SAME `reason:
'not-configured'` value. No third reason is introduced. `app/api/vendors/stand-payment/initiate/route.ts`'s
existing `503` + council-blocked-message handling for `'not-configured'` therefore requires
**zero changes** to keep refusing correctly — the refusal path this mission exercises is
identical code to the one M3's A55 already proved, just now reachable via either tier being
the missing one.

## 5. Backward compatibility — `VendorStandOrder.tier`

`types/index.ts`'s `VendorStandOrder` gains one new field, appended at the end (additive, no
renames, no reordering of existing fields):

```typescript
export interface VendorStandOrder {
  // ...all M3 fields, unchanged...
  tier: VendorStandPricingTier | null; // null for orders written before this mission
}
```

`app/api/vendors/stand-payment/initiate/route.ts` writes `tier: priceResolution.tier` on
every `vendorStandOrders` document it creates or overwrites, alongside `amount` (same
transactional step, M3's existing "re-derived server-side, never client-supplied" write —
this mission does not touch that transaction's shape, only adds one more server-derived
field to the object it already writes).

**A pre-existing `vendorStandOrders` document written by M3's code has no `tier` key in
Firestore at all** (Firestore omits absent fields; it is not stored as `tier: null`). Every
reader must treat "key absent" and "key present and null" identically:

- `lib/vendor-stand-payment-notification.ts` (settlement) — its idempotency guard
  (`status !== 'pending'`), amount guard (`grossAmountCents === Math.round(order.amount *
  100)`), and cross-gateway guard (`order.gateway === provider.id`) are **unchanged and never
  read `order.tier`**. A legacy order with no `tier` field settles through the exact same
  code path as a new one with a `tier`. This mission adds no new guard to settlement — `tier`
  is informational (denormalized, for admin/audit display), never a security- or
  money-relevant field, so it is deliberately excluded from every settlement check, the same
  reasoning M3 gives for keeping `boothNumber` allocation out of the payment path entirely.
- `app/admin/vendors/page.tsx`'s `fetchStandPaymentStatusById()` only ever projects
  `.status` off each `vendorStandOrders` doc — unaffected either way, no change needed, and
  a legacy doc's absent `tier` field can never reach it because it isn't read.

This mirrors M3's own "additive, no admin write path" discipline (A63): the new field is
written by exactly one route (`initiate`), read by nothing that enforces a security or money
property, and its absence on old data is a no-op everywhere it could be read.

## What Council still owes us

Six ZAR figures (`VENDOR_STAND_PRICE_ZAR[1|2|3].earlyBird` / `.regular`) and one cutoff date
(`VENDOR_STAND_EARLY_BIRD_CUTOFF`). None of the seven values may be invented, estimated, or
defaulted — every one ships `null` in this mission, exactly as M3's three flat prices did.
The moment Council supplies real numbers, filling in these seven constants is the entire
follow-up change — no route, page, token, or settlement code should need to change, mirroring
M3's own "the moment Council supplies three real numbers, filling in `VENDOR_STAND_PRICE_ZAR`
is the entire follow-up change" claim (A55's regression lock). A future check in the same
shape as A55 (pricing flips the mechanism on nothing but the constants) is recommended once
real figures are supplied, though it is not written here since it would currently be
vacuously true against all-null fixtures rather than real data.

## RED checks — proof these properties do not hold against current code

All four fail against HEAD (`c9b465aa` plus the M3 code already on disk) because
`VENDOR_STAND_PRICE_ZAR[n]` is currently a bare `number | null`, not a
`{earlyBird, regular}` record, and `resolveVendorStandPrice` currently takes one argument,
not two. See `contracts/contract-vendor-stand-early-bird-pricing.yaml` (A1-A4) for the exact
commands and captured failure output.

- **A1** — correct tier selected either side of the cutoff, reusing `isWithinEarlyBirdWindow`
  (pure function, no harness).
- **A2** — a forged client-supplied timestamp field cannot buy the early-bird rate
  (behavioural, route-runner harness) + static class assertion that the route never threads
  a body-derived value into `resolveVendorStandPrice`'s `now` argument.
- **A3** — refusal holds independently per tier when only one tier's figure is null (pure
  function, no harness).
- **A4** — a `vendorStandOrders` document written before this mission (no `tier` key) still
  settles correctly through the unmodified settlement handler, and the settlement handler's
  source contains zero references to `.tier` in any guard (behavioural + static).
