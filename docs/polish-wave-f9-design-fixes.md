# Polish wave F9 - NOS Design ruling fixes

NOS Design's #92 judgement (2026-10-25) produced three fixes, all implemented as ruled.

- P1: the ShowBand countdown overflowed at 390px on the event page, where the band sits in a
  narrower content column than on home ("MINUTES" ran into "SECONDS"). `components/home/ShowBand.tsx`
  now wraps the cells in a Tailwind v4 `@container` box with a `grid grid-cols-4
  @max-[300px]:grid-cols-2` grid. Below 300px of container width the four cells re-flow
  2x2 (Days/Hours, then Minutes/Seconds). Type, labels and markup are unchanged, so the query
  is a no-op wherever the band already fits (home at 390, 307px container, stays four across).
  The cell side padding below `sm` drops from `px-1.5` to `px-0.5` so the Minutes and Seconds
  labels fit their cells on home at 390 (they were 3px too wide).
- P2: the National Show event page stated dates and venue twice (meta table, then the band
  about 100px below). `app/(marketing)/events/[slug]/page.tsx` now gates the meta `<dl>` on
  `!show`. The h1, date line and band stay; ordinary events keep their table.
- P3: at 1440 the `/events/submit` form column sat flush left under a centred hero.
  `components/events/SubmitEventPageBody.tsx` now centres it with `mx-auto max-w-[640px]`. The
  mirror PR will later align it to the 52% copy column.

Out of scope: the band photo (orchid-dark-showband cut, mirror PR).

Checks: `contracts/checks/polish-wave-2026-10-25/f9-static.mjs`, `f9-countdown-rendered.mjs`
(320/360/390/414), `f9-event-meta-rendered.mjs`, `f9-submit-rendered.mjs`, plus
`f5-event-detail-rendered.mjs`.
