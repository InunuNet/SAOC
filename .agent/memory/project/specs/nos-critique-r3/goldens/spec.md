# nos-critique-r3 F1 — golden spec (R39)

Worktree `.tmp/sandbox/critique-r3` (base `242f51fb (origin/main after the F2-r36 and F6 rebase; r3 was originally specified against ea9056ad)`). Ruling R39, relayed by the SAOC lead 2026-10-16:
"[P1] Cards are 782px tall, so the 4 bios read as a two-screen wall of text. Clamp each bio to 4 lines and
make "Read full bio" an inline disclosure with aria-expanded, not a modal. Keep the existing accessible names."
"[P2] Bio text is 16px; the body role is 17px." Content gaps (one role line, no talk titles/sessions) go to Brad
via the lead: add NO fields and NO copy.

## 1. Footprint (A2)
Only: `components/nos/PresenterGrid.tsx`, `components/nos/PresenterSection.tsx` (rename one prop, drop one
comment), `app/(marketing)/national-show/presenters.css`, `docs/nos-critique-r3.md`, and checks under
`contracts/checks/`. The two architect-owned files in `nos-presenter-cards/` (check-styles, check-section-source)
are already updated; @dev does not edit them or anything in `nos-critique-r3/`. Hub page, tickets, vendors CTA,
ShowContentState, nos-theme.css, NosSkipLink: untouched.

