# nos-critique-r17

Brad's beta review, relayed by the lead (saoc-82) on 2026-10-19, with Codi's FINAL rulings. BASE `origin/main` `5c093d6e`.
Every edit stays inside `docs/rules/no-invention.md` (no new copy, tokens or colours), `design/design_handoff_saoc/` and
`branding/National Show 2027/`. Nothing under `branding/` changes.

## F1 - The exhibitor card goes to the vendor application flow

Ruling, verbatim: "Exhibitor and Trader do the same vendor application flow."

- **/national-show/tickets, "Exhibiting or trading?"** (`FOOT_OPTIONS` in
  `app/(marketing)/national-show/tickets/page.tsx`). Three lines of the exhibitor card change:
  - The "I'm exhibiting orchids" body drops the sentence "Entry sales are not yet open — they open closer to the show."
    and gains nothing in its place. It now reads "See what is involved in exhibiting at the National Show."
  - The CTA is relabelled "Exhibitor entry" → "Apply to exhibit" (Codi's ruling, sentence case).
  - The CTA now goes to `/national-show/vendors/apply`, the same href as the trader card's "Vendor registration".
- **Search overlay quick link** (`components/chrome/SearchOverlay.tsx:37`). "Exhibit at the National Show" now goes to
  `/national-show/vendors/apply` (lead amendment). It was the only other link to `/national-show/exhibitors` that read
  as an action. Its label is unchanged.
- **Other links to `/national-show/exhibitors` are unchanged.** These are the ShowBand "Exhibitor info", the show
  overview button, the nav "Exhibitor entry guide" (mega menu, mobile drawer, NosShowIndex and NosSubNav), the sitemap
  and the JSON-LD. Each is an information link to the grower entry guide, not the entry CTA. The full list is in
  `f1-spec.md` section 2.
- **Note for the lead:** the kept body still reads "See what is involved in exhibiting", while the CTA now opens the vendor
  application. The ruling allows no new copy, so the wording stays as it is.
- **Known gap (accepted).** Per Brad ("Exhibitor and Trader do the same vendor application flow."), the exhibitor CTA
  opens the shared vendor application.
  - That form requires a business name, a product category and at least one stand, so a non-trading orchid exhibitor
    cannot complete it as it stands.
  - The field requirements come from Lee-Ann's registration form and are unchanged here.
  - The lead ruled on 2026-10-19 that this is an accepted product gap, not a code defect.
  - It is queued as a question for Lee-Ann: which fields become optional for non-trading exhibitors. Any field change
    will come later under its own contract.

## F2 - NOS footer brand block: the gold vertical lockup, then REG and NPO only

Ruling, verbatim: "Vertical monotone logo, no paragraph just reg and NPO, paragraph is from SAOC remove it." Codi's
FINAL rulings set the file, size, placement and REG/NPO style.

- **Logo.** One centred `<picture>` in `components/nos-chrome/NosFooter.tsx` shows the gold vertical lockup at every width.
  The horizontal file and the ≤700px swap are gone.
  - The file is `public/images/NOS-2027-logo-reversed-gold-vertical.png`, 3272×2876. It was copied byte-identical from
    `branding/National Show 2027/Logo/` (sha256 `fdf12524…9ede`).
  - The `<img>` carries a 1x/2x density set for a 360px box. The custom loader maps it to the WebP variants it builds.
  - The alt stays LOCKUP_ALT, "National Orchid Show, Western Cape 2027".
- **Size and placement** (`components/nos-chrome/nos-chrome.css`).
  - The lockup is 360px wide at ≥701px and 280px at ≤700px, never wider than the `.nf-wrap` content box.
  - It is centred on the royal band. The brand block now spans the full grid row at every width, so the ≥1180px
    four-column layout with the logo in its own column is gone. Explore, Partners and Stay in touch sit in three columns
    below it.
- **Clear space** (logo PDF p.08). The gap from the lockup's visible bottom to the REG/NPO line is 0.25 × the rendered
  emblem width: about 64.6px at 360 and 50.3px at 280.
  - It is set as a percentage bottom margin on the image, so it scales with the image's width, including when the width is
    capped.
  - The margin subtracts the file's own transparent foot from the gap.
- **Removed.** The "South African Orchid Council" eyebrow and the SAOC paragraph are removed.
  - `FOOTER_BRAND_TEXT`, which nothing renders any more, is deleted from `components/chrome/footer-data.ts`. No references
    to it remain.
  - The now-unused `.nf-org` wrapper and its CSS are removed.
- **REG/NPO.** `FOOTER_REG` is unchanged byte for byte and is still the first text after the lockup. It reads "REG#
  1978/004040/08", then three U+00A0 no-break spaces, then "NPO 043-901".
  - It is restyled in the footer's existing label role, `.nf-head` (Karla 700, 12px, 0.14em, uppercase), in
    `--nc-gold` #F3F2D6. That is 13.69:1 on the royal ground.
  - No new token or colour is added.
- **Unchanged.** The `.nf-base` row (copyright and legal links). The old `/images/nos/*` lockups stay on disk, because the
  OG route still uses the horizontal one.
