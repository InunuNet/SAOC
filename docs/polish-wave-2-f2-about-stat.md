# Polish wave 2 F2 — /about heritage stats (AB-1)

**AB-1.** The stats band under Lee-Ann's About copy showed "1968 / Founded" beside
"28 July 1968 / Founding date, Bloemfontein". The bare year restated the date next to it, and the
prose already says "Established in 1968".

## Change

- `app/(marketing)/about/page.tsx`: the `{ value: '1968', label: 'Founded' }` entry is removed from
  `HERITAGE_STATS`. Three facts remain, strings unchanged: `28 July 1968`, `4`, `15`.
- The stats `<dl>` goes from `sm:grid-cols-4` to `sm:grid-cols-3` (no empty fourth cell);
  `grid-cols-2` below `sm` is kept.
- The About prose (Lee-Ann's text, `<strong>1968</strong>` included) is untouched. No new copy.

## Checks

`contracts/checks/polish-wave-2-2026-10-25/f2-about-static.mjs` (array, labels, grid class, prose)
and `f2-about-rendered.mjs` (stat terms and one row of three columns from 640px up, at four viewports).
