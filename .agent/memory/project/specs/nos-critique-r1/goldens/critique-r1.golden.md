# nos-critique-r1 F1: golden

**Where.**
- Worktree `.tmp/sandbox/critique-r1`, branch `fix/nos-critique-r1`, base `1e1f5732` (main).
- Source report: `.tmp/sandbox/nos-excellence-critique/round-1/REPORT.md`, items (b)#3, #9
  and #12.
- Bar: Codi's NOS acceptance bar A–J, `/Users/vetus/ai/SAOC/comms.md:1616`.

**QA inputs.**
- The checks are `contracts/checks/nos-critique-r1/*.mjs`, plus the superseded pin in
  `contracts/checks/nos-presenter-cards/check-styles.mjs`.
- @architect wrote them. `checks.sha256` locks them, and @dev must not edit them.

**No invention.** Every string and value below traces to:
- Codi's bar or ruling;
- the approved handoff or `branding/`;
- Brad's instruction;
- existing site copy or code, cited by file:line.

---

## §1 Footprint (lead-cleared; guard `check-footprint.mjs`)

Files @dev may change:
- `app/(marketing)/national-show/sponsors/page.tsx`
- `app/(marketing)/national-show/symposium/page.tsx`
- `app/(marketing)/national-show/wosa-conference/page.tsx`
- `app/(marketing)/national-show/presenters.css`
- `docs/nos-critique-r1.md` (@docs)

Changed by @architect:
- `contracts/checks/nos-critique-r1/**`
- `contracts/checks/nos-presenter-cards/check-styles.mjs` (§4)

Everything else is off limits, and the guard fails on any other changed or untracked path.

**F2 owns** `components/nos/*`, `components/tickets/*`, `ShowContentState`,
`RealEmptyListing.tsx`, the hub, archive and exhibitors.

`nos-theme.css` and `components/show/_shared/StatusMarker.tsx` are not cleared either. They
are used, never edited.

---

## §2 Sponsors: G2 designed empty state (report (b)#3)

**Bar G2.** A heading, one line of real copy from the page data or an R11 placeholder, and a
next-step link. Never a blank section or a bare "No results".

**Today.**
- `sponsors/page.tsx:69-78` renders `RealEmptyListing`: a dashed panel, the absence
  statement, a TBC chip, an "EACH ENTRY WILL SHOW / Sponsor / Tier / Website" scaffold, and
  the button.
- `RealEmptyListing.tsx` is F2's, so sponsors **stops using it**. The page builds its own
  G2 block from existing primitives. It does not edit any of them.

**Sources, element by element.** None is new copy.

| element | string | source |
|---|---|---|
| heading | "Become a sponsor" | `app/(marketing)/sponsors/page.tsx:109`. This is the site's own sponsorship block, the same block as the CTA the lead cleared. |
| R11 chip | "To be confirmed by the show committee" | Codi's bar G1 (comms.md, section G) and the seeded pendingLabel in `contracts/golden/show-visitor-info/confirmation-status-model.golden.md:28` |
| line | "No Show sponsors have been confirmed for 2027 yet." | The first sentence of the existing `ABSENCE_STATEMENT` (`sponsors/page.tsx:31-33`). It is factual: `showSponsorsQuery` returns 0 records. Its wording has no council source, so it sits under the R11 chip. That is an R11 placeholder: chip, then one sentence. |
| next step | "Talk to us about sponsorship" → `mailto:info@saoc.co.za` | `app/(marketing)/sponsors/page.tsx:119` for the label; Brad for the address (all contact goes to info@) |

**Removed.**
- `RealEmptyListing` (the import and its use), and `CARD_FIELD_LABELS`.
- The second sentence of `ABSENCE_STATEMENT`: "…as the Council signs off each partnership
  ahead of the show." It is an unsourced timing promise, and G2 allows one line.
- `ABSENCE_STATEMENT` is replaced by `const NO_SPONSORS_YET`.

**Structure.**
- The exact target is `goldens/sponsors.page.golden.tsx`. Copy it, with formatting free and
  structure fixed.
- The block is `<Card data-nos-empty-state="sponsors">`. It is the NOS canvas card
  (`components/nos/Card.tsx`): radius-card, white, rule border. R18/5 says no dashed
  outline.
