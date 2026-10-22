# NOS round r57 — FAQ and what-to-expect wiring

Codi routes 57, 58 and 63 (2026-10-22). Governing rule: [no-invention](rules/no-invention.md) —
every string comes from an existing source, and Sanity is read only, never written by us.

## What changed

- `components/show/AdmissionPriceList.tsx` (new): `admissionPriceLabels(cards)` walks
  `TICKET_FAN_ORDER`, skips a product with no card, no price, or state `salesClosed`,
  `pricePending` or `soldOut`, and words the rest with `fanLinkLabel` (the tickets hub's own fan
  link wording). `AdmissionPriceList` renders them as `<ul data-admission-prices="">`. No price is
  typed in code: the figures come from `loadTicketCardViewModels()`, which reads the Sanity
  `ticketType` docs that `TICKET_PRODUCTS` (names, dates, meta only) is paired with.
- `components/show/ShowFaqList.tsx`: new optional `wired` prop keyed by the showFaq `_id`. The
  confirmation marker leaves `<summary>` and sits at the top of the answer panel (preview only,
  never on a wired row). A wired row renders `<div data-faq-wired={kind}>` after the Sanity answer,
  or instead of it when `replaces`.
- `app/(marketing)/national-show/faq/page.tsx`: wires two rows and, in preview, draws one
  page-level status line before the list. JSON-LD is unchanged (built from the Sanity answers).
  - `showFaq-tickets-1` (cost): the priced list plus a Tickets link, after the Sanity answer, only
    when at least one product has a price to show.
  - `showFaq-getting-there-3` (venue): replaces the Sanity answer with `show.venue.name`, only
    while `showVisitorInfo.confirmations.venue === 'confirmed'`. Name only; the entrance note is
    still to come.
- `app/(marketing)/national-show/what-to-expect/page.tsx`: when prices exist, the `Admission`
  card shows the priced list instead of the Sanity admission prose and counts as confirmed (the
  priced list is the tickets page's own published fact), which also drops it from the public
  holding note.
- `app/(marketing)/national-show/nos-structure.css`: the answer-panel marker reads in sentence
  case.

## Audit (14 FAQ rows, 7 what-to-expect cards)

| Item | Source that exists | Wired |
|---|---|---|
| FAQ cost (`showFaq-tickets-1`) | tickets hub loader | yes |
| FAQ venue (`showFaq-getting-there-3`) | `nationalShow.venue.name`, `confirmations.venue` | yes (name only) |
| FAQ when is the show | `showDate`/`showEndDate` | no change |
| FAQ ticket at the door, concessions, travel, parking, wheelchair, dogs, photographs, food, plants, permits | none published | no |
| WTE Admission | tickets hub loader | yes |
| WTE Show dates | already source-read | no change |
| WTE Opening hours, Food, Photography, Cloakroom, Accessibility | pending, no source | no |
| WTE long-form Venue | `buildShowFacts` | no change |

Nothing for travel, parking or transport is wired.

## Owner flags (Sanity content, for saoc-82 / Lee-Ann)

- O1 The Admission prose (per person per day, concession rates) conflicts with the priced products.
- O2 The Food prose says details follow once the venue is confirmed, but the venue is confirmed.
- O3 The venue answer also said entrance, parking and accessibility are being worked out; the wired
  row shows the name only.
- O4 The public FAQ shows 13 rows whose prose says "has not been confirmed", with no marker. Hide
  non-confirmed rows in public?
- O5 The four admission prices are `provisional: true` in Sanity and the hub shows no caveat; the
  FAQ cost row keeps its Sanity sentence and the Admission card carries none.

## Limits

- Wired rows are keyed by Sanity `_id`; a re-created FAQ doc silently falls back to its Sanity answer.
- The checks read live Sanity and the loader's aggregate sold counts (no orders or PII).
- `contracts/checks/launch-weekend/f18/check-e-faq.mts` asserts the marker sits in the summary;
  r57 supersedes it (Codi).
