# F19 - SAOC design pass (launch-weekend)

Scope: SAOC (not National Show). Items R64, R65 (SAOC side), R72, R79, R80 #2. One dev, one QA. Visuals only from
`design/design_handoff_saoc/` plus `branding/SA Orchid Council/` (read-only); copy only from Drive or existing repo strings.
NOS is out of bounds: F18 owns `app/(marketing)/national-show/**`, `components/nos/**`, `nos-structure.css`.

Skills the dev MUST load and use: **impeccable** (craft-floor, polish, critique), **frontend-design**, **web-design-guidelines**, **accessibility**.
Gate cwd = the implementation worktree (branch from main with spec/lw-f19 merged, so goldens/f19 and contracts/checks/launch-weekend/f19 exist; copy `.env.local`
in and delete it at the end). BASE_URL = production build on **port 3619**: `pnpm build && pnpm exec next start -p 3619`; stop by exact PID
(`lsof -ti tcp:3619 -sTCP:LISTEN`); do not rebuild while it runs. Runtime checks read the CMS read-only.

## 1. Measured baselines (main 47cf7f1b; :3012 = beta preview, :3013 = public)

Hero contrast, 2nd-percentile worst pixel, text composited, 4 slides (min over slides): current scrim is `from-primary/75 via-primary/75 to-primary/85`.

| target | 1280 | 390 |
|---|---|---|
| h1 roman (ivory) | 4.65 - 6.22 | 4.79 - 5.71 |
| h1 italic accent (accent-soft) | **2.53 - 3.30** | **2.76 - 3.20** |
| lede | 4.86 - 7.32 | 4.64 - 6.52 |
| CTA 1 (primary fill) | 9.53 | 8.17 - 9.53 |
| CTA 2 (outline) | 5.38 | 5.81 |

So the current scrim passes everything except the italic accent, and it passes by hiding the carousel.
What the brief literally says (README l.125) measured on the same four slides, min over slides at 1280 / 390:

| candidate scrim | h1 | accent | lede |
|---|---|---|---|
| diagonal 135deg sage 60% to 25% + bone pull | 2.04 / 2.26 | 1.19 / 1.38 | 1.92 / 1.93 |
| uniform 60% sage | 3.14 / 3.29 | 1.72 / 1.94 | 3.12 / 3.11 |
| uniform 60% primary-800 | 3.84 / 4.03 | 2.10 / 2.40 | 3.82 / 3.80 |
| diagonal + text-zone veil (R1 below) | 8.6+ / 10.9+ | 5.7+ / 5.9+ | 10.2+ / 10.5+ |

**The brief verbatim cannot reach 4.5:1** for ivory text over these photographs. Hence R1.
Other baselines: header logo x = 32 (390 and 1280), 352 (1920), 420 (2056); SAOC body headings and eyebrows sit at 64 / 320 / 388 (section px-16 plus an inner
max-w-[1280px] with no padding); /privacy /terms /refunds h2 at 312 / 700 (centred reading column); /contact second-column h2 at 566. Home hero h1-to-lede
gap = **0px** at 390 and 1280 (the unlayered global `.h1 {margin:0}` beats the `mb-6` utility); hero CTAs at 390 are 183.8 and 213.3 wide, left aligned.
Yearbook: copy paragraph bottom to meta top = 243px at 1280, 40px at 390; last CTA bottom = photo bottom (justify-between). Events strip h2 "Upcoming society shows",
eyebrow "What's on", one row (the national show). Only title-case button on SAOC pages: "Find Your Society" (ShowBand "Book tickets" was fixed in F14).
Prose: judging 8 elements under 16px (15px), contact 14px, sponsors 13px and 15px, members 14px and 15px, about 15px; home MissionBlock 17px/1.65 x2,
YearbookStrip 18px/1.65, hero lede 20px/1.5; about and others 16px/1.63 (`leading-relaxed`).

## 2. Rulings (architect decisions for the lead to confirm; a reversal is a tokens.json plus spec edit, not a contract rewrite)

