# nos-critique-r9

## F1 - lockup image delivery

Every NOS page used to download 537,176 bytes of lockup PNG: the header lockup, and both footer
lockups, because the footer drew two eager images and CSS hid one. Only delivery changes; the
artwork, boxes, aspect ratios and alt text do not.

- Header (`NosHeader.tsx`): `next/image`, `priority`, 1200x294, `sizes` from the real box
  (448px, 390px below 700px). The brand link and its aria-label are unchanged.
- Footer (`NosFooter.tsx`): ONE `<picture>`. A `<source media="(max-width: 700px)">` carries the
  vertical (900x791); one lazy, async `<img>` carries the horizontal (1200x294), with no
  fetchPriority. `nos-chrome.css` lost the two-image show/hide rules and keeps the boxes.
- The sources are still the supplied `/images/nos/*.png`; the existing custom loader
  (`lib/image-loader.ts`) maps them to the pre-built WebP candidates in `public/images/_opt/`.
  No new asset, no loader change.

## F2 - research chip

A research chip inside a disclosure shows the existing short tag (`StatusMarker`'s `FALLBACK_RESEARCH_LABEL`) at every width, via the opt-in `shortResearch` prop (forwarded by `ConfirmationBadge`). The full research wording (Sanity `researchLabel`) becomes the group aria-label and is drawn as a `ShowStatusFoot` inside the group; with no `researchLabel` the group keeps its label and has no foot. Pending, mixed (pending beats research) and bare markers are unchanged.

## F3 - no fractional-width gap in the chip steps

The narrow chip steps use media range syntax, so a viewport of 419.5, 374.5 or 359.5px no longer falls between two integer steps: tracking 0 below 375px, 0.02em below 420px, 0.06em up to and including 700px, and the short tag below 360px (`StatusMarker`, on both spans). Values are unchanged. Each narrower tracking step adds a `:not([hidden])` to win by specificity. Measured: normal at 359, 360 and 374; 0.24px at 375 and 419; 0.72px at 420 and 700; 1.68px at 701; one line throughout.
