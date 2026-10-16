# nos-critique-r3 — presenter bio disclosure, 390px body floor, symposium jump link

Branch `fix/nos-critique-r3`, base `ea9056ad`. Rulings R39, R43 and R44 A5 from the SAOC lead (2026-10-16).

## R39 — presenter bio clamp and inline disclosure

Ruling: "Cards are 782px tall, so the 4 bios read as a two-screen wall of text. Clamp each bio to 4 lines and
make "Read full bio" an inline disclosure with aria-expanded, not a modal. Keep the existing accessible names."
And: "Bio text is 16px; the body role is 17px."

- **17px source.** `app/(marketing)/national-show/nos-theme.css:307` declares `--fs-body: 1.0625rem` (17px, R14 body
  scale). The approved handoff `design/design_handoff_saoc/colors_and_type.css` has no 17px role, so the pin rests on
  nos-theme.css R14 plus R39's explicit 17px. The role is applied to `.pc-clip` only, so eyebrow, chip, name and role
  sizes are unchanged. nos-theme.css is not touched.
- **Clamp mechanism.** `max-height: calc(var(--pc-bio-lines) * var(--pc-bio-lh) * 1em)` (4 x 1.68 x 17px = 114.24px) with
  `overflow: hidden` and a 1.7em bottom fade. A bio is several `<p>`/`<ul>` blocks, so `-webkit-line-clamp` cannot clamp it.
- **Accepted approximation (lead ruling, Codex P2).** The 4-line height ignores the 14px gaps between bio blocks. A bio
  that opens with a short paragraph is cut partway into its fourth visible line, under the fade; a bio of exactly four
  lines across two blocks shows a toggle it does not strictly need. The content stays reachable through the toggle, so
  the lead accepted the spec'd `max-height` over a per-card JS line measurement.
- **No-JS degradation (progressive enhancement).** The clamp CSS is scoped to `.pc-grid[data-clamp]`, set only after
  mount. Without JavaScript, or before hydration, every bio shows in full and every button is `hidden`.
- **Disclosure contract.** `<button type="button" aria-expanded aria-controls>` toggles the `is-open` class on the bio
  region whose `id` is `aria-controls`. `aria-expanded` flips false, true, false. Focus is never moved. The accessible name
  is unchanged ("Read full bio" plus sr-only " of {name}"); no collapse label is invented. The button is `hidden` unless
  the bio overflows 4 lines.
- **Removed.** The `<dialog>`, its refs and handlers, the `eager` image prop, all `.pc-modal` / `.pc-sheet-*` CSS, the
  `html:has(...)` scroll lock, the two keyframes and the dialog-only tokens. The shortest-bio equal-height script
  (`--bio-h`) is gone too; the grid keeps `align-items: start`.
- **Supersession.** The R35-era equal-height pins and the dialog pins are superseded by R39 (annotated in
  `nos-presenter-cards/check-styles.mjs`).
- **Content gaps routed to Brad, not built.** One role line only; no talk titles or sessions. No fields or copy added.

## R43 — order note becomes the R11 chip; 390px body floor

- **Chip.** The internal "Sample sequence" note is replaced by the existing R11 `ConfirmationBadge`
  (`status="pending" pendingLabel="To be confirmed by the show committee"`), imported from `@/components/show`. `.pc-order-note` CSS is deleted.
- **Rule.** Running prose (a sentence of 4+ words) takes the body role: 17px (`--fs-body`, nos-theme.css:307) on NOS
  routes. Two 16px exceptions use the handoff `--body-md` (`colors_and_type.css:55`, 16px "default"): the SAOC home cards
  (outside `.nos-theme`, so `--fs-body` is undefined) and `JudgingGroupCard` (2-up at 390, 17px would give ~14 characters per line).
