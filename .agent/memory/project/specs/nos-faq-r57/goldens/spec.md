# nos-faq-r57 — /national-show/faq and /national-show/what-to-expect (Codi routes 57, 58, 63; 2026-10-22)

Source: Codi (NOS design lead, final authority), verbatim at the main project's `.tmp/sandbox/queue/r57-ruling.md` with the route-63 and re-rank addenda.
Base `origin/main` 8e686f06. No invention (docs/rules/no-invention.md): every string comes from an existing source; Sanity is read only, never written.

## Ranked scope
- P1  FAQ cost row (`showFaq-tickets-1`) and the what-to-expect Admission card answer from the tickets hub's own loader (`loadTicketCardViewModels`, products
      `TICKET_FAN_ORDER`, wording `fanLinkLabel`) and link to Tickets. The Admission card's Sanity prose is not drawn while the prices are; it stays in Sanity (owner flag).
- P1  FAQ venue row (`showFaq-getting-there-3`) reads `show.venue.name`, the fact strip's source, while `showVisitorInfo.confirmations.venue === 'confirmed'`.
- Q   Audit of the 14 questions and 7 cards below: only the two rows above and the Admission card have a real published source.
- P2 public  Unanswered rows and empty sections hidden: markers are already absent in public; Q1 keeps that true (see owner question O4 for the prose).
- P3 preview  FAQ marker out of `<summary>`: one page-level R11 line (ShowStatusLine) before the list, and the existing marker, sentence case, inside each answer panel.

## Findings the spec rests on (Sanity READ only, published perspective, 2026-10-22)
- Venue is committee-confirmed: `showVisitorInfo.confirmations.venue = "confirmed"`; `nationalShow.venue.name = "The Hangar, Stellenbosch Flying Club"` (== `location`).
  Not provisional, so it is wired, not an owner question. `venue.directionsNote` says the exact entrance is still to come: that is why only the name is wired.
- what-to-expect has no venue line of its own in code. The page already draws Venue in the long-form aside via `buildShowFacts(show)` (same source as the fact strip).
  The sentence Codi saw ("will be published once the committee confirms the venue") is inside the Sanity `food` prose: an owner flag, not a wiring task.
- TICKET_PRODUCTS holds names, dates and meta only. Prices are not static: they come from the Sanity `ticketType` docs through `loadTicketCardViewModels()` (the hub's
  loader). The hub's fan links carry `aria-label = fanLinkLabel(...)`: "VIP Ticket, R300", "Sunset Cocktails (Single), R800", "Weekend Pass (Early Bird), R360",
  "Early-Bird Exhibition Ticket, R120". The wired lists must equal that set; the rendered checks read it live from /national-show/tickets.
- Base public build: all 14 FAQ rows render with no marker (their Sanity prose says "not confirmed"); what-to-expect hides Admission and names it in the holding note.
- Base preview: every unconfirmed FAQ summary holds the marker (113-165px tall at 390 vs 66-118px for the question alone).

