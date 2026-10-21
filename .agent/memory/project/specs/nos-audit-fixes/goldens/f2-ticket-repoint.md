# F2 golden: NOS ticket repoint

Mission `nos-audit-fixes`, feature F2. Worktree `.tmp/sandbox/nos-fixes`
(branch fix/nos-audit-p1, base 047d610e). This golden was written by @architect, and @dev
implements against it.

## Source (the only spec)

Brad, 2026-10-15, relayed by lead saoc-2b:

> Point NOS 'Book tickets' at the EXISTING SAOC flow, /tickets/[slug] → /tickets/confirmation
> and /tickets/cancelled, with no new NOS routes. Do it in your NOS lane. Leave the
> uncommitted /national-show/tickets/buy relocation alone.

## Facts on base 047d610e (verified by reading the source)

| # | fact | where |
|---|---|---|
| 1 | `/tickets/[slug]` serves **admission** products only. Any other category returns `notFound()`. | `app/(marketing)/tickets/[slug]/page.tsx:86-91` |
| 2 | The live Sanity dataset has five admission slugs: early-bird, day-visitor, early-bird-weekend-pass, weekend-pass, vip. | `.tmp/sandbox/audit/devserver.log:64-68`; `contracts/contract-ticketing-f4-admission-products.yaml` |
| 3 | Checkout returns to `/tickets/confirmation?ref=` and cancels to `/tickets/cancelled?ref=` for every product. | `app/api/tickets/checkout/route.ts:960-961` |
| 4 | `/national-show/conferences` and `/national-show/workshops` buy inline through `TicketPurchaseForm`. That form posts to the same checkout, so those products already end on confirmation and cancelled. | `components/tickets/CategoryTicketsPage.tsx:211` |
| 5 | The `/tickets` listing links each card to `/tickets/${slug}`. | `components/tickets/TicketTypeCard.tsx:125` |
| 6 | Nav-config (FROZEN) links `/national-show/tickets`, `/tickets/day-visitor` and `/tickets/weekend-pass`. | `components/chrome/nav-config.ts:146,269-280` |
| 7 | The JSON-LD Offer URL is already `https://saoc.co.za/tickets/<slug>`. | `app/(marketing)/national-show/page.tsx:166`; `components/seo/JsonLd.tsx:149` |
| 8 | No `app/(marketing)/national-show/tickets/buy` exists on this base. | `git ls-tree 047d610e` |

## Every NOS ticket CTA: before → after

| # | surface | base href | after | why |
|---|---|---|---|---|
| C1 | `/national-show` hero "Book tickets →" (`page.tsx:572`) | `/tickets` | **`/national-show/tickets`** | D1 |
| C2 | `/national-show/tickets` admission card "Get visitor tickets" (`tickets/page.tsx:130`) | `/tickets` | **one link per public admission product, `/tickets/${p.slug}`, label `{p.name}`; base button only when the list is empty** | D2, D4 |
| C3 | `/national-show/what-to-expect` Admission block (`what-to-expect/page.tsx:195`) | `/tickets` | **`/national-show/tickets`** | D3 |
| C4 | `/national-show` "The Show" group, Tickets (`page.tsx:326`) | `/national-show/tickets` | unchanged | already NOS |
| C5 | `ShowSectionNav` Tickets (`ShowSectionNav.tsx:53`) | `/national-show/tickets` | unchanged | already NOS |
| C6 | nav-config Tickets rail | as fact 6 | unchanged | FROZEN |
| C7 | `/national-show/tickets` secondary cards (exhibitor, vendor, conferences, workshops) | `/national-show/...` | unchanged | fact 1: `/tickets/<slug>` would 404 these, and fact 4 says they already end on the existing confirmation and cancelled pages |
| C8 | JSON-LD Offer URLs | `/tickets/<slug>` | unchanged | fact 7 |

## Decisions

**D1. The hero goes to `/national-show/tickets`, not to one slug.** Sanity holds five admission
products (fact 2). A single "Book tickets" button cannot honestly stand for one of them: it
would pick a product for the visitor, and when that product expires (early-bird) the hero
would send people to a dead end. `/national-show/tickets` is where the frozen nav and the
section nav already send people (C4–C6), and it shows the products as `/tickets/<slug>`
links (D2). So the NOS path into the existing flow is:
`/national-show` → `/national-show/tickets` → `/tickets/<slug>` → `/tickets/confirmation` or
`/tickets/cancelled`. The label `Book tickets →` stays verbatim.
DECISION NEEDED (Brad): see the contract notes. The alternative is hero → `/tickets/day-visitor`,
the slug the frozen nav rail already features.

