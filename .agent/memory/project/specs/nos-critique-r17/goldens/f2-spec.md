# nos-critique-r17 F2 — NOS footer brand block: vertical monotone logo, REG and NPO only

BASE: `origin/main` `39b15ec0` since the restack (was `5c093d6e` when the spec was written; main's 5c093d6e..39b15ec0 touches none of the F2 files). Branch `fix/nos-critique-r17-restack`.
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

- **Logo.** One centred `<picture>` (1x/2x cap, no ≤700 swap) showing the gold vertical file at every width: 360px at ≥701px, 280px at ≤700px (see Codi's rulings below).
  - Alt stays LOCKUP_ALT.
  - The file is copied byte-identical from `branding/National Show 2027/Logo/` to `chosen.dest` in `public/images/`. The existing loader (`lib/image-loader.ts`, `scripts/generate-image-variants.mjs`) generates its WebP variants at build time, with no extra step.
  - Nothing under `branding/` is added, deleted or committed.
- **Removed.** The eyebrow and the paragraph go. FOOTER_ORG_NAME and FOOTER_BRAND_TEXT are no longer imported into NosFooter. `components/chrome/footer-data.ts` was first specified as byte-unchanged (superseded by the amendment below). Note: the SAOC footer does not render the paragraph at BASE either (it shows only SaocLockup and the REG line), so FOOTER_BRAND_TEXT becomes an export nothing renders. **Amendment (lead ruling, 2026-10-19):** delete it. `footer-data.ts` BASE lines 24–26 (the two-line const and the blank line after it) are removed, and nothing
else in the file changes. FOOTER_REG stays byte-exact. `footer-data.ts` joins `f2-footprint.json`. f2-static S6 requires 0 references to
`FOOTER_BRAND_TEXT` in app, components, lib, sanity, content, types and scripts.
- **Kept.** "REG# 1978/004040/08   NPO 043-901", exactly: the separator is three U+00A0 no-break spaces, as in BASE. It stays in the same position (the first text after the lockup), restyled in the label role per Codi.
- The old `/images/nos/*` files stay on disk. The horizontal one is still used by the OG route (`app/(marketing)/national-show/og/route.tsx:29`).

## Codi's rulings (FINAL, relayed by the lead, 2026-10-19, after her correction)

These supersede the open questions in the first version of this spec. The white lockup and the 200/160px sizing were withdrawn by Codi's correction.

| ruling | spec |
|---|---|
| **Logo: GOLD** `NOS-2027-logo-reversed-gold-vertical.png`, sha256 `fdf12524…9ede` | `chosen` in `f2-logo.json`. Codi: "the only true one-ink lockup, 13.7:1 on #211A57". No file in `public/` at BASE hashes to it (the existing `public/images/nos/nos-reversed-white-vertical-900.png` is a 900px white derivative), so the dev copies it byte-identical to `public/images/NOS-2027-logo-reversed-gold-vertical.png` |
| **Width** 360px at ≥701px, 280px at ≤700px, never wider than the footer wrap's content box (100% minus the gutters) | `guidance.renderWidth`; R4 ±1px |
| **Markup**: one `<picture>`, the 1x/2x cap kept, the ≤700 swap dropped (same file) | R1: one `<picture>`, no `<source media>`, every candidate is the gold file or its `_opt` variant with a 1x/2x descriptor, and alt is LOCKUP_ALT |
| **Centred** on the royal band | R4: the image centre equals the `.nf-wrap` content-box centre, ±1px |
| **Gap** from the lockup's bottom edge to REG/NPO = the PDF clear space, `calc(0.25 × rendered emblem width)` | R4. The emblem is 2350 of the file's 3272px width (71.8%), so the gap is about 64.6px at 360 and 50.3px at 280. It is measured from the lockup's visible bottom (the location line, file y 2620) to the REG line's top. The check accepts the rule −1px, up to the rule plus the image's own transparent bottom padding (+1px), so a margin taken from the image box bottom also passes. Source: logo PDF p.08 "Clear space and minimum size" |
| **REG/NPO**: text and position as BASE, restyled in the label role | R3. The text is exact (three U+00A0) and is the first text after the lockup. Computed style: Karla, 700, 12px, letter-spacing 1.68px (.14em), uppercase, rgb(243, 242, 214), at least 4.5:1 on its ground (13.69:1 on royal) |
| **Legal row** (copyright and legal links) unchanged | R5 compares it with the BASE footer-data list |
| Remove the SAOC eyebrow, the paragraph and `FOOTER_BRAND_TEXT` | S1, S2, S6, R2 |

### Label role, colour and font: all existing, no gap

- **Label role.** `components/nos-chrome/nos-chrome.css:129` `.nf-head` is `700 12px/1.3 var(--nc-sans)`, letter-spacing 0.14em, uppercase. This is the NOS footer's existing label role; only its colour (green-1) differs from Codi's.
- **Colour.** `--nc-gold: #F3F2D6` (`nos-chrome.css:9`). The same value also appears as `--nos-pale-gold` (`app/globals.css:31`) and `--gold` (`nos-theme.css:321`, nos-v4 `index.html:16`). Brand PDF p.05: "Pale gold #F3F2D6".
- **Font.** Karla comes from `components/nos-chrome/fonts.ts` (next/font, `--font-nos-karla`) through `--nc-sans` (`nos-chrome.css:164`).

### Legibility on the royal ground

Gold on #211A57: wordmark 13.69:1, location line 10.34:1, emblem darkest shading 3.99:1 (graphic at least 3:1). At 280px the location line renders about 5–6px tall and
the wordmark about 10px. Codi ruled the size, so this is recorded and not flagged again.

## Checks

The `f2-static.mjs` checks:

- S1: no FOOTER_ORG_NAME or FOOTER_BRAND_TEXT in NosFooter, FOOTER_REG still rendered, alt kept, old files not referenced.
- S2: footer-data.ts is BASE minus the dead export.
- S3: the gold file is referenced and sha-equal, and no `branding/` commit.
- S4: no invention.
- S5: the docs have a "## F2" section.
- S6: 0 references to FOOTER_BRAND_TEXT.

The `f2-rendered.mjs` checks run on public and preview builds at 1280 and 390, on /national-show, /national-show/tickets and /national-show/exhibitors:

- R1: one `<picture>` of the gold file (1x/2x, no swap), alt, aspect, served sha.
- R2: no eyebrow and no paragraph.
- R3: the REG/NPO text is exact, first after the lockup, in the label-role restyle, at least 4.5:1.
- R4: width 360/280 (capped), centred, royal ground, emblem at least 24px, gap = calc(0.25 × emblem width), clear space free.
- R5: the legal row is unchanged; the SAOC footer on /about keeps REG and shows no NOS logo.
