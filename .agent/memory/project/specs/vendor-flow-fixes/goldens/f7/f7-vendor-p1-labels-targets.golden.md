# F7 golden -- vendor P1s: heading rename, 44px tap targets, payment invalid-link action

Approved by Brad 2026-10-15. Base `integ/vendor-flow-fixes` (d2071be5), branch
`fix/vendor-p1-labels-targets`. SA/UK spelling. No other copy changes (docs/rules/no-invention.md).

## 1. Label -- exact string `Exhibitors and Vendors`

Brad: "Exhibitors and Vendors as a heading, some might just Exhibit some may just be vendors eg
Food, some may be both like nurseries". Replaces BOTH "Exhibiting Nurseries" and "Trade Vendors".

| file (line on base d2071be5) | before | after |
|---|---|---|
| app/(marketing)/national-show/vendors/page.tsx:20 | `title: 'Exhibiting Nurseries — National Show',` | `title: 'Exhibitors and Vendors — National Show',` |
| app/(marketing)/national-show/vendors/page.tsx:44 | `title="Exhibiting Nurseries"` | `title="Exhibitors and Vendors"` |
| app/(marketing)/national-show/page.tsx:319 (238 in the dirty main checkout) | `label: 'Trade Vendors'` | `label: 'Exhibitors and Vendors'` |
| components/show/ShowSectionNav.tsx:52 | `label: 'Trade Vendors', hint: 'The trade floor and how to exhibit'` | label only; hint byte-identical |
| components/chrome/nav-config.ts:259 | `label: 'Trade Vendors',` | `label: 'Exhibitors and Vendors',` (id, href, descriptor byte-identical) |

Other occurrences found by grep (same label, must move with the rest or the nav/manifest drift --
ShowSectionNav's own comment says its labels match the manifest "exactly"):

| file | line | change |
|---|---|---|
| content/national-show-routes.json | 238 | `"label": "Exhibitors and Vendors",` |
| scripts/generate-nos-route-manifest.ts | 275 | `label: 'Exhibitors and Vendors',` (the manifest's source) |

Left alone on purpose (historical records, not shipped copy): the stale goldens under
`.agent/memory/project/specs/menu-system-layout4/` and `national-show-ia-alignment/`, and
`contracts/golden/vendor-form-ui/README.md`. `check-nav-top-level-golden.mjs` reads only `topLevel`,
so the nested vendors item does not trip it.

## 2. Tap targets >= 44x44 CSS px (NOS audit P1)

Design source: `design/design_handoff_saoc/`. The handoff specifies no checkbox control, so the
checkbox's VISUAL box stays exactly what it is (16x16, `h-4 w-4`) -- only the hit area grows.
The handoff's own button (`design/design_handoff_saoc/src/styles.css:176-190`, `.btn`:
padding 14px 22px, 14px type, radius 2px; `README.md:80` 2px radius on buttons/inputs;
`README.md:86` hover/press behaviour) is taller than 44px, so a 44px floor on the site's
Continue button moves it toward, not away from, the handoff. Colours, type, radius, hover and
focus treatment stay as they are.

### 2a. /national-show/vendors/apply checkboxes (14 on base, 16x16)

Component: `components/vendors/VendorCheckboxGroupField.tsx` (used by `VendorApplyForm.tsx:220`).
The HIT target is the option's `<label htmlFor>` (already associated). Required rendered result,
at 390 and 1440 wide:

- label box >= 44 x 44 (suggested: `min-h-11` on `optionLabelClass`, the label stays `flex items-center`;
  Tailwind v4 `min-h-11` = 2.75rem = 44px; the label is already full cell width);
- the `<input>` itself still 16 x 16;
- the label's padding strip (its bottom-left 2px) is what a pointer lands on, and clicking it
  toggles the checkbox (so the 44px is a real hit area, not an empty box);
- 14 checkboxes still render.

`VendorCheckboxField.tsx` (register's single `termsAccepted` checkbox) has the same shape. Giving
it the same `min-h-11` is permitted for consistency but is not asserted -- the gated form is not in
this audit item.

### 2b. /national-show/vendors/register "Continue" (96 x 42 on base)

Component: `components/vendors/VendorRegistrationCodeEntryForm.tsx:117-124`. Required: button box
>= 44 x 44 at both widths (suggested: add `min-h-11` to its class list; width 96 already clears 44).
Label text, colours, padding, hover and focus ring unchanged. Other buttons (e.g. the apply form's
submit, ~42px tall) are NOT in this item; do not touch them.

## 3. /national-show/vendors/payment invalid-link state

Component: `app/(marketing)/national-show/vendors/payment/page.tsx:70-73`. Base renders only:
"This payment link is no longer valid. Please contact SAOC if you believe this is an error."
-- a dead end. Add a contact ACTION with existing copy and an existing component only:

- Wrap the existing words "contact SAOC" in `<Link href="/contact" className="text-ink underline underline-offset-2">`
  (`next/link`). This is the exact pattern of `app/(marketing)/privacy/page.tsx:164`,
  `terms/page.tsx:108`, `refunds/page.tsx:198`, `media-kit/page.tsx:159`.
  The visible sentence stays word for word identical; mailto:info@saoc.co.za is an accepted
  alternative target (`media-kit/page.tsx:153` pattern) but `/contact` is the recommendation.
- No new sentence, no new button label, no new institutional copy. The `/photos` invalid state
  (`photos/page.tsx:70`) uses the same sentence; the two stay consistent and /photos is not touched.
- Applies to every `usable === false` outcome (no token, garbage token, expired, paid, ...), which
  all render this one branch (enumeration-blind by design -- do not add a distinguishing outcome).
- The inline link is exempt from the 44px rule (inline text link in a sentence); it need only be a
  visible link to `/contact` or `mailto:info@saoc.co.za` in the same block as the sentence.

## Out of scope (must not appear in the diff)

Any other copy; the Sanity dataset; the apply form's submit button and other controls; the
/photos and /payment/status pages; any API route, lib module, Firestore or payment code.
`check-scope.mjs` enforces the file list.

## Measured on base (for the dev's before/after)

See `measurements.base.json`.

### Accepted dev deviation: `shrink-0` on checkbox input

The dev added `shrink-0` to the checkbox input. Accepted: it fixes a base defect (the fertilisers-growing-media input measured 15x16 at 1440 on base) and serves the existing "input stays 16x16" requirement.
