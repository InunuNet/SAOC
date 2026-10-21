# nos-critique-r20 F4: one footer rhythm, both footers (44px rows, 16px headings, aligned first rows)

BASE: `origin/main` `7fb251a1` (r18 and r19 merged). Branch `fix/nos-critique-r20`, worktree `.tmp/sandbox/critique-r20`.
Ruling: Codi, FINAL, footer-rhythm, relayed by the lead on 2026-10-22. It is an amendment to r20: F3 still lands the SAOC four-column
grid; F4 governs the row and heading rhythm inside the columns, in BOTH footers. Goldens: `f4-edits.json` (the exact SAOC-side edits,
the NOS markup and rules, the acceptance numbers), `f4-footprint.json`. Sources: `components/chrome/Footer.tsx`,
`components/nos-chrome/NosFooter.tsx`, `components/nos-chrome/nos-chrome.css`, `design/design_handoff_saoc/`; `docs/rules/no-invention.md`.

## The ruling (verbatim in substance)

1. ONE shared row class, defined once (in footer-data or a shared component), used in `Footer.tsx` AND `NosFooter.tsx`:
   `inline-flex min-h-11 items-center`, 14px, the column text colour, the ul with no gap. Every list row in every column is 44px, link
   or not.
2. The Explore, Partners and Stay in touch headings share the same eyebrow class, the same 16px bottom margin (the handoff kit:
   `design/design_handoff_saoc/ui_kits/website/components.jsx:469`, `marginBottom: 16`) and the same top. At 1280 they sit on one
   baseline. (`src/styles.css:1108` `.footer__label` says 18px; the ruling names 16px, the UI kit's value.)
3. Partners stay plain text inside the shared row. No URLs: the SANBI and Kirstenbosch URLs are owner items.
4. Stay in touch: the blurb, the form and the WOSA link keep their own blocks, but the column's first element starts at the same y as
   the first Explore and Partners rows. The WOSA link uses the shared row class.
5. The NOS footer gets the same rhythm and the same shared row; only the tokens differ.

## The defect, measured on BASE

- SAOC: Explore rows are `inline-flex min-h-11` links, 44px, in a gapless list. Partners are plain spans in a `gap-2` list, about 29px
  a row (the Partners column is 123px at 390 against Explore's 252px for five rows).
- NOS: Explore links are 44px (`.nf-list a`, flex, min-height 44px, 15px); Partners spans are padded (11px block, about 42px); the
  headings carry a 6px bottom margin (`.nf-head`), not 16px.
- The SAOC headings already sit 16px above their first row: `mb-1` (4px) plus the column's `gap-3` (12px). F4 keeps that.

## Build route (decision: a shared constant beside FOOTER_LAYOUT)

`footer-data.ts` gains `FOOTER_RHYTHM`, after `FOOTER_HEADINGS` (BASE line 22), on a different line from F3's `FOOTER_LAYOUT` block
(BASE line 47):

```ts
export const FOOTER_RHYTHM = {
  list: 'flex flex-col',
  row: 'inline-flex min-h-11 items-center text-[14px]',
};
```

`row` is the ruling's class, verbatim, with 14px. Colour, family, hover and the link target width stay with each skin, because the ruling
keeps the tokens per skin. Options weighed: a shared `<FooterRow>` component (heavier, and it would re-plumb both footers' JSX for one
class string), or a CSS class in globals (a second home for footer styling beside footer-data). The constant is F3's own pattern.

### SAOC (`f4-edits.json` `saocFooter`, exact)

Footer.tsx lines 22, 52, 57, 71, 74 and 118 (all distinct from F3's 19, 29, 38, 39, 128 and 133):
- 22: import `FOOTER_RHYTHM`.
- 52 and 71: both lists become `FOOTER_RHYTHM.list`. Partners' `gap-2` goes.
- 57 (Explore link), 74 (Partners name) and 118 (WOSA link): `${FOOTER_RHYTHM.row}`, followed by BASE's own skin classes, minus the four
  the row now carries. Links keep `min-w-11` (a 44px target; "About" is about 40px wide at 14px).
- Headings, the columns' `gap-3`, the form line and the WOSA block are untouched. BASE already spaces each heading 16px from its first
  element (4 + 12). Leaving the form line alone keeps it clear for footer-newsletter-subscribe.

### NOS (content-pinned: F1 and F3 rebuild NosFooter.tsx)

- NosFooter.tsx imports `FOOTER_RHYTHM`. The two lists are `` <ul className={`nf-list ${FOOTER_RHYTHM.list}`}> ``. The Explore
  `<Link>`, the Partners `<span>` and the WOSA `<a>` each take `className={FOOTER_RHYTHM.row}`.
- nos-chrome.css is unlayered, so it beats Tailwind's layered utilities. The row geometry and size therefore come off the NOS rules:
  - `.nf-list` drops `display: grid`;
  - `.nf-list a, .nf-list span` keep only line-height, colour and text-decoration;
  - the `.nf-list span` padding rule goes;
  - `.nf-wild a` keeps only its colour and underline.
  NOS colour, line-height and underline stay. The NOS rows go from 15px to the ruling's 14px.
- `.nf-col > .nf-head { margin-bottom: 16px; }`. This rule also reaches F1's `<label className="nf-head">`, which is a direct child of
  `.nf-col-touch`. That keeps F1 R3 true (the label's margin-bottom equals the heading's), and the label sits 16px above the input, not 6px.
  The WOSA heading (`.nf-wild .nf-head`) and REG/NPO (`.nf-brand .nf-reg`) keep 6px. They are not column headings.

## The submit behaviour is out of scope

footer-newsletter-subscribe owns it and lands after r20. F4 does not touch either `<form>` line. f4-static S5 holds both BASE form lines
and fails on any `action`, `formAction` or `FormData`.

## Reconciliation with F3 and F1

- f3-static S1/S2 pinned footer-data.ts and Footer.tsx as BASE plus F3's edits only. They now accept BASE plus F3, or BASE plus F3 and
  F4 (the same file must be one of the two). f4-static S1/S2 require BASE plus F3 plus F4.
- f3-rendered L7 held the whole SAOC footer to BASE in boxes and pixels, and F4 changes the Partners rows. L7 now holds what F4 does
  not govern:
  - column 1 (box and pixels);
  - the lockup;
  - the bottom bar (size and pixels);
  - the grid and every column at their BASE x and width.
  The columns' heights, the footer height at 390 and the bar's y are F4's. `f3-baseline.json` is re-captured on BASE for the new L7
  shots.
- F3 L2's 476px at 1280 still holds. Columns 1 and 4 (271px) set the row height at 1280. Explore is about 252px, and Partners becomes
  about 164px.
- F1 R3 holds through `.nf-col > .nf-head` (see above).

## Acceptance (f4-rendered.mjs; both modes; the r20 SAOC routes and NOS routes; 1280, 1920 and 390)

- **R1:** every Explore and Partners row is exactly 44px, 44px apart, with no list gap.
- **R2:** every Explore, Partners and WOSA row is the shared row: inline-flex, centred, min-height 44px, 14px. The WOSA link is 44px.
  The Explore and Partners rows share one colour.
- **R3:** the three headings share one class and sit 16px above their first element.
- **R4:** at 1280 and 1920, the heading tops are equal (+-1) and the first-row tops (Explore, Partners, the blurb) are equal (+-1).
- **R5:** at 390 the columns stack, with the same rows. There is no overflow anywhere.

There is no F4 baseline: every assertion is absolute. On BASE, f4-rendered fails only on the defect: SAOC Partners rows, the NOS
Partners rows, the NOS 15px rows and the NOS 6px headings.
