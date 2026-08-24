# Golden: `TicketTypeCard.tsx` vertical layout + orchid photo

Full rationale: `README.md` §3-4.

## `lib/tickets-orchid-image.ts` (new)

```ts
export const TICKET_TYPE_ORCHID_IMAGE: Record<string, string> = {
  'early-bird': '/images/orchid-pink.jpg',
  'day-visitor': '/images/orchid-yellow.jpg',
  'weekend-pass': '/images/orchid-purple.jpg',
  vip: '/images/orchid-violet.jpg',
};

export const DEFAULT_ORCHID_IMAGE = '/images/orchid-dark.jpg';

export function getOrchidImageForTicketType(slug: string): string {
  return TICKET_TYPE_ORCHID_IMAGE[slug] ?? DEFAULT_ORCHID_IMAGE;
}
```

Exact filenames — all five already exist in `public/images/`, no new assets.

## `TicketTypeCard.tsx`

`TicketTypeCardData` gains no new required display fields beyond what F1 already wired through
`CategoryTicketsPage`/the new `[slug]/page.tsx` (`price` is already the F1-resolved effective
price by the time it reaches this component — this component does no price math of its own).

`TicketTypeCardProps` gains:

```ts
mode: 'list' | 'buy';
```

Structural shape (both modes share the photo/name/price/badge block; only the trailing
interactive element differs):

```tsx
<div className="flex flex-col gap-3 border p-5 ..."> {/* vertical, was flex-row */}
  <div className="relative aspect-[4/3] w-full overflow-hidden">
    <Image
      src={getOrchidImageForTicketType(slug)}
      alt={name}
      fill
      className="object-cover"
    />
  </div>
  <p className="font-serif ...">{name}</p>
  <p className="font-serif ...">{price === 0 ? 'Free' : `R${price.toFixed(2)}`}</p>
  <p className="font-sans ...">{description}</p>
  {provisional ? <span data-testid="provisional-badge">...</span> : null}
  {soldOut ? <span>{soldOutLabel}</span> : null}

  {mode === 'list' ? (
    <Link href={`/tickets/${slug}`} className="...">
      View tickets →
    </Link>
  ) : (
    /* existing quantity stepper block, UNCHANGED internals */
    <div role="group" aria-label={`${name} quantity`}>...</div>
  )}
</div>
```

`mode === 'list'` never renders the stepper (`onQuantityChange`/`quantity` props become optional,
only required/used when `mode === 'buy'`). `mode === 'list'` with `soldOut === true` still links
through to `/tickets/[slug]` — the dedicated screen is what shows the disabled/sold-out state on
the actual stepper, matching this project's existing "the disable is UX only, real enforcement
is server-side" comment already on this file.
