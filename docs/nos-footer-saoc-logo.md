# NOS footer SAOC logo

The NOS footer credits the organising body with the standing SAOC lockup: the official mono emblem,
the live wordmark "South African Orchid Council", a rule and the tagline "Making a difference since 1968",
all in one solid ink (`#F4F3EC`, the SAOC `--ivory` token). It replaces the full-colour yellow mark, the
"To be confirmed" badge and the separate name line.

## Emblem

`public/images/saoc-lockup-vertical-emblem.png` (768x490 RGBA) is the second panel of page 4 of
`branding/SA Orchid Council/SA Orchid Council Logo Presentation.pdf` ("vertical, light type on dark"):
`img-002` with its own smask `img-003` as alpha. It is lossless: no resample, no crop, no upscale.
`branding/` is read-only. Regenerate or verify with `scripts/extract-saoc-footer-lockup.py`
(`--out <dir>` extracts, `--check` compares against the shipped file pixel for pixel; needs `pdfimages`).

## Component

`components/chrome/SaocLockup.tsx` gains `variant="official-mono"` (vertical + dark only), `href` (root becomes a
plain `<a>`, same tab) and `testId`. Header, footer and mobile-menu call sites pass none of them and render as before.
The link has no `aria-label`: its accessible name is its visible text. The emblem has `alt=""`. The focus ring
comes from the host's `.nf :focus-visible` rule. The wordmark is the `WORDMARK` constant, so switching the wording
is a one-string change.

## Layout

`NosFooter.tsx` renders `.nf-saoc-credit`: the lockup, then the REG/NPO line 24px below it, outside the link.
Below 768px the group is 244px wide and the REG line is centred under the lockup; from 768px it is
`max-content` and the REG line is flush left. The WOSA link is unchanged. The lockup's height matches the
NOS lockup (about 218px).

## Verification

The render gate is `.agent/memory/project/specs/nos-footer-saoc-logo/checks/nos-footer-saoc-logo-check.mjs`
(needs a prior `pnpm build`); it writes screenshots to `.tmp/sandbox/nos-footer-saoc-logo-shots/`.
