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
   `13px` block and the gutter inline, flex, gap 24, height 97±1 at >= `breakpoints.row` on both.
3. **Lockup (ruling (d) plus the fit ruling).** Both hosts keep their own lockup file, uncropped, unfiltered, not recoloured (SAOC: the full-name PNG, Lee-Ann 2026-10-15). Parity is by footprint:
   ink WIDTH equal ±2 on both hosts at every width, vertically centred. Width = `min(container content width, 405)`: 405 at >= `breakpoints.row` (NOS unchanged, 405x70; SAOC about 53 tall), and below it the lockup never grows
   past that desktop footprint (760: 405 wide, SAOC about 53 / NOS 70 tall; 390: both fill the 358 container). Heights differ once widths are equal (aspect 7.62 vs 5.79), so **header height is equal ±1 at every width**,
   held by a min-height: at >= row the bar has the min-height that makes SAOC 97 (NOS 13+70+13+1); below row the first (lockup) row gets `min-height` = the NOS lockup ink height at that width and the SAOC lockup is
   vertically centred in it, the actions row identical. Ink = link box on both (NOS pulls its PNG's transparent margin back, `nos-chrome.css:32,167`; the SAOC PNG's alpha bbox is the whole image, checked).
   Checks: `brand-width-capped`, `header-height-pair` (gate widths include 760 and 390).
4. **Nav.** `margin-left: auto` with a 24px minimum from the lockup (`gap-brand-nav-min-24`); nav to search 12 and search to CTA 12 on SAOC, nav to CTA 12 on NOS (no search); items items `min-height: 44px`, padding `0 9px`, gap 2, own sans (SAOC Manrope, NOS Karla) at 600 14.5px/1, no tracking, no case change.
   Disclosure triggers keep the NOS chevron as it is (`.nc-chev`, `gap: 6px`); nothing new is drawn.
5. **CTA.** Last item, flush to the container's right edge. `min-height: 44px; padding: 10px 24px; border-radius: 10px; font: 700 13px/1; letter-spacing: .12em; uppercase`.
   NOS "Tickets", SAOC "Join a society". Same box height and right edge (±1) at >= 700.
6. **SAOC search.** A 44x44 icon button between the nav and the CTA (12px gaps each side), full-nav widths only; it never moves the CTA's right edge. Below `full` it is the first drawer row.
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

## Breakpoint measurement and the fit ruling

Method (measured, not estimated): Chromium via playwright laid out the repo's own `Manrope` and `Karla` woff2 files at the spec sizes (values in `header-geometry.json` `breakpoints.provenance`). The method reproduces the live NOS Tickets CTA
(61.3 + 48 = 109.3, live 109). Not yet confirmed by a build: the gate measures the real headers at full-1, full, row-1 and row.
- **row = 780: measured.** 405 + 24 + 168.4 ("Join a society") + 24 + 104 (MENU) = 725.4 content; content = W - 2*clamp(16px,2.5vw,32px), so W >= 764; +16 for a classic scrollbar. (NOS Design's estimate was 820.)
- **full = 1384: RULED (NOS Design, modified option B, final).** At the earlier spec the SAOC full row needed 1325.1px, 5.1px more than the 1320px content box. The ruling: brand-nav keeps a 24 minimum, nav-search 12, search-CTA 12, NOS nav-CTA 12; item padding stays `0 9`
  (44px hit area). SAOC full row = 405 + 635.7 + 44 + 168.4 + 24 + 12 + 12 = **1301.1** content. W >= 1301.1 + 2*32 gutters = 1365.1; + 16 classic scrollbar = 1381.1; set to **1384**. NOS is narrower so SAOC sets the shared value. Rejected by NOS Design: (A) search only in the drawer
  (unreachable on desktop, no MENU button there), (C) thinner item padding, (D) smaller lockup. Gaps are checked by `gap-*` rules in the gate.
- **Phone band and heights: RULED.** Below `row` the lockup is `min(container, 405)` on both hosts, and header height is equal ±1 at 390 and 760 (see 3).
  Risk for dev: the first-row min-height must follow the NOS lockup ink height, a pure function of width (405 or width/5.79), so it is expressed in the same CSS on both hosts, not measured at runtime.

2. **Sequencing with the footer.** `fix/saoc-societies-footer` (7d7a0986, not merged) rewrites `Footer.tsx` (three columns, `FOOTER_LAYOUT.gridSaoc`, WOSA under REG). F1 and F2 both edit
   `Footer.tsx`. Base F1/F2 on that branch: rebase `fix/nav-focus-underline` onto it after it merges (or onto its tip), and put the email directly under the `FOOTER_REG` span, above its WOSA list. The email may be a literal in `Footer.tsx` or a constant in
   `footer-data.ts`: F2 releases that file from F1's freeze (`scope-f2.json` `release`), so one dev pass can edit it. PR #80 is the footer branch (Partners column removed, WOSA under REG/NPO).
3. NOS "accent" for hover/focus text is `--nc-royal`, which is already its text colour, so on NOS the hover change is the bar only. Say so if a different token is meant.

## Gaps: values with no source in the code or the handoff (listed, not picked)

`design/design_handoff_saoc/` predates the NOS v4 work: it still specifies a utility bar (`README.md:92-95`) and has no header height, nav item size or search size, so it is not a source for HD-1 numbers. The NOS v4 header (`nos-chrome.css`, `NosHeader.tsx`) is the geometry source.
- **Header 97px:** not a literal anywhere; it derives from the NOS rules (13+13 padding, 70 ink, 1px rule = 97) and was measured live by NOS Design. The gate asserts it.
- **SAOC search 44x44:** only the HD-1 ruling; NOS has no search and SAOC's is 34x34 today (`Header.tsx:165`). No icon size, radius or border is specified, so the dev keeps the existing 18px icon and radius and sets the box.
- ~~Search placement in the drawer~~ **RULED (final):** first row of the drawer below `breakpoints.full`, above the nav items, full width, 44px, existing 18px icon, visible label "Search SAOC" (the search dialog's own `aria-label`, `SearchOverlay.tsx:124`; no new string), opens the same dialog. Above `full` the header icon keeps `aria-label="Open search"`. Check: `check-header-spec.mjs drawer-search`.
- ~~SAOC MENU button border~~ **RULED (final):** `1.5px solid var(--nh-control-border)`, one solid token per host, nav ink at 28% over the ground. SAOC `#b6b6b0` (`--ink` over `--parchment`), NOS `#bebbc5` (`--nc-royal` over `--nc-ground`; today a bare `rgba(33,26,87,.28)`, `nos-chrome.css:65`). `--rule` (#d9d7c9) does NOT qualify: CIE76 dE 12.6 against the SAOC composite, over the allowed 2, so the token is added. Decorative, no 3:1 gate. Check: `check-header-spec.mjs menu-border`.
- **Hover/focus text accent on NOS:** equals the existing royal text; see risk 3.
- **SAOC nav item count and order, tracking of the CTA on SAOC:** taken from `nav-config.ts` and the NOS CTA values as written.
