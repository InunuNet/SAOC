# F12 spec: NOS hub hero, grouped index, symposium and show-page template (R68-R70)

Pinned against F3's structure (branch feat/nos-f3-hub-tickets, bf2faf26), not main's. Machine-readable values: values.json. Copy provenance: copy.json.
Cited: docs/rules/no-invention.md; design/design_handoff_saoc/design_system_README.md ("Page max width: 1280px. Gutter: 32px."); branding/ is read-only and untouched.

## What F3 changed that this spec depends on (read from the F3 diff)
- ShowSectionNav is unreferenced by every NOS route (f3-static asserts it). Its 16-card wall is therefore NOT on the F3 hub. R69 is built as a NEW component, components/nos/NosShowIndex.tsx, rendered on the hub. components/show/ShowSectionNav.tsx stays byte-identical (dead, unreferenced).
- The hub's "Explore the National Show" block is gone and F3 hub-links asserts "no <nav> on the hub". R69 restores exactly one grouped index; see supersession.json.
- Every NOS content block is <NosSection> > [data-nos-wrap] (1080 + gutter, .nos-theme [data-nos-wrap], specificity 0,2,0). Main's "centred max-w-[900px]" no longer exists on the six template pages; their container is the 1080 wrap. R70's 1280 / px-8 container therefore OVERRIDES the wrap on those pages (a Tailwind utility alone loses to the 0,2,0 rule: use a scoped rule in nos-structure.css or a wrap modifier, never !important sprinkled in JSX).
- Hub hero = NosHero titleSize="display": .nos-hero-copy > h1.nos-hero-title + .nos-hero-body (lede + actions children: .nos-hero-actions, price, countdown div, dl.nos-hero-facts, confirmation badge).
- Inner heroes: .nos-hero-inner. Symposium has the orchid-violet photo (photo variant); the other five template pages are typographic or photo per hero-photos.ts.

