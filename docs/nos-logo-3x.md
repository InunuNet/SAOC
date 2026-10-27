# NOS header and footer logos on 3x displays (LG-1)

LG-1 (P3, NOS Design sweep 2026-10-25): on a 3x phone the NOS header and footer logos were served
files narrower than they are drawn (header 828 vs 1188 needed, footer 640 vs 744).

## Cause

`NosHeader.tsx` and `NosFooter.tsx` called `getImageProps` with a width and no `sizes`. Next then
emits a density srcset of 1x and 2x only, so a 3x screen took the 2x candidate.

## Fix

- Both components pass `sizes` equal to the drawn box (header 448px wide from 780px up; below it
  `min(448px, calc(110.6vw - 35.4px))`, which is 396px at a 390px viewport; footer 248px).
  Next then emits a width srcset over the whole variant ladder and the browser picks the right
  candidate for its density. The narrow `<source>` carries its own `sizes`.
- The header source is now `public/images/nos/nos-full-colour-horizontal-2400.png` (2400x589), so
  the 448px box at 3x (1344) can be served the 1920 variant. NOS Design ruled this option (a): a
  lanczos resize of the supplied master, no crop, recolour, re-matte or sharpening, alpha kept.
  Generated once, from the repo root:

  ```
  node -e "const s=require('sharp');s('branding/National Show 2027/Logo/NOS-2027-logo-full-colour-horizontal.png').resize({width:2400,kernel:'lanczos3',withoutEnlargement:true}).png({compressionLevel:9}).toFile('public/images/nos/nos-full-colour-horizontal-2400.png')"
  ```

- This supersedes R1.1's 1200 pin. The old `nos-full-colour-horizontal-1200.png` stays in
  `public/images/nos/`. No component uses it any more, but the checked-in logo validation still
  declares it as `NOS_LOGO_FILES.header` (`contracts/checks/nos-own-brand-chrome/_lib.mjs`), so a
  follow-up must update that reference before deleting the file.

## Verification

Spec, contract and checks: `.agent/memory/project/specs/nos-logo-3x/`. `gate-logos.mjs` checks
every header and footer logo on both hosts at 390@3, 820@2, 1023@3, 1280@2 and 1440@3 against
`ceil(drawn width x DPR)`; `check-pure-downscale.mjs` proves each served file is a pure lanczos
downscale of the supplied master.
