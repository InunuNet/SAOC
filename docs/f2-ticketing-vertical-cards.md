# F2: Ticketing Vertical Cards — Admission Redesign & Real Photos

**Feature:** F2 of mission `ticketing-flow-redesign` (milestone M2). Redesigns the Admission ticket purchase flow per Brad's approved prototype: vertical ticket-type cards with real orchid photos, one dedicated buy screen per ticket type, and a fixed price-display issue ensuring checkout charges the displayed price.

**Contract:** `contracts/golden/ticketing-flow-redesign-f2/README.md` — the full design record; read it first. **This doc is the guide; that is the specification.**

**Depends on:** F1 (pricing model migration must land first — this feature displays `regularPrice` and calls `resolveEffectivePrice()`, which do not exist until F1 ships).

**Status:** Gated 12/12, QA-passed, Codex GPT-5.5 cross-model-passed, browser-verified (vertical layout, real photos, whole-card click-through, keyboard focus, no console errors, design tokens matched).

---

## What Changed: Overview

Three interconnected changes to the Admission ticket (`/tickets`) purchase flow:

1. **List-of-links page** (`/tickets`) — replaces the shared `CategoryTicketsPage` component with a dedicated `AdmissionTicketsList` — a vertical stack of per-ticket-type cards. Each card is a `<Link>` wrapping the photo, name, effective price, and provisional badge; no quantity stepper, no submit button. Purely a menu.

2. **Per-ticket-type buy screen** (NEW `app/(marketing)/tickets/[slug]/page.tsx`) — dedicated purchase screen for exactly one ticket type. The URL `/tickets/early-bird`, `/tickets/day-visitor`, etc. is directly linkable and shareable (e.g., in a newsletter). Fetches the single ticket type, active show window, and sold counts, then renders a narrowed `TicketPurchaseForm` variant: quantity stepper, attendee fields (if `requiresAttendeeNames`), day picker (if `requiresDaySelection` — ready for F3), and its own "Buy" submit that posts to checkout with line items ONLY of this one ticket type. Unrecognised/inactive slugs render 404 (`notFound()`).

3. **Vertical card layout** (`TicketTypeCard.tsx`) — changes from horizontal (name/description left, price/stepper right) to a vertical stack: real orchid photo top, then name, description, effective price, provisional badge. The component gains a `mode: 'list' | 'buy'` prop:
   - `'list'` mode (on `/tickets`): the stack wrapped in a `<Link>`, no quantity stepper.
   - `'buy'` mode (on `/tickets/[slug]`): the same stack PLUS the quantity stepper below the badge. No `<Link>` wrapper.

This single component keeps the visual identity (photo, typography, badges) defined in one place rather than two components drifting apart, while the interactive affordance genuinely differs between "browse" and "buy".

---

## Scoped to Admission Only

**Conferences and Workshops pages unchanged.** `app/(marketing)/national-show/conferences/page.tsx` and `.../workshops/page.tsx` still use the shared `CategoryTicketsPage` + `TicketPurchaseForm` multi-select-cart model. Brad's review and approval was specifically of the Admission prototype; nothing in the mission brief mentions Conferences or Workshops. `CategoryTicketsPage.tsx` itself is untouched; only `/tickets/page.tsx` stops using it.

---

## Real Orchid Photos via `lib/tickets-orchid-image.ts`

New file defines an explicit slug-to-image map:

```ts
export const TICKET_TYPE_ORCHID_IMAGE: Record<string, string> = {
  'early-bird': '/images/orchid-pink.jpg',
  'day-visitor': '/images/orchid-yellow.jpg',
  'weekend-pass': '/images/orchid-purple.jpg',
  'vip': '/images/orchid-violet.jpg',
};
export const DEFAULT_ORCHID_IMAGE = '/images/orchid-dark.jpg';

export function getOrchidImageForTicketType(slug: string): string {
  return TICKET_TYPE_ORCHID_IMAGE[slug] ?? DEFAULT_ORCHID_IMAGE;
}
```

**Why an explicit map, not a hash:** Four real, stable Admission slugs exist today. An explicit map is what lets Brad request "swap VIP's photo" as a one-line diff, not "change the hash seed and hope the distribution still looks right." The fallback protects against future new products; it is not expected to fire for today's four.

**Reuses existing assets only.** No new image files added — reuses exactly the five orchid photos already in `public/images/` site-wide (`orchid-{pink,purple,yellow,violet,dark}.jpg`), matching this project's "no invented brand assets" discipline. `TicketTypeCard` renders via `next/image` (not raw `<img>`), with `fill` + fixed-aspect-ratio container, `alt={name}` (not a generic "ticket icon" alt), same pattern as this project's other `next/image` usage (e.g., `components/societies/*`).

---

## Price-Display Fix: `resolveEffectivePrice()`

