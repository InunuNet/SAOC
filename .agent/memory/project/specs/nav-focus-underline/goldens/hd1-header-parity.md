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
3. **Lockup.** Left on the container edge; ink height 70±2 at >= 700 and equal ±2 on both hosts at every width. Ink = link box on both: NOS pulls its PNG's transparent margin back
   (`nos-chrome.css:32,167`); the SAOC full-name PNG has no transparent margin (alpha bbox 0,0,3757,493, checked), so its `data-hd="brand"` box is its ink. Supplied file,
   scaled only: no crop, filter or recolour (`check-header-spec.mjs saoc-header`).
4. **Nav.** `margin-left: auto`; items `min-height: 44px`, padding `0 9px`, gap 2, own sans (SAOC Manrope, NOS Karla) at 600 14.5px/1, no tracking, no case change.
   Disclosure triggers keep the NOS chevron as it is (`.nc-chev`, `gap: 6px`); nothing new is drawn.
5. **CTA.** Last item, flush to the container's right edge. `min-height: 44px; padding: 10px 24px; border-radius: 10px; font: 700 13px/1; letter-spacing: .12em; uppercase`.
   NOS "Tickets", SAOC "Join a society". Same box height and right edge (±1) at >= 700.
6. **SAOC search.** A 44x44 icon button between the nav and the CTA (24px gap), full-nav widths only; it never moves the CTA's right edge. Below 1260 it moves into the drawer.
7. **States (F1 amended).** On both hosts hover and `:focus-visible` turn the item text to the indicator colour (SAOC `--primary`, NOS `--nc-royal`) with a 2px bar in the
   label's slot (`bottom: -8px`, SAOC `-bottom-2`). Active (`aria-current`) is a persistent 2px bar in the same slot (SAOC `--primary`, NOS `--nc-green-1`). No hover fill, no
   ring on menu items. Only the open mega-menu trigger (`aria-expanded`) keeps its fill. NAV-1's h1 route focus and `aria-current` rules apply unchanged. The drawer rows keep NAV-1's treatment.
8. **Breakpoints, identical.** >= 1260 full nav. 700-1259: lockup, CTA, then the 44px labelled MENU button ("Menu"/"Close" is the existing NOS string, `NosHeader.tsx:335`; CSS uppercases it).
   < 700: the lockup takes the whole first row, the actions sit below it, the header is `position: relative`. SAOC's icon-only hamburger becomes that button; SAOC moves from 1240 to 1260.
9. **Content starts at the header bottom** on both (`main` top minus header bottom within ±1 at scroll 0).
10. **Preview banner.** It mounts only on NOS ticketing surfaces (`TicketingTestBar.tsx`), never on SAOC. Decision: unchanged, and `banner-footer` keeps SAOC free of it and NOS's 44/48px offsets intact.

## HD-1b (F3): one container

`--container-max` becomes `calc(1320px + 2*clamp(16px, 2.5vw, 32px))` and `--container-pad` becomes `clamp(16px, 2.5vw, 32px)` (`app/globals.css:88-89`), the same box as NOS
(`--nc-wide`, `--nc-gutter`, `nos-chrome.css:14-15`). Everything on `.saoc-container` (`globals.css:382-386`, 17 files) follows with no page edits. Found while checking "single token
or class change": five public SAOC files do not use that class and hard-code `max-w-[1280px] px-8`, so the token alone would leave their left edge at the old box: `Header.tsx:72`
(replaced by F2), `Breadcrumb.tsx:20`, `ui/PageHero.tsx:48`, `app/(marketing)/societies/[slug]/page.tsx`, `app/not-found.tsx`. They move onto `.saoc-container`: a class swap, not new layout.
`components/nos/SectionNav.tsx` and `components/show/ShowSectionNav.tsx` also hard-code it on NOS pages; the gate (content left edge equal ±1 on both hosts at 2056/1440/1280) decides whether they need the same swap.
`admin/PageHeader.tsx` is out of scope.

## Risks and decisions for the lead (read before dispatch)

1. **The SAOC full-name lockup cannot be 70px ink high next to the full nav at 1260.** 3757x493 at 70px high is 533px wide (NOS: 405). My estimate, not a measurement: 533 + 7 nav
   items at the NOS size (~690) + 44 search + ~181 "Join a society" CTA + gaps is about 1520px of bar against 1197 at a 1260 viewport; it fits only from roughly 1580. The old header
   already hit this (`Header.tsx:73-87`: the live lockup and W2 squeezed the nav into two-line wraps at 1280). The same applies in menu mode (533 + CTA 181 + MENU 104 + gaps = ~870 against 665 at 700)
   and on phones (the NOS lockup is 352x61 at 390; a 61px-high SAOC full-name lockup is 465 wide). The gate encodes the spec as written (ink 70±2, single-line nav, no horizontal overflow,
   pair equality), so it will fail loudly rather than pass by shrinking something. Options, your ruling: (a) SAOC uses a shorter lockup (the live `SaocLockup` horizontal, about 1.6x narrower per the
   `Header.tsx` comment, not the full name Lee-Ann asked for on 2026-10-15); (b) the SAOC nav drops to the NOS item count; (c) lockup parity relaxed to the widths where it fits, by editing
   `header-geometry.json` (rules are data). My recommendation: (a), measured first. The dev must stop and report if the measurement fails, not cut the ink height.
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
