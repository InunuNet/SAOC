# F2 — vendor form controls: target size and pointer-focus contrast

Sources: WCAG 2.5.8 Target Size (Minimum) 24x24 CSS px; WCAG 1.4.11 Non-text Contrast 3:1; the site convention of a 44px row
(VendorCheckboxGroupField already uses `min-h-11`; components/nos/Button.tsx min-h-[50px]).

## Specification
1. Checkbox and radio controls in components/vendors/ become >=24px: VendorCheckboxField.tsx:13, VendorCheckboxGroupField.tsx:30,
   VendorRadioGroupField.tsx:22, VendorBooleanRadioField.tsx:23 (`h-4 w-4` -> `size-6`, keep every other token). The radios are an
   extension of the stated checkbox scope, taken because the same defect is in the same four files; if the lead wants them out,
   drop the two radio entries from CONTROL_FILES in f2-a11y-static.mjs and from this list together.
2. Every label row around those controls is >=44px tall: add `min-h-11` (and `items-center` where the row is `items-start`, keeping
   the existing gap) to the labels in VendorCheckboxField.tsx:14, VendorRadioGroupField.tsx and VendorBooleanRadioField.tsx. The
   group field already has it. The label is the click target; the whole row must stay clickable (label wraps the input).
3. Replace every `ring-ink/40` under components/vendors/ (12 sites: VendorCheckboxField, VendorCheckboxGroupField,
   VendorRegistrationCodeEntryForm x2, VendorRadioGroupField, VendorRegisterForm, VendorFormField, VendorGasEquipmentTable,
   VendorApplyForm, VendorElectricalEquipmentTable, VendorBooleanRadioField) with `ring-primary`. Same variant prefix, same ring
   width, same offset classes. The colour is the existing chrome ring, #384138 (--primary), 10:1 on ivory. Nothing else changes.
   Leave `focus:border-ink/40` on text inputs alone (a border change on focus, not the indicator).
4. Do not touch components/nos/Button.tsx, nos-theme.css, globals.css, or anything outside components/vendors/. The NOS keyboard
   outline (2px solid #7e3f97) already passes; do not alter it.
5. Update the two pre-existing checks that pin the old classes (see README, supersession) and log them in checks-updated.md.
6. Docs: docs/polish-wave-f2-vendor-a11y.md — the measured baseline (16x16, 14/16 pointer rings under 3:1, keyboard outline already
   fine) and why the Continue button is excluded.

## Checks
f2-a11y-static.mjs (sizes, row heights, zero ring-ink/40, >=12 ring-primary, primary vs ivory/bone/parchment >=3:1 computed from
globals.css), f2-a11y-rendered.mjs (16 checkboxes on /vendors/apply x 4 viewports: size, row, keyboard outline, pointer ring).
Baseline red: size 16/16 and pointer ring 14/16 at every viewport. Keyboard outline and row height are guards that are green on the baseline.
Declared limit: the radios and the gated /vendors/register form cannot be reached without a token, so they are static-only.