**D2. The `/national-show/tickets` admission card links every public admission product to
`/tickets/${p.slug}`.**
- The list is `filterPubliclyListableTicketTypes(ticketTypes ?? [])` from
  `@/lib/demo-ticket-type`, the same filter `/tickets` uses, kept in the query's `order asc`.
  `ticketTypes` is already fetched with `category: 'admission'`, so every link resolves on
  `/tickets/[slug]` (fact 1).
- Each link is the existing `<Button as={Link}>` component. The `href` is
  `` {`/tickets/${p.slug}`} `` and the label is `{p.name}`, which is Sanity data, so no copy is
  invented. Use one `.map((p) => ...)` over that list. Slugs are never written into the source.
- The first product gets `variant="primary"` (it is the `dominant` the price panel already
  shows). The rest get `variant="ghost"`. Both variants already exist on the page.
- The links render whenever products exist, whatever `salesOpen` says. Base did the same
  (its button always showed), and `/tickets/[slug]` renders its own SalesClosedNotice
  (`tickets/[slug]/page.tsx:169-170`).
- The price panel (From / R price / name / day-selection / early-bird / provisional) is
  unchanged.
- The string "Get visitor tickets" survives only in the D4 empty-list fallback.
- `export const revalidate = 60` stays. Do not add `getSoldCountsByTicketType`,
  `firebase-admin` or `force-dynamic` (contracts/contract-build-without-secrets.yaml).
- Optional and allowed: derive `dominant` from the same filtered list, so a slug-only demo
  product (DEMO_TICKET_TYPE_SLUG) can never be dominant. Do not change anything else on the page.

**D3. The what-to-expect Admission button goes to `/national-show/tickets`.** Its label,
`info?.admissionLinkLabel ?? 'See ticket prices and book'`, promises prices. Prices live on
`/national-show/tickets`, so that is its target. The label expression stays byte-for-byte.

**D4. Empty-list fallback (the lead, 2026-10-15; Brad was AFK. Codex QA P2 at
`tickets/page.tsx:133`).** When Sanity returns null or no public admission product, the
per-product list would leave the visitor admission card with no link at all. In that case
render base's button verbatim, and only then:

```tsx
{admissionProducts.length > 0 ? (
  <div className="flex flex-wrap gap-3">
    {admissionProducts.map((p) => (
      <Button key={p._id} as={Link} href={`/tickets/${p.slug}`} ...>{p.name}</Button>
    ))}
  </div>
) : (
  <Button as={Link} href="/tickets" variant="primary" className="w-fit">
    Get visitor tickets
  </Button>
)}
```

The per-product Buttons are the existing ones, unchanged. `admissionProducts` must be the
`const` assigned from `filterPubliclyListableTicketTypes(...)`. The checks also accept
`{admissionProducts.length === 0 ? (FALLBACK) : (...)}` and
`{admissionProducts.length === 0 && (FALLBACK)}`. The button's attributes, their order and the
label stay byte-for-byte as base (whitespace may differ). This is the only bare `/tickets` link
allowed on any NOS surface. The hero and what-to-expect never use it. Nothing is invented: the
label and href are base code, and `/tickets` is the existing SAOC flow.

## Out of bounds: do not touch

- `components/chrome/**`, which includes the FROZEN nav-config.ts.
- The existing flow: `app/(marketing)/tickets/**`, `components/tickets/**`, `app/api/tickets/**`
  and `lib/demo-ticket-type.ts`. Brad said *existing*.
- Any new file under `app/(marketing)/national-show/`. Do not create `tickets/buy`.
- F1's files: `contract-f1.yaml`, and the `check-{disclosures,key-dates-stack,sponsor-enquiry,tap-targets}.mjs`
  and `_lib.mjs` checks.
- `contracts/checks/nos-audit-fixes/f2-*.mjs`. These are QA inputs, and @dev never edits them.

## Files @dev changes (exactly three)

1. `app/(marketing)/national-show/page.tsx`: C1, href only.
2. `app/(marketing)/national-show/tickets/page.tsx`: C2 (import, list, links), plus the
   optional `dominant` derivation from D2.
3. `app/(marketing)/national-show/what-to-expect/page.tsx`: C3, href only.