- **R1 Scrim (A1, A2).** Three aria-hidden layers inside the carousel section, after the slides and before the content, `data-hero-scrim`:
  1. `diagonal`: `linear-gradient` to bottom right (120-150deg), `--primary` (or `--primary-800`) at 60% at the top-left stop to 25% at the bottom-right stop, alpha never rising. This is README l.125 verbatim.
  2. `veil`: a `radial-gradient` ellipse centred on the copy block, `--primary-800` at about 85-90% across the text zone, fading to transparent at its rim. This is the text-zone protection the uniform scrim used to give; it is the only way to meet 4.5:1 with the diagonal in place.
     Sizing is responsive: at 1280 it hugs the copy (the corners keep the diagonal's 60 and 25), at 390 it must cover the full width because the copy does.
  3. `bone`: `linear-gradient(to top, var(--bone) 0, transparent <48-96px>)`. README says "bone-to-transparent pull on the bottom for headline contrast"; bone behind ivory text would LOWER contrast, so the pull lives inside the section's bottom padding (96px), clear of the CTAs, pause button and dots (A1 measures the clearance). It blends the hero into the next section.
  The old `from-primary/75 via-primary/75 to-primary/85` layer is deleted, not hidden. `simulate.js` shows one set of numbers that passes (veil `ellipse 56% 54%` .88/.84/0 at >=768, `ellipse 100% 62%` .90/.86/0 below).
  Contrast bar is 4.5:1 on h1 roman, h1 italic accent, lede and both CTAs, all 4 slides, 1280 and 390. The italic accent (accent-soft) is large text (3:1 under WCAG) but the lead asked for 4.5 on the h1, so the bar is 4.5. If the lead prefers 3:1 on the accent only, change `check-b-contrast.mjs` target filter; the veil can then be lighter.
  Visibility: at 1280 the solved overlay alpha is .50-.72 at the top-left corner and .18-.40 at the bottom-right corner (6% boxes above the bone pull).
- **R2 Casing (A3).** Casing only: "Find Your Society" to "Find your society". The check scans every button-like control (padded, bordered or filled link or button outside chrome) on 9 SAOC routes, so a title-case button added elsewhere fails too. Proper nouns allowlisted in tokens.json.
- **R3 Events (A4).** Option A: the existing "What's on" label becomes the h2, the eyebrow pill is removed (one "What's on", not two). Chosen over hiding the section because it is deterministic (no data dependence) and keeps the "Full calendar" link. The section gains `data-home-section="events"`.
- **R4 Yearbook (A5).** `data-yearbook-copy` on the paragraph. Copy column `justify-content: flex-start`, `gap: 32px` between the copy block and the meta block, `align-self: start`, actions 16-32px under the meta, the photo (4/5, unchanged) carries the row height. F14-A12's last-CTA-on-photo-bottom clause is superseded (supersession.json).
- **R5 Hero spacing (A6).** h1-to-lede 16-20px at 390 (use `--space-4` 16 or 20), 16-32px at 1280. Root cause is the unlayered `.h1` margin reset: fix by spacing the lede (or a wrapper) instead of fighting the reset; do not edit `.h1`. CTAs get `data-hero-ctas` (wrapper) and `data-hero-cta="primary|secondary"`, lede `data-hero-lede`. At 390 both full width or both equal width and centred; at >=640 side by side as today.
- **R6 Axis (A7).** One class `.saoc-container` in an F19 block of `app/globals.css`: `max-width: var(--container-max); margin-inline: auto; padding-inline: var(--container-pad);` (the header's own tokens; `components/chrome/**` is untouched and is the authority, A7 measures against the header logo's x). Body sections drop their own `px-8 md:px-16` and put `.saoc-container` on the inner wrapper (section keeps `py` and its background full-bleed). Used in at least 6 files. Exempt by construction: centred elements (heroes, CTA bands), the home hero carousel, `show-band` (flush-left bleed, ShowBand.tsx is untouched), headings inside cards, and headings in the 2nd+ column of a grid (contact's form). Legal pages (constitution, privacy, terms, refunds) are a centred reading column: A7 reports them as NOTE only. They are NOT in the F19 file allowlist. LEAD DECISION: say so if you want them on the axis too (they would need a left-aligned column with a 60-70ch measure).
- **R7 Judging (A8).** Overview, How judging works and Becoming a judge each get `data-judging-split`: `grid-template-columns: 4fr 7fr` at >=1024 (gap free, `--space-8` suggested), the section's h2 (today an `.eyebrow` h2, no new heading copy) in the left column, the prose in the right column at <=60ch, tops aligned within 10px; below 1024 one column. Awards grid and judges list unchanged.
- **R8 Type (A9).** 16px / 1.55 (24.8px). `app/globals.css` `.p-lg` 1.65 to 1.55 (in-place edit, the only allowed non-additive edit); MissionBlock 17px to 16; YearbookStrip 18px to 16; `ui/PageHero` lede 17px to 16 with root `data-page-hero`; every SAOC prose under 16px (judging, contact, sponsors, members, about) to 16; 16px prose that carries `leading-relaxed` (1.63) to 1.55. Labels, meta, mono eyebrows stay 12-14px; the societies card meta lines and media-kit captions are meta and not asserted. NOS side excluded.
  **PageHero is shared**: `/national-show/about` and `/national-show/tickets/buy` use it, so its lede goes 17px to 16px there too. That is the settled R65 value on both sites and A12 ignores paragraphs inside a PageHero root for exactly this reason.

- **R9 Provenance (A21, A22).** Every fact the Drive does not source is wrapped in `withholdPlaceholderProse()` (lib/data/show-pages.ts): withheld on the public build and on :3012, shown only on the beta preview (`SHOW_PLACEHOLDER_PREVIEW=true`, wall up) inside an element carrying `data-placeholder` and one existing marker string ("Not confirmed by SAOC", "To be confirmed", "Not yet confirmed", "Awaiting confirmation"). No new marker copy. The unsourced regex list is `tokens.json provenance.unsourced`; sourced facts with citations (About doc l.3 and l.5 for 1968 and the Bloemfontein founding meeting; Spec V3 l.714 for info@saoc.co.za) are in `provenance.sourced` and stay public. Home: the whole yearbook band is withheld in public (editor, 184 pages, ISSN, "Orchids South Africa" copy), as are "federated network of 21 societies", the 1990 standardisation, "56 accredited" and the "EST. 1968" ornament unless cited. No bare 18, 21, 56 or 184 leaf may survive in public.
- **R10 Gap states.** Where a section is withheld the page shows the existing `ABSENT_SHOW_PAGE_FIXED_SENTENCE` in one `[data-content-gap]` element. /about: the six TBC committee h3s are hidden in public and the grid reflows with no orphan h3; on preview all six cards show, each marked. /sponsors: neutral h1 "Sponsors" in both modes (not content-gated), the R18 designed empty state, no stat list. /judging and /events: the unsourced claims (100-point scale, 56 judges, 1990, "overhauled" vs "standardised", criteria, award thresholds) follow R9.
- **R11 Events (A23).** /events shows 1 row because 17 of 18 societyEvent docs are unpublished drafts; the count is correct and A23 asserts it equals the published Sanity count (read-only query). The National Show row title links to /national-show; each row gets `<time datetime>`; one Event JSON-LD per row via the existing `eventJsonLd` helper.
- **R12 Contact (A24).** name/email `autoComplete`; field boundary 3:1; button 44px; a `role="status"` region present before submit that carries the success message; error element with an id listed in the textarea's `aria-describedby` plus `aria-invalid`. Address: a sourced address only, otherwise a holding state (`data-content-gap`). Only info@saoc.co.za is sourced. VenueCard is not edited. There is no tel field, so tel autocomplete is N/A (adding one would be new copy).
- **R13 Taps (A25).** SAOC footer links, newsletter input and button at least 44x44 at 390 on /, /about, /contact, /events. Footer.tsx and footer-data.ts are allowed (see allowlist); the rest of `components/chrome/**` stays forbidden.

## 3. Hooks the dev adds (checks depend on them)

`data-hero-scrim="diagonal|veil|bone"`, `data-hero-lede`, `data-hero-ctas`, `data-hero-cta="primary|secondary"`, `data-home-section="events"`, `data-yearbook-copy`,
`data-page-hero` (PageHero root), `data-judging-split`, class `saoc-container`, `data-content-gap`, `data-placeholder`. Existing hooks (`data-home-section`, `data-yearbook-*`) stay.

## 4. File allowlist (A10 enforces; anything else changed fails)

`app/globals.css` (additive under an F19 comment, plus the `.p-lg` 1.65 to 1.55 edit); `components/home/{Hero,MissionBlock,NavCards,EventsStrip,YearbookStrip,PartnersSection}.tsx`;
`components/ui/**`; `components/chrome/Footer.tsx` and `components/chrome/footer-data.ts` (only these two chrome files; Header.tsx only after the lead is told); `app/(marketing)/page.tsx`; `app/(marketing)/{about,societies,events,judging,contact,sponsors,members,media-kit}/page.tsx`;
prefixes `components/{about,contact,events,judging,members,societies,sponsors}/`, `contracts/checks/launch-weekend/{f19,f14,f17}/` (f14 and f17 only for the re-pins already in this branch), `.agent/memory/project/specs/launch-weekend/`, `docs/`, `.tmp/`, `e2e/f19-`.
**Forbidden outright:** `app/(marketing)/national-show/**`, `components/nos/**`, `components/nos-chrome/**`, `components/show/**`, any `nos-structure.css`, the rest of `components/chrome/**` (UtilityBar.tsx, NOS header components, ChromeFrame.tsx), `app/(marketing)/tickets/**`, `components/VenueCard*`, `nos-theme.css`, `components/tickets/**`, `components/vendors/**`, `lib/**`, `sanity/**`, `app/api/**`, `components/home/ShowBand.tsx`.
Added lines: no hex colour, no rgb()/rgba() other than palette values (56 65 56, 34 40 31, 232 230 220, 244 243 236), no new font, no keyframes or animate-, no duration other than 150ms, no emoji. No new copy (A11 measures it against `copy-baseline.json`).

NOS guard: if the globals.css `.p-lg` edit cascades into NOS pages, A11b and A12 assert NOS computed type is unchanged against `nos-baseline.json`.

## 5. Self-critique loop (A14)

impeccable critique at 390 and 1280 on home, judging, societies, events, about, contact, sponsors, members, plus the four home hero slides. `capture-shots.mjs` writes
`.tmp/sandbox/lw-f19/after/` (16 route shots and 8 slide shots); the log `.agent/memory/project/specs/launch-weekend/f19-critique-log.md` has `## Pass N` sections, names impeccable,
mentions every route, "scrim" and "slide", shows findings fixed between passes, and the final pass reads `P0: 0`, `P1: 0`, `P2: 0`, `Score: NN/40` with NN >= 36.

## 6. How the checks were proven

Each runtime check was run RED against untouched main (:3012). `F19_SIMULATE=1` injects `simulate.js` (a throwaway DOM/CSS patch imitating the intended result, NOT a reference implementation) and A1, A2, A3 (its static half stays red), A4, A5, A6, A9 (static half red), A11 went green with it. A7 (axis) positive path was proven on the already-compliant routes (`F19_ROUTES=/events,/contact`), its static `.saoc-container` half is red on main. A8 (judging) is proven red only; its green path was reasoned from the CSS grid contract, not simulated.
A11 and A12 are regression guards that are green on main by design.

## 7. Source gaps and open points for the lead

1. README l.125 (diagonal 60 to 25 + bone pull) conflicts with the handoff prototype `src/styles.css` `.hero__scrim` (a vertical ink gradient .58 / .42 / .78) and with the 4.5:1 bar. R1 keeps the README gradient and adds the veil. Brad's call if he prefers the prototype's vertical scrim.
2. The italic accent at 4.5:1 (R1) forces the veil to ~85-90% behind the copy. Relaxing it to 3:1 (WCAG large text) lets the veil drop to ~70%.
3. The hero's primary CTA (`bg-primary`) is nearly invisible as a shape on a veiled sage field; its label passes (9.5:1) but the button edge is a non-text-contrast P3 for the critique loop, not asserted.
4. Legal pages off the axis (R6) and the societies/media-kit meta sizes (R8) are left alone by ruling; say so if either should move.
5. SUPERSEDED by R9: unsourced figures are now withheld in public and shown marked on preview (A21, A22).
6. e2e: `pnpm test:e2e` starts its own dev server on a free port; expect it to be the slowest assertion (timeout 1500s).
7. Flags: the tracked Drive spec doc holds plaintext passwords (values not repeated here; rotate and scrub). Hero "SINCE 1968 · BLOEMFONTEIN" is sourced only as the founding meeting place. "21" is derivable from the societies listing but not from Drive. secretary@saoc.co.za (privacy, constitution, JSON-LD) is unsourced and untouched. Societies member counts and footer "Reg#" are unsourced and untouched. Contact fallback labels "SAOC Secretariat / General enquiries" are unsourced and withheld in public. 17 draft events are unpublished (editorial, not code). Green paths of A21 to A25 are unproven (red-only on main).

## 8. Font load split (A26, design-cb P1, lead-confirmed)

Target: NOS routes declare and load only Fraunces and Karla; SAOC type rendering is unchanged (same declared faces, same computed font-family; `fonts-baseline.json` was captured from main :3013). Today `app/layout.tsx` loads Crimson Pro, Manrope and JetBrains Mono for every route (Lora is declared too, from main's own SAOC styles) and the `UtilityBar variant="nos"` uses them on NOS.
Allowed files for this item (added to A10): `app/layout.tsx`, `app/(marketing)/layout.tsx`, `app/(marketing)/national-show/layout.tsx`, and anything under `app/(marketing)/(saoc)/`. NOT allowed: `ChromeFrame.tsx`, `UtilityBar.tsx`, NOS header components, `nos-theme.css`.
Recommended shape: route group `app/(marketing)/(saoc)/` for the SAOC pages (git mv, excluding `tickets/`), its own `layout.tsx` holding the font loaders and wrapping children in the font-variable classes; loaders removed from `app/layout.tsx`; the SAOC chrome elements built in `app/(marketing)/layout.tsx` are wrapped with the same variable classes (a `display: contents` wrapper) so Header, UtilityBar and Footer still render SAOC faces.
The unavoidable risk: the NOS utility bar (forbidden file) uses `font-sans` and `font-mono`, so on NOS routes those stacks must resolve to Karla or a generic, not Manrope or JetBrains Mono. A26 fails on any NOS element whose first computed family is outside Fraunces, Karla or a generic. If that cannot be met without editing UtilityBar.tsx or nos-theme.css, the dev STOPS and sends the lead the exact diff (a scoped `--font-sans` and `--font-mono` remap in the NOS scope).
Admin, studio, not-found and tickets also sit under the root layout today: they must keep a working font (own loader or generic fallback); not asserted.

## 9. Hero CTA on the veil (A27, design-cb ruling, final)

R1 stands as Option A: README diagonal plus the radial veil, no large-text exemption (A2 stays 4.5:1 on the italic accent). On the veil the PRIMARY CTA inverts to an ivory/bone fill with primary-colour text, same size and radius as before; the SECONDARY is an ivory outline with ivory text; both sentence case. A27 measures fill vs veil at least 3:1, label vs fill at least 4.5:1, secondary border ivory and text at least 4.5:1, all 4 slides at 390 and 1280.

## 10. Typographic quotes (standing design-cb rule)

Rendering straight quotes and apostrophes as typographic ones is typography, not new copy. A11 and A11p fold the curly quotes and apostrophes to straight ones on both sides before comparing; the check carries a built-in probe proving curly equals straight and a genuinely new word still fails. A10 has no copy comparison (it diffs added lines for colour, font, animation, duration, emoji), so nothing to normalise there.
