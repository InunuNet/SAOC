# nos-critique-r17 F2 — NOS footer brand block: vertical monotone logo, REG and NPO only

BASE: `origin/main` `5c093d6e`. Branch `fix/nos-critique-r17`.
Ruling: Brad's beta review, relayed by the lead (saoc-82) on 2026-10-19, verbatim:

> "Vertical monotone logo, no paragraph just reg and NPO, paragraph is from SAOC remove it."

Golden: `f2-logo.json`. Footprint: `f2-footprint.json` (`components/nos-chrome/NosFooter.tsx`, `components/nos-chrome/nos-chrome.css`, `components/chrome/footer-data.ts`), plus `chosen.dest`.
Sources: `docs/rules/no-invention.md`; `design/design_handoff_saoc/`; `branding/National Show 2027/` (Logo/, and "National Orchid Show 2027 Logo.pdf").

## BASE (measured)

`NosFooter.tsx` `.nf-brand` contains:

- one `<picture>`: the horizontal full-colour reversed lockup `/images/nos/nos-reversed-horizontal-1200.png` above 700px, and `/images/nos/nos-reversed-white-vertical-900.png` at or below 700px (a 900px derivative). Both use `alt` LOCKUP_ALT "National Orchid Show, Western Cape 2027";
- the `.nf-head` eyebrow FOOTER_ORG_NAME "South African Orchid Council" (rendered uppercase);
- the `.nf-text` paragraph FOOTER_BRAND_TEXT "A national coordinating body … since 1968.";
- the `.nf-reg` line FOOTER_REG "REG# 1978/004040/08   NPO 043-901".

The footer ground is royal `#211A57`, rgb(33, 26, 87).

## Target

- **Logo.** One `<img>` (no `<source>` switch) showing the chosen vertical file at every width.
  - Alt stays LOCKUP_ALT.
  - The file is copied byte-identical from `branding/National Show 2027/Logo/` to `chosen.dest` in `public/images/`. The existing loader (`lib/image-loader.ts`, `scripts/generate-image-variants.mjs`) generates its WebP variants at build time, with no extra step.
  - Nothing under `branding/` is added, deleted or committed.
- **Removed.** The eyebrow and the paragraph go. FOOTER_ORG_NAME and FOOTER_BRAND_TEXT are no longer imported into NosFooter. `components/chrome/footer-data.ts` was first specified as byte-unchanged (superseded by the amendment below). Note: the SAOC footer does not render the paragraph at BASE either (it shows only SaocLockup and the REG line), so FOOTER_BRAND_TEXT becomes an export nothing renders. **Amendment (lead ruling, 2026-10-19):** delete it. `footer-data.ts` BASE lines 24–26 (the two-line const and the blank line after it) are removed, and nothing
else in the file changes. FOOTER_REG stays byte-exact. `footer-data.ts` joins `f2-footprint.json`. f2-static S6 requires 0 references to
`FOOTER_BRAND_TEXT` in app, components, lib, sanity, content, types and scripts.
- **Kept.** "REG# 1978/004040/08   NPO 043-901", exactly: the separator is three U+00A0 no-break spaces, as in BASE.
- The old `/images/nos/*` files stay on disk. The horizontal one is still used by the OG route (`app/(marketing)/national-show/og/route.tsx:29`).

## The file choice: PENDING (Codi). `chosen` is one golden field.

| | reversed-white-vertical | reversed-gold-vertical |
|---|---|---|
| sha256 | 265102a6…1e1a | fdf12524…9ede |
| pixels | 3272×2876, alpha | 3272×2876, alpha (identical geometry) |
| emblem | lilac-white, median 13.39:1 on royal; darkest shading 5.16:1 | gold, median 11.62:1; darkest shading 3.99:1 |
| wordmark | white, 15.55:1 | pale gold #F3F2D6, 13.69:1 |
| location line | **olive rgb(190,191,106), 8.04:1** | gold rgb(214,214,156), 10.34:1 |
| monotone? | **no**: two inks (white plus an olive location line, per the PDF's "ON DARK: location line Green 1") | **yes**: one gold family |

Both pass on the royal footer: type is at least 4.5:1 and the emblem graphic at least 3:1. Brad asked for "monotone", and only the gold file is a single ink.
Recommendation for Codi: gold. To fill `chosen`, copy the whole candidate object (`source`, `sha256`, `dest`, `path`, `dims`) and re-pin. Until then f2-static S3 and
f2-rendered R1 FAIL as PENDING.

## Size: GAP (DECISION NEEDED)

The logo PDF (p.08) gives only a minimum: emblem height at least 24px on screen, and clear space on all sides of a quarter of the emblem width, measured from the
petal tips and the ends of the location line. Neither the PDF nor `design/design_handoff_saoc/` gives a footer render size for the vertical
lockup, so I am not inventing one: `guidance.renderWidth` is null.

The only existing value is the current footer's vertical box, `min(342px, 100%)` at or below 700px (`nos-chrome.css:154`, `VERTICAL_BOX`).
Once the lead or Codi sets `renderWidth`, f2-rendered R4 enforces it to ±1px. Until then the checks enforce the PDF minimum and clear space only.

## Legibility on the royal ground

Contrast is fine for both files (see the table). The risk is the size of the type at the footer scale. The file's location line ("WESTERN CAPE · 2027")
is 56–66 file px tall in a 2876px-high image. At a 342px render width (300px tall), that gives location-line glyphs about 6–7px tall, and the wordmark
band (112 px) gives about 12px. Expect the location line to be hard to read at that width. The PDF's answer is "set the mark larger rather than simplifying it".
Flagged for the size decision; it is not a blocker for either file.

Clear space at 342px is about 61px from the content box. The rendered REG line therefore has to sit at least about 35px below the image bottom
(BASE `.nf-brand` gap is 20px). R4 checks this.

## Checks

The `f2-static.mjs` checks:

- S1: no FOOTER_ORG_NAME or FOOTER_BRAND_TEXT in NosFooter, FOOTER_REG still rendered, alt kept, old files not referenced.
- S2: footer-data.ts is BASE minus the dead export.
- S3: `chosen` is filled, referenced and sha-equal, and no `branding/` commit.
- S4: no invention.
- S5: the docs have a "## F2" section.
- S6: 0 references to FOOTER_BRAND_TEXT.

The `f2-rendered.mjs` checks run on public and preview builds at 1280 and 390, on /national-show, /national-show/tickets and /national-show/exhibitors:

- R1: one image, the chosen file, alt, aspect, and served sha.
- R2: no eyebrow and no paragraph.
- R3: the REG/NPO line is exact.
- R4: emblem at least 24px, clear space, royal ground, `renderWidth` once set.
- R5: the SAOC footer on /about still shows the REG/NPO line and not the NOS logo.