## Audit (14 FAQ rows, 7 what-to-expect cards)
| Item | Source that exists | Wire? |
|---|---|---|
| FAQ How much does it cost to get in? | ticket hub loader (4 priced admission products) | YES |
| FAQ Where exactly is the show being held? | `nationalShow.venue.name`, `confirmations.venue` confirmed | YES (name only) |
| FAQ When is the show? | `showDate`/`showEndDate`, dates confirmed; row already correct, hand-typed | no change (drift risk noted, optional later) |
| FAQ Can I buy a ticket at the door? | none (admission prose: "not yet confirmed") | no |
| FAQ Concessions for pensioners, children, society members? | none; the phrase is on the unsourced-text list (`carriesUnsourcedVisitorText`) | no |
| FAQ airport/travel, parking | none; plan-your-visit says guidance "being put together" | no (TBC) |
| FAQ wheelchair access, assistance dogs | none (`accessibility` pending) | no |
| FAQ photographs | none (`photographyPolicy` pending, unsourced) | no |
| FAQ food and drink | none (`food` pending) | no |
| FAQ plants at the show, leaving plants, border permits | none (cloakroom pending; permits generic) | no |
| WTE Show dates | already source-read, confirmed | no change |
| WTE Admission | ticket hub loader | YES |
| WTE Opening hours | values are "To be confirmed"; programme page has no times; there is no FAQ opening-times row | no |
| WTE Food, Photography, Cloakroom, Accessibility | pending, no source | no |
| WTE long-form aside Venue | `buildShowFacts` (already the fact strip's source) | no change |
Nothing for travel, parking or transport is wired.

## Dev brief (files, exact changes, source of each value)
1. NEW `components/show/AdmissionPriceList.tsx` (server component). `admissionPriceLabels(cards)` = for each id in `TICKET_FAN_ORDER`: skip when no card, `price === null`, or state
   `salesClosed`/`pricePending`/`soldOut`; else `fanLinkLabel(id, vm)` (from `components/tickets/keepsake/TicketMini`). `<AdmissionPriceList cards>` renders
   `<ul data-admission-prices="">` with one `<li>` per label, null when none. No price or string literal of its own.
2. `components/show/ShowFaqList.tsx`: new optional prop `wired?: Record<string, { kind: string; body: ReactNode; replaces: boolean }>` keyed by the showFaq `_id`.
   - The `ConfirmationBadge` leaves `<summary>` (the question span stays; the icon stays). It moves to the top of the `.nos-faq-answer` panel, rendered only when
     `!hideUnanswered` and the row is not wired.
   - A wired row renders `<div data-faq-wired={kind}>{body}</div>` after the Sanity answer, or instead of it when `replaces`.
3. `app/(marketing)/national-show/faq/page.tsx`: also fetch `nationalShowQuery` (as `ShowFactsSource`) and `loadTicketCardViewModels()` in the existing `Promise.all`. Build `wired`:
   - `showFaq-tickets-1`: only when `admissionPriceLabels(loaded.cards).length > 0`; `replaces: false`; body = `<AdmissionPriceList>` + `<Button as={Link} href="/national-show/tickets" variant="ghost">`
     with `{info?.admissionLinkLabel ?? 'See ticket prices and book'} →` (the string the what-to-expect page already uses). The Sanity answer (which says prices are provisional) stays above it.
   - `showFaq-getting-there-3`: only when `show?.venue?.name` and `info?.confirmations?.venue === 'confirmed'`; `replaces: true`; body = `<p>{show.venue.name}</p>`.
   - In preview (`!hideUnanswered`) render `<ShowStatusLine kind="confirmation" status="pending" pendingLabel researchLabel>` (no items) once, before `<ShowFaqList>`. Public renders none.
   - JSON-LD stays built from the Sanity answers, unchanged.
4. `app/(marketing)/national-show/what-to-expect/page.tsx`: add `loadTicketCardViewModels()` to the `Promise.all`. `admissionWired = admissionPriceLabels(loaded.cards).length > 0`.
   The Admission block entry uses `status: admissionWired ? 'confirmed' : status.admission` (this also drops it from `heldBack`, so the public holding note stops naming it).
   Admission `VisitorInfoBlock`: `body={admissionWired ? null : admissionNote}`, `status={admissionWired ? 'confirmed' : status.admission}`, children = `<AdmissionPriceList>` then the existing Tickets `Button`.
   Comment why 'confirmed': the priced list is the tickets page's own published fact. Nothing else on the page changes.
5. `app/(marketing)/national-show/nos-structure.css`: after `.nos-faq-answer { ... }` add `.nos-theme .nos-faq-answer [data-confirmation-badge] { letter-spacing: normal; text-transform: none; }` with a one-line comment. Do not touch the R19 block.
6. `docs/nos-faq-r57.md`: records r57, the audit table, `TICKET_PRODUCTS`/`loadTicketCardViewModels`, `confirmations.venue`, both row ids, `Admission`, the Sanity-read-only rule and the owner flags.
`goldens/reference-trial.patch` is the architect's trial (proved the checks green, then reverted). Non-binding: adapt, do not paste blindly.
Prettier: all five footprint files are clean at base except nos-structure.css (10 dirty lines); keep it at 10.

## Owner questions (route to saoc-82 / Lee-Ann; no Sanity write by us)
- O1  Admission prose ("charged per person per day, with concession rates for pensioners...") conflicts with the priced products. Please revise.
- O2  The Food prose says details "will be published once the committee confirms the venue", but the venue is confirmed.
- O3  The venue FAQ's Sanity answer also said entrance, parking and accessibility "are still being worked out". The wired row shows the venue name only; those topics keep their own rows.
- O4  (Codi) Public FAQ shows 13 rows whose prose says "has not been confirmed", with no marker. P2 public ("0 TBC rows") is met for markers only. Hide non-confirmed rows in public?
- O5  Sanity flags the four admission prices `provisional: true`, and the hub cards show no provisional note. The FAQ cost row keeps its Sanity sentence ("They remain provisional...");
      the Admission card carries no caveat, like the hub. Does Codi want one?

## Known limits
- Checks read live Sanity and the loader's Firestore sold counts (aggregate counts, no orders or PII), exactly like the hub. A price change on the hub is followed, not asserted.
- `contracts/checks/launch-weekend/f18/check-e-faq.mts` asserts the chip sits in the summary; r57 supersedes it (Codi). Not part of this gate.
- Wired rows are keyed by Sanity `_id`; a re-created FAQ doc silently unwires (falls back to its Sanity answer).
