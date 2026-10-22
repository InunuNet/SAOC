# NOS vendor apply form: control size, top band and stands width (r55)

Codi reviewed `/national-show/vendors/apply` at 1280 on beta (2026-10-22). The structure passed, with three fixes:

- **16px controls on every NOS form.** iOS Safari zooms the page when a focused control is under 16px, and the NOS
  forms rendered at 15px (14px in the registration equipment tables). One rule in
  `app/(marketing)/national-show/nos-theme.css`, placed after the `.nos-form-label` role, sets every text control
  inside `.nos-theme` (inputs, selects and textareas, not checkboxes, radios, files or hidden inputs) to
  `var(--body-md)`. That is the existing 16px body token from `colors_and_type.css`. The rule is unlayered, so it
  beats the components' layered Tailwind `text-[15px]` and `text-[14px]` without per-component edits. It reaches the
  vendor apply, vendor code entry and vendor registration forms and the ticket checkout attendee fields. The footer
  newsletter input sits outside `.nos-theme`, so `.nf-form input` in `components/nos-chrome/nos-chrome.css` takes
  `var(--body-md)` directly.
- **The band above the form.** The 165px between the hero and the first form text was the 45px subnav plus the NOS
  section's default top padding (`clamp(72px, 9vw, 120px)`). The apply page's `NosSection` now sets
  `paddingBlockStart: var(--space-7)` (48px) inline. It is inline because the section padding is unlayered and would
  beat a Tailwind utility. The subnav-to-text gap is about 48px at every width. No other page changes.
- **Stands field width.** "Indicative number of stands" holds a short number but ran the full 672px. `VendorFormField`
  takes an optional `inputClassName`, and the apply form passes `max-w-[12ch]` to that field only.

No new tokens, colours or copy. Checks: `.agent/memory/project/specs/nos-vendor-apply-form/` (contract A1–A7).
