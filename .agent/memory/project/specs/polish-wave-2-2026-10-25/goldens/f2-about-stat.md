# F2 — SAOC /about heritage stats (AB-1)

The stats band under Lee-Ann's About copy shows "1968 / Founded" next to "28 July 1968 / Founding date, Bloemfontein". The bare year restates the date
beside it and the prose already says "Established in 1968".

## Specification
1. app/(marketing)/about/page.tsx: delete the `{ value: '1968', label: 'Founded' }` entry from HERITAGE_STATS. Remaining, in order:
   `28 July 1968` / `Founding date, Bloemfontein`; `4` / `Founding societies`; `15` / `Accredited SAOC Judges, Sept 1968`. Strings unchanged.
2. The stats `<dl>` grid goes from `sm:grid-cols-4` to `sm:grid-cols-3` (three facts, no empty fourth cell). Keep `grid-cols-2` below sm and every other class.
3. Do not touch the About prose (Lee-Ann's text, rendered verbatim, `<strong>1968</strong>` stays), the comment block above HERITAGE_STATS beyond
   updating it to say the bare year stat was removed, or any other page.
4. Docs: docs/polish-wave-2-f2-about-stat.md, naming AB-1.

## Checks
f2-about-static.mjs (array, labels, grid class, prose) and f2-about-rendered.mjs (terms at 4 viewports, one row and three columns from 640px up).
