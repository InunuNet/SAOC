# vendor-form-input-focus-indicators F1 — golden

## Correction to the mission premise

The mission brief assumed `ContactForm.tsx` / `TicketFormField.tsx` text inputs already carry a
visible `focus-visible` ring and that the vendor form should copy their treatment. That is not
what the current code does. As of this contract, all four of `ContactForm.tsx`, tickets'
`TicketFormField.tsx`, `CartDayPicker.tsx`, and the vendor form's own `VendorFormField.tsx` share
the **identical** defect: their shared `inputClass`/className string is

```
... outline-none ... focus:border-ink/40 ...
```

— a barely-perceptible border-colour shift with the browser's default outline suppressed, and no
ring. There is no already-fixed text-input reference to copy.

What *is* an established, verified site convention (`.agent/memory/project/learned.md`,
"Focus-visible ring pattern is now the site default", 2026-08-21/22) is:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-{bg}
```

already reused verbatim across 8 components' buttons/links (Header, MegaMenu, MobileMenu,
`ContactForm`'s submit button, `TicketPurchaseForm`'s submit button, `DownloadTicketButton`,
`TicketTypeCard`'s stepper buttons and list-mode Link, `VendorRegisterForm`'s submit button).
This F1 fix extends that same, unmodified token set to the vendor form's text-type inputs — it
does not invent a new treatment. `{bg}` is `ivory`, matching `VendorFormField`'s
`bg-ivory` input background.

## Defect

`components/vendors/VendorFormField.tsx`, the shared `inputClass` constant (used by every
text/tel/email/url/number/textarea field in the vendor registration form, 24 usages across
`VendorContactFieldset`, `VendorCategoryFieldset`, `VendorBoothFieldset`,
`VendorMarketingFieldset`, `VendorPaymentFieldset`):

```
const inputClass =
  'w-full rounded-sm border border-rule bg-ivory px-3.5 py-2.5 font-sans text-[15px] text-ink placeholder:text-muted outline-none transition-colors focus:border-ink/40 disabled:opacity-60';
```

carries `outline-none` with only a `focus:border-ink/40` colour shift — no ring. Tabbing to any
of these ~24 inputs produces no meaningfully visible focus indicator.

Checkboxes (`VendorCheckboxField.tsx`), radios (`VendorRadioGroupField.tsx`,
`VendorBooleanRadioField.tsx`, `VendorCheckboxGroupField.tsx`), and the submit button
(`VendorRegisterForm.tsx`) are unaffected — they already carry their own correct, visible focus
treatment and are explicitly out of scope / regression-guarded.

## Fix

In `components/vendors/VendorFormField.tsx`, append the site-default ring token set — unchanged,
no new colour/width/offset invented — to `inputClass`:

- `focus-visible:ring-2`
- `focus-visible:ring-ink/40`
- `focus-visible:ring-offset-2`
- `focus-visible:ring-offset-ivory`

(`focus-visible:outline-none` is optional to add explicitly since the existing unconditional
`outline-none` already suppresses the default outline at all times; do not remove the existing
`outline-none` or `focus:border-ink/40` — this is an additive, surgical change to one constant.)

Because every affected input (text/tel/email/url/number/textarea) renders through this single
shared constant, this one-file, one-constant edit is sufficient to reach all ~24 elements. No
other file needs to change for F1's scope.

## Non-goals / regression guard

- `VendorCheckboxField.tsx`'s `checkboxClass` (`h-4 w-4 rounded-sm border border-rule outline-none
  focus:ring-2 focus:ring-ink/40 disabled:opacity-60`) must remain byte-identical.
- `VendorRadioGroupField.tsx`'s `radioClass` (`h-4 w-4 border border-rule outline-none
  focus:ring-2 focus:ring-ink/40 disabled:opacity-60`) must remain byte-identical.
- `VendorBooleanRadioField.tsx` and `VendorCheckboxGroupField.tsx` are untouched.
- `VendorRegisterForm.tsx`'s submit button className is untouched.
- Non-focused rendering of every vendor-form input (border colour, background, padding, text
  size) is unchanged — only the focus-visible state gains the ring.
- `ContactForm.tsx`, `TicketFormField.tsx`, and `CartDayPicker.tsx` are out of scope for this
  mission (they share the same underlying defect — see "Correction to the mission premise" above
  — but fixing them is a separate follow-up, not part of `vendor-form-input-focus-indicators`).

## Manual/visual proof (mandatory, kind: agent_review)

A BrowserAgent (Playwright) pass against the running dev app must:

1. Navigate to `/national-show/vendors/register` (or the current vendor registration route).
2. Use real keyboard Tab navigation (`page.keyboard.press('Tab')` repeatedly — never
   `.focus()`, which does not reliably trigger `:focus-visible` in Chromium once a prior
   pointer/mouse interaction happened in the same page session; see learned.md, "Playwright
   `:focus-visible` verification", 2026-08-21/22) to reach, in turn, one representative input of
   each affected type: a `text` input, an `email` input, a `tel` input, a `number` input, a
   `url` input, and the `textarea`.
3. For each, screenshot the focused state AND read the computed style via
   `getComputedStyle(el).boxShadow` (or `page.locator(...).evaluate(el =>
   getComputedStyle(el).boxShadow)`) — confirm it is a non-`none` value consistent with a
   Tailwind ring (an inset/outer box-shadow with the ink/40 colour), not just that the
   `focus-visible:ring-2` class string is present in the DOM. Class presence alone is
   insufficient — a transition-timing or specificity bug can leave the class attached with no
   rendered ring (this bit the sibling `tickettypecard-focus-ring` mission earlier the same
   session; verify the effect, not the markup).
4. Tab to a checkbox and a radio option in the same form; screenshot and confirm their existing
   ring treatment still renders (regression guard — unaffected by this fix).
5. Confirm non-focused rendering of at least two inputs (spot check) is visually unchanged from
   before the fix.
