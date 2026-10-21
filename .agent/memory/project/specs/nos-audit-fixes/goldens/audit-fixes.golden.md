# nos-audit-fixes F1: golden

Worktree `.tmp/sandbox/nos-fixes`, branch `fix/nos-audit-p1`, base `047d610e`
(= origin/release/nos-beta-cut-20261008). Every line number below is at base.
QA inputs: `contracts/checks/nos-audit-fixes/*.mjs` in that worktree, written by @architect
and locked by `goldens/checks.sha256`. @dev implements against this file and must not edit
the checks.

**Sources (no invention).** Each element below traces to one of: Lee-Ann's Drive copy, the
approved handoff (`design/design_handoff_saoc/`, `branding/`), Brad's instruction, or
existing site code or copy cited by file:line. No copy is rewritten, and no date, count,
label or colour is introduced.

Rule references:
- R7: `.agent/memory/project/design/nos-design-rulings.md:100`.
- R11: same file, `:225`.
- R18: same file, `:553` (clauses 5, 6, 7).
- pending/research semantics:
  `contracts/golden/show-visitor-info/confirmation-status-model.golden.md:15-16`.

---

## §1 OUT OF SCOPE (recorded, not built)

- **Item 1: the /national-show/vendors disclosure is DROPPED.** It was a false positive.
  The VendorIntro copy is Lee-Ann's (Drive `1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4`).
  `content/drive-source/` is gitignored on purpose, so `classifySection`
  (`lib/data/show-pages.ts:328`, which the lead cited as :336) fails closed. The lead owns
  that fix.
  - Do not touch `components/vendors/**` or `app/(marketing)/national-show/vendors/**`.
    Guard A6 requires them to be byte-identical to base, with no disclosure added.
  - Do not touch the vendors heading, menu label or section nav. Brad is renaming it to
    "Exhibitors and Vendors" in the lead's F7.
- **Chrome is frozen.** `components/chrome/**` must not change (guard A5).
  - This includes `components/chrome/nav-config.ts`. `lib/nav-config.ts` does not exist at
    base; the guard names it anyway so a new file there is caught.
  - The header and newsletter controls on the audited pages also sit below 44px. They are
    chrome, so they are not fixed here.
