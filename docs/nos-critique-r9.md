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
