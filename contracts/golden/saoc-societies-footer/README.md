# saoc-societies-footer: expected behaviour (PR-2, branch fix/saoc-societies-footer)

Contract: `contracts/saoc-societies-footer.yaml`. Checks: `contracts/checks/saoc-societies-footer/`.
Fixtures: `societies-fixture.json`, `fixtures/browser-manifest-deployed.json`.

Governing rules: `docs/rules/no-invention.md`. Visual decisions only from
`design/design_handoff_saoc/` (golden CSS is `src/styles.css`, golden markup `src/pages-interior.jsx`
l.212-245) and `branding/`. NOS Design rulings SO-1, SO-2, P3, FT-1 are final: implement as given.
Lee-Ann's answers, `.tmp/sandbox/health/leeann-doc-2026-10-24.txt` l.44-46: "SANBI and Kirstenbosch are
not partners. WOSA is a Partner."

Run `.mts` checks with `pnpm exec tsx` (resolves the `@/` alias), `.mjs` with `node`. The worktree has
no `node_modules`; run `pnpm install` in it first.

## (e) /societies server HTML has the society links

Cause: `SocietiesClient` calls `useSearchParams()`, so the static render bails out to the nearest
`<Suspense>` fallback, and the fallback is a grey skeleton with no links.

Implement:
- New `components/societies/SocietiesGrid.tsx`: a server-safe component (no `use client`, no hooks)
  taking `{ societies: SanitySociety[] }` and rendering the same grid wrapper
  (`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3`) of `<SocietyCard>`s. Export it from
  `components/societies/index.ts`.
- `SocietiesClient` renders its filtered results through `SocietiesGrid`, so server and client markup
  are the same cards.
- `SocietiesFallback.tsx` is rewritten to take `{ societies }` (not `count`): a filters row that
  reserves the real row's height (same classes, no text, `aria-hidden`) followed by
  `<SocietiesGrid societies={societies} />` with every society, unfiltered. No `animate-pulse`.
- `page.tsx` passes `<SocietiesFallback societies={listed} />` as the Suspense fallback.
Client JS only filters. Result: the static HTML carries one `<a href="/societies/<slug>">` per listed
society, and a no-JS visitor or crawler can follow each one.

## (f) SO-1 filters row and province chips

Replace the search block and the chip group with ONE row, golden `.filters` (styles.css:1304):
`flex flex-wrap items-center justify-between gap-5 border-b border-rule pb-6` (golden: gap 20px,
padding-bottom 24px, 1px `var(--rule)` under it). Inside: the chips group on the left (golden
`.filters__chips`, gap 6px = `gap-1.5`, wrapping) and the search field on the right (golden
`.filters__search`: parchment ground, 1px rule border, 2px radius, 8px gap, `min-w-[260px]`, muted
search icon from `lucide-react` `Search` at 16px). The input keeps the current 16px size (stops iOS
zoom) and its transparent, borderless inner styling.

