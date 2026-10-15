# F1 golden: NOS own-brand chrome v4 (mission nos-own-brand-chrome)

Design source and authority: Brad approved 2026-10-15 ("Use mono tone in the footer vertical logo, its approved with that one change") and told SAOC to "Work with NOS Design and get the changes done". The handoff is vendored beside this file:

- `HANDOFF.md` (cited below as **H:n**, line n)
- `chrome.css` (cited as **C:n**; **wins wherever it disagrees with H**, H:7)
- `chrome-reference.js.txt` (cited as **J:n**; behaviour reference, not shipped code)
- `img/*.png` (the three lockup files, shipped as-is)

`docs/rules/no-invention.md` applies: every visual comes from this folder or `branding/National Show 2027/`; every word comes from existing SAOC components and data. Contract assertion A20 enforces that the shipped stylesheet carries every declaration of `chrome.css` (see "Stylesheet").

## 0. Decisions (architect)

| Question | Decision | Why |
|---|---|---|
| Mount point | `app/(marketing)/layout.tsx` renders a small client component, `components/nos-chrome/ChromeFrame.tsx`, that picks the chrome with `useSelectedLayoutSegment()` (`'national-show'` => NOS). Props: `saoc={{ top, bottom }}` (the existing `<UtilityBar/><Header/>` and `<Footer/>`, rendered by the server layout exactly as today) and `nos={{ top, bottom }}` (`<NosHeader/>`, `<NosFooter/>`). It renders `{top}<main>{children}</main>{bottom}` with the chosen pair. | A nested `national-show/layout.tsx` cannot remove its parent's SAOC chrome, and the header/footer must be body-level siblings of `<main>` (the menu panel inerts "every body child except the header and the panel", H:173, J:40-44; and per HTML-AAM a `<header>`/`<footer>` inside `<main>` loses the banner/contentinfo landmark). Moving the 17 NOS routes to a new route group would rename ~100 files, break path-grepping contracts, and collide with in-flight branches. A server-side `headers()` switch would make every marketing page dynamic. Client segment switch costs one wrapper and keeps SAOC SSR output byte-identical (A3). The SAOC subtree for NOS pages and vice versa travels in the RSC payload only; assertions B/D measure the DOM and SSR HTML, never the payload. |
| ShowBand | Not a NOS-route component at all: `components/home/ShowBand.tsx` renders only on the SAOC home page (`app/(marketing)/page.tsx:73`). The "band above the hero" that NOS pages do carry is `components/nos/NosMasthead.tsx` (a live-text/emblem `Logo`) plus the colophon `<Logo>` in `national-show/layout.tsx`. **Both are removed**: each is a second NOS logo, and the new header and footer replace them. Base measurement (see Base results): `/national-show/about` shows the SAOC lockup, the masthead and the Disa emblem in the first screen; after F1 it must show the header lockup only. The P3 768px overflow is measured by A10; `NosMasthead` is the only band on those pages, so it is closed by its removal. Delete `components/nos/NosMasthead.tsx` (orphaned). `components/nos/Logo.tsx` is left alone (older contracts grep it; orphaning is acceptable, deleting is a separate cleanup). | H:16, H:264 (one logo per viewport). |
| Rail targets | `components/chrome/nav-config.ts` `featureRail.destinations` already carries the secondary entries `Day Visitor` => `/tickets/day-visitor` and `Weekend Pass` => `/tickets/weekend-pass` (verified: neither `#ticket-day` nor `#ticket-weekend` exists anywhere on `/national-show/tickets`; its cards are `/tickets/<slug>` routes). Use exactly those two, read from nav-config. The `primary` Tickets destination is NOT rendered in the rail (H:139-140, H:256). The Tickets leaf in "The Show" group stays (nav-config). | H:139, data rule. |
| Mega-menu and panel content | `NAV` from nav-config verbatim: lead label, "The Show" group, Visit, Programme, Exhibit & Trade, descriptors, hrefs. The F7 label "Exhibitors and Vendors" (not the handoff's "Trade Vendors"). Contact in the panel is the literal `/contact` link `MobileMenu.tsx` already uses. | Data rules. |
| Show dates, venue, edition | Lead meta and rail meta computed exactly as `MegaMenu.tsx` does: `show` = the `nationalShow` Sanity singleton the marketing layout already fetches (`sanityFetch(nationalShowQuery)`), `venue = show.venue.name`, `dates = formatShowDateRange(show.showDate, show.showEndDate)` from `lib/show-identity.ts`; lead meta = `[venue, dates].filter(Boolean).join(' · ')`, rail meta = `dates`; omit a line cleanly when null. Edition text = `NAV` mega `lead.leadLabel` ("19th SAOC National Orchid Show"). The show dates are an OPEN QUESTION with the committee (H:267): the handoff says 23–26 September 2027, the old hub said 16–19, and currently Sanity and Lee-Ann's ticketing doc (ticketing content.md line 66, "Thursday 23rd September", under content/drive-recovered/13-booking-tickets/) agree with 23–26. The contract therefore asserts **no date value at all**, only single-sourcing. Nothing in `components/nos-chrome/` may hard-code a date, venue or edition (A15). The alt/aria strings in "Lockups" below contain "2027" and are the only exempt text. | H:270, data rule. |
| Footer data | New `components/chrome/footer-data.ts` owns: `FOOTER_NAV`, the brand paragraph, the REG/NPO line, the bulletin copy and placeholder, the WOSA heading/link/URL, the legal links (Privacy, Terms, Refunds, Constitution, Media kit) and the copyright text builder. `Footer.tsx` imports it and renders byte-identical markup (A3 proves it). `NosFooter` imports the same module. Partners come from `lib/data` `partners`. No copy change anywhere. The bulletin form keeps exactly today's behaviour: `onSubmit={(e) => e.preventDefault()}`, `type="email"`, `required`, `aria-label="Email address"`. | H:183-188, H:221. |
| Fonts | `components/nos-chrome/fonts.ts` declares Fraunces and Karla with a config **character-for-character identical** to the new `national-show/layout.tsx` config: `Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-nos-fraunces', display: 'swap' })` (no `weight`), `Karla({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-nos-karla', display: 'swap' })`. `layout.tsx` gets the same two edits NOS Site's presenter branch makes (A14 compares the blocks). The chrome wrapper element carries both variable classes because the chrome sits outside `.nos-theme`. The chrome never references Cormorant/Jost/Crimson/Manrope/JetBrains or Tailwind `font-*` utilities (A16). | H:42, data rule. |
| Lockup delivery | Plain `<img src="/images/nos/<file>">`, **not** `next/image` and not `<picture>` (H:203). The three files are copied unaltered from `goldens/f1/img/` to `public/images/nos/` (A4 checks the served bytes by sha256). Header lockup `loading="eager"` + `fetchPriority="high"`; both footer lockups eager (H:204). Add an `eslint-disable-next-line @next/next/no-img-element` with a one-line reason. | "Ship them as-is"; next/image re-encodes. |
| Hub | **Amended (NOS Design ruling, Brad rejects the double logo):** F1 removes the hub hero's own lockup (the `getImageProps` `<picture>` in `national-show/page.tsx` / `NosHero.tsx`) and sets the hero `<h1>` to the text imported from nav-config `lead.leadLabel` ("19th SAOC National Orchid Show"; import it, never retype it): HANDOFF "Hub hero" H:224 (h1 text), H:228 ("No lockup in the hero. The header carries the one NOS logo"). Lede, facts, CTAs and photo stay untouched. The rest of the hub hero redesign (H:225-234: Fraunces 300 type, sizing, scrim, photo inset, <=700 stacking) remains **F2**. A6 is strict on the hub; A21 checks the h1 and the absence of hero lockups. Files now in scope: `app/(marketing)/national-show/page.tsx`, `components/nos/NosHero.tsx`. | H:224, H:228 |
| Page body fonts | The page bodies still use Cormorant/Jost via `nos-theme.css` (R14 retarget is later). A11 therefore asserts the chrome's fonts, and the whole-page font set only under `NOS_FONTS_STRICT=1`. | Scope. |

## 1. Files (A13 enforces: nothing else may change)

Create: `components/nos-chrome/` (`ChromeFrame.tsx`, `NosHeader.tsx`, `NosFooter.tsx`, `fonts.ts`, `nos-chrome.css`, client islands as needed), `components/chrome/footer-data.ts`, `public/images/nos/{nos-full-colour-horizontal-1200,nos-reversed-horizontal-1200,nos-reversed-white-vertical-900}.png`, `docs/nos-own-brand-chrome.md`.
Modify: `app/(marketing)/layout.tsx`, `app/(marketing)/national-show/layout.tsx` (two font edits; remove `NosMasthead`, the colophon `<footer data-nos-colophon>` and the `Logo` import; keep `.nos-theme` and its font variables), `components/chrome/Footer.tsx` (import `footer-data`).
Delete: `components/nos/NosMasthead.tsx`.
Must stay untouched: `components/chrome/{Header,MobileMenu,MegaMenu,UtilityBar,nav-config}.ts*`.

## 2. DOM contract (the checks select on these; the CSS needs them)

```
header#nh.nh                      (+ .is-scrolled once scrolled; position: sticky >=700, relative <=699)
  span#nh-sentinel.nh-sentinel    (IntersectionObserver target, C:25, J:13-14)
  div.nh-bar
    a.nh-brand[href="/national-show"][aria-label="National Orchid Show, Western Cape 2027, National Show home"]   (+ aria-current="page" on the hub)
      img  src=/images/nos/nos-full-colour-horizontal-1200.png  alt="National Orchid Show, Western Cape 2027"  width=1200 height=294
    nav.nh-nav[aria-label="Primary"] > ul
      li > a.nh-link        About, Societies, Judging & Awards, Events, Members   (NAV order)
      li#nh-show > button#nh-show-trigger.nh-trigger[aria-expanded][aria-controls="nh-mega"][data-current] > span.nh-label "National Show" + svg.nc-chev
          div#nh-mega.nh-mega[hidden]  (.nh-mega-grid > .nh-mega-lead, .nh-mega-col x3, .nh-mega-rail)
      li > a.nh-link        Sponsors
    a.nh-cta[href="/national-show/tickets"] "Tickets"   (aria-current="page" on that page)
    button#nh-burger.nh-burger[aria-expanded][aria-controls="nd"] > svg.is-bars + svg.is-x + span.nh-burger-label "Menu"/"Close"
div#nd.nd[hidden]  (sibling of the header, not inside it; .nd-inner > ul.nd-list > li ...; National Show item is button.nd-item[data-sub][aria-expanded][aria-controls=<sub id>] + div.nd-sub[hidden])
footer#nf.nf > .nf-wrap > .nf-grid
  .nf-brand: a.nf-lockup[href="/national-show"] > img.nf-h + img.nf-v ; .nf-org > .nf-head "South African Orchid Council", p.nf-text, span.nf-reg
  .nf-col x2 (Explore, Partners) ; .nf-col.nf-col-touch (Stay in touch: p.nf-text, form#nf-form.nf-form, .nf-wild)
  .nf-base > span ; .nf-legal > a x5
```

Mega-menu leaves are `a` > `.nh-leaf` + `.nh-desc` (C:56-57); the current page's leaf gets `aria-current="page"` (C:58). Rail: `.nh-mega-rail` > meta, `h4` "Tickets", ul of the two text links (C:59-62). Class names are the stylesheet's, so use them verbatim.

## 3. Tokens (C:7-23; H:19-62)

Colours (H:24-40): royal `#211A57`, royal-900 `#1A1445`, black `#0B0A14`, ground `#FBFAF0`, gold `#F3F2D6`, gold-300 `#E8E6C2`, ink `#3A3654`, ink-500 `#6A6780`, line `#DAD7C8`, lilac `#D2CBE8`, green-1 `#A7A841`, green-2 `#7F7D33`, olive-700 `#6A6829`, violet `#7E3F97`, white `#FFFFFF`. Prefix `--nc-*` (C:8-11).
Layout (C:16-17, H:47-48): `--nc-gutter: clamp(16px, 2.5vw, 32px)`, `--nc-wide: 1320px`, bars `max-width: calc(var(--nc-wide) + 2 * var(--nc-gutter))` (C:31, C:118). Radii 10px / 16px rail (H:50, C:59). Shadows (C:14-15, C:45). Easing (C:18). Focus rings (C:30, C:116). Single theme, no dark mode (H:62; do not add `prefers-color-scheme` rules).
Type (H:42-44): **Fraunces** = display + menu-panel items; **Karla** = nav, body, labels. `--nc-serif`/`--nc-sans` in the shipped sheet must lead with `var(--font-nos-fraunces)` / `var(--font-nos-karla)` (the literal `"Fraunces"` names in C:12-13 do not resolve to next/font's hashed families; this is the one sanctioned departure, checked by A20).
Not shipped: `.np` pill and the tweak panel (H:17; C:160-165).

## 4. Header (H:64-115; C:27-44, 74-89)

- Rows (H:68-73): >=1260 one row (lockup, nav, CTA); 700-1259 lockup, CTA, Menu; <=699 two rows (lockup full width; Tickets left, Menu right).
- >=700: `position: sticky; top: env(safe-area-inset-top, 0px); z-index: 60` (C:28), padding `13px var(--nc-gutter)` gap 24px, bar 97px tall, 1px `--nc-line` bottom border, `.is-scrolled` adds `--nc-shadow-float` via the sentinel (C:29, H:76-79). <=699: `position: relative`, padding-block `16px 12px`, gap 12px, 146px tall (C:81-88, H:80-83).
- Lockup (H:85-99): `nos-full-colour-horizontal-1200.png`, 1200x294, `--nc-logo-w` 448px (>=700), 390px (<=699, C:82), `min(390px, calc((100vw - 32px) / 0.904))` (<=420, C:89); margins `calc(W * -0.045) calc(W * -0.0508) calc(W * -0.0442) calc(W * -0.045)` (C:34); `max-width: none; height: auto`; never crop. Always visible at every width including while the mega-menu or panel is open (H:99).
- Nav (>=1260, H:101-115, C:37-43): Karla 600 14.5px, min-height 44, padding `0 9px`, radius 10; hover and open get `--nc-gold`; trigger `data-current` on **every** NOS page draws the 2px green-1 bar 8px under the label (C:43). Order from NAV: About, Societies, Judging & Awards, Events, Members, **National Show**, Sponsors.
- Tickets CTA (H:144-151, C:65-69): the only primary action, every width, `href="/national-show/tickets"`, `aria-current="page"` on that page => outline style. Takes the slot of SAOC's Contact button. No Search, no UtilityBar, no SAOC logo anywhere in the chrome (H:16, H:254).
- Menu button (H:154-157, C:70-73): min 44x44, padding `0 12px`, 1.5px `rgba(33,26,87,.28)` border, bars icon + "Menu"; open shows x + "Close"; `aria-expanded`, `aria-controls="nd"`. Visible <1260 only (C:74-78).

## 5. Mega-menu (H:117-142; C:45-62; J:16-28)

Click-only disclosure; never opens on hover (no `onMouseEnter`, no `:hover` that reveals it; A17 greps handlers, A7 measures). Sheet `position: absolute; top: 100%; left: 0; right: 0` under the header. Closes on: Escape (focus returns to the trigger, J:67/20-23), focus leaving `#nh-show` (J:26), mousedown outside (J:27), click on any link inside (J:28). Chevron rotates 180deg while open (C:41). Grid `1.05fr 1fr 1fr 1fr 0.9fr`, padding `28px var(--nc-gutter)`, columns 2-4 `padding-inline: 24px` with a 1px `--nc-line` left border (C:46-47). Lead: the `leadLabel` link to `leadHref` (Fraunces 1.35rem, green-1 underline, C:49), the meta line (C:50), then the "The Show" group; **no logo in the lead**. Group heads Karla 700 12px 0.14em uppercase `--nc-olive-700` (C:51). Leaves Karla 700 14.5px royal + 12.5px ink-500 description, 1px dividers, `padding: 9px 8px` (C:52-57). Rail: gold ground, radius `0 16px 16px 0`, meta, h4 "Tickets", the two text links with 44px min-height; **no Tickets link and no buttons** (C:59-62; H:139-140).

## 6. Menu panel below 1260px (H:153-180; C:91-112; J:30-63)

`#nd` is a **sibling of the header** (`position: fixed`, `top` set to the header's bottom edge when it opens so the header and lockup stay visible, C:92, J:46). List in SAOC drawer order: About, Societies, Judging & Awards, Events, Members, **National Show** (accordion), Sponsors, Contact (H:162-165). Items Fraunces 400 1.375rem, min-height 56, 1px dividers (C:96). Accordion (`aria-expanded`): lead link + meta; the four groups with descriptions; a **Tickets** group of Day Visitor and Weekend Pass text links; **no second Tickets button** (H:167-171, C:100-108).
While open (J:36-53): every sibling of the header/panel along their path to `<body>` is `inert` (skip script/style/link/template), `body` overflow hidden, focus moves to the first item, and where the header is not sticky (phones) the page scrolls to the top and closing restores the previous `scrollY`; following a link closes without restoring (J:56). Escape closes and calls `burger.focus({ preventScroll: true })` (J:66). Closes itself when the viewport reaches 1260px (J:62). Motion only under `prefers-reduced-motion: no-preference` (C:109-112).

## 7. Footer (H:182-221; C:114-158)

Content = `footer-data.ts` verbatim (columns Explore / Partners / Stay in touch, brand paragraph, REG/NPO, legal row; **no** "An event of the South African Orchid Council" line, H:189). Added: the "South African Orchid Council" `.nf-head` label above the brand text, inside one `.nf-org` group, gap 8px (H:195, C:127-128). Skin (H:190-194, C:115-145): royal ground, lilac text, padding-block `clamp(56px, 7vw, 88px)` / `calc(76px + env(safe-area-inset-bottom, 0px))`, heads Karla 700 12px 0.14em uppercase green-1, links 15px with 44px rows, hover to ground colour + green-1 underline.
Lockups (H:196-206, C:121-124, 153-155): two `<img>` and CSS, both eager, both inside `a.nf-lockup[href="/national-show"]`. >700: `nos-reversed-horizontal-1200.png` at 448px with the header's negative margins. <=700: `nos-reversed-white-vertical-900.png` (the **mono** file Brad approved) at `min(342px, 100%)`, margins none, centred with the brand block. Inactive one `display: none`.
Grid (H:207-215, C:119, 146-158): >=1180 `var(--nc-logo-w) repeat(3, minmax(0, 1fr))`; 701-1179 three columns with the brand on its own row; <=700 two columns, brand and Stay in touch full row, base row stacked; gap `48px 40px` (<=700 `40px 20px`).
Bulletin form (H:216-221, C:135-140, 146): stacked at >=701 (input over button, both full width, 44px), side by side at <=700 (input `flex: 1`, 8px gap); input border `1px solid rgba(210,203,232,.36)`, radius 10, placeholder "your@email.co.za"; button gold on royal, Karla 700 13px uppercase.

## 8. Lockup files (H:236-250)

| Use | Ship as | sha256 |
|---|---|---|
| Header | `nos-full-colour-horizontal-1200.png` 1200x294 | `30a4eb8732e98b0f809d94887c16628d82eb6590d443b6fbbbf34d5a901feec6` |
| Footer >700 | `nos-reversed-horizontal-1200.png` 1200x294 | `8e10ac8e5083b792526cda7ae75933f800578a43d1ba24fed279a5b3064e6c0b` |
| Footer <=700 | `nos-reversed-white-vertical-900.png` 900x791 (mono) | `fc2192d04496468277673c384e253c6d53cbae111a7d8e8a9da283bc894eb281` |

Alt text for all three (H:249): "National Orchid Show, Western Cape 2027". Never typeset, recolour, crop, trim or redraw.

## 9. Stylesheet

Ship `components/nos-chrome/nos-chrome.css` containing every rule of `chrome.css` except `.np*` (C:160-165), with `--nc-serif`/`--nc-sans` leading with the next/font variables. Additions are allowed (for example `@media (prefers-reduced-motion)` guards, `[hidden]` display rules the UA stylesheet would otherwise lose against `display:grid/flex` rules: `.nh-mega[hidden], .nd[hidden], .nd-sub[hidden] { display: none }`), but no approved declaration may be changed or dropped (A20 diffs declaration by declaration).

## 10. Acceptance map

A1 build, A2 tsc (L); A3 SAOC byte-identical (A); A4 logos (B); A5 sizes (C); A6 one logo (D); A7 mega (E); A8 panel (F); A9 targets and type floor (G); A10 no horizontal scroll (H); A11 fonts and console (I); A12 aria-current and elevation (J); A13 scope (K); A21 hub h1 + no hero lockup; A14-A20 static guards (fonts config, no hard-coded show facts, no foreign fonts, exclusions, shared footer data, mount, stylesheet fidelity).
Run server-backed checks with `node --import tsx/esm contracts/checks/nos-own-brand-chrome/<file>` from the worktree root after `SITE_PUBLIC_LAUNCH=true pnpm build`. They spawn `next start` on `NOS_PORT` (default 3617) and refuse to reuse a server unless `NOS_REUSE_SERVER=1`.

## 11. Base results (c0e48c39, 2026-10-15, built with SITE_PUBLIC_LAUNCH=true)

| Assertion | Base | Reading |
|---|---|---|
| A1 build, A2 tsc | pass | |
| A3 (A) SAOC byte-identical | pass | goldens captured from this build; capture is stable across two runs |
| A4 (B) | FAIL | SAOC lockup preload + `saoc-lockup-*` / `saoc-emblem-footer-lapis-*` on all three routes; no NOS chrome lockups |
| A5 (C) | FAIL | `#nh` / `#nf` absent |
| A6 (D) | FAIL | `/national-show/about` first screen: SAOC lockup + NosMasthead band (header lockup absent). Hub: SAOC lockup + hero lockup `<picture>` (report-only until F2) |
| A7 (E), A8 (F) | FAIL | triggers absent |
| A9 (G), A12 (J) | FAIL | chrome absent |
| A10 (H) | pass | no horizontal scroll at 390 or 768 on all 17 NOS routes at base; the P3 "ShowBand 768px overflow" does not reproduce. ShowBand is home-only. Kept as a regression guard. |
| A11 (I) | FAIL | Fraunces/Karla not loaded by the chrome; no console errors at base |
| A13 (K) | pass | after removing stray `.tmp-*` files |
| A14-A20 | FAIL | `components/nos-chrome/`, `footer-data.ts`, mount and font edits do not exist yet |

## 12. Rulings folded in (NOS Design, under Brad's approval, 2026-10-15)
- ShowBand / any band is dropped outright on `/national-show/*`, unconditionally: the NOS header carries the lockup, so a band is always a second logo. Enforced by A6 (one logo per viewport) and A17 (no ShowBand/NosMasthead/colophon logo). SAOC pages keep what they show today (A3).
- Dates (supersedes the earlier 16-19 ruling): open question with the committee. Requirement is single-source only: the NOS lead/rail meta must equal what the SAOC mega renders from the same Sanity singleton (check E), and nothing in `components/nos-chrome/` may hard-code a date, venue or edition (A15). No check asserts a literal date; whichever value Sanity holds renders everywhere, and a Studio edit fixes every surface.
- Lockup visibility (checks D and F) is measured on the INK box (header file ink (54,54)-(1139,241) of 1200x294, H:86, scaled to rendered width), not the img box, because the approved negative margins (C:34) pull the img box partly off-screen. Scroll restore (check F) is exercised in two real-use ways: Menu clicked while on screen at scrollY 60, and keyboard (focus with preventScroll, Enter, Escape) at scrollY 600; both assert J:37 / J:66 behaviour.
- Design-lead ruling 2026-10-15 (check H, A10): no horizontal scroll at 360 and 375 as well as 390 and 768 (scrollWidth == clientWidth == innerWidth). C:89 (`@media (max-width: 420px) { :root { --nc-logo-w: min(390px, calc((100vw - 32px) / 0.904)) } }`) must actually reach the lockup: declare `--nc-logo-w` on `:root` exactly as the stylesheet does, never re-declare it on `.nh` (that shadows the media query and pins the lockup at 390px, giving scrollWidth 388 at 375).
- Design-lead ruling 2026-10-15 (new check M, A22): the Menu/Close toggle (`#nh-burger`) keeps its right edge and width between closed and open (0.5px tolerance) at 390 and 1024: a fixed `min-width` that fits "CLOSE" plus the icon, right-aligned to the gutter. Previously measured 260-359 closed vs 272-374 open. This adds a declaration to the stylesheet (allowed by section 9: additions may not change approved declarations; `.nh-burger { min-width: ... }` overrides C:70's 44px minimum for this one property, so keep it in a separate later rule).
- Check E (A7): the "23-26 present" ban is removed. Dates are single-source only: NOS meta must equal the SAOC mega render, and A15 covers hard-coding. Nothing asserts or forbids a specific date value.
- Hub hero CTAs (NOS Design hub review, HANDOFF "Hub hero" H:229: "Kept from the approved hub: the lede, the facts (Dates / Host / Venue / Cycle), and the CTAs Plan your visit and Find your society"): remove the hero's "Register interest" button and its "Book tickets" CTA. Why: the header Tickets CTA (H:144-151, decision 1 at H:253) is now on every NOS page, so a hero ticket CTA would be a second one on the first screen. Check L (A21) asserts: no "Register interest" in the hero, no hero link matching /book tickets/i, exactly one "Plan your visit" link (href = nav-config leaf `plan-your-visit`, /national-show/plan-your-visit) and exactly one "Find your society" link (/societies). NOTE for the dev: the base hero has NO "Plan your visit" CTA (base CTAs: Book tickets, Register interest, Find your society), so F1 must add it, using the same Button grammar and order as the handoff lists (Plan your visit, then Find your society); its restyle is F2.
- Ticket-reachability chain (A23-A24 equivalents are the amended TKT-06 / TKT-07 in `contracts/contract-ticket-reachability.yaml`, allowed in scope together with helper `contracts/checks/ticket-reachability/check-national-show-header-cta.mjs`): /national-show no longer links `/tickets` from the hero. The chain is the NOS header `a.nh-cta` (inside `header#nh`) with href `/national-show/tickets` and meaningful text. NOS Site rebases its own TKT amendment onto this one.
- Provenance of the "no Register interest" rule: Brad's 2026-10-08 v4 refinement ("no Register interest", per NOS Design's memory) together with HANDOFF "Hub hero" H:229.
- Design-lead ruling 2026-10-15 (hub hero CTA order, check L / A21): "Plan your visit" comes FIRST as the primary, in the slot and gold style of the old "Book tickets" button (the existing `variant="on-dark"` Button); "Find your society" comes second, ghost/secondary (`ghost-on-dark`). No other hero CTAs. Asserted: exactly two `[data-nos-hero-button]` elements in the hero, in DOM order Plan your visit then Find your society (keep the existing `data-nos-hero-button` attribute on both). Visual style is not machine-asserted; it is the dev's reuse of the two existing Button variants.
- Check F (A8) extended after Codex review: with the panel open at 390, clicking the header Tickets CTA, `history.back()` and `history.forward()` must each leave the destination with the panel hidden, no `inert` anywhere, body scroll not locked, Menu `aria-expanded="false"`, and (CTA case) scrollY near 0, not the old page's saved restoreY. The panel's close-on-unmount / route-change path must therefore clear inert, the scroll lock and the saved restoreY without restoring it (J:56 `keepPlace: false` semantics).
- Design-lead ruling 2026-10-15 (check M / A22, classic scrollbar): the toggle's right edge must be identical closed vs open WITH a classic scrollbar. The open panel's body overflow lock removes the scrollbar and the reflow moved the toggle 15px. The check runs a second Chromium with Playwright's default `--hide-scrollbars` dropped (15px layout-taking scrollbar; it fails if none is present). Fix by compensating the lock (for example `scrollbar-gutter: stable` on `html`, or padding-right equal to the measured scrollbar width while locked), not by changing the toggle's width.