- Inside it, in this order:
  1. `<SectionHeading title="Become a sponsor" />` (h2, no eyebrow; an eyebrow would be new
     copy).
  2. `<ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" />`
  3. `<p>{NO_SPONSORS_YET}</p>`, at 17px/1.65 (bar B3).
  4. `<Button as="a" href="mailto:info@saoc.co.za">Talk to us about sponsorship</Button>`.
     This is the default primary variant, which already carries the 44px floor.
- The `ShowEntityGrid` branch for `list.length > 0` is unchanged.

---

## §3 Prose measure of 60ch or less (report (b)#9; bar B3)

**Measured (audit).** sponsors 126ch, wosa 93ch, symposium 87ch.
- `ShowPageProse` renders PortableText inside `ShowContentState`'s `max-w-[900px]` column,
  with no measure of its own.
- The hero lede is already `max-w-[58ch]` (`components/nos/NosHero.tsx:303`), so leads
  already meet 58ch or less. The rendered check measures them anyway.

**Change (amended after Codex P2 on 7c3a25d9).** On each of the three pages, wrap
`<ShowContentState …/>` (and nothing else) in:

```tsx
<div className="contents [&_.nos-show-page-prose_p]:max-w-[60ch] [&_.nos-show-page-prose_li]:max-w-[60ch]">
```

- `contents` adds no box, so layout and spacing are unchanged.
- **Scope.** The cap reaches only PortableText prose, meaning the `p`/`li` inside
  `ShowPageProse`'s `.nos-show-page-prose` div (`components/nos/ShowPageProse.tsx:51-52`). That
  includes the R11 notice line.
- **Why not `[data-nos-content-state]`.** The first selector, `[data-nos-content-state] p/li`,
  also capped:
  - `ShowEntityGrid`'s `<li>` cards (`components/show/nos/ShowEntityGrid.tsx:37`);
  - the `<p>`s inside sponsor cards.

  With one or two sponsors, those cards stopped filling their grid tracks. That selector is
  now forbidden.
- **Prose outside `.nos-show-page-prose` takes the cap directly**, as a page-local
  `max-w-[60ch]` on its own `<p>`:
  - the sponsors G2 line (`<p className="mt-3 max-w-[60ch] …">{NO_SPONSORS_YET}</p>`);
  - wosa-conference's `afterProse` WOSA credit (`wosa-conference/page.tsx`, the
    `<p className="border-t … ">` before "For wild orchid identification…": add
    `max-w-[60ch]`, with no copy change).
- **Exposure audit.**
  - symposium's `ShowContentState` (prose layout) renders only `ShowPageProse`, so nothing
    else is affected.
  - wosa's adds only the `afterProse` `<p>`, now capped directly.
  - On all three pages, `PresenterSection` (the presenter grid `li`) sits outside
    `ShowContentState` and was never reached.
  - On sponsors, the `ShowEntityGrid` `<ul>/<li>` is the only list under `ShowContentState`
    besides prose.
- `ShowContentState` is not edited.

**Not covered (gap, §6).**
- The presenter bios: `.pc-body p` uses `max-width: 68ch` (`presenters.css:84`).
- The hub (154ch).

---

## §4 Presenters focus per R9/3 (report (b)#12) — AMENDED 2026-10-16

**Codi's corrected ruling, verbatim.** "FOCUS. R9/3 stands: violet #7E3F97 on pale-gold
grounds (~6.6:1), and pale gold #fbfaf0 on royal/dark grounds. 'Royal on light' in my bar D3
and in my presenters ruling was my error. So: nos-theme.css:181 --ring-focus-on-light stays
violet, unchanged, and F2 doesn't touch it. Presenters should be the theme violet ring at 2px
solid with a 2px offset, i.e. what was already rendering. Please revert your royal re-point."

The first version of this section asked for royal. That instruction is withdrawn.

**What renders.**
- `.nos-theme :focus-visible:not(.group)` (`nos-theme.css:245`, specificity 0,3,0) beats
  `.nos-presenters :focus-visible` (`presenters.css:58`, 0,2,0). Both are unlayered.
- So presenters already render the theme ring: `2px solid var(--ring-focus)` at a 2px offset.
  On light grounds that is violet `#7e3f97`. Inside `.nos-on-dark` it is pale gold `#fbfaf0`.
- The rendered check measured violet at 2px/2px on base.

**Decision: dead-code removal, nothing else.**
- Line 58's `outline: 2px solid var(--pc-violet); outline-offset: 3px` never wins, which is
  exactly what the audit misread as "3px violet". Under "leave nothing dead" it goes.