Both `/tickets/page.tsx` (list view) and `/tickets/[slug]/page.tsx` (buy screen) now call `resolveEffectivePrice()` server-side to determine the displayed price. This fixes a bug discovered during Codex cross-model QA: the list view was showing stale early-bird pricing that checkout later corrected at purchase time, leaving the buyer surprised by the charged amount.

**Integration:** `TicketTypeCard` receives `effectivePrice: number` prop (pre-computed by the caller); the card displays it, and the same value is used for validation in checkout. Displayed price now always matches charged price.

---

## Screen Structure & Routing

### `/tickets` (admission list page)

Route: `app/(marketing)/tickets/page.tsx`  
Component: `AdmissionTicketsList.tsx`

Fetches all active Admission ticket types (flagged `active === true` in Sanity), sorts by `order`, and renders one `TicketTypeCard` per type in a vertical stack. Each card's computed `effectivePrice` is passed as a prop. Each card is wrapped in a `<Link href="/tickets/{slug}">`.

### `/tickets/[slug]` (per-ticket-type buy screen)

Route: `app/(marketing)/tickets/[slug]/page.tsx`

Fetches:
- The single `ticketType` doc via `ticketTypeBySlugQuery` (existing query, already used by checkout for pricing — re-used here for display).
- The active show window (used for Day Visitor's day list, F3's domain).
- Sold counts (via existing `soldByTicketTypeQuery` or similar).

Renders:
- A page header (photo, name, description, price).
- A narrowed `TicketPurchaseForm` variant (called with `ticketTypes={[oneType]}`) containing:
  - Quantity stepper.
  - Attendee fields (only if `requiresAttendeeNames` — VIP only today).
  - Day picker mount point (only if `requiresDaySelection` — Day Visitor only, F3 wires the real picker).
  - "Buy" submit button posting to checkout.

Unrecognised or inactive slugs render `notFound()` (404), same convention as `/societies/[slug]`, `/events/[slug]`.

---

## Component Reuse: No `TicketPurchaseForm` Duplication

`TicketPurchaseForm.tsx` is NOT deleted or forked. It remains the single cart/attendee/day-picker/submit component, now used by:
- The new `/tickets/[slug]/page.tsx` screen (called with `ticketTypes={[oneType]}`).
- The existing Conferences/Workshops flow (called with `ticketTypes={[...multiple types]}`).

No new "single-type form" component duplicates its logic — scoped purchasing is achieved by passing a one-element array, not by building a separate component.

---

## Keyboard & Accessibility

- The card's `<Link>` in list mode is keyboard-focusable; pressing Enter navigates to the detail page.
- The quantity stepper on the buy screen has visible `focus-visible:ring-*` styling (matches site tokens elsewhere).
- Card images use real `alt={name}` descriptions (not generic text); meets accessible images requirement.

**Known open:** The list-mode card's `<Link>` lacks a `focus-visible:ring-*` class and falls back to the default browser outline (still visible/accessible, just visually inconsistent with custom focus rings used on the quantity stepper and elsewhere). Recommend adding `focus-visible:ring-*` to match; logged to backlog as a non-blocking follow-up.

---

## Known Open: Server Warning on Category Field

A server warning logs for all 5 admission ticket types: missing `category` field. This is currently covered by the null-category-defaults-to-admission fallback in `lib/tickets-category-warning.ts`, so no functional issue, but real data is preferable to a fallback.

**Recommendation:** Run `scripts/migrate-ticket-type-category.ts` (if it exists) with `--apply` to backfill the `category` field on all five admission ticket types and clear the warning. A dry-run may have already been executed; check before running live.

Logged to backlog as a non-blocking follow-up.

---

## Files Changed

- `lib/tickets-orchid-image.ts` — NEW: slug-to-photo map and fallback.
- `components/tickets/TicketTypeCard.tsx` — Updated: added `mode: 'list' | 'buy'` prop and mode-specific rendering.
- `components/tickets/AdmissionTicketsList.tsx` — NEW: vertical stack of cards with links to detail pages.
- `app/(marketing)/tickets/page.tsx` — Updated: now uses `AdmissionTicketsList` instead of `CategoryTicketsPage`.
- `app/(marketing)/tickets/[slug]/page.tsx` — NEW: dedicated buy screen per ticket type.
- `sanity/queries.ts` — Updated: may include query refinements or new helpers (verify in implementation).

---

## Out of Scope

- Day Visitor's per-day quantity picker internals (F3). This feature's `[slug]/page.tsx` screen for `day-visitor` renders whatever day-picker component F3 defines; F2 only builds the screen shell it renders inside.
- Checkout route, pricing logic, Sanity schema updates — F1's scope.
- New image assets, colours, fonts — none added.

---

## Next Steps

F3 (Day Visitor per-day quantity picker) builds on F2's screen shell, wiring the real per-day picker component on the `day-visitor` buy screen. See `contracts/golden/ticketing-flow-redesign-f3/README.md` for that feature's scope.
