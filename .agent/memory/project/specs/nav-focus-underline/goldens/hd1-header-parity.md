# HD-1 / HD-1b: one header on both hosts (F2, F3)

Brad (verbatim): "I want the switch between selecting National Orchid Show or being on the SAOC site to be almost seamless. The visuals must
change, but I don't want to see fucking headers and things and all of that jump around and be different. We want the same experience, we want
the same header breakdown, the same sizes". NOS Design spec HD-1 and HD-1b are final. The reference is the NOS v4 header (`.nh` in
`components/nos-chrome/nos-chrome.css`; approved golden `.agent/memory/project/specs/launch-weekend/goldens/nos-v4/handoff/chrome.css`). SAOC moves to
it. Only the visuals (colours, each site's own sans, the lockup, the CTA label) differ. Current state of both sides: see the table in `README.md`.

## Mechanism (architect decision)

- **Hooks, not class names.** Both headers carry the same `data-hd` attributes: `bar` (the flex row), `brand` (lockup link), `nav`, `item` (each top-bar
  link or trigger), `label` (the span that owns the bar slot), `cta`, `menu` (the labelled MENU button), and on SAOC `search`. One measuring script
  (`checks/measure-header.js`) reads both hosts through them. The implementation (shared stylesheet, Tailwind arbitrary values, tokens) is the dev's call;
  the contract measures the result. Recommendation: put the numbers in tokens that mirror NOS (`--nc-gutter`, `--nc-wide`) rather than in literals.
- **Measured parity is the gate.** `goldens/header-geometry.json` holds every target and tolerance; `checks/compare-geometry.mjs` compares the two hosts at
  2056, 1440, 1280, 1024 and 390 (and the cross-site click pair). Static checks (`checks/check-header-spec.mjs`) cover what a measurement cannot name
  (the hooks exist, the utility bar is gone, hover has no fill, the NOS reference values did not move).
- F2 does not edit F1's assertions. Two NAV-1 details are amended in the F1 README (bar slot -8px; active bar 2px), neither is asserted by F1.

## Spec, both hosts

1. **No utility bar on either site.** Delete `UtilityBar.tsx` and its mount (`SaocFrame.tsx:35`). "Join a society" (`/societies`, the string the utility bar
   pill used) becomes the SAOC header CTA. The show pill ("19th National Show · Sept 2027") is removed with its `showLabelWithEdition` /
   `formatShowShortMonthYear` use. `info@saoc.co.za` moves to the SAOC footer brand column, under the REG#/NPO line, as a `mailto:` link (it gets the NAV-1 link focus treatment).
2. **Bar.** Sticky, 1px bottom rule (permanent, like NOS `:26`, not scroll-gated), `max-width: calc(1320px + 2*clamp(16px,2.5vw,32px))`, padding
   `13px` block and the gutter inline, flex, gap 24, height 97±1 at >= 1260 on both.
3. **Lockup (ruling (d), replaces the earlier "ink height 70").** Both hosts keep their own lockup file, uncropped, unfiltered, not recoloured (SAOC: the full-name PNG, Lee-Ann 2026-10-15). Parity is by footprint:
   ink WIDTH equal ±2 on both hosts at every width, vertically centred in the same bar. At >= `breakpoints.row` that width is 405 (NOS unchanged, 405x70; SAOC comes out about 53 tall). Below `breakpoints.row`
   each lockup fills the full first row, so its width equals the bar's content width ±2. Heights differ once widths are equal (aspect 7.62 vs 5.79), so the bar's height at >= row is held by a
   `min-height` that makes SAOC 97 as well (NOS: 13+70+13+1), and the header height is not compared in the phone band. Ink = link box on both (NOS pulls its PNG's transparent margin back, `nos-chrome.css:32,167`;
   the SAOC PNG's alpha bbox is the whole image, checked). Cost accepted by NOS Design: NOS goes to menu mode between 1260 and `breakpoints.full` and to the two-row layout below `breakpoints.row`.
4. **Nav.** `margin-left: auto`; items `min-height: 44px`, padding `0 9px`, gap 2, own sans (SAOC Manrope, NOS Karla) at 600 14.5px/1, no tracking, no case change.
   Disclosure triggers keep the NOS chevron as it is (`.nc-chev`, `gap: 6px`); nothing new is drawn.
5. **CTA.** Last item, flush to the container's right edge. `min-height: 44px; padding: 10px 24px; border-radius: 10px; font: 700 13px/1; letter-spacing: .12em; uppercase`.
   NOS "Tickets", SAOC "Join a society". Same box height and right edge (±1) at >= 700.
6. **SAOC search.** A 44x44 icon button between the nav and the CTA (24px gap), full-nav widths only; it never moves the CTA's right edge. Below 1260 it moves into the drawer.
7. **States (F1 amended).** On both hosts hover and `:focus-visible` turn the item text to the indicator colour (SAOC `--primary`, NOS `--nc-royal`) with a 2px bar in the
   label's slot (`bottom: -8px`, SAOC `-bottom-2`). Active (`aria-current`) is a persistent 2px bar in the same slot (SAOC `--primary`, NOS `--nc-green-1`). No hover fill, no
   ring on menu items. Only the open mega-menu trigger (`aria-expanded`) keeps its fill. NAV-1's h1 route focus and `aria-current` rules apply unchanged. The drawer rows keep NAV-1's treatment.
8. **Breakpoints, shared, set by the longer SAOC bar, always changed together** (`header-geometry.json` `breakpoints`): >= `full` inline nav; `row` .. `full`-1 lockup, CTA, then the 44px labelled MENU button
   ("Menu"/"Close" is the existing NOS string, `NosHeader.tsx:335`; CSS uppercases it), SAOC search in the drawer; < `row` the lockup takes the whole first row, actions below, header `position: relative`.
   Both hosts move off 1260/700 (SAOC off 1240). The NOS lockup `<picture>` media query and `PANEL_BREAKPOINT_QUERY` move with them. The gate adds widths full-1, full, row-1, row and asserts one row (two below `row`) and no overflow on both hosts.
9. **Content starts at the header bottom** on both (`main` top minus header bottom within ±1 at scroll 0).
10. **Preview banner.** It mounts only on NOS ticketing surfaces (`TicketingTestBar.tsx`), never on SAOC. Decision: unchanged, and `banner-footer` keeps SAOC free of it and NOS's 44/48px offsets intact.

## HD-1b (F3): one container

`--container-max` becomes `calc(1320px + 2*clamp(16px, 2.5vw, 32px))` and `--container-pad` becomes `clamp(16px, 2.5vw, 32px)` (`app/globals.css:88-89`), the same box as NOS
(`--nc-wide`, `--nc-gutter`, `nos-chrome.css:14-15`). Everything on `.saoc-container` (`globals.css:382-386`, 17 files) follows with no page edits. Found while checking "single token
or class change": five public SAOC files do not use that class and hard-code `max-w-[1280px] px-8`, so the token alone would leave their left edge at the old box: `Header.tsx:72`
(replaced by F2), `Breadcrumb.tsx:20`, `ui/PageHero.tsx:48`, `app/(marketing)/societies/[slug]/page.tsx`, `app/not-found.tsx`. They move onto `.saoc-container`: a class swap, not new layout.
`components/nos/SectionNav.tsx` and `components/show/ShowSectionNav.tsx` also hard-code it on NOS pages; the gate (content left edge equal ±1 on both hosts at 2056/1440/1280) decides whether they need the same swap.
`admin/PageHeader.tsx` is out of scope.

## Breakpoint measurement and the open blocker

Method (measured, not estimated): Chromium via playwright laid out the repo's own `Manrope` and `Karla` woff2 files at the spec sizes (values in `header-geometry.json` `breakpoints.provenance`). The method reproduces the live NOS Tickets CTA
(61.3 + 48 = 109.3, live 109). Not yet confirmed by a build: the gate measures the real headers at full-1, full, row-1 and row.
- **row = 780: measured.** 405 + 24 + 168.4 ("Join a society") + 24 + 104 (MENU) = 725.4 content; content = W - 2*clamp(16px,2.5vw,32px), so W >= 764; +16 for a classic scrollbar. (NOS Design's estimate was 820.)
- **full = 1440: PROVISIONAL, and the spec as written cannot fit.** SAOC nav at 600 14.5px/1 Manrope: items 497.7 + 7x18 padding + 6x2 gaps = 635.7. Bar = 405 + 24 + 635.7 + 24 + 44 (search) + 24 + 168.4 = **1325.1px, but the content box never exceeds
  1320px** (`--nc-wide`), so the full row fails at every width, 5.1px short. The gate will fail at B15 (overflow or wrapped nav at 1440 and 2056) rather than pass by shrinking something. Options for NOS Design, each computed:
  (A) search lives only in the drawer at every width: 1257.1 needed, fits from about 1321 (full ~1340), but item 6 is dropped; (B) the three bar gaps 24 -> 12: 1289, full ~1370, but `.nh-bar` gap changes on both hosts;
  (C) item padding `0 9` -> `0 7`: 1297, full ~1380, but the nav item spec changes; (D) SAOC lockup 405 -> 375, which breaks width parity. Recommendation: (A), since search is already moving into the drawer below `full`. Nothing is picked here.
- **Phone band cost:** with the lockup filling the first row up to `row`, a 760px content box gives a 760px-wide lockup (SAOC about 100 tall, NOS about 131). That is what ruling (d) says; flagged in case it is not intended.
- **Header height at 390** cannot be equal: equal widths, different aspects (SAOC 358/7.62 = 47 tall, NOS 358/5.79 = 62). The ruling's "header height equal ±1" is asserted at widths >= `row` only.

2. **Sequencing with the footer.** `fix/saoc-societies-footer` (7d7a0986, not merged) rewrites `Footer.tsx` (three columns, `FOOTER_LAYOUT.gridSaoc`, WOSA under REG). F1 and F2 both edit
   `Footer.tsx`. Base F1/F2 on that branch: rebase `fix/nav-focus-underline` onto it after it merges (or onto its tip), and put the email directly under the `FOOTER_REG` span, above its WOSA list. The email may be a literal in `Footer.tsx` or a constant in
   `footer-data.ts`: F2 releases that file from F1's freeze (`scope-f2.json` `release`), so one dev pass can edit it. PR #80 is the footer branch (Partners column removed, WOSA under REG/NPO).
3. NOS "accent" for hover/focus text is `--nc-royal`, which is already its text colour, so on NOS the hover change is the bar only. Say so if a different token is meant.

## Gaps: values with no source in the code or the handoff (listed, not picked)

`design/design_handoff_saoc/` predates the NOS v4 work: it still specifies a utility bar (`README.md:92-95`) and has no header height, nav item size or search size, so it is not a source for HD-1 numbers. The NOS v4 header (`nos-chrome.css`, `NosHeader.tsx`) is the geometry source.
- **Header 97px:** not a literal anywhere; it derives from the NOS rules (13+13 padding, 70 ink, 1px rule = 97) and was measured live by NOS Design. The gate asserts it.
- **SAOC search 44x44:** only the HD-1 ruling; NOS has no search and SAOC's is 34x34 today (`Header.tsx:165`). No icon size, radius or border is specified, so the dev keeps the existing 18px icon and radius and sets the box.
- **Search placement in the drawer:** the ruling says it moves there; no markup or label is specified. Existing string "Open search" (`Header.tsx:164`) is reused; nothing new is worded.
- **SAOC MENU button look:** the ruling gives the label and 44px; the NOS `.nh-burger` rules (`:65`, `min-width: 104px`, border `1.5px rgba(...)`) are the only source and use NOS colours with a bare rgba. SAOC's border colour is not specified: use an existing SAOC token (`--rule`), flagged for NOS Design if it should differ.
- **Hover/focus text accent on NOS:** equals the existing royal text; see risk 3.
- **SAOC nav item count and order, tracking of the CTA on SAOC:** taken from `nav-config.ts` and the NOS CTA values as written.
