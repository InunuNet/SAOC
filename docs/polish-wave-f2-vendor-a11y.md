# Polish wave F2: vendor form controls

## Baseline (measured on the unchanged tree)
- All 16 checkboxes on /vendors/apply were 16x16 CSS px, under the WCAG 2.5.8 24px minimum.
- 14 of 16 pointer-focus rings (`ring-ink/40`) were under 3:1 (WCAG 1.4.11).
- Keyboard focus already passed (the `.nos-theme` 2px solid outline) and label rows were already 44px.

## Change
- Checkbox and radio controls in `components/vendors/` use `size-6` (24px); their label rows carry `min-h-11` and
  `items-center`.
- Every `ring-ink/40` in `components/vendors/` is now `ring-primary`, the existing chrome ring (Header.tsx). No new colour.
  `focus:border-ink/40` on text inputs is untouched.
- The two checks that pinned the old classes were updated, not deleted (see checks-updated.md in the mission spec).

## Excluded
The Continue button (VendorRegistrationCodeEntryForm) is excluded: `components/nos/Button.tsx` already has `min-h-[50px]`
(measured 133.5 x 50 at 390@3), so there is nothing to fix.

## Limit
The radios and the token-gated /vendors/register form are covered statically only.
