# Golden: `/tickets` list page + `/tickets/[slug]` dedicated buy screen

Full rationale: `README.md` §2.

## `components/tickets/AdmissionTicketsList.tsx` (new)

Presentational, server-renderable (no `'use client'` of its own — no hooks, no browser APIs):
takes the same `cardData: TicketTypeCardData[]` shape `CategoryTicketsPage` already builds, maps
each to `<TicketTypeCard mode="list" .../>`, wrapped in a vertical stack (`flex flex-col gap-6`,
not the old horizontal row).

## `app/(marketing)/tickets/page.tsx`

Keeps its existing Sanity/Firestore fetches (ticketsPage singleton, sales state, active ticket
types, sold counts — same queries F1 already extended to select `regularPrice`), but stops
importing `CategoryTicketsPage`/`TicketPurchaseForm` for its render. Renders `PageHero` (unchanged)
+ `AdmissionTicketsList` instead. `SalesClosedNotice`/sold-out/`termsNote` states are preserved
byte-for-byte (this feature changes ticket-type presentation, not sales-state handling).

## `app/(marketing)/tickets/[slug]/page.tsx` (new)

```tsx
export const dynamic = 'force-dynamic'; // same reasoning as CategoryTicketsPage — live inventory

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function TicketBuyPage({ params }: Props) {
  const { slug } = await params;

  const ticketType = await sanityFetch<SanityTicketType | null>({
    query: ticketTypeBySlugQuery,
    params: { slug },
    tags: ['ticketType', 'sanity'],
  });

  if (!ticketType || ticketType.category !== 'admission') {
    notFound();
  }

  // ... resolve active show window/days (same buildShowWindow/computeShowDays calls F5 already
  // established), sold counts, salesOpen — SalesClosedNotice/sold-out states reused as-is.

  return (
    <>
      <PageHero image={...} eyebrow={...} heading={ticketType.name} lede={ticketType.description} />
      <div className="mx-auto max-w-[560px] px-8 py-16">
        <TicketPurchaseForm
          ticketTypes={[cardData]}
          buyButtonLabel={buyButtonLabel}
          soldOutMessage={soldOutMessage}
          showDays={showDays}
        />
      </div>
    </>
  );
}
```

`notFound()` fires for: unknown slug, inactive document (`active !== true` — reuse
`filterPubliclyListableTicketTypes`'s existing demo-exclusion + active check rather than a new
inline condition), or a non-admission category (Conferences/Workshops products are NOT reachable
via this route — they stay on their own `CategoryTicketsPage`-rendered pages, §1). `<TicketTypeCard
mode="buy">` is what `TicketPurchaseForm` renders internally for this single-element array —
no new "buy screen" duplicate of the card.

## Explicitly unchanged

- `POST /api/tickets/checkout` request/response shape — a single-item `lineItems` array is
  already a valid request today (multi-line-item cart support is additive, not exclusive).
- `useTicketCart.ts`, `CartAttendeeFields.tsx`, `CheckoutRedirectNotice.tsx`,
  `PayfastRedirectForm.tsx` — all reused as-is by the narrowed `TicketPurchaseForm` call.
