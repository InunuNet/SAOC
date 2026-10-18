# nos-critique-r15 F2b - the remaining focus rings use the handoff --primary (>= 3:1)

Lead ruling FINAL 2026-10-18 (team-lead, after the architect's STOP report). Branch `fix/nos-critique-r15-f2b`, stacked on the r15 tip.
**BASE = 7bb4064b** (not r15's ab7c549c). Golden: `f2b-edits.json`. Checks: `checks/f2b-static.mjs`, `f2b-rendered.mjs`, `f2b-nonreg.mjs`
(helpers `_f2b.mjs`, plus r15's `_server.mjs` and `_color.mjs`, reused unchanged). Pins: `checks-f2b.sha256`.

## 1. The change

On each IN line (BASE line numbers), `focus-visible:ring-ink/40` becomes `focus-visible:ring-primary`. That is the whole edit: no other
class, token, opacity or offset changes in any file.

| file | BASE lines | rendered scope |
|---|---|---|
| components/chrome/MegaMenu.tsx | 111, 118, 153, 268, 269 | MegaMenu panel open, 1280 (118 dormant, see below) |
| components/chrome/MobileMenu.tsx | 126, 145, 180, 181, 200, 226, 252, 293, 306, 318 | drawer open, every accordion expanded, 390 (226 dormant) |
| components/contact/ContactForm.tsx | 195 | /contact, 1280 and 390 |
| components/members/SuggestionForm.tsx | 171 | /members, 1280 and 390 |
| components/tickets/DownloadTicketButton.tsx | 110 | none: static only |

- **DownloadTicketButton** is unreachable in a check. /tickets/confirmation renders it only for a confirmed Firestore order
  (`getConfirmedOrderForDisplay`). Its offset is ivory on the inherited parchment page, so the expected ratio is 9.53:1, but that is not measured.
- **Dormant lines.** MegaMenu.tsx:118 (`groupHeadingLinkClassName`) and MobileMenu.tsx:226 render only for a nav column with a
  `headingHref`. Every column in `components/chrome/nav-config.ts` has `headingHref: null`, so no page renders them today. They take
  the substitution (static S1); the rendered coverage check skips them.
- MegaMenu is desktop only (the primary nav shows at >= 1240px), and the MobileMenu drawer is opened by the "Open menu" button that shows
  below that. Each is therefore measured at the one width where it exists.

## 2. Basis (NO INVENTION)

- Token: `--primary` #384138, from `design/design_handoff_saoc/colors_and_type.css:11`. It is mapped in `app/globals.css` @theme as
  `--color-primary: var(--primary)`, both unchanged.
- Focus rule: `design/design_handoff_saoc/README.md:192`, "Focus = `--primary` border". The lead's ruling cited
  `design_system_README.md`; the line is in `README.md`, corrected here.
- Same substitution and token as r15 F2 (header), see `f2-spec.md`.

## 3. Measurements

Architect probe on the public build of 7bb4064b, keyboard modality, computed (box-shadow over the composited ancestor background) and
painted (16x3 capture):

| site | background | offset | ink/40 today (bg / offset) | ring-primary (bg / offset) |
|---|---|---|---|---|
| MegaMenu panel links (111, 153) | parchment #f4f3ec | parchment | 2.49 / 2.49 | 9.53 / 9.53 |
| MegaMenu NOS CTAs (268, 269) | nos-pale-gold rgb(243,242,214) | parchment | 2.48 / 2.54 | 9.33 / 9.53 (painted 7.27-8.77, anti-aliased rounded-full) |
| MobileMenu drawer rows | parchment | parchment | 2.49 / 2.49 | 9.53 / 9.53 |
| MobileMenu ticket links on the bone band | bone rgb(232,230,220) | parchment | 2.44 / 2.74 | 8.47 / 9.53 |
| ContactForm / SuggestionForm submit | parchment | ivory #f4f3ec | 2.49 / 2.49 | 9.53 / 9.53 |

## 4. OUT, byte-unchanged (each keeps its ring-ink/40)

- **components/chrome/SaocLockup.tsx:50** (footer lockup, `Footer.tsx:40`, on bg-primary-800 #22281f).
  - The class sets `ring-offset-2` with no offset colour, so the offset paints Tailwind's default white.
  - The visible indicator is that white band: **15.09:1** against the footer.
  - A --primary ring would be 1.42:1 against the footer (ink/40 today is 1.07:1), so it is not moved.
  - The lead may amend this.
- **Every vendor-form site.** These are:
  - VendorApplyForm 197 and 358;
  - VendorRegistrationCodeEntryForm 114 and 121;
  - VendorRegisterForm 148;
  - VendorFormField, VendorCheckboxField, VendorRadioGroupField, VendorBooleanRadioField and VendorCheckboxGroupField;
  - VendorGasEquipmentTable and VendorElectricalEquipmentTable.

  They render only under `.nos-theme`. There the unlayered reset `.nos-theme :focus-visible:not(.group)`
  (`app/(marketing)/national-show/nos-theme.css:257`) sets `box-shadow: none` and paints `outline: 2px solid var(--ring-focus)`, measured
  as rgb(126,63,151). The ring class is dead there, and NOS focus is Codi's lane.
- `app/(marketing)/national-show/nos-theme.css:240` is a comment, not a class use.

The static inventory (S3) fails on any ring-ink/40 outside this list, and on any left behind on an IN line.

## 5. Checks

- **f2b-static.mjs**
  - S1: each IN file equals BASE with exactly the listed substitutions.
  - S2: OUT files are byte-identical.
  - S3: the ring-ink/40 inventory under app/, components/ and lib/ is exactly the OUT counts.
  - S4: the token is unchanged.
  - S5: docs keep every BASE line and gain a `## F2b` section naming ring-primary, the README.md:192 basis and the SaocLockup exclusion.
  - S6: footprint (`f2b-footprint.json` + docs + spec dir) vs 7bb4064b; HEAD descends from it.
- **f2b-rendered.mjs**
  - R1: :focus-visible with a >= 2px ring outside an offset.
  - R2: computed >= 3:1 against the background and the offset.
  - R3: painted >= 3:1 against the background pixel and the offset pixel.
  - R4: minStops per scope, and every non-dormant rendered IN line is matched by a measured element.
  - Menus are opened with element.click(), so the pointer never hovers a row (hover:bg-bone).
  - The clip is viewport-relative. Verified: a viewport screenshot's clip is trimmed to the viewport, not the document.
- **f2b-nonreg.mjs**
  - r15's 15 routes at 1280/390, against a baseline captured on 7bb4064b, nothing masked (focus is off at rest).
  - N1 geometry, N2 block-mean screenshot, N3 no overflow.

Proven by the architect:
- At BASE: static FAIL (S1, S3, S5). Rendered FAIL with 106 R2 and 106 R3 failures (53 stops × background and offset).
- On a prototype of exactly this edit: static, rendered (53 stops, 15 lines covered) and nonreg (30 captures) all PASS.
- The prototype was then reverted.

## 6. Stacking note

- r15's own checks (contract-f1..f3) are evaluated at their tip, 7bb4064b.
- At the F2b tip, r15's `footprint.mjs` (BASE ab7c549c) and `f2-static.mjs` (MegaMenu.tsx = BASE + 1 line) would report the F2b edits.
  F2b supersedes them for MegaMenu.tsx, MobileMenu.tsx, ContactForm.tsx, SuggestionForm.tsx and DownloadTicketButton.tsx.
- Gate F2b with contract-f2b.yaml.
