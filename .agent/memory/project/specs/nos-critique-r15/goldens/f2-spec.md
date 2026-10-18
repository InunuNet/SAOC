# nos-critique-r15 F2 — header focus ring reaches 3:1 (WCAG 1.4.11) with a handoff token

BASE: `origin/main` `ab7c549c`. Shared branch and worktree with F1/F3.

## Finding (measured at BASE, public build)

`focus-visible:ring-ink/40` paints rgb(155,156,150) on the header's parchment rgb(244,243,236). That is **2.49:1**: computed by
compositing the ring's box-shadow colour on a canvas, and confirmed on the painted pixels. It fails 1.4.11 (3:1) on every one of the 24
header focus stops, which are 9 at 1280 and 3 at 390, each at rest and scrolled.

The header has one background in every state: `bg-parchment`. Scrolled adds only `shadow-float border-b border-rule`. The ring sits
between its own ring-offset (parchment) and the header (parchment).

Lines today:
- `components/chrome/Header.tsx`: 103 (logo), 142 (nav links), 160 (Contact), 179 (search), 191 (menu). The lead's 89/129/151/159/168
  have shifted with later edits.
- `components/chrome/MegaMenu.tsx:129`: the header-bar trigger ("National Show", and every mega item) uses the same class string. A
  Tab through the header stops on it, so it is in scope.

## Candidate tokens (every colour token in design/design_handoff_saoc/colors_and_type.css; WCAG ratio against parchment #f4f3ec)

| token | value | ratio on parchment | >= 3:1 |
|---|---|---|---|
| --ink | #171917 | 15.89 | yes |
| --primary-800 | #22281f | 13.57 | yes |
| **--primary** | #384138 | **9.53** | **yes (chosen)** |
| --primary-700 | #4a554a | 7.02 | yes |
| --muted | #636660 | 5.24 | yes |
| --accent | #9e8c6b | 2.94 | no |
| --accent-soft | #c2b393 | 1.86 | no |
| --rule | #d9d7c9 | 1.30 | no |
| --rule-soft | #e4e1d0 | 1.18 | no |
| --bone / --primary-100 | #e8e6dc | 1.12 | no |
| --parchment / --ivory | #f4f3ec | 1.00 | no |
| --fg-on-dark-muted | rgba(244,243,236,.65) | ~1.0 on parchment | no |
| ink/40 (today, an opacity on --ink) | → rgb(155,156,150) | 2.49 | no |

Every token is mirrored in `app/globals.css` `@theme` as `--color-*`. The NOS tokens (`--nos-*`) are not SAOC handoff tokens and were
not considered for the SAOC header.

## Decision

On those 6 lines only, replace `focus-visible:ring-ink/40` with `focus-visible:ring-primary` (the full token, no opacity). Nothing else
changes: `ring-2`, `ring-offset-2` and `ring-offset-parchment` stay. This is a one-substitution edit (goldens/f2-edits.json).

Why --primary and not --ink or --muted, which also pass:

- The handoff names it for focus: README.md:192 "Focus = `--primary` border", and src/styles.css `.field input:focus { border-color: var(--primary) }`.
- The app already uses it for focus: `focus-visible:outline-primary` (6 uses) and `ring-primary/40` (16).
- --muted passes at only 5.24 and is the caption/meta colour. --ink is the body text, so a ring in the text colour reads as an underline box.

### Out of scope (reported, same defect class)

These are the same `ring-ink/40` defect outside the header bar, and the lead decides on them:
- MegaMenu panel links: MegaMenu.tsx:111, :118, :153, :268, :269. These appear only when the panel is open, and the CTA buttons are
  on bg-nos-pale-gold.
- MobileMenu.tsx: 9 lines inside the off-canvas dialog.
- SaocLockup.tsx:50 (footer).
- 15 more uses across form, field and ticket components (contact, members, vendors, tickets).

## Acceptance (contract-f2.yaml; pins in checks-f2.sha256)

- A1: pins.
- A2: footprint.
- A3: `f2-static.mjs`:
  - S1: both files equal BASE plus exactly that substitution on exactly 5 + 1 lines;
  - S2: `--primary: #384138` is in the handoff file and mirrored in @theme, and both files are unchanged;
  - S3: the docs record F2.
- A4: `f2-rendered.mjs`, public build, /about, 1280 and 390, at rest and scrolled. It Tabs through the header and, at every stop:
  - R1: a >= 2px ring is shown;
  - R2: the computed ring colour (composited) reaches >= 3:1 against the header background and against its offset;
  - R3: the painted ring pixel reaches >= 3:1 against the painted header pixel.
  - R4: at least 5 stops at 1280, including a MegaMenu trigger, and at least 3 stops at 390.

## Proof

- At BASE, A4 fails R2 and R3 on all 24 stops at 2.49:1, and A3 fails S1/S3.
- On the prototype (the substitution only), every stop measures 9.53:1 computed and painted, and A2-A4 PASS. The prototype was reverted.

## NO INVENTION sources

- `docs/rules/no-invention.md`
- `design/design_handoff_saoc/`:
  - design_system_README.md: --primary is "deep sage — headlines, primary buttons";
  - colors_and_type.css:11 `--primary: #384138`;
  - README.md:192;
  - src/styles.css `.field input:focus`;
  - SKILL.md, ui_kits/, screenshots/: no focus-ring colour other than --primary is specified.
- `branding/SA Orchid Council/`: no colour is added.
- The lead ruling (FINAL 2026-10-18).