## 2. The 17px body role (P2) — source
`app/(marketing)/national-show/nos-theme.css:307` `--fs-body: 1.0625rem;` (comment: "R14 body scale ... mock
index.html:21"), applied at `nos-theme.css:163` (`.nos-theme { font-size: var(--fs-body) }`). 1.0625rem = 17px.
The approved handoff `design/design_handoff_saoc/colors_and_type.css:52-57` has NO 17px role (`--body-md: 16px`
default, `--body-lg: 18px`); that is the SAOC scale, not the NOS scale. So the 17px pin rests on nos-theme.css R14
plus R39's explicit "17px". `.nos-presenters` currently overrides to `font-size: 1rem` (presenters.css), which is
why bios compute 16px. Do not touch nos-theme.css. Put the body role on `.pc-clip` only (the bio), not on
`.nos-presenters`, so eyebrow/order note/name/role sizes are unchanged.

## 3. Decisions

| question | decision | why |
|---|---|---|
| 4-line clamp mechanism | `max-height: calc(var(--pc-bio-lines) * var(--pc-bio-lh) * 1em)` + `overflow: hidden` on `.pc-clip`, bottom fade mask | `-webkit-line-clamp` only clamps inline text in one block; a bio is a grid of several `<p>`/`<ul>` blocks with 14px gaps, so line-clamp would clamp none of them correctly. max-height is exact: 4 x 1.68 x 17px = 114.24px. |
| degradation | Clamp CSS is scoped to `.pc-grid[data-clamp]`, which is set after mount (`useSyncExternalStore`, server false / client true). No JS (or before hydration) = full bios, every button `hidden`. | The only alternative (always clamp) would hide bio text for no-JS users with no way to reveal it. Cost: a one-time layout shift at hydration; accepted. |
| disclosure element | `<button type="button" aria-expanded aria-controls>` toggling a class | R39 requires aria-expanded. Native `<details>` exposes expanded state implicitly, cannot clamp a preview of its own content, and cannot be hidden when the bio fits; rejected. |
| accessible name | unchanged: visible `Read full bio` + `<span className="sr-only"> of {presenter.name}</span>` | R39 "keep the existing names". |
| collapse label | None. Neither existing code nor R39 supplies one, so the same name stays and only `aria-expanded` flips (false -> true -> false). No "Show less" etc. | no-invention rule. |
| show toggle only on overflow | `hidden={!overflowingIds.includes(id)}`; overflow = `clip.scrollHeight > MAX_LINES * lineHeightPx + OVERFLOW_TOLERANCE_PX`, where lineHeightPx = `parseFloat(getComputedStyle(firstBodyBlock).lineHeight)`. Measured by absolute px (not clientHeight) so it is identical collapsed or expanded; an expanded card keeps its toggle. | a bio of <= 4 lines gets no button and no fade. |
| focus | never moved. No `.focus()`, no scroll calls. | a disclosure keeps focus on its trigger. |
| motion | none. No transition on height; `.pc-more` colour transition only inside `@media (prefers-reduced-motion: no-preference)`. max-height auto is not animatable and a JS-driven animation is unwarranted for a text reveal. | craft-floor: reduced motion honoured by construction. |
| equal heights | R39 replaces the shortest-bio clamp. Delete `level()`, `--bio-h`, `Math.min`. Grid stays `align-items: start`; collapsed cards are naturally within 4 lines of each other, an expanded card grows alone. | stretching would pad the neighbour with empty card. |
| modal | Delete `<dialog>`, `dialogRef/sheetBodyRef/closeRef/openerRef`, `activeId`, `openBio`, `handleDialogClose`, the `eager` prop on `PresenterImage` (only the dialog used it), and all `.pc-modal`, `.pc-sheet-*`, `html:has(...)`, `@keyframes pc-rise/pc-fade` CSS. Remove tokens only the dialog used. | coding.md: leave nothing dead. |
| prop rename | `dialogIdBase` -> `idBase` in both components (the name would lie). | |
| focus ring, 68ch, ink | unchanged (theme R9/3 ring; `.pc-body p, li { max-width: 68ch }`). | |

## 4. Target PresenterGrid.tsx shape
- Imports: `useCallback, useEffect, useRef, useState` still; drop nothing else needed. `'use client'` stays.
- Constants (named): `MAX_LINES = 4`, `OVERFLOW_TOLERANCE_PX = 1`.
- State: `clampReady: boolean` (false until mount), `overflowIds: string[]`, `openIds: string[]`.
- `measure` (useCallback on `presenters`): for each `.pc-clip` read the first `.pc-body p, .pc-body li`; a clip with no block is not overflowing; `overflowIds` = ids whose `scrollHeight > MAX_LINES * lineHeightPx + OVERFLOW_TOLERANCE_PX`; set state only when the list changed.
- `clampReady`: `useSyncExternalStore(subscribe, () => true, () => false)` (server snapshot false, client true; `subscribe` is a no-op). eslint `react-hooks/set-state-in-effect` rejects `setClampReady(true)` in an effect; behaviour is identical: `data-clamp` appears only after mount. Keep a `useEffect` for the ResizeObserver; same ResizeObserver (grid + each `.pc-body`), `document.fonts.ready.then(schedule)`, rAF schedule, `disconnect`/`cancelAnimationFrame` cleanup as today.
- `toggle(id)`: add/remove id in `openIds`. Nothing else.
- Markup:
```tsx
<ul ref={gridRef} className="pc-grid" data-clamp={clampReady ? '' : undefined}>
  ...
  <div className="pc-bio">
    <div
      id={`${idBase}-bio-${presenter.id}`}
      className={`pc-clip${overflowIds.includes(presenter.id) ? ' is-clipped' : ''}${openIds.includes(presenter.id) ? ' is-open' : ''}`}
    >
      <PresenterBody bio={presenter.bioExcerpt} />
    </div>
  </div>
  <div className="pc-foot">
    <button
      type="button"
      className="pc-more"
      aria-expanded={openIds.includes(presenter.id)}
      aria-controls={`${idBase}-bio-${presenter.id}`}
      hidden={!overflowIds.includes(presenter.id)}
      onClick={() => toggle(presenter.id)}
    >
      Read full bio<span className="sr-only"> of {presenter.name}</span>
    </button>
  </div>
```
  `ids` are passed through `presenter.id`; ensure they are DOM-safe as today.
- Fragment/`<dialog>` wrapper removed; `PresenterGrid` returns the `<ul>`. File header comment rewritten to describe the disclosure.
- `PresenterSection.tsx`: `<PresenterGrid presenters={ordered} idBase={idBase} />`; comment "full-bio dialog" -> "inline bio disclosure". Nothing else.

## 5. Target presenters.css (exact values the checks pin)
Declared on `.nos-presenters`: `--pc-bio-lines: 4;` `--pc-bio-lh: 1.68;`
```css
.nos-presenters .pc-clip { font-size: var(--fs-body, 1.0625rem); }
.nos-presenters .pc-grid[data-clamp] .pc-clip:not(.is-open) { max-height: calc(var(--pc-bio-lines) * var(--pc-bio-lh) * 1em); overflow: hidden; }
.nos-presenters .pc-grid[data-clamp] .pc-clip.is-clipped:not(.is-open) { -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 1.7em), transparent); mask-image: linear-gradient(to bottom, #000 calc(100% - 1.7em), transparent); }
.nos-presenters .pc-body p, .nos-presenters .pc-body li { max-width: 68ch; line-height: var(--pc-bio-lh); }
@media (prefers-reduced-motion: no-preference) { .nos-presenters .pc-more { transition: color var(--pc-t-med) var(--pc-ease); } }
```
- Remove from `.pc-more` the unconditional `transition`; keep `min-height: 44px`, `display: inline-flex`, violet, underline, `[hidden]{display:none}`, hover.
- Delete the old `.pc-clip` / `.pc-clip.is-clipped` rules, the whole dialog block (`.pc-modal` through `@keyframes pc-fade`), the `html:has(...)` rule, the `@media (max-width:600px)` sheet block, the two dialog comments, and the stale "equal heights come from the script" comment.
- Delete tokens `--pc-gold-100 --pc-gold-300 --pc-backdrop --pc-shadow-xl --pc-t-slow --pc-fs-lg --pc-fs-xl`. Keep `--pc-t-med --pc-ease --pc-radius-md --pc-white --pc-black` (still used). Remove the file header's mentions of the dialog only where they would now be false.
- 1.7em fade (not the old 5.5em): the whole clamp is 4 lines (6.7em), 5.5em would mask almost all of it.
- Check-styles supersession comments say "R39 supersedes"; mirror the R35/R36 style in presenters.css where a value changes.

## 6. Craft-floor items folded into assertions
disclosure a11y (button, aria-expanded flips, aria-controls resolves to the region, keyboard Enter/Space, focus stays); target >= 44x44; focus ring left to the theme; reduced motion (no animation/transition outside no-preference, rendered with `reducedMotion: reduce`); no-JS full text; text never lost (clipped text stays in the a11y tree, nothing aria-hidden); no horizontal overflow at 375 and 1280.

## 7. Rendered pins (A9, symposium)
At 375 and 1280: card <= 600px (was 782px); collapsed clip <= 4 x computed line-height + 1px; >= 1 card overflows and shows the toggle; bios that fit show none; aria-expanded false -> true -> false by click, and Enter/Space; expanded clip shows the whole text and is taller; `document.activeElement` is the button; zero `dialog`/`.pc-modal`; bio `p`/`li` font-size 17px, line-height 28.56px, <= 68ch; target >= 44x44; no overflow. No-JS (JavaScript disabled): no `data-clamp`, nothing clipped, all toggles hidden. Screenshots to `.tmp/sandbox/critique-r3-shots/`.

## 8. Docs
`docs/nos-critique-r3.md`: R39 text, the 17px source (nos-theme.css:307 R14, handoff has none), clamp mechanism and no-JS degradation, the aria-expanded/aria-controls contract and unchanged name, removed modal, supersession of the R35-era equal-height pins, the content gaps routed to Brad (not built).


---
# F2 — R43 (contract-f2.yaml)
Same worktree and base (`242f51fb (origin/main after the F2-r36 and F6 rebase; r3 was originally specified against ea9056ad)`) and branch as F1; one @dev does F1..F4 in order (F2/F3/F4 touch PresenterSection.tsx and presenters.css again).
Check scripts are in `contracts/checks/nos-critique-r3/`, hash-locked in `goldens/checks.sha256`. Footprint guards are per feature and cumulative:
`check-footprint.mjs --through=N`. Lead ruling: hub and /tickets page files only where unavoidable (the four class lines listed in F2.2d); /workshops and /conferences ticket text is out.
Rendered before -> after: `check-rendered-f2.mjs` prints the font-size table (route, text, before px -> measured after px, source line) on pass.

### F2.1 R43 P1 — replace the internal note with the existing R11 chip
- `PresenterSection.tsx` today renders `<p className="pc-order-note">Sample sequence. Lee-Ann will confirm the order.</p>` when `provisional`.
- The R11 chip is `ConfirmationBadge` (`components/show/ConfirmationBadge.tsx`, a wrapper over `_shared/StatusMarker.tsx`), exported from `@/components/show`.
  The exact string "To be confirmed by the show committee" already lives, as a literal prop, at
  `app/(marketing)/national-show/sponsors/page.tsx:79`: `<ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" />`.
  There is no shared constant; reuse the same literal (touching sponsors/page.tsx is out of footprint). StatusMarker also has a hardcoded floor label
  "To be confirmed" if the prop were ever empty.
- Target: `import { ConfirmationBadge } from '@/components/show';` and
  `{provisional ? <ConfirmationBadge status="pending" pendingLabel="To be confirmed by the show committee" /> : null}` in place of the note. No new copy.
- Delete `.pc-order-note` CSS (and its pins; check-styles.mjs now asserts it absent). The chip sits in `.pc-sec-top` exactly where the note did.

### F2.2 R43 P2 — body floor at 390px (measured, not guessed)
Measured on the production build of the worktree at 390x844 with a Playwright probe (leaf elements with >= 25 chars of own text, computed < 16px).
**Rule used to separate prose from meta** (encoded in `check-rendered-f2.mjs`):
- RUNNING PROSE = own text of >= 4 words that is >= 40 chars or ends in . ? ! , not uppercase/tracked, not a pill badge, not in `.nos-show-page-notice`.
  It takes the body role: **17px** (`--fs-body`, nos-theme.css:307, R14) on NOS routes. Precedent for the literal: `sponsors/page.tsx:80` `text-[17px]`.
- Two exceptions to 17px, both **16px** = handoff `--body-md` (design/design_handoff_saoc/colors_and_type.css:55, "default"): the SAOC home cards
  (outside `.nos-theme`, so `--fs-body` is not defined there) and `JudgingGroupCard` (2-up at 390, ~150px columns: 17px would run 14 chars/line).
- META/LABEL stays at its current size, 12–14px: uppercase or tracked text (dt labels, eyebrows, chips, button labels, StatusMarker), pill badges (`Badge`),
  short fact values and captions without a sentence. `--body-xs: 13px` "tiny meta" and `--body-sm: 14px` "captions-adjacent" (colors_and_type.css:56-57) cover them.
- Only existing tokens: 17px = `--fs-body`; 16px = `--body-md`. No new token, no new size.

### 2a. FIX (class-only edits; before -> after at 390; each is pinned by NAMED rows in check-rendered-f2 and by PAIRS in check-static-f2)
| route | element (own text starts) | file:line | before | after |
|---|---|---|---|---|
| `/` (SAOC home, outside /national-show) | NavCards card blurbs "From Cape Town to Polokwane…" (x4) | components/home/NavCards.tsx:130 | 13 | 16 |
| `/` | PartnersSection partner blurbs "Partner organisation hosting…" (x3) | components/home/PartnersSection.tsx:74 | 15 | 16 |
| `/national-show` | hub link-card descriptions "The 2027 theme…" (x5) | components/nos/VisitorLinkCard.tsx:23 (shared) | 14 | 17 |
| `/national-show` | "Looking for your local orchid society?" | national-show/page.tsx:586 (**hub page file**) | 15 | 17 |
| `/national-show` | "Host province rotates…" | national-show/page.tsx:614 (**hub page file**) | 13 | 17 |
| `/national-show` | class cards "Cattleya, Laelia…" (x12) | components/nos/JudgingGroupCard.tsx:32 (shared) | 13 | 16 |
| `/national-show` | exhibitor path "Contact your provincial society…" (x4) | components/nos/ExhibitorStageCard.tsx (the `<p>` description, shared) | 14 | 17 |
| `/plan-your-visit` | venue paragraph "The show is held at the hangar…" and address block | components/show/VenueCard.tsx:48,80 (shared) | 15 | 17 |
| `/plan-your-visit` | emergency notes "Works from any mobile…", "The committee will supply…" | plan-your-visit/page.tsx:157 (**page file**) | 13 | 17 |
| `/plan-your-visit` | attraction note (conditional, same class) | plan-your-visit/page.tsx:118 (**page file**) | 14 | 17 |
| `/what-to-expect` | "Dates and daily opening hours…", "The final day usually closes…" | what-to-expect/page.tsx:160 (**page file**) | 13 | 17 |
| `/tickets` | group descriptions "See what is involved…", "Register a trade booth…", "Register for the SAOC Symposium…", "Book Sunset Cocktails…" | national-show/tickets/page.tsx:188,199 (**tickets page file**) | 14 | 17 |
| `/sa-exhibitors`, `/international-guests` | "No South African nurseries…", "No international guests…" | components/show/nos/RealEmptyListing.tsx:36 (shared) | 15 | 17 |
| `/exhibitors` | key-dates cells "Staging start not set…", "When you can start delivering…" | components/show/ExhibitorKeyDates.tsx:96,105 (shared) | 15 | 17 |
| `/exhibitors` | question answers "Lead times across the shows…" | components/show/ExhibitorQuestions.tsx:49 (shared) | 15 | 17 |
| `/faq` | answers "The show is at Stellenbosch Flying Club…" | components/show/ShowFaqList.tsx:99 (shared) | 15 | 17 |

"exhibitor staging text (12px)" in the lead's note is the `/exhibitors` key-dates cells and the 12px step-timing lines. The cells (15px prose) are fixed above.
The step-timing lines ("By the published entry deadline", ExhibitorSteps.tsx:59) are 12px with `tracking-[0.16em]`: tracked labels -> meta, they stay.

### 2b. STAYS (meta/labels; pinned at their exact current size by META rows, and the sweep asserts every uppercase/tracked label is 12-14px)
| element | file:line | size | reason |
|---|---|---|---|
| hero eyebrow "SINCE 1968 · BLOEMFONTEIN" | components/home/Hero.tsx | 11 | uppercase tracked label (SAOC home hero, not changed) |
| key-fact values "The Hangar, Stellenbosch Flying Club" (dd 15, EventsStrip p 14) | home/ShowBand.tsx:128, home/EventsStrip.tsx | 15 / 14 | short fact value paired with a dt label; no sentence |
| archive note "Reduced format — pandemic protocols" | components/nos/PastEditionCard.tsx:83 | 14 | caption (--body-sm "captions-adjacent"), not a sentence |
| emergency dt labels "Ambulance and fire…", all `dt`/eyebrows/chips | plan-your-visit/page.tsx:150 etc. | 12 | uppercase tracked labels |
| StatusMarker chips "To be confirmed by the show committee" | components/show/_shared/StatusMarker.tsx | 12 | R11 chip, uppercase tracked |
| exhibitors banner "Exhibitor entries are not yet open — …" | exhibitors/page.tsx:99 (inside `Badge`) | 12 | pill badge |
| "Provisional pricing — subject to change." | tickets/page.tsx:182 | 12 | fine-print caption on the price (EXEMPT_TEXT) |
| "You must choose a day when you book.", "Early-bird pricing ends …" | tickets/page.tsx:167,172 | 13 | hint attached to one ticket's controls (EXEMPT_TEXT); the lead named only the group descriptions on this page |
| button labels "See ticket prices and book →" etc. | nos/Button.tsx | 14 | uppercase tracked button label |
| opening-hours/emergency **notes** are NOT meta | | | sentences that tell the visitor something (-> 17). This answers the lead's opening-hours question: notes are prose, `dt` labels are meta. |

### 2c. OUT OF SCOPE / NOT TOUCHED (flag to the lead)
- `.nos-show-page-notice` "This text is an AI-generated placeholder…" (15px) is rendered by ShowContentState (lead exclusion). Exempt in the sweep; will remain 15px.
- Ticket purchase flow text (`/workshops`, `/conferences`, `/national-show/vendors`: TicketTypeCard/CategoryTicketsPage 13px descriptions) is outside the routes the lead named and in
  the ticketing components; not swept, not touched. Say if you want it in.
- Home hero 11px eyebrow is below the NOS 12px floor but home is SAOC, not NOS; unchanged.
- R34 (exhibitors jump nav / top CTA) held per the lead.

### 2d. Page files touched (merge-collision list for the lead's F3 dev)
`app/(marketing)/national-show/page.tsx` (hub; two className edits, lines 586 and 614), `app/(marketing)/national-show/tickets/page.tsx` (two className edits, lines 188 and 199),
`plan-your-visit/page.tsx` (118, 157), `what-to-expect/page.tsx` (160), `symposium/page.tsx` (one import, one JSX line). All edits are single-attribute className swaps, one line each; no reflow of surrounding JSX.
Shared components fixed instead of pages wherever the text lives in one (VisitorLinkCard, JudgingGroupCard, ExhibitorStageCard, VenueCard, RealEmptyListing, ExhibitorKeyDates, ExhibitorQuestions, ShowFaqList).
SAOC home files: `components/home/NavCards.tsx` and `components/home/PartnersSection.tsx` (used by `app/(marketing)/page.tsx`).

### 2e. Existing pins R43 supersedes (architect already updated them; annotated "R43 supersedes")
- `contracts/checks/nos-audit-fixes/check-key-dates-stack.mjs:64` (td `text-[15px]` -> `text-[17px]`)
- `contracts/checks/nos-audit-fixes/check-sponsor-enquiry.mjs:59` (RealEmptyListing statement `text-[15px]` -> `text-[17px]`)
- `contracts/checks/nos-presenter-cards/check-section-source.mjs` and `check-styles.mjs` (order note).
- Older golden fixtures under `contracts/golden/**` (e.g. f6-home-fidelity/NavCards.tsx, PartnersSection.tsx) are historical copies, not gate inputs for this contract.



---
# F3 — R44 A5 (contract-f3.yaml)
Ruling R44 A5: "symposium: jump link only. Fold "Presenters (4)" into r3. No duplicate 2x2 portrait grid: once R39 clamps the bios, the cards are the index. Go 2-up at >=768."


- **Link** `Presenters (N)`, N = `presenters.length`, never a literal. Placement decision: **in PresenterSection.tsx** (next to the id it points at), exported as
  `PresenterJumpLink({ presenters })`, plus `presenterSectionId(presenters)` returning `presenters-${presenters[0].event}` (the same `idBase` the section uses).
  Minimum footprint: `symposium/page.tsx` gains one import and one line `<PresenterJumpLink presenters={presenters} />` between the hero block and `<PresenterSection>`.
  The wosa-conference page is untouched (R44 says symposium) and gets no link. Returns `null` when `presenters.length === 0`.
- Markup: `<div className="pc-jump"><div className="pc-wrap"><a className="pc-jump-link" href={`#${presenterSectionId(presenters)}`}>Presenters ({presenters.length})</a></div></div>`.
  It is a plain `<a>` (no aria-label: the visible text is the name; no new copy).
- Target id: put `id={idBase}` on the existing `div.pc-sec-top` (eyebrow + heading), not on the section (the section's 56px top padding would add dead scroll).
- CSS:
  - `.nos-presenters .pc-sec-top { scroll-margin-top: 90px; }` = 74px sticky header at 1280 + 16px air; also clears the 62px header at 375.
  - Tokens: declare the token block on `.nos-presenters, .pc-jump` (selector list) and leave the layout props (display, padding, font, colour) on `.nos-presenters` alone; add
    `.pc-jump { padding-block: 24px 0; font-family: var(--pc-sans); color: var(--pc-ink-700); }` and widen `.pc-wrap` to `.nos-presenters .pc-wrap, .pc-jump .pc-wrap`.
    Why not reuse `.nos-presenters` on the wrapper: critique-r2's rendered check reads the first `.nos-presenters` for `.pc-role/.pc-name`; a second one would break it.
  - `.pc-jump .pc-jump-link { display: inline-flex; align-items: center; min-height: 44px; font-size: var(--fs-body, 1.0625rem); font-weight: 700; color: var(--pc-violet); text-decoration: underline; text-decoration-thickness: 1.5px; text-underline-offset: 6px; }`, hover `color: var(--pc-royal)`, colour transition only inside `prefers-reduced-motion: no-preference`. Same family as `.pc-more`.
  - Focus ring is the theme ring (no outline rule), as for `.pc-more`.
- **Grid**: replace `@media (min-width: 1120px)` with `@media (min-width: 768px) { .pc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }` (marked "R44 supersedes").
  Fit check at 768: content width = 768 - 2 x 30.7 = 707px, gap 32px -> card 337px; with the default 32px padding the 160px photo + 24px gap leaves an 89px name column: **does not fit**.
  So between 768 and 1119 the card takes the small-screen geometry: `@media (min-width: 768px) and (max-width: 1119px) { .pc-card { padding: 24px; gap: 24px; } .pc-head { grid-template-columns: 104px minmax(0, 1fr); gap: 16px; } }`
  -> name column 167px. From 1120px the original 32px/160px geometry applies (card 499px, name column 249px).
  Media-query strings must match these exactly (check-styles compares them after whitespace normalisation, not colon spacing).
- Rendered pins: link exists once, text equals `Presenters (<card count>)`, href resolves to `.pc-sec-top`, link follows the hero h1 and precedes `.nos-presenters`, >= 44x44, scroll-margin >= header,
  click lands the heading at/below the sticky header; 1 column at 375, 2 at 768 and 1280; no overflow at 375/768/1280; at 768 no card overflows and `.pc-id` >= 150px; no link on wosa-conference.



---
# F4 — .pc-title section-h2 role (contract-f4.yaml)
R36 (F2 architect finding, relayed by the lead): `.pc-title` ("Presenters") takes the NOS section-h2 role from nos-theme.css:332-340 as corrected by the F2 branch:
`font-size: clamp(2rem, 1.2rem + 2.667vw, 3rem); line-height: 1.15; letter-spacing: -0.01em; font-variation-settings: "opsz" 48; margin: 0`.
origin/main's nos-theme.css:335 still reads `clamp(2rem, 1.5rem + 1.6vw, 2.4375rem)`, and presenters.css's own `.nos-presenters .pc-title` rule (higher specificity) pinned the same old clamp (max 39px).
Edit presenters.css only: change the one `font-size` clamp; keep `margin: 0` (spacing comes from `.pc-sec-head` gap 6px and `.pc-sec-top` margin-bottom 32px); line-height, letter-spacing and opsz are already these values.
Do NOT edit nos-theme.css (excluded). check-styles.mjs carries the pin ("R36 (F2 architect) supersedes").
Rendered (`check-rendered-f4.mjs`) asserts the literal computed values, no probe: 32px at 375, 39.68px at 768, 48px at 1280 (19.2px + 2.667vw capped at 48px; 53.3px at 1280 before the cap);
line-height 1.15 x size; letter-spacing -0.01 x size; opsz 48; weight 400; Fraunces; margin 0px on all sides.
(critique-r2's rendered check compares .pc-title with a probe h2 and will diverge until the F2 branch lands; r2 is shipped and not in this gate.)
Note: check-styles.mjs is one pin file for F1..F4 CSS; it passes only when all four features' CSS has landed. Run it as part of the gate after the dev finishes (it is in F1 A4, F3 and F4).


---
# Rebase note (2026-10-16, after r3 landed on origin/main 242f51fb)
- Footprint BASE is now 242f51fb and every contract uses `check-footprint.mjs --through=4` (a stacked tree cannot be gated per feature).
- F6 deleted the hub "Three-year cycle" section; the `Host province rotates…` line (page.tsx:614, 13 -> 17) went with it. The hub diff is the single `Looking for your local orchid society?` line (586). The NAMED row and the PAIRS entry were removed.
- `nos-critique-r1/check-presenters-focus.mjs` rejects any added presenters.css line, so it cannot pass R39/R43/R44; F1's gate uses `nos-critique-r3/check-focus.mjs` (same focus contract, plus focus rule byte-identical to base).
- `check-sponsor-enquiry.mjs` was stale against main's sponsors page (no RealEmptyListing there); the sponsors-page block was removed, the RealEmptyListing component pins incl. the 17px statement stay.
- Reduced motion: globals.css:313 sets `transition-duration: 0.01ms !important` under reduce (computes 1e-05s); any duration <= 1ms counts as no motion.
- F2's copy check exempts the F3 string `Presenters (`.
- Hub META row "Reduced format" removed: the archive card note no longer renders on main (F6 trimmed it); /national-show/archive is added to the prose/label sweep (10 routes).
- R44-A5 placement (lead-cleared exception, supersedes F3's "between hero and PresenterSection"): `ShowContentState` gains optional `afterHero?: ReactNode`, rendered as `{afterHero}` directly after `<NosHero …/>` (before `div[data-nos-content-state]`), no wrapper, no styling. symposium passes `afterHero={<PresenterJumpLink presenters={presenters} />}`; no standalone `<PresenterJumpLink>` remains. check-static-f3 asserts the ShowContentState diff is exactly the prop, its destructure and `{afterHero}`; check-rendered-f3 asserts the link precedes `[data-nos-content-state]` in document order. ShowContentState.tsx is in the F3 footprint for that slot only.
- `--pc-ink-500` and `--pc-fs-sm` were removed from presenters.css (orphaned by the order-note removal); check-styles never pinned them.
