# PartnersSection redesign — requirements golden (F1)

Target: `components/home/PartnersSection.tsx`, rendered by
`app/(marketing)/page.tsx:76`. Section is currently a 6-column bordered grid
of bare centred names (110px tall cells) — reads as an unstyled table, not a
designed section.

## Card treatment (not directly assertable by shell — QA/human visual check)

- Real card treatment: padding, internal hierarchy (name as primary, one-line
  description as secondary), a hover state, and a resting state that doesn't
  read as a spreadsheet row.
- The WOSA card's description is not generic filler: WOSA is a documented
  SAOC partner whose annual conference will be hosted at the 2027 National
  Show (its own section in Spec V3; a planned ticket tier). Say that,
  factually — see `partners-data.golden.md` for exact wording constraints
  and the CLAUDE.md scope boundary (describe the partnership and the Show
  tie-in, never wild-orchid conservation as SAOC's own remit).
- Typography and layout alone must carry the design — no logos exist for any
  of the three kept partners. Do not fabricate or source logo images.
- Layout must not assume exactly three cards. Use `cards.map(...)` over the
  full array with a responsive wrap (e.g. grid with `auto-fit`/`minmax`, or
  flex-wrap), not a hardcoded 3-column / 3-item layout. If Sanity ever
  returns N partners (once `active`/`logo`/`website` are set on the live
  `sponsor` documents), the same component must render N cards correctly.
  Asserted structurally by PC-10 (no `slice(0, 3)` / `cards[0]` /
  `length === 3` hardcoding).

## Tokens only

- No new colours, fonts, or brand assets. Use existing `app/globals.css`
  tokens only: `bone`, `parchment`, `ink`, `rule`, `.eyebrow`, `font-serif`,
  etc. (see `@theme` block, `app/globals.css:92-107`).

## Data

- Exactly the three partners in `partners-data.golden.md`, in that order,
  when the Sanity-sourced `partners` prop is empty/null (the current live
  state — all 6 `sponsor` docs lack `active`, so `partnersQuery` returns
  none and the static fallback renders).
- `wosa` entry's `website` corrected to `https://wildorchids.co.za`.

## Accessibility

- External links (`website` present) keep `target="_blank"` and
  `rel="noopener noreferrer"` (PC-11/PC-12).
- Must not remove default focus visibility. The codebase currently sets no
  `outline: none` / `outline-none` anywhere (verified — `grep -n outline
  app/globals.css` and the `home/` components are both empty of it) — so the
  browser's native focus ring is the accessibility baseline. Do not add
  `outline-none` (or equivalent) to the card links without supplying a
  replacement focus style at least as visible (PC-13 guards against a bare
  removal).

## Responsive

- No horizontal overflow at 375px viewport width, scoped to this section
  (PC-14). `ShowBand.tsx` has a known, separate, out-of-scope overflow bug at
  the whole-page level — do not let that pre-existing bug make this
  assertion permanently red; it is scoped to the partners `<section>`
  element only, not `document.documentElement`.

## Sanity wiring (unchanged, do not touch)

- `sanity/queries.ts:164` `partnersQuery` and the `toCards()` fallback logic
  in `PartnersSection.tsx` are out of scope — this is a card-rendering
  redesign, not a data-layer change. Do not add an `active` field to the
  live sponsor documents as part of this task.

## Footer partner list (in scope — see partners-data.golden.md)

- `lib/data/partners.ts`'s `partners` array is a second, independent
  hardcoded partner list, rendered by `components/chrome/Footer.tsx`
  (Col 3, "Partners") on every page. Trim it to the same three real
  partners. Names only are required to satisfy the assertions; adding
  `url` (the `Partner` type already supports it) is optional and NOT
  required — do not refactor `PartnersSection.tsx` and `Footer.tsx` to
  share one data source as part of this task, that's a separate,
  larger change.
- Fix `components/chrome/Footer.tsx:117`'s WOSA link href from
  `https://wosa.org.za` to `https://wildorchids.co.za` (its
  `target="_blank"`/`rel="noopener noreferrer"` are already correct —
  leave them as-is).
- Asserted on `/about` (FTR-01…FTR-08 in the contract), not `/`, so the fix
  is proven page-wide via the shared layout rather than coincidentally only
  where the home-page section also happens to be correct.