- Line 58 becomes exactly `.nos-presenters :focus-visible { border-radius: 4px; }`. The
  `border-radius` is live, so it stays.
- **No** `--ring-focus` re-point anywhere in `presenters.css`. Remove the
  `--ring-focus: var(--pc-royal);` line from the root block.
- No other line changes.
- The render is unchanged: A9 still expects violet at 2px/2px.

**Untouched.**
- `--pc-violet` stays declared and is used by `.pc-role` and `.pc-more` (Codi's reference
  render).
- `.pc-body` keeps `max-width: 68ch`. Codi: "Bios: keep 68ch. That's the approved presenters
  handoff, which Brad approved." It is not in scope.

**`contracts/checks/nos-presenter-cards/check-styles.mjs` pins** (rewritten by @architect for
the corrected ruling):
- `:focus-visible` declares no outline and no outline-offset;
- `border-radius` is 4px;
- `.nos-presenters` declares no `--ring-focus`.

---

## §5 Rendered critique round (`check-rendered.mjs`; needs `pnpm build` first)

**Setup.**
- `next start` runs on a free port in 3010-3019 (never 3002), with throwaway local basic-auth
  credentials so the beta wall (`proxy.ts`) admits the check.
- Playwright Chromium runs at 375×812, 768×1024 and 1280×800, plus 360×800 for overflow only.
- Routes: /national-show/sponsors, /symposium, /wosa-conference.

**Measures.**
- **B3:** every visible `<p>`/`<li>` of 40 characters or more inside
  `[data-nos-content-state]` is 60ch or less. Width is the content box divided by the width
  of "0" in that element's own font.
- **B3 lede:** the hero lede (the `<p>` after the `<h1>`) is 58ch or less.
- **C4:** scrollWidth is no larger than clientWidth.
- **Scope probe (1280, every route):** inside `[data-nos-content-state]`, the check injects:
  - a grid `<ul>` (outside `.nos-show-page-prose`) with a long `<li>`. The `<li>` must fill
    its track: its width is within 1px of the `<ul>` content width, and that track is wider
    than 61ch, so the probe actually binds.
  - a `<ul><li>` inside the first `.nos-show-page-prose`. That `<li>` must be 60ch or less.
  - It runs whatever the sponsor data is, so a selector that caps grid items fails even while
    there are 0 sponsors.
- **G2 (sponsors):**
  - "Each entry will show" is absent.
  - `[data-nos-empty-state="sponsors"]` holds, in DOM order: h2 "Become a sponsor", then a
    `[data-confirmation-badge="pending"]` containing "To be confirmed by the show committee",
    then the exact line, then a mailto link "Talk to us about sponsorship" of at least
    44×44.
- **D3 (symposium):**
  - Two probe `<button>`s are prepended inside `.nos-presenters`: one on the light ground, one
    inside a `.nos-on-dark` div. Each is focused with keyboard modality, and the check fails
    as invalid if `:focus-visible` does not match.
  - The light probe must compute `2px solid rgb(126, 63, 151)`, offset 2px (the theme violet,
    R9/3).
  - The on-dark probe must compute `2px solid rgb(251, 250, 240)`, offset 2px.
- **Screenshots** go to `.tmp/sandbox/critique-r1-shots/<route>-<width>.png` for Codi's Canary
  pass.

---

## §6 Gaps (named, not filled)

1. **There is no council copy for the sponsors empty state.**
   - The heading is borrowed from the site-level sponsorship block. The line is our own
     factual sentence under an R11 chip.
   - This is already on Brad's Lee-Ann list (comms "content needed" items 1 and 2: Sponsors
     intro, confirmed sponsor list).
2. **The R11 chip anatomy does not match G1.**
   - G1 wants a dashed 2px chip in Karla 700, 12px, .14em, uppercase.
   - `ConfirmationBadge` → `StatusMarker` renders a solid 1px border in mono with a "※"
     glyph, which also fails B6.
   - `StatusMarker.tsx` is not cleared. The owner is the F2/lead.
3. Withdrawn: the sitewide violet ring is correct per R9/3, which Codi confirmed on
   2026-10-16.
4. Closed: the presenter bio measure stays at 68ch, Codi's approved presenters handoff, which
   Brad approved. Not in scope.
5. **The hub measure is 154ch.** The hub is F2's, so it was not touched.