- **Not changed and reported only:**
  - `RealEmptyListing.tsx:24` draws a dashed border, which R18/5 forbids ("never a dashed
    outline").
  - The sa-exhibitors and international-guests absence statements are equally unsourced.
  - The live workshop ticket types (4 on the dev server: field-trip, field-trip-single,
    field-trip-all-outings, sunset-cocktails-single) differ from
    `lib/provisional-figures.ts:388-422` (3 types).

---

## §2 Key-dates table stacks at narrow widths (/national-show/exhibitors)

File: `components/show/ExhibitorKeyDates.tsx`. Check: `check-key-dates-stack.mjs`.

**Defect.**
- `:58` puts `overflow-x-auto` on the wrapper at every width.
- `:59` puts a `min-w-[560px]` floor on the table at every width.
- At 390px the table therefore scrolls inside its own box, and the ExhibitorStatusBadge
  chips in the When cell are clipped.

**Breakpoint.** `sm` (Tailwind v4 default, 640px). It is already the site's narrow
breakpoint (for example `archive/page.tsx:103` uses `sm:grid-cols-2`). No new breakpoint,
no arbitrary `max-[..px]:` variant, no `md`/`lg`.

**Change.** Add classes only. Keep every existing class except the two that are moved
behind `sm:`.

| line | element | change |
|---|---|---|
| :58 | wrapper div | `overflow-x-auto` becomes `sm:overflow-x-auto` |
| :59 | table | `min-w-[560px]` becomes `sm:min-w-[560px]`; add `max-sm:block` |
| :65 | thead | add `className="max-sm:sr-only"` (column headers stay in the a11y tree) |
| :87 | tbody | add `className="max-sm:block"` |
| :89 | body tr | add `max-sm:block` |
| :92 | th scope=row | add `max-sm:block` |
| :96, :105 | both td | add `max-sm:block` |

**Permitted.** `max-sm:` padding adjustments using the existing spacing scale (for example
`max-sm:py-1`), so the stacked rows do not double their padding.

**Not permitted.**
- Inline styles.
- Hex colours.
- New colour tokens.
- Replacing `<table>`/`<th>`/`<td>` with divs.
- Removing the caption, the three `scope="col"` headers, or the ExhibitorStatusBadge.

**Acceptance (QA, rendered).**
- At 390px: no horizontal scroll inside the section, every chip fully visible, rows stacked
  as Milestone / When+chip / Detail.
- At 1280px: the table renders exactly as at base.

---

## §3 Tap targets of at least 44×44 CSS px

Check: `check-tap-targets.mjs`.

**Where the 44px rule comes from.**
- The codebase states it in `components/nos/Button.tsx:29-33`: "`min-h-[44px]` is the WCAG
  touch-target floor" (Codi F2, 2026-09-29).
- The codebase applies it at `components/nos/Button.tsx:87` and
  `app/admin/login/AppleSignInButton.tsx:56`.
- **Gap named:** the handoff has no tap-target rule. `design_handoff_saoc/src/styles.css:1793-1794`
  is a 44px icon box, not a hit-area rule. The citation is the codebase plus WCAG 2.5.5,
  not the handoff.

**Audit numbers, checked against a live render** (dev server :3002, same markup as base):
- **Workshops, 13: matches.** 4 ticket types × (− button, quantity input, + button) + 1
  submit = 13.
  - Only 8 of the 13 are "stepper buttons" (32×32).
  - 4 are `<input type="number">` (`py-1` with a 15px line, about 31px tall).
  - 1 is the submit button (`py-2.5` with a 14px line, about 40px).
- **Conferences, 7: matches.** 2 × 3 + submit. These are the same three control kinds,
  from the same `CategoryTicketsPage` → `TicketPurchaseForm` → `TicketTypeCard` chain.
- **"Open in a map", 19px tall: consistent with the source.** `inline-block` 12px mono
  text.
- These controls render only when sales are open and not every type is sold out
  (`CategoryTicketsPage.tsx:204-217`).

**Change.** Use only the size tokens `h-11`/`w-11` (44px) or `min-h-[44px]` (the codebase
idiom). The sizes apply at every width, not `sm:`-gated.

| file:line | control | change |
|---|---|---|
| `components/tickets/TicketTypeCard.tsx:147, :172` | − / + buttons | `h-8 w-8` becomes `h-11 w-11` |
| `components/tickets/TicketTypeCard.tsx:165` | quantity input | add `h-11` (`w-12` = 48px stays) |
| `components/tickets/DayQuantityPicker.tsx:40, :64, :57` | identical stepper and input | same as TicketTypeCard |
| `components/tickets/TicketPurchaseForm.tsx:113` | submit | add `min-h-[44px]` |
| `components/show/VenueCard.tsx:90` | "Open in a map ↗" | `inline-block` becomes `inline-flex min-h-[44px] items-center` |

**DayQuantityPicker.** It carries the same stepper markup. It is sized with TicketTypeCard
so the site does not end up with two stepper sizes. It renders on single-type
day-selection pages such as /tickets.

**Must keep.** Every existing type, colour, border and radius class, and the focus-ring set
`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2`.
That set appears 3× in TicketTypeCard and 2× in DayQuantityPicker; it is what
`contracts/checks/tickettypecard-focus-ring-f1` counts.

**Minimal visual change.** The stepper boxes grow from 32 to 44px and the link text stays
vertically centred. A pseudo-element hit area is not accepted, because the audit measures
the bounding box.

---

## §4 R7 disclosures with the existing ConfirmationBadge

Check: `check-disclosures.mjs`.

**Mechanism.**
- Use `ConfirmationBadge` from `@/components/show` (barrel `components/show/index.ts:2`)
  with `status="pending"` and no label, tone or `as` overrides.
- It renders the existing fallback label "To be confirmed"
  (`components/show/_shared/StatusMarker.tsx:55`).

**Why `pending` and not `research`.** The confirmation-status model defines:
- `pending` = "Placeholder. We made it up as scaffolding. The committee must supply the real
  value."
- `research` = "Real, verified by us."

Neither claim below was verified by anyone, so `research` ("Not yet confirmed") would
mislabel it.

**Source check, done before marking.**

- **/national-show/archive stats: genuinely unsourced. Disclose.**
  - The entries, visitors and trophies figures are in `lib/data/shows.ts:21-72`, which
    arrived in scaffold commit `6451883f` (2026-06-11) with no citation.
  - Nothing matches in `content/drive-source/` or `content/drive-recovered/`.
  - Sanity values merged in through `mergePastShows` carry no source either.
- **/national-show/conferences "Joint track": unsourced AND contradicted.**
  - "Joint" appears nowhere in Lee-Ann's Drive copy.
  - The joint bundle was retired per Brad's 2026-10-07 ticket news
    (`lib/provisional-figures.ts:264-277`, `:330-344`, `RETIRED_CONFERENCE_SLUGS`).
  - Only SAOC Symposium and WOSA Conference render.
  - Disclose now. The removal is a DECISION NEEDED (see the contract report).

**Change, archive** (`app/(marketing)/national-show/archive/page.tsx`):
1. Add `import { ConfirmationBadge } from '@/components/show';` next to the NOS imports
   (:15-18).
2. Inside the stats conditional at :139-156, wrap the body in a fragment:
   `(show.entries || …) && ( <> <div …stats row…/> <ConfirmationBadge status="pending" /> </> )`.
   The badge is the fragment's last child, so it renders only when stats render, once per
   card, before `{show.note && …}` at :158.
3. Leave the stats row markup and the four Badge pills unchanged.

**Change, conferences** (`app/(marketing)/national-show/conferences/page.tsx`):
1. Add `import { ConfirmationBadge } from '@/components/show';`.
2. Pass `note={<ConfirmationBadge status="pending" />}` to `CategoryTicketsPage` (:27-33).
   The `note` slot already exists (`CategoryTicketsPage.tsx:88-90`, rendered at :202 above
   the ticket list); workshops already uses it. `CategoryTicketsPage.tsx` is not edited.
3. Leave the lede (:32) and the metadata description (:17-18) byte-identical.

---

## §5 /national-show/sponsors: enquiry action and absence marker (R18/6, R7)

Check: `check-sponsor-enquiry.mjs`.

**R18/6.** "`/sponsors` has a conversion job and takes a button (sponsorship enquiry)."

**Brad:** all contact goes to `info@saoc.co.za`.

**Label: existing site copy, not invented.**
- The label is "Talk to us about sponsorship", from `app/(marketing)/sponsors/page.tsx:119`.
  It is the site-level sponsors CTA, which today links to `/contact`.
- No other sponsorship-enquiry label exists in the codebase.

**The dated promise.**
- No council copy or date exists for when sponsors will be announced (R18 notes Lee-Ann's
  sponsor folder is empty).
- `ABSENCE_STATEMENT` (`sponsors/page.tsx:30-32`) already uses a gate in words and no date,
  but its wording is ours.
- So keep it unchanged and mark it as awaiting copy with the existing
  `ConfirmationBadge status="pending"` ("To be confirmed").
- Never write a date.
- R18/7 forbids stacking the R11 AI-placeholder notice on the panel. The ConfirmationBadge
  is the per-claim confirmation marker, not the R11 notice, so it does not breach R18/7.

**Change, `components/show/nos/RealEmptyListing.tsx`** (the component stays generic):
1. `import type { ReactNode } from 'react';`
2. Add two optional props to `RealEmptyListingProps` (:15-20):
   - `absenceMarker?: ReactNode;`
   - `action?: ReactNode;`
3. Destructure `{ fieldLabels, absenceStatement, absenceMarker, action }`.
4. Render `{absenceMarker ? <div className="mt-2">{absenceMarker}</div> : null}` directly
   after the absence `<p>` (:25), before the "Each entry will show" block.
5. Render `{action ? <div className="mt-6">{action}</div> : null}` after the field-label
   block (after :38's closing `</div>`). The order follows R18/5: what, then when, then the
   action.
6. Leave the `<p>` at :25 byte-identical.
7. No marker, notice or date is hardcoded in this file.

**Change, `app/(marketing)/national-show/sponsors/page.tsx`:**
1. Add `import { Button } from '@/components/nos/Button';`.
2. Extend :3 to `import { ConfirmationBadge, ShowSectionNav } from '@/components/show';`.
3. At :68:

   ```tsx
   <RealEmptyListing
     fieldLabels={CARD_FIELD_LABELS}
     absenceStatement={ABSENCE_STATEMENT}
     absenceMarker={<ConfirmationBadge status="pending" />}
     action={<Button as="a" href="mailto:info@saoc.co.za">Talk to us about sponsorship</Button>}
   />
   ```

   - Use the default `primary` variant. The panel is a light parchment ground; `primary` is
     the NOS Button default and already carries the 44px floor.
   - No className override on the Button. No `/contact` link.

**sa-exhibitors and international-guests.** They pass neither prop.

**Acceptance (QA, rendered).** /national-show/sponsors at 390 and 1280 shows, in this
order:
1. The absence sentence.
2. "To be confirmed".
3. The field labels.
4. A 44px-tall "Talk to us about sponsorship" button whose href is
   `mailto:info@saoc.co.za`.
