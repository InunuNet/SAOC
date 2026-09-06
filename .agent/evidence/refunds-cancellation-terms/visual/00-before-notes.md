# Visual baseline — /refunds

Captured: 2026-09-06T20:34:59Z UTC | commit 1c2fe858
Source: https://beta.saoc.co.za/refunds (HTTP 200 at all three viewports)
Tool: playwright chromium, fullPage, real viewport sizes

| viewport | file |
|---|---|
| desktop-1440 | before-desktop-1440.png (1,0M) |
| mobile-320 | before-mobile-320.png (452K) |
| mobile-375 | before-mobile-375.png (472K) |

## Observed state (desktop-1440, read from the rendered page)

- Hero renders correctly; SAOC chrome intact above the fold.
- An existing grey callout already states: "Draft pending legal review. This page has been
  drafted with AI assistance and has not yet been reviewed by a qualified legal professional."
  Provisional figures therefore extend an existing disclaimer rather than needing a new one.
- Five headings, all figure-free: Terms pending confirmation, Refunds, Cancellations,
  Exceptional circumstances, How to request a refund or cancellation.
- Body copy repeatedly defers: "have not yet been confirmed by the council",
  "pending council confirmation". This is the gap the feature closes.
- Footer links to Privacy / Terms / Refunds / Constitution / Media kit — cross-page
  consistency matters, per the research brief.
- "Last updated: August 2026" — must be refreshed when terms land.
