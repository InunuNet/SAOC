# nos-critique-r20 F3: the NOS footer follows the SAOC footer layout

BASE: `origin/main` `a4807791`. Branch `fix/nos-critique-r20`.
Ruling: Codi, FINAL, on Brad's direction that the "NOS Footer should follow the same layout as the SAOC footer", relayed verbatim by the
lead on 2026-10-20. It supersedes the r17 full-row centred brand (nos-critique-r17 F2) and retires the 0.25 x emblem clear-space gap.
Goldens: `f3-edits.json` (exact SAOC-side edits, retired NOS rules, acceptance numbers), `f3-footprint.json`, `f3-baseline.json` (the SAOC
footer at BASE). Sources: `components/chrome/Footer.tsx` (the layout); `docs/rules/no-invention.md`.

## Content mapping (NO INVENTION: nothing new)

Both footers already render from `components/chrome/footer-data.ts`, so every heading, link and line exists in the NOS footer today:

| column | content |
|---|---|
| 1 | the brand slot plus REG/NPO (`FOOTER_REG`) |
| 2 | Explore (`FOOTER_HEADINGS.explore`, `FOOTER_NAV`) |
| 3 | Partners (`FOOTER_HEADINGS.partners`, `partners`) |
| 4 | Stay in touch (`FOOTER_HEADINGS.touch`, `FOOTER_BULLETIN`), then "Looking for wild orchids?" (`FOOTER_WOSA`, link https://wildorchids.co.za) |

The bottom bar is the copyright (`FOOTER_COPYRIGHT_TAIL`) on the left and `FOOTER_LEGAL_LINKS` on the right.

**No gaps to report.**

## Build route (decision: one shared layout, two skins)

Options weighed:

1. **NosFooter copies Footer.tsx's grid classes.** Zero SAOC blast radius, but the two footers can drift silently. That is how this
   ruling came about.
2. **Footer.tsx becomes the shared component, with a brand slot and NOS tokens under .nos-theme.** No drift, but every SAOC page's footer
   is re-plumbed. The SAOC skin is Tailwind utilities with SAOC colours, so NOS theming would need class overrides or a variant prop
   threaded through every element. That is the widest blast radius and the most code.
3. **Chosen: shared layout constants.** `footer-data.ts`, already "the one home" of both footers' words, gains `FOOTER_LAYOUT`. It holds
   the five SAOC layout class strings verbatim: `grid`, `brandColumn`, `brandMark`, `bar`, `legal`.
   - Footer.tsx swaps its five literals for the keys. That is a pure refactor: the same strings and the same DOM, which L7 proves
     pixel-for-pixel on the SAOC routes.
   - NosFooter uses the same keys, so the grid, breakpoints, order and bar cannot drift. Colour and type stay NOS (nos-chrome.css), and
     the column internals stay NOS.
   - Blast radius onto SAOC is a no-op refactor, checked by L7.
   - Tailwind v4 scans footer-data.ts like any source file.

## Exact SAOC-side edits (`f3-edits.json`)

- `footerData`: the `FOOTER_LAYOUT` block, inserted before the copyright-tail doc comment (BASE line 47).
- `saocFooter`: Footer.tsx lines 19, 29, 38, 39, 128 and 133: the import, plus the five class literals swapped for `{FOOTER_LAYOUT.<key>}`.

## NosFooter (pinned by f3-static S3 and f3-rendered)

The markup:
- `footer#nf.nf` contains `<div className={FOOTER_LAYOUT.grid}>` with four columns in SAOC order:
  - column 1 is `<div className={`nf-brand ${FOOTER_LAYOUT.brandColumn}`}>`;
  - inside it, `<div className={FOOTER_LAYOUT.brandMark}>` holds the `Link.nf-lockup` with the one `<picture>` and `<img>`, followed by
    `<span className="nf-head nf-reg">`.
- Then comes the existing Explore, Partners and Stay-in-touch columns (`.nf-col`, `.nf-col-touch` with F1's label, and `.nf-wild`).
- Then `<div className="nf-base"><div className={FOOTER_LAYOUT.bar}>`, holding the copyright span and
  `<div className={`nf-legal ${FOOTER_LAYOUT.legal}`}>`.
- `.nf-wrap` and `.nf-grid` are gone.
- `LOCKUP_BOX = 248`: the density srcset follows the new box.

nos-chrome.css:
- `.nf` keeps its ground, colour and font, and drops its own padding-block. The grid carries py-16, the bar py-4, and the iOS
  safe-area inset stays as `padding-bottom: env(safe-area-inset-bottom, 0px)`, which is 0 on desktop and in the checks.
- `.nf-wrap`, `.nf-grid` and its two breakpoint rules go, along with:
  - the r17 `.nf-brand` grid/centre rule;
  - the `.nf-lockup` widths `min(360px, 100%)` and `min(280px, 100%)`;
  - the clear-space margin;
  - `.nf-col-touch { grid-column: 1 / -1 }`;
  - the `.nf-base` column rule.
- New rules: `.nf-lockup { display: block; width: 248px; max-width: 100%; line-height: 0; border-radius: 4px; }`, and
  `.nf-lockup img { display: block; width: 100%; max-width: none; height: auto; }`.
- `.nf-base` keeps only its rule line (border-top lilac .2, the existing NOS value), its 13px size and its .02em tracking. `.nf-legal`
  drops its own flex and gap, because the bar's `legal` classes carry them.
- REG/NPO keeps `.nf-head` plus `.nf-brand .nf-reg` (gold, tabular numerals). Its centring goes, because the parent no longer centres, so
  it sits on the column's left edge, 32px under the lockup (mb-4 + gap-4, SAOC's).

## Acceptance (f3-rendered.mjs; both modes, at 1280, 900 and 390)

- **L1:** the column x and width equal SAOC's, measured live on /about (at 1280: 32, 344, 656, 968), the grid box equals SAOC's, and
  the columns start 64px under the footer top.
- **L2:** the height is within 40px of SAOC's (476px at 1280) at 1280 and 390.
- **L3:** the bar equals SAOC's.
- **L4:** the lockup is 248 wide, centred over column 1, on the column top, and level with Explore at 1280.
- **L5:** REG/NPO is left-aligned across the column, 32px under the lockup, in the label role, and gold.
- **L6:** the headings, the WOSA block and the royal ground are in place, with no overflow.
- **L7:** the SAOC footer on /, /about, /events and /contact equals BASE in boxes and pixels.

## Superseded

nos-critique-r17 F2 (the full-row centred lockup, 360/280px, the 0.25 x emblem clear space) and the stale
`contracts/checks/nos-own-brand-chrome/check-b-logos.mjs` and `check-c-lockup-sizes.mjs` describe footers that no longer exist. None runs
in CI: the contract-suite step is an inventory ratchet that executes no assertion, and the e2e suite has no footer test. r17's checks are
branch-scoped (their footprint guard pins r17's own BASE), so they are not re-run on main. This section is the record of the
supersession, and r17's hash-pinned files stay untouched.

## Risk to watch at capture

L2 at 390: the NOS column internals are taller than SAOC's (15px lists at 44px, the stacked form). The estimate is SAOC ~1111px against
NOS ~1138px at 390, and SAOC 476 against NOS ~500 at 1280, both inside the 40px tolerance. If the rendered run shows otherwise, that is
a DECISION for the lead (tighten the NOS column internals, or widen the tolerance), not a dev call.