## R68 hub hero (>=1024 unless stated)
| selector | property | value |
|---|---|---|
| h1 | text | exactly "National Orchid Show" (a constant in the hub page, not nav-config: nav-config keeps "19th SAOC National Orchid Show" as the mega-menu lead label) |
| .nos-hero-hub .nos-hero-copy | justify-content / padding-top / padding-bottom / row gap | center / 96px / 88px / 36px |
| .nos-hero-title | max-width / font-size / line-height / letter-spacing / text-wrap | none / clamp(52px,4.9vw,96px) / 1 / -0.01em / balance. One line at >=1280 |
| .nos-hero-body | max-width / row-gap | 760px / 32px |
| .nos-hero-lede | max-width | 46ch |
| .nos-hero-facts | grid-template-columns / column-gap / row-gap | repeat(4,max-content) / 40px / 0 at >=1024; 2x2 below 1024 (F3's 2-column rule stays) |
| actions + countdown wrapper | display / align-items / justify-content / gap / flex-wrap | flex / flex-end / space-between / 48px / wrap. Two children: the actions cluster (.nos-hero-actions, then the price anchor when it exists) and the countdown block. Under 640px they stack, actions first |
- Buttons per R67: Tickets primary, then Plan your visit (F3 check-f3-hero-ctas keeps running).
- Below 1024 the F3 stacked hero is kept (padding-block 40px, gap 32px); <=700px keeps F3's h1 clamp(2.8rem,12vw,3.4rem). R68 sets nothing there.
- Stack order at 390: CTAs, price (if any), countdown, facts (F3 C-2, still true below 640).
- Fold at 1280x800: h1 and both CTAs fully above 800px (F3 fold rule, still holds).

## R69 grouped index (hub only, last block before the footer)
- Root: <nav aria-label="Explore the show pages"> (the trailing " pages" is what F3's audit/container/rhythm checks already exempt). padding-block 88px, border-top 1px solid --rule. Inner container is the R70 container (max-w 1280, px 32) so the hub index and the template pages share one left axis.
- Eyebrow: <p> "Explore the show" (Karla 12px 600 .14em uppercase text-accent, same role as the old eyebrow). Not a heading, so C-3 and the heading outline are untouched.
- Three columns minmax(0,1fr), column-gap 56px at >=900px; one column below 900.
- Group heading: h3, 12px Karla 600, letter-spacing .14em, uppercase, text-accent (#7e3f97), padding-bottom 16px, border-bottom 1px solid --rule.
- Items: ul > li (border-bottom 1px solid --rule) > a: display flex, justify-content space-between, align-items center, min-height 56px, Fraunces 20px, text-ink (#211a57). Arrow span aria-hidden at opacity .35; on :hover (and :focus-visible) arrow opacity 1 and translateX(4px), link text text-accent. No description text anywhere.
- Groups and hrefs: hub-index-groups.json (16 items). Visible item text = the nav-config.ts label for that href.
- Current page: prop `current` (pathname). The item whose href equals `current` is KEPT in the list with aria-current="page" and the text-accent class; no other item carries aria-current. (On the hub itself `current` is "/national-show", which is not in the list, so none is marked. The render check proves the marking with another pathname.)
- Legacy 16-card ShowSectionNav is not touched or re-used.

## R70 symposium and template
Symposium (/national-show/symposium):
1. h1 "National Orchid Show Symposium"; "SAOC Symposium" is removed from the visible h1 and from <title> (and og:title / twitter:title / og image text, for consistency). nav-config's "SAOC Symposium" label (mega menu, sub-nav, hub index item) is a separate surface and is NOT changed by F12.
2. The hero lede is the theme line, not the spec's internal Purpose line. Theme line: copy.json (verbatim from Lee-Ann's Drive). No quote characters. Fraunces italic, clamp(22px,2vw,30px)/1.3, max-width 30ch, colour --bone (#f3f2d6).
3. Body "Symposium theme" section: h2 "Symposium theme" (sentence case, was "Symposium Theme"); the quoted theme-line block is dropped from the body (it now lives in the hero); only Lee-Ann's description sentence remains. Applied at render in lib/data/show-page-presentation.ts, between hydratePage and wrapGatedProse (the gate and its notice logic are untouched; ShowPageProseProps keeps exactly one key, G7).
4. Inner hero min-height 380px at >=1024 (computed min-height >= 380 and rendered height >= 380; the photo variant's existing clamp(360px,32vw,460px) is raised, not lowered). Inner h1 at >=1024: max-width none, text-wrap balance, so "Symposium" never sits alone on the last line.
5. The single-item in-page nav "Presenters (4)" is removed: PresenterJumpLink is no longer rendered; the Presenters section itself stays.

Template: the six routes that render through ShowContentState (programme, symposium, wosa-conference, sa-exhibitors, international-guests, sponsors) plus the FAQ page's container. conferences and workshops render through CategoryTicketsPage (max-w-[720px] column) and are NOT on this template: the queued 60ch work for them is not superseded and F12 leaves both files byte-identical.
- Container: mx-auto max-w-[1280px] px-8 (1280 border-box, 32px inline padding at every width).
- Each .nos-show-page-prose >=900: grid, columns minmax(0,4fr) minmax(0,7fr), column-gap 64px, padding-top 40px, border-top 1px solid --rule. h2 in column 1 (32px, margin 0; sticky top 120px optional, not asserted). Everything else (paragraphs, lists, the beta-only TBC / R11 notice, the F8 gap notice) in column 2. p max-width 60ch. Below 900 the block is one column, h2 first.
- FAQ page container uses the same container (its faq list and contact row sit inside it).
- No `max-w-[900px]` remains in the six pages, ShowContentState, ShowPageProse or the FAQ page (sponsors/page.tsx carried one for its listing surface).

## The four conflicts, resolved
(a) r5's `[&_p]:max-w-[60ch]` on vendors/page.tsx and exhibitors/page.tsx survives: both files are on mustBeUnchanged and a runtime check measures their paragraphs at <= 60ch.
(b) Body size (R65 16px/1.55) is not set here: added CSS lines in the F12 diff may not declare a font-size on `.nos-show-page-prose p/li`, body or `.nos-theme p` (static diff check). The template h2 32px and index/lede sizes are the only new type sizes.
(c) Template pages: the six above + FAQ container. conferences/workshops untouched (their 60ch cap stays queued under NOS Site).
(d) F8 withheld-placeholder logic keeps working: ShowPageProse keeps emitting data-nos-content-gap on the same element that carries nos-show-page-prose (the grid), the notice still renders before the heading in DOM order, and when F8 is merged beneath F12 its A1-A3 checks run unchanged in the F12 gate. The collapsed gap block sits in the same grid (notice in column 2).

## Open points the lead must rule on (architect's assumption stated)
1. Hub index placement: last block before the footer (assumed; the old nav was foot-of-page, R21).
2. Hero copy axis vs content axis: hero copy uses its own gutter clamp(16px,4vw,48px) (48px at 1280) and a 1320 cap; R70's content container is 32px / 1280. At 1280 the hero text starts at 48px, the content at 32px: a 16px offset remains and wider screens differ more. R70 does not ask to change the hero container, so F12 does not; check-f prints the offsets as NOTE lines, it does not fail on them.
3. "Inner hero min-height ~380px" is applied to all inner heroes at >=1024 (assumed), and asserted on the symposium and the other five template pages.
4. The hub <title> / og title still read the F3 metadata (not in R68); only the visible h1 changes.

## Added 2026-10-16 (lead relay)
Conflict (c), NOS Design: conferences and workshops take the R70 container (1280, px-8) for alignment and 60ch for measure; they do not get the prose grid. They render through components/tickets/CategoryTicketsPage.tsx, which /national-show/tickets also uses: change it only behind an opt-in prop passed by the two pages; tickets stays on the F3 1080 wrap (measured in F12-A7). The inner column cap for the ticket form is left to the dev; only container and paragraph measure are asserted.

SAOC utility bar on NOS pages (Brad, direct, with screenshot): the dark band (mail icon + info@saoc.co.za left; pills right) renders above the NOS header on every /national-show/* route.
- Reuse components/chrome/UtilityBar.tsx, add optional prop `variant: 'saoc' | 'nos'` (default 'saoc', output byte-identical to base: proven by render check F12-A13 against `git show <base>:components/chrome/UtilityBar.tsx`). No restyle, no copy of the markup.
- 'nos' replaces only the show pill: href "/" (same origin; the SAOC home is saoc.co.za), label "saoc.co.za", the replaced pill's style, MINUS its width gating (lead ruling 2026-10-16): the hidden and min-[900px]:inline-block classes are dropped so the pill shows at every width; an inline-block display class takes their place. Email and "Join a society" stay.
- Mount: app/(marketing)/layout.tsx, nos.top = UtilityBar variant="nos" then NosHeader. Not inside the components/nos-chrome directory (F1 check-static forbids a UtilityBar reference there; F12 keeps that true).
- The skip link stays first in DOM and the first Tab stop; #nh stays sticky (the bar scrolls away, the header pins at top 0). Measured at 1280 and 390 on all 17 routes (F12-A14).
- SAOC pages: bar unchanged; Header/Footer/menus unedited; the header Tickets CTA is removed by F13 (landing before F12), so F12-A14 expects none on /, /about, /societies, /contact.
- Phones (rulings 2026-10-16): the pill is visible at every width (390 and 360 included). To make the row fit, in the nos variant ONLY and below 480px the email text collapses to the existing mail icon: the link stays mailto:info@saoc.co.za with aria-label="Email info@saoc.co.za", the address text is visually hidden (a span with a max-[479px] sr-only style), and the target is at least 24px. Padding and gap stay identical to the SAOC bar; the only class additions allowed are tokens starting max-[479px]. From 480px up the bar is exactly as before. F12-A13/A14 allow exactly this one difference and assert the aria-label. The bar must be one row with no wrap or overflow at 360, 390, 479, 480 and 1280, every link target at least 24px tall and wide (44px preferred; shorter ones print a NOTE).