Chips, golden `.chip` (styles.css:1318) with the ruling's size: pill (`rounded-full`), 1px rule
border, parchment ground, label in the sans at 14px (`font-sans text-[14px]`, ink), then the count in
mono (`.chip__n`: `font-mono text-[10.5px] opacity-70`, 8px gap, `.is-active` opacity 0.85). Active chip
uses `bg-primary border-primary text-ivory` (golden `.chip.is-active`, `var(--primary)`), replacing
today's `bg-ink`. Hover border `var(--primary)`. Each chip and the search field are at least 44px tall
(`min-h-11`; this overrides the golden's 7px/14px padding, which is shorter). The "All" chip stays,
labelled "All provinces". Keep the existing 480px abbreviation of the label; the count shows at every
width. `aria-label` is `"<name>, <count>"` so a screen reader hears the count.

Counts come from data: new `lib/societies-view.ts` exports
`provinceCounts(societies: { province: string | null }[], provinces: { code: string }[]): Record<string, number>`,
keyed by province code plus `ALL` (the total). Province match is case-insensitive, as the client filter
already compares upper-cased. A society with no province counts only toward `ALL`. A province with no
society is `0`. Fixture and exact expected counts: `societies-fixture.json` `expectedCounts`.

## (g) SO-2 province eyebrow reserves its line

`SocietyCard` always renders the eyebrow `<p>` (same classes). With a province: the province text.
Without: the same `<p>` plus `aria-hidden="true"`, containing only a non-breaking space (U+00A0), so the
line box has identical metrics and titles align across a row. No province is invented, and nothing is
announced. Alfred County Orchid Society (no province in Sanity) is the live case; its data is not
touched.

## (h) P3 duplicate search label

Delete the visible mono `<label>`. The input keeps `placeholder` and gains
`aria-label` with the same string (`SEARCH_PLACEHOLDER`, the one place the string lives:
`Search by name or region…`). `htmlFor`/`id` pairing goes with the label.

## (i) FT-1 footer

Source of the pattern: `components/nos-chrome/NosFooter.tsx` (#77): the lockup block, REG# and NPO,
then a `FOOTER_RHYTHM.list` `<ul>` holding the WOSA anchor (`target="_blank"`, `rel="noopener noreferrer"`,
`FOOTER_RHYTHM.row` + `gap-1`, `FOOTER_WOSA.label`, `<ExternalArrow />`, `FOOTER_NEW_TAB_CUE` in an
`sr-only` span).

Implement in `components/chrome/Footer.tsx` and `footer-data.ts`:
- Delete the Partners column, the `partners` import from `@/lib/data`, and `FOOTER_HEADINGS.partners`.
  Update the file header comment (three columns).
- In the brand column, after the `FOOTER_REG` span, add that `<ul>` with the WOSA link, styled as the
  Explore links are (`font-sans text-ivory/80 hover:text-ivory transition-colors duration-150`).
  WOSA appears once in the footer.
- Add `FOOTER_LAYOUT.gridSaoc` =
  `grid grid-cols-1 gap-x-8 gap-y-12 py-16 px-8 max-w-[1280px] mx-auto md:grid-cols-2 xl:grid-cols-[auto_auto_300px] xl:justify-between`
  (the existing `grid` string with three tracks; justify-between over content-width tracks makes the two
  gaps equal by construction, the same device as the four-track grid). Footer.tsx uses it. The shared
  four-track `FOOTER_LAYOUT.grid` is unchanged: `NosFooter` still uses it.
- Update the `FOOTER_WOSA` comment in `footer-data.ts` ("the first Partner on SAOC" is no longer true).

Where SANBI and Kirstenbosch appear on SAOC pages (found by grepping `components/ app/ lib/ content/
sanity/ scripts/ public/`):
1. `components/chrome/Footer.tsx`, Partners column, via `lib/data/partners.ts` (names listed there).
2. `lib/data/partners.ts`: three entries, two to remove. After (1) nothing imports `partners`, so
   delete the file and its `export * from './partners'` line in `lib/data/index.ts` (and the `Partner`
   type in `types/index.ts` if it is then unused). Grep before deleting.
3. `components/home/PartnersSection.tsx` `STATIC_PARTNERS`: the `sanbi` and `kirstenbosch` cards.
   Remove both; only the `wosa` card remains. The home page strip reads Sanity `sponsor` documents first
   (`partnersQuery`, `app/(marketing)/page.tsx`) and uses `STATIC_PARTNERS` only when that returns none.
4. NOT partner mentions, left alone: `lib/data/placeholder-events.ts` lines 32, 61, 109 use
   "Kirstenbosch Hall" as an event venue.

Not code, flagged for the orchestrator: if the Sanity dataset holds active `sponsor` documents for
SANBI or Kirstenbosch, the live home strip still shows them after this PR. That is a content edit
(set `active: false` or delete), not part of this diff, and not checkable offline.

Superseded history: `contracts/partners-cards.yaml` A17-A21 assert the SANBI/Kirstenbosch names in
`PartnersSection.tsx` for a card layout the file no longer has; it is not a live gate.

## (j) JU-1 /judging section headings

Defect: the five headings are `<h2 className="eyebrow">` (12px mono pills). Promote the existing
strings; no new copy. Golden: `design_handoff_saoc/src/pages-interior.jsx:350-415` uses `.h2`
(`styles.css:112`) with design placeholder lines ("Three regions, one standard." and the like); those
lines are NOT used, only the treatment.

Implement: `JudgingSplit.tsx` heading becomes `<h2 className="h2 justify-self-start">`; in `page.tsx` the
"SAOC awards" and "Accredited judges" headings become `<h2 className="h2">` and their wrapper `mb-10` /
`mb-6` becomes `mb-6` (24px). The existing `.h2` class in `app/globals.css` is the token set: serif,
`--display-md` (clamp 34px to 54px, so always at least 32px, hence weight 300), sentence case, margin 0.
Do not edit `.h2`. The stacked heading-to-body gap is already `var(--space-5)` (24px) in
`[data-judging-split]`; section rhythm stays `py-24` (96px, golden `.section`). On at least 1024px the
heading stays in its left column as today. The hero eyebrow "SAOC judging system" keeps the eyebrow
style (a real eyebrow). Headings, tag, font, size, weight: `judging-headings.json`.

## (k) JU-2 Contact SAOC target

`components/judging/JudgesDirectory.tsx`: the link (`min-h-6`, 24px tall) becomes
`inline-flex min-h-11 items-center` (44px, text vertically centred in the hit area), every other class
unchanged so the look is the same.

## Email

None of these changes sends email or touches an email path (the footer newsletter form is untouched), so
no `gws_inbox_check` is declared. The triad linter will report that kind missing; that is correct here.

## Out of scope

No new colour, font or token. No change to NOS pages other than the shared footer-data constants
(its grid string and behaviour are asserted unchanged). No change to society data, the society detail
page, or the Sanity schema.
