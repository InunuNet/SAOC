# nos-critique-r16 F2 — SAOC chrome on the root 404, and the handoff primary on the /sponsors CTA

BASE: `origin/main` `cea06daf`. Branch `fix/nos-critique-r16`. Ruling: Codi, FINAL, relayed by the lead (saoc-82) on 2026-10-19.
Golden: `f2-edits.json`. Footprint: `f2-footprint.json`.
Sources: `docs/rules/no-invention.md`; `design/design_handoff_saoc/` (README, `colors_and_type.css`, `src/styles.css`, `ui_kits/`, `screenshots/`); `branding/`.

## 6. Root `app/not-found.tsx`

Measured at BASE on the public build:

| route | header | footer | document | hero bottom |
|---|---|---|---|---|
| /this-page-does-not-exist (root not-found) | 0 | 0 | 900 | 640, which leaves a 260px empty band below the hero |
| /events/no-such-event (marketing notFound()) | 1 | 1 | — | chrome present |

Target:

- The root 404 renders the full SAOC chrome: the skip link to `#main-content`, the "Utility bar" region, the header (with the "Primary" nav at 1280), one `main#main-content`, and the footer. Import them from `@/components/chrome`, the same way `app/(marketing)/layout.tsx` composes them.
- The header, footer and utility bar text must equal the text on /terms.
- No empty band: the hero section's bottom equals main's bottom, which equals the footer's top (±1px). The footer ends the document.
- The labels become "Go home" and "Find a society" (sentence case), on both 404 routes.
- The r15 eyebrow "404 — Page not found" keeps its `text-ivory` line, rgb(244, 243, 236).
- The HTTP status stays 404.

## 7. /sponsors CTA

At BASE the "Talk to us about sponsorship" link (`app/(marketing)/sponsors/page.tsx:148`) is `bg-ink` rgb(23, 25, 23) with radius 0.
The handoff button is `.btn` with `border-radius: 2px` and `.btn--primary` with `background: var(--primary)` and hover `var(--primary-800)`
(`src/styles.css`). `colors_and_type.css` defines `--primary #384138` and `--radius-1: 2px /* buttons, inputs */`, and `app/globals.css` carries
`--radius-1: 2px`. The exact line edit is in the golden: `bg-ink` becomes `rounded-[length:var(--radius-1)] bg-primary`, and `hover:bg-ink/85`
becomes `hover:bg-primary-800`. Nothing else changes, so the label and href /contact stay. The rendered result must be rgb(56, 65, 56), 2px on every corner,
ivory text at least 4.5:1, and keyboard focus painting an indicator at least 3:1 against its ground.

## Checks

The `f2-static.mjs` checks:

- S1: the exact sponsors line.
- S2: the 404 labels, the eyebrow line, and the chrome import.
- S3: no invention.
- S4: the docs have a "## F2" section.

The `f2-rendered.mjs` checks run on public and preview builds at 1280 and 390:

- R1: chrome landmarks, the first Tab stop, and the chrome text.
- R2: no band.
- R3: labels and the eyebrow on both 404 routes.
- R4: the sponsors CTA.