- **Meta stays (judged meta and left alone).** Uppercase or tracked labels (dt, eyebrows, chips, button labels,
  StatusMarker), pill badges, short fact values and captions. Specifically: hero eyebrow 11px; ShowBand/EventsStrip fact
  values 15/14px; PastEditionCard note 14px; emergency dt labels 12px; exhibitors banner (in `Badge`) 12px; tickets fine print 12px and
  per-ticket hints 13px; step-timing lines 12px. `.nos-show-page-notice` (15px, ShowContentState) is a lead exclusion and stays.
- **Before and after at 390px** (class-only edits):

| route | element | before | after | file |
|---|---|---|---|---|
| `/` | NavCards blurbs | 13 | 16 | components/home/NavCards.tsx:130 |
| `/` | partner blurbs | 15 | 16 | components/home/PartnersSection.tsx:74 |
| `/national-show` | link-card descriptions | 14 | 17 | components/nos/VisitorLinkCard.tsx:23 |
| `/national-show` | local orchid society line | 15 | 17 | national-show/page.tsx:586 |
| `/national-show` | host province line | 13 | 17 | national-show/page.tsx:614 |
| `/national-show` | class cards | 13 | 16 | components/nos/JudgingGroupCard.tsx:32 |
| `/national-show` | exhibitor path text | 14 | 17 | components/nos/ExhibitorStageCard.tsx |
| `/plan-your-visit` | venue paragraph, address | 15 | 17 | components/show/VenueCard.tsx:48,80 |
| `/plan-your-visit` | emergency notes, attraction note | 13 / 14 | 17 | plan-your-visit/page.tsx:157,118 |
| `/what-to-expect` | hours and closing notes | 13 | 17 | what-to-expect/page.tsx:160 |
| `/tickets` | group descriptions | 14 | 17 | tickets/page.tsx:188,199 |
| `/sa-exhibitors`, `/international-guests` | absence statements | 15 | 17 | components/show/nos/RealEmptyListing.tsx:36 |
| `/exhibitors` | key-dates cells | 15 | 17 | components/show/ExhibitorKeyDates.tsx:96,105 |
| `/exhibitors` | question answers | 15 | 17 | components/show/ExhibitorQuestions.tsx:49 |
| `/faq` | answers | 15 | 17 | components/show/ShowFaqList.tsx:99 |

- **Page files touched** (single-attribute className edits): `app/(marketing)/national-show/page.tsx` (hub),
  `app/(marketing)/national-show/tickets/page.tsx`, `plan-your-visit/page.tsx`, `what-to-expect/page.tsx`, and one import plus one line in `symposium/page.tsx`.
- **Not touched.** ShowContentState, ticket purchase flow components (13px descriptions), the home hero eyebrow, R34 (held by the lead).

## R44 A5 — symposium jump link and 2-up grid

- **Link.** `PresenterJumpLink` in `PresenterSection.tsx` renders `Presenters (N)`, N = `presenters.length`, directly
  under the hero through ShowContentState's new `afterHero` slot (one optional prop, one JSX line, no styling; cleared by
  the lead after Codex found the link landing after the prose); `null` when empty. It targets `id={presenterSectionId(presenters)}` on `.pc-sec-top`.
  The wosa-conference page gets no link.
- **Scroll margin.** `.pc-sec-top { scroll-margin-top: 90px }` = 74px sticky header at 1280 + 16px air; it also clears the 62px header at 375.
- **Grid.** 2-up from 768px (R44 supersedes the 1120px breakpoint). At 768 the content width is 707px, so a card is 337px; the 160px
  photo would leave an 89px name column. Between 768 and 1119 the card takes the small-screen geometry (24px padding and gap,
  104px photo, 16px head gap), giving a 167px name column. From 1120px the original 32px / 160px geometry applies.

## R36 — "Presenters" heading

`.pc-title` takes the NOS section-h2 role: `font-size: clamp(2rem, 1.2rem + 2.667vw, 3rem)` (32px at 375, 39.68px at 768, 48px
at 1280), line-height 1.15, letter-spacing -0.01em, opsz 48, margin 0. Only the one clamp in `presenters.css` changed.
