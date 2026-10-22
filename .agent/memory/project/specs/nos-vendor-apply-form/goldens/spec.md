# nos-vendor-apply-form (r55) - spec

Source: Codi (NOS Design lead, final design authority), route 55 at 1280 on beta, 2026-10-22, verbatim:

> r55 - /national-show/vendors/apply - structure PASS
> - P2: inputs are 15px. iOS zooms on focus under 16px, so set form controls to 16px on all NOS forms (impeccable craft-floor forms/mobile).
> - P2: there's a 165px dead band between the subnav and the "All fields are required..." line (hero bottom 477, form top 642). Tighten it to about 48px (critique H8, spacing rhythm).
> - P3: "Indicative number of stands" is 672px wide for a short number. Make it about 12ch (craft-floor, field width).

Base dc664ef9. No copy, colour, font or token is added (docs/rules/no-invention.md). Every value below is an existing token or Codi's own number.

## What "all NOS forms" covers (measured on the dc664ef9 public build)

NOS chrome and the `.nos-theme` scope cover exactly two route segments (components/nos-chrome/ChromeFrame.tsx NOS_SEGMENTS: `national-show`, `tickets`).
Contact, members suggestion, event submission, societies search and the SAOC footer are SAOC pages, outside this ruling (contact and suggestion are already 16px).

| form | where | controls | computed font-size now |
|---|---|---|---|
| Vendor application | /national-show/vendors/apply, VendorApplyForm via VendorFormField.tsx:31 `text-[15px]` | business, trading, contact name, email, cell, stands | 15px |
| Vendor registration code entry | /national-show/vendors/register (no token), VendorRegistrationCodeEntryForm.tsx:115 `text-[15px]` | business name, code | 15px |
| Vendor full registration | same route with a token, VendorRegisterForm + the Vendor*Fieldset files (VendorFormField, VendorGasEquipmentTable/ElectricalEquipmentTable `text-[14px]` inputs) | ~60 text/number/tel/email/url/textarea controls | 15px and 14px (token-gated: covered by the shared rule, not rendered by the public check) |
| Ticket checkout | /tickets/<slug>, TicketFormField.tsx:68 `text-[15px]` (attendee name, email); TicketTypeCard.tsx:169 `text-[15px]` quantity | name, email, quantity | 15px (the checkout quantity input already computes 16px) |
| NOS footer newsletter | every NOS route, nos-chrome.css:139 `.nf-form input { font: 15px var(--nc-sans) }` (outside `.nos-theme`) | email | 15px |
| Stand payment / photos | /national-show/vendors/payment, /photos (token) | radios, file inputs | not text controls: iOS does not zoom them; excluded by the rule |

## Decision

16px is already an existing token: `--body-md: 16px` (app/globals.css :root, and design/design_handoff_saoc/colors_and_type.css:55, "default"). No new token.

There is no shared control style today (each component repeats a Tailwind class), so one rule, not 25 class edits. The NOS stylesheet is plain unlayered CSS, imported by NosThemeScope; Tailwind utilities live in a cascade layer, and an unlayered rule beats a layered one whatever the specificity, so a single scoped rule overrides every `text-[15px]` / `text-[14px]` utility without touching a component (the same reason `.nos-theme .bg-accent.text-ink` in globals.css works).

### Change 1 - shared control rule (app/(marketing)/national-show/nos-theme.css)
Immediately after the `.nos-theme .nos-form-label` block (the NOS "form role" block, R82), add, with a one-line comment citing r55 and iOS focus zoom:

    .nos-theme :is(input, select, textarea):not([type='checkbox'], [type='radio'], [type='file'], [type='hidden']) {
      font-size: var(--body-md);
    }

Covers vendor apply, vendor code entry, the full registration form (every fieldset, the equipment tables, select/textarea), and the ticket checkout. Prettier quote style as the file uses it.

### Change 2 - footer newsletter input (components/nos-chrome/nos-chrome.css, `.nf-form input`)
The footer sits outside `.nos-theme`, so Change 1 cannot reach it. In the one existing declaration `font: 15px var(--nc-sans)` replace `15px` with `var(--body-md)` (so `font: var(--body-md) var(--nc-sans)`). Nothing else on the line or file changes (`.nf-text` 15px, the button 13px stay).

### Change 3 - the band (app/(marketing)/national-show/vendors/apply/page.tsx)
Measured at 1280: hero bottom 477, `.nos-subnav` 477-522 (45px), `.nos-section` starts 522 with `padding-block: clamp(72px, 9vw, 120px)` (nos-structure.css:31, 115px at 1280), first form text (the required-fields sentence) top 637 (glyph ~642). So the 165px Codi saw is 45px of subnav plus 115px of section padding; the dead band is that padding. Target "about 48px" from the subnav to the sentence = `--space-7` (48px, app/globals.css, design handoff colors_and_type.css:81).

On this page only, `<NosSection style={{ paddingBlockStart: 'var(--space-7)' }}>`. Inline style because the section rule is unlayered CSS that a Tailwind `pt-*` utility would lose to; NosSection already forwards `...rest`. No change to NosSection, nos-structure.css, the bottom padding (stays clamp), or any other page (register and the rest keep 115px; Codi ruled on this route only). The same 48px then applies at 390 (was 72).

### Change 4 - stands field (VendorFormField.tsx, VendorApplyForm.tsx)
VendorFormField gains an optional `inputClassName?: string`, appended to the input's class string (after the error class), default none; every other caller is unchanged. VendorApplyForm passes `inputClassName="max-w-[12ch]"` to the `indicativeBoothCount` field only. Width: 12ch at the field's 16px Karla is ~114px at 1280 (border-box, so the padding is inside the 12ch) and `w-full` still caps it at the container at 390. Label, helper, error text and the other five fields stay full width.

### Out of scope (do not touch)
Per-component font classes, the SAOC forms, NosSection, labels (14px role), the error text, buttons, placeholder colours, any copy.

## Checks (goldens/checks.sha256 pins them)
- footprint.mjs: only goldens/footprint.json (5 files), docs/nos-vendor-apply-form.md and this spec dir differ from the merge-base with origin/main.
- static.mjs: S1-S6 (the exact rule, footer, inline padding, prop, no invention, docs).
- rendered.mjs: fresh public build, 1280 and 390: R1 every visible text control >= 16px on vendor apply, vendor register code entry, the first two ticket checkouts and the footer input; R2 gap 40-56px; R3 stands <= 14ch at 1280 and within its container at 390, other fields still form-width; R4 no overflow, no clipped footer input; R5 axe no new violations (goldens/render-baseline.json from the base render); R6 hero bottom, subnav height and unrelated font-sizes unchanged.
- prettier --check on the five touched files, eslint on the three TSX files, tsc.
- To re-record the baseline (only on an unmodified base): `NOS_VA_RECORD=1 node .../checks/rendered.mjs`.
- Chrome: run from the worktree with `NODE_OPTIONS='--require ../r19-chrome/use-chrome.cjs'`, or from anywhere with `NOS_VA_CHROME=<Chrome binary>`.
