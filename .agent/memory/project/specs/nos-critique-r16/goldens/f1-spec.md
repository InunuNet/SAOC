# nos-critique-r16 F1 — NOS consistency (buttons, back-link target, sentence case, exhibitors back link, programme cards)

BASE: `origin/main` `cea06daf` (r15 + r15 F2b merged). Branch `fix/nos-critique-r16`, worktree `.tmp/sandbox/critique-r16`.
Ruling: Codi's rulings, FINAL, relayed by the lead (saoc-82) on 2026-10-19. Golden: `f1-edits.json`. Footprint: `f1-footprint.json`.

Sources every edit must stay inside: `docs/rules/no-invention.md` (no new copy, no new tokens);
`design/design_handoff_saoc/` (README, `colors_and_type.css`, `ui_kits/`, `screenshots/`); `branding/`.
Note the `nos-theme.css:257` reset: `ring-*` classes have no effect inside `.nos-theme`, so focus is measured as painted pixels.

## 1. Vendor submit buttons use the NOS primary button

| route | label | BASE | target |
|---|---|---|---|
| /national-show/vendors/apply | Submit application | `<button>` with `bg-accent px-5 py-2.5`, rgb(126, 63, 151) | `<Button type="submit">` from `components/nos/Button.tsx` |
| /national-show/vendors/register | Continue | same violet `<button>` | same |

The reference is the "Buy ticket" button on /national-show/wosa-conference. It is the NOS `Button` with the default `primary` variant:
`bg-primary text-ivory hover:bg-primary-800`. In the NOS theme that computes to rgb(33, 26, 87) (#211A57), ivory text, radius 10px,
height 50px, font 700 14px uppercase. Reuse the component and change nothing else: label, `disabled` and pending logic, and the
surrounding markup all stay. f1-rendered R1 checks that the class list equals the reference's, along with background, radius,
min-height, height and font. Text must reach at least 4.5:1, and the focus indicator at least 3:1.

## 2. "Back to tickets" target height

At BASE the link on /tickets/confirmation measures 95.45 × 21.69. Two copies render it: `app/(marketing)/tickets/confirmation/page.tsx:120`
and `components/tickets/ConfirmationPoller.tsx:142`. Padding only, and nothing else changes. `py-px` (2px in total) is not enough, giving 23.69.
`py-0.5` gives about 25.7. The edit is exact: `inline-block` becomes `inline-block py-0.5` on both lines. Width, font (14px / 21.7px)
and underline stay the same.

## 3. Sentence case (h1, title, og:title, subnav)

| route | before | after |
|---|---|---|
| /national-show/exhibitors | Exhibitor Information | Exhibitor information |
| /national-show/vendors | Exhibitors and Vendors | Exhibitors and vendors |
| /national-show/vendors (h2) | Showcasing the Finest in South African Orchid Growing | Showcasing the finest in South African orchid growing |
| /national-show/vendors/apply | Vendor Application | Vendor application |
| /national-show/vendors/register | Vendor Registration | Vendor registration |
| /national-show/vendors/payment and /payment/status | Vendor Stand Payment | Vendor stand payment |
| /national-show/vendors/photos | Vendor Product Photos | Vendor product photos |

Proper nouns stay capitalised (South African). Page titles and the subnav label follow the h1 (T3/R64). The title template is
"{head} — National Orchid Show | SAOC", and og:title carries the same head. The 23 BASE lines that change are listed in
`f1-edits.json` `sentenceCase.lineEdits`, generated from BASE. Every listed line becomes exactly `to`, and nothing else in those files changes.
`components/chrome/nav-config.ts:258` holds the "Exhibit & trade pages" subnav label. The same entry feeds the SAOC MegaMenu, the mobile menu,
NosShowIndex and the breadcrumb JSON-LD, so those follow too. That is intended, because one label is one string.

**DECISION NEEDED: the Exhibitor h1 comes from the CMS.** The /national-show/exhibitors h1 is Sanity `showExhibitorInfo.title`, which is
"Exhibitor Information" at BASE. The code fallbacks change here. The rendered h1 only follows once the CMS title is edited in Studio.
Recommendation: edit the Sanity document. The alternative is a code override that ignores the CMS title. Until then, f1-rendered R3 FAILS on that row.

Left unchanged and recorded as out of scope: the `content/national-show-routes.json` labels, `components/show/ShowSectionNav.tsx` (dead),
`VendorIntro` (dead), and the "Vendor Application" button labels inside `vendors/page.tsx`. Those are labels, not headings.

## 4. Drop "← Show overview" on /national-show/exhibitors

This follows the R38 #4 precedent. BASE lines 194–203 of `app/(marketing)/national-show/exhibitors/page.tsx` are removed, and that is the only
other change in the file.

## 5. Programme ticket cards on /national-show/programme

/national-show/programme gets the hub's existing Programme ticket cards: Symposium, WOSA and Workshops. Today the hub
(/national-show/tickets) renders them as `<TicketSection id="programme">` from `components/tickets/keepsake`, with data from
`lib/data/ticket-presentation.ts`. Reuse the same components and data. The section goes before the "Explore the show pages" nav,
the page's h1 stays ["Programme"], and no copy is new. f1-rendered R5 checks that the section's text, hrefs and card boxes equal the hub's.
/national-show/wosa-conference is unchanged.

## Supersessions

- `nos-critique-r13` `_r13.mjs` pins the "Vendor Stand Payment" title. r16 supersedes that pin.
- The `nos-critique-r15` F2b S2 check keeps `VendorApplyForm.tsx` and `VendorRegistrationCodeEntryForm.tsx` byte-identical. r16 item 1 supersedes it for the submit button only.

## Checks

The `f1-static.mjs` checks:

- S1: exact line edits and drops.
- S2: the vendor `Button` import, `type="submit"` and the labels, one fewer `<button>`, and no `bg-accent`.
- S3: no invention.
- S4: the programme imports and the section.
- S5: the docs have a "## F1" section.

The `f1-rendered.mjs` checks run on public and preview builds at 1280 and 390, covering R1–R5 as above.
