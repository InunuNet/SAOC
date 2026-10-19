# nos-critique-r17

Brad's beta review, relayed by the lead (saoc-82) on 2026-10-19. BASE `origin/main` `5c093d6e`. Every edit stays inside
`docs/rules/no-invention.md` (no new copy, tokens or colours) and `design/design_handoff_saoc/`.

## F1 - The exhibitor card goes to the vendor application flow

Ruling, verbatim: "Exhibitor and Trader do the same vendor application flow."

- **/national-show/tickets, "Exhibiting or trading?"** (`FOOT_OPTIONS` in
  `app/(marketing)/national-show/tickets/page.tsx`). Exactly two lines change:
  - The "I'm exhibiting orchids" body drops the sentence "Entry sales are not yet open — they open closer to the show."
    and gains nothing in its place. It now reads "See what is involved in exhibiting at the National Show."
  - The "Exhibitor entry" CTA now goes to `/national-show/vendors/apply`, the same href as the trader card's "Vendor
    registration". The label is unchanged.
- **Other links to `/national-show/exhibitors` are unchanged.** These are the ShowBand "Exhibitor info", the show
  overview button, the nav "Exhibitor entry guide" (mega menu, mobile drawer, NosShowIndex and NosSubNav), the search
  overlay quick link, the sitemap and the JSON-LD. Each is an information link to the grower entry guide, not the entry
  CTA. The full list is in `f1-spec.md` section 2.
- **Note for the lead:** the kept body still reads "See what is involved in exhibiting", while the CTA now opens the vendor
  application. The ruling allows no new copy, so the wording stays as it is.
