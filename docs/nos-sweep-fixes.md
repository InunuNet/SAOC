# nos-sweep-fixes

Four NOS Design sweep rulings (2026-10-25). NC-1, TK-1 and SP-1 are fixed here; NX-1 is deliberately withheld.

## NC-1 (P1) and TK-1: ticket card plate `sizes`

`STUB_PHOTO_SIZES` in `components/tickets/keepsake/parts.tsx` was `(max-width: 700px) 50vw, 300px`, which made the browser pick a plate image too small for the stacked stub (a half-width card, 421px at 2056). NC-1 set it to `(max-width: 700px) 100vw, 421px`. TK-1 (the `/tickets` stub cover upscale) replaced that with `(max-width: 700px) 100vw, (max-width: 1018px) 470px, (max-width: 1265px) 625px, 600px`, derived in `values.json` `nc1.sizesDerivation`; no stub CSS changed. The constant is shared by every `TicketStub` (`TicketCard`, `TicketMini`, `SessionTicketCard`), so the Workshops card on `/tickets` and `/programme` is fixed without touching either page. The smaller admission plates are over-served; accepted, to avoid a per-card prop.

## SP-1 (P2): presenter portrait upscale and srcset

`lib/view-models/presenter-photo.ts` no longer upscales. The requested width is `min(requested, available)`, where `available` is the crop rect width for a mapped asset and the width encoded in the Sanity asset ref (`-<W>x<H>-<ext>`) otherwise; an unparseable ref caps at the 160px plate. The 1.3x ceiling (`MAX_UPSCALE`) is gone, both URL shapes carry `fit=max`, and `PresenterPhoto` gains a `srcSet` of the 1x (160) and 2x (320) candidates. `PresenterGrid.tsx` renders a plain `<img srcSet>` because `next/image` with `unoptimized` drops `srcset`. Tibbs (201px original) now requests 160 and 201 instead of 261.

## NX-1 (P1 copy): exhibitors lede, withheld

Ruled (a) accept as is. The lede is Sanity content (`showExhibitorInfo.intro`); the public build already trims it to the first sentence, and only the beta preview shows the full draft to the committee. The trim is removed when uuu lands, so no code change and no guard ships here. This is the known gap: the full drafting text is visible in preview until the content is edited in Sanity.
