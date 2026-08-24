# Golden: pricing model (schema + provisional-figures + resolveEffectivePrice)

Full rationale: `README.md` §2-5. This file pins the exact shape.

## `sanity/schemas/documents/ticketType.ts`

New field, additive, placed near `earlyBirdCutoff`/`releasedQuantity`:

```ts
defineField({
  name: 'regularPrice',
  title: 'Regular Price (post-cutoff, ZAR)',
  type: 'number',
  description:
    'Price this ticket type switches to once earlyBirdCutoff passes. Leave unset if this ' +
    'product has no post-cutoff price (sale simply closes at the cutoff). Ignored when ' +
    'earlyBirdCutoff is unset.',
  validation: (Rule) => Rule.min(0),
}),
```

Every pre-existing field is unchanged — no removals, no renames, no new `.required()`.

## `lib/checkout-reservation.ts`

New pure export, placed near `isWithinEarlyBirdWindow`:

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

Truth table (this IS the spec — dev must match every row):

| `earlyBirdCutoff` | within window? | `regularPrice` | returns |
|---|---|---|---|
| unset | n/a | any | `price` |
| set | true | any | `price` |
| set | false | `null`/unset | `null` |
| set | false | a number | that number |

## `lib/provisional-figures.ts`

`ProvisionalAdmissionProduct` interface gains:

```ts
/** Optional. Price after `earlyBirdCutoff` passes. Unset = sale closes at cutoff (unchanged
 *  legacy behavior) — see contracts/golden/ticketing-flow-redesign-f1/README.md §2. */
regularPrice?: number | null;
```

`ADMISSION_PRODUCTS` array, exact resulting shape (order preserved, `early-bird-weekend-pass`
entry REMOVED entirely):

```ts
export const ADMISSION_PRODUCTS: ProvisionalAdmissionProduct[] = [
  {
    slug: 'early-bird',
    name: 'Early-Bird Exhibition Ticket',
    category: 'admission',
    description: 'Single-day admission to the National Show during the early-bird window.',
    price: 130,
    capacity: 400,
    releasedQuantity: 400,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'day-visitor',
    name: 'Day Visitor Ticket',
    category: 'admission',
    description: 'Single-day general admission to the National Show — choose your day.',
    price: 150,
    capacity: 800,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: true,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'weekend-pass',
    name: 'Weekend Pass',
    category: 'admission',
    description: 'Full-weekend admission to the National Show.',
    price: 380,
    regularPrice: 400,
    capacity: 300,
    releasedQuantity: null,
    earlyBirdCutoff: EARLY_BIRD_CUTOFF,
    requiresDaySelection: false,
    requiresAttendeeNames: false,
    provisional: true,
  },
  {
    slug: 'vip',
    name: 'VIP Ticket',
    category: 'admission',
    description: 'Reception access plus full-weekend admission to the National Show.',
    price: 480,
    capacity: 120,
    releasedQuantity: null,
    earlyBirdCutoff: null,
    requiresDaySelection: false,
    requiresAttendeeNames: true,
    provisional: true,
  },
];
```

Four entries, not five — `early-bird-weekend-pass` is gone from the source-of-truth array (it
still exists, retired, in the live Sanity dataset via the patch script, §6/`migration-script.golden.md`).
`CONFERENCE_PRODUCTS`/`WORKSHOP_FIELD_TRIP_PRODUCTS` arrays: byte-identical, zero edits (interface
field is optional).

## `sanity/queries.ts`

`regularPrice` added to the GROQ projection in exactly these three query bodies, immediately
after the existing `price,` line in each:

- `activeTicketTypesQuery`
- `activeTicketTypesByCategoryQuery`
- `ticketTypeBySlugQuery`
