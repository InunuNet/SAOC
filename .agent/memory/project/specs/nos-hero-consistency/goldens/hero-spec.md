# NOS inner hero consistency (Brad, 25 and 26 Nov 2026)

One hero height per breakpoint on every NOS inner route, whatever the content. The hub keeps its own hero.

## Height formula (locked; Brad, 26 Nov 2026: "lock the height")

| Width | Hero box | Copy inside the box | Below the box, on the page ground |
|---|---|---|---|
| 1024 and up | `height: max(420px, 29.3vw)` (the SAOC PageHero box), padding-block `clamp(32px, 2.5vw, 48px)` | crumbs, h1, lede, facts, actions | sub-nav |
| 768 to 1023 | 320px, the full-bleed photo bounded to the box row | crumbs, h1 | lede, facts, actions |
| below 768 | 2:1 photo band, then a title block of `124px + 2 * max(3rem, 1.8rem + 3.2vw)` | crumbs, h1 | lede, facts, actions |

Expected box heights: 1440 = 421.9, 1024 = 420, 768 = 320, 390 = 415.

## Scope (lead rulings, 25 Nov 2026)

- The equal-height rule applies to photo heroes. A typographic hero (no photograph: 404, /tickets/recover,
  /archive) keeps its content-fit height: the PG-1 floor `clamp(320px, 22vw, 380px)` at padding
  `clamp(48px, 4vw, 72px)` from 1024, no floor below. At 390 an equal-height version is mostly an empty
  near-black block, the "too dark" look Brad objected to, with no photograph to fill it.
- /tickets is exempt, like the hub: it is the tickets landing page with its own approved fan masthead
  (TicketsMasthead: ticket fan, countdown, facts, visit row on the violet ground), and the 1 Dec go-live is days
  away. It is unchanged.
- /media-kit renders through NosHero (photo S2c) and follows the rule; it is admin-gated, so the rendered checks
  cannot reach it.

## Overflow treatment

Below 1024 the lede, facts and actions move out of the hero onto the light ground under it, set in ink with muted
labels and rule-coloured dividers. From 1024 the lede fills the copy column (max-width none). The copy column ends at
`max(48cqw, axis + 570px)`: 48% (PageHero's column) from about 1190px, wider below that because the vendor
application's lede and three facts need 570px of text to fit the locked box (58% at 1024).

## Photo and scrim: the SAOC interior hero system (Brad, 26 Nov 2026)

Brad: "ugly banding ... Where is the same system we use to fix the heroes on SAOC?" This supersedes NH2's split
panel and the 25 Nov photo mask for inner heroes.

- From 768 the photograph is full bleed across the box, through PageHero's `HeroPicture` (AVIF and WebP srcsets),
  with `sizes` driven by the source aspect (`heroSourceAspect`). Below 768 it is the 2:1 band that leads.
- No mask on the photograph, no solid panel, no fade into the ground.
- The copy sits on an overlay scrim local to the copy column, in the NOS ink (rgb 11 10 20), from
  `lib/interior-hero.ts`: PageHero's full strength (0.8) from the left edge to the copy edge, then the SAOC home
  hero's eased tail (shares 1, .97, .90, .78, .65, .5, .35, .22, .10, .03, 0 of 0.8, 2.2% apart) to clear over 22%
  of the width. PageHero's own ramp eases only at its clear end; mirrored onto a wide plateau, its slope change read
  as a vertical seam over bright petals, so the tail is the home hero's, which eases at both ends.
- The crops are full-width 2:1 cuts of the originals at native resolution (never resized), so the box shows the
  widest band each original allows. The colmanara (S3a) and the rust paphiopedilum (D1) are mirrored files (the
  SAOC `-flip` precedent) so the bloom sits right of the copy.
- Zoom: Brad asked for at least 50% less magnification. A full-bleed box is 1.6-1.8x wider than the 25 Nov panel
  and every original's full width is now on screen, so magnification rose 1.37-1.79x instead. Halving it needs
  originals of about 8,200px wide; a photograph choice for Brad.

## Contrast floor

Every hero text run over the photo (900, 1024, 1440, 2056) clears 4.5:1 (h1 3:1) against the brightest pixel behind
it.

## Navigation

A nav group with exactly one link renders as a plain link to that page, labelled with the group heading, in the
top row and in the menu panel. Vendors is the current case. The R27 group sub-nav does not render for a one-link
group; Programme pages keep theirs.

## Contact

The Contact hero carries the shared facts strip: Dates and Venue from the show facts, and Email (the show
contact address, a mailto link). No new copy.
