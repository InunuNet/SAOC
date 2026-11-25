# NOS inner hero consistency (Brad, 25 Nov 2026)

One hero height per breakpoint on every NOS inner route, whatever the content. The hub keeps its own hero.

## Height formula

| Width | Hero box | Copy inside the box | Below the box, on the page ground |
|---|---|---|---|
| 1024 and up | `max(420px, 29.3vw)` (SAOC PageHero), padding-block `clamp(32px, 2.5vw, 48px)` | crumbs, h1, lede, facts, actions | sub-nav |
| 768 to 1023 | 320px row: title block (58%) beside the photo (42%) | crumbs, h1 | lede, facts, actions |
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
labels and rule-coloured dividers. From 1024 the lede fills the copy column (max-width none), and the three-fact
row is a single row, so every route's copy fits inside the fixed box.

## Scrim

The SAOC PageHero ramp (alpha 0 to 0.8 over 34-52%) mirrored and drawn as the photo's mask, intersected with the
photo box's 22% edge fade. Visibility at the copy edge E = max(48cqw, axis + 640px): 0.2, then 0.3 / 0.48 / 0.68 /
0.84 / 0.94 / 1 at E + 1.5 / 4 / 7 / 10 / 14 / 18cqw. No dark gradient lies over the bloom.

## Contrast floor

Every hero text run over the photo (1024, 1440, 2056) clears 4.5:1 (h1 3:1) against the brightest pixel behind it.

## Navigation

A nav group with exactly one link renders as a plain link to that page, labelled with the group heading, in the
top row and in the menu panel. Vendors is the current case. The R27 group sub-nav does not render for a one-link
group; Programme pages keep theirs.

## Contact

The Contact hero carries the shared facts strip: Dates and Venue from the show facts, and Email (the show
contact address, a mailto link). No new copy.
