# ticketing-flow-redesign F2 — decision record

Mission: `.agent/memory/project/missions/2026-08-24-ticketing-flow-redesign.md`, feature F2,
milestone M2. Depends on F1 (must land first — this feature displays `regularPrice`/
`resolveEffectivePrice`'s output, which does not exist until F1 ships).

## 0. Scope

Mission items (1) vertical cards, (2) one dedicated buy screen per ticket type instead of a
shared cart+buy button, and (5) real orchid photos replacing placeholder icons. Scoped to the
**Admission** category (`/tickets`) only — see §1. Does NOT touch the Day Visitor per-day
quantity picker's internal data model (F3), though it DOES provide the screen shell F3's picker
renders inside.

## 1. Scoped to Admission (`/tickets`) only, not Conferences/Workshops

**Decision:** `app/(marketing)/national-show/conferences/page.tsx` and
`.../workshops/page.tsx` — both still built on the shared `CategoryTicketsPage` +
`TicketPurchaseForm` multi-select-cart component — are UNCHANGED. Brad's review and approval was
specifically of the Admission ticket-type prototype (the mission brief enumerates exactly the 5
— now 4, post-F1 — Admission products); nothing in the brief mentions Conferences or Workshops.
A buyer registering for multiple conference tracks or field-trip outings in one checkout is a
plausible reason those pages intentionally keep the shared-cart model — changing that is a new,
unrequested decision this feature does not make. `CategoryTicketsPage.tsx` itself is untouched;
`/tickets/page.tsx` stops using it and gets its own implementation (§2).

## 2. `/tickets` becomes a list-of-links page; buying happens on a new per-type route

**Decision:**

- `app/(marketing)/tickets/page.tsx` renders a NEW component, `AdmissionTicketsList.tsx` — a
  vertical stack of `TicketTypeCard`s, each a `<Link href="/tickets/[slug]">` wrapping the whole
  card (name, effective price, orchid photo, provisional badge, sold-out state) — no quantity
  stepper, no attendee fields, no day picker, no submit button. Purely a menu.
- NEW route `app/(marketing)/tickets/[slug]/page.tsx` — the dedicated buy screen for exactly one
  ticket type. Fetches the single `ticketType` doc via the existing `ticketTypeBySlugQuery` (same
  query checkout already uses server-side for pricing — re-used here for display, not
  duplicated), the active show window (for Day Visitor's day list), and sold counts, then renders
  a NARROWED `TicketPurchaseForm` variant scoped to that one type: quantity stepper, attendee
  fields (if `requiresAttendeeNames`), day picker (if `requiresDaySelection` — F3 renders here),
  and its own "Buy" submit that posts `{ showId, lineItems }` to `POST /api/tickets/checkout`
  with line items ONLY of this one ticketType. An unknown/inactive slug renders Next.js
  `notFound()` (404), same convention as this project's other `[slug]` routes
  (`app/(marketing)/societies/[slug]/page.tsx`, `app/(marketing)/events/[slug]/page.tsx`).
- `components/tickets/TicketPurchaseForm.tsx` is NOT deleted — it still exists, used by the
  Conferences/Workshops multi-select flow (§1) and now ALSO reused (not forked) by the new
  `[slug]/page.tsx` screen when given a single-element `ticketTypes` array. No new "single-type
  form" component duplicates its cart/attendee/day-picker/submit logic — `[slug]/page.tsx` calls
  the exact same `TicketPurchaseForm` with `ticketTypes={[oneType]}`, `CategoryTicketsPage`'s
  list-rendering half is what's NOT reused for Admission (§2 above), not the purchase form.

**Why a real Next.js route, not a client-side modal/expand-in-place:** "one dedicated buy screen
per ticket type" is Brad's own wording — a real URL per product is also directly linkable/
shareable (e.g. in a newsletter: "click here to buy your VIP ticket"), which an in-page expand
state cannot offer, and costs nothing extra given the existing `[slug]` route convention already
used for societies/events/national-show archive years.

## 3. Vertical card layout

**Decision:** `TicketTypeCard.tsx`'s root layout changes from
`flex items-start justify-between` (name/description left, price/stepper right, horizontal) to a
vertical stack: photo top, then name, then effective price, then description, then (list context)
a "View tickets →" link OR (dedicated-screen context) the quantity stepper. See
`ticket-type-card.golden.md` for the exact prop/structure split between the two render modes.

**Decision: one component, a `mode` prop, not two components.** `TicketTypeCard` gains
`mode: 'list' | 'buy'` (required). `'list'`: renders the photo/name/price/badge stack wrapped in
a `<Link>`, no stepper. `'buy'`: renders the same photo/name/price/badge stack PLUS the existing
quantity stepper (unchanged stepper logic), no `<Link>` wrapper. This keeps the visual identity
(photo, typography, badge rendering) defined in exactly one place rather than two components
drifting apart, while the interactive affordance genuinely differs between "browse" and "buy".

## 4. Real orchid photos, explicit per-slug map

**Decision:** new `lib/tickets-orchid-image.ts`:

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

**Why an explicit map, not a hash of the slug:** four real, known, stable Admission slugs exist
today (post-F1) — a hash function adds indirection with no benefit over just writing the four
lines down, and an explicit map is what lets a human (Brad) request "swap VIP's photo" as a
one-line diff instead of "change the hash seed and hope the distribution still looks right." The
fallback exists ONLY so a future new Admission product (or a Conference/Workshop product, if this
helper is ever reused there — not this feature's scope) never renders a broken image; it is not
expected to fire for any of today's four products. No new image assets are added — reuses exactly
the five files already in `public/images/` site-wide, per this repo's CLAUDE.md "no invented
brand assets."

`TicketTypeCard.tsx` renders it via `next/image` (`fill` + a fixed-aspect-ratio container,
matching this project's other `next/image` usage — e.g. `components/societies/*` — rather than a
raw `<img>`), `alt={name}` (never a generic "ticket icon" alt, since a real photo needs a
real description for accessibility per this project's coding.md "Accessibility first").

## 5. Explicitly out of scope

- Day Visitor's per-day quantity picker internals — F3. This feature's `[slug]/page.tsx` screen
  for `day-visitor` still renders whatever day-picker component F3 defines; F2 only builds the
  screen shell it renders inside (form layout, buy button, attendee/day-picker mount points).
- Conferences/Workshops pages, `CategoryTicketsPage.tsx` — unchanged (§1).
- Checkout route, pricing logic, Sanity schema — F1's scope, already shipped by the time this
  feature is implemented.
- New image assets, colours, fonts — none added; only the five existing site-wide orchid photos
  are reused.
