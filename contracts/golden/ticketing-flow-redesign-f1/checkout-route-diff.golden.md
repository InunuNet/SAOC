# Golden: `app/api/tickets/checkout/route.ts` diff

Full rationale: `README.md` §7. This file pins the exact shape.

## `SanityTicketType` interface (~line 102)

Gains one field, placed next to `earlyBirdCutoff`:

```ts
interface SanityTicketType {
  _id: string;
  name: string;
  price: unknown;
  regularPrice: unknown;
  capacity: unknown;
  show: { _ref: string } | null | undefined;
  releasedQuantity: unknown;
  earlyBirdCutoff: unknown;
  requiresDaySelection: unknown;
  requiresAttendeeNames: unknown;
  capacityPool: unknown;
  headcountPerUnit: unknown;
}
```

## New validator, next to `isUsableEarlyBirdCutoff` (~line 177)

```ts
function isUsableRegularPrice(value: unknown): value is number | null {
  if (value === null || value === undefined) return true;
  return typeof value === 'number' && value >= 0;
}
```

## `unusableTicketType()` field union (~line 203)

Gains `'regularPrice'`:

```ts
function unusableTicketType(
  slug: string,
  field:
    | 'capacity'
    | 'price'
    | 'regularPrice'
    | 'show'
    | 'releasedQuantity'
    | 'earlyBirdCutoff'
    | 'showWindow'
    | 'capacityPool'
    | 'headcountPerUnit'
): NextResponse {
```

## Per-distinct-ticketType loop (~line 508-577)

Destructuring gains `regularPrice`:

```ts
const { capacity, price, regularPrice, releasedQuantity, earlyBirdCutoff, capacityPool, headcountPerUnit } =
  ticketTypeDoc;
if (!isUsableCapacity(capacity)) return unusableTicketType(slug, 'capacity');
if (!isUsableAmount(price)) return unusableTicketType(slug, 'price');
if (!isUsableRegularPrice(regularPrice)) return unusableTicketType(slug, 'regularPrice');
```

The line `amountByType[slug] = price;` (~line 550) AND the early-bird 409-refusal block
(~lines 567-576) are DELETED TOGETHER and replaced by exactly this, in the SAME textual position
(after the pool/capacity bookkeeping, before the loop's closing brace — matching where the old
409 check sat):

```ts
const effectivePrice = resolveEffectivePrice({
  price,
  regularPrice,
  earlyBirdCutoff,
  now: new Date(),
});
if (effectivePrice === null) {
  return NextResponse.json(
    { error: 'Early-bird pricing for this ticket type has closed.' },
    { status: 409 }
  );
}
amountByType[slug] = effectivePrice;
```

`resolveEffectivePrice` is imported from `lib/checkout-reservation.ts` alongside the existing
`isWithinEarlyBirdWindow`/`effectiveCapacity` imports — `isWithinEarlyBirdWindow` itself is no
longer called directly from route.ts (it's now called ONLY from inside `resolveEffectivePrice`),
so its import is removed from route.ts if nothing else in the file uses it directly. Verify with
a grep before removing the import — do not remove it if some other line still calls it.

## Explicitly unchanged

- Every other validator (`isUsableCapacity`, `isUsableReleasedQuantity`, `isUsableCapacityPool`,
  `isUsableHeadcountPerUnit`), the pool/capacity math, `requiresDaySelectionByType`/
  `requiresAttendeeNamesByType` bookkeeping, everything below line 577.
- The response status/message on the refusal path (409, same string) — a caller cannot tell,
  from the response alone, whether this feature shipped for a product that never sets
  `regularPrice`.
