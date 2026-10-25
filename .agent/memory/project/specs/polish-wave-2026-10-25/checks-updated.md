# Pre-existing checks edited (supersession)

- contracts/checks/vendor-form-input-focus-indicators-f1/check-a1-ring-tokens.sh: expected inputClass token
  `focus-visible:ring-ink/40` is now `focus-visible:ring-primary` (F2 spec item 3). Check kept, still passes.
- contracts/checks/vendor-form-input-focus-indicators-f1/check-a2-checkbox-radio-regression.sh: pinned checkbox and
  radio class strings changed from `h-4 w-4 ... focus:ring-ink/40` to `size-6 ... focus:ring-primary` (F2 spec items 1 and 3).
  Check kept as a regression guard on the new strings, still passes.
- contracts/golden/saoc-seo-polish/sitemap-expected.json (F3): `/members` moved from `include` to
  `exclude` with a reason. The members area has no portal yet, so the sitemap no longer lists it;
  without this edit the drift guard contracts/checks/saoc-seo-polish/check-sitemap-routes.mts fails.
- contracts/checks/polish-wave-2026-10-25/f5-event-detail-rendered.mjs (F9 P2): the "band is below the meta table"
  assertion now measures against the h1, because the National Show event page drops its meta <dl> when the band
  renders (ruling P2). The band-once, CTA-href, chip and back-link assertions are unchanged.
- contracts/checks/polish-wave-2026-10-25/f9-submit-rendered.mjs (F9 P3 fix): the centre reference was
  documentElement.clientWidth / 2, which ignores the 15px `scrollbar-gutter: stable` reservation (measured 712.5 vs 720 at 1440,
  952.5 vs 960 at 1920). It now compares the form centre with the centre of [data-page-hero] (falling back to main), per the
  ruling's "centred under the hero". The 2px tolerance and the 480-640px width bounds are unchanged.
- contracts/checks/polish-wave-2026-10-25/f9-static.mjs (F9 P1 threshold ruling): the accepted container-query variant range
  moved from 340-384px to 300-330px (set at 320px), so it sits between the event-page countdown box (~262px) and the home box
  at 390 (~326px) and the query is a no-op on home, per the ruling's "if it already fits".
- contracts/checks/polish-wave-2026-10-25/f9-countdown-rendered.mjs (same ruling): the home ShowBand at 390 and 414 must now render
  the four cells on one row, with the existing no-overflow assertions. Other widths and the event page are unchanged.
