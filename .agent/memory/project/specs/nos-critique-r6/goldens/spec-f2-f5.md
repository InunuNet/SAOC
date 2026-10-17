# nos-critique-r6 f2-f5 and f7 — the 2026-10-17 lane (spec for @dev; f6 and f8 are the second architect's)

Source of every item: lead saoc-2b 2026-10-17 (R80/R63/R82/SEO lane), relaying Brad; backlog.md:1928.
Worktree `.tmp/sandbox/critique-r6`, branch `fix/nos-critique-r6`, BASE 47cf7f1b (the lead rebased onto F18a, 538faab8 + merge, while this was being written; every finding below was re-verified on 47cf7f1b).
Stacked: @dev applies f1 -> f5 in one tree; every footprint runs with `--through=<N>`. F18a is on main, so all five can start. NO INVENTION: copy and labels come only from
design/design_handoff_saoc/, branding/, Lee-Ann's Drive, or labels already in the codebase.
New code in NOS scope must meet R65 (body 16px / 1.55, via `text-[length:var(--fs-body,1rem)]` + `leading-[1.55]`) because
f1's static check scans every scope file.

OFF-LIMITS for all five (F18/F19 own them): national-show/tickets, /tickets/*, checkout and return pages; the workshops and
conferences catalogues; components/nos/LongFormPage, ShowFacts, HoldingState; lib/data/show-facts.ts; globals.css, Header,
Footer, NosSkipLink, ShowContentState; app/api. The hub page.tsx is allowed only in f5.

## f2 — R63 [P2]: a NOS-scoped not-found for /national-show/*

Findings on BASE: the only not-found is the SAOC root `app/not-found.tsx` (SAOC copy, no NOS chrome). An unmatched URL
under /national-show renders that root file inside the root layout alone, so the NOS header/footer (ChromeFrame, mounted
by app/(marketing)/layout.tsx and chosen by `useSelectedLayoutSegment() === 'national-show'`) never appear. A segment
`not-found.tsx` only renders when a page in that segment calls `notFound()`; an unmatched URL never reaches it.

Design: two new files, nothing else.
1. `app/(marketing)/national-show/[...slug]/page.tsx` — a catch-all whose default export calls `notFound()` (no data
   fetch, no metadata of its own). Static routes always win over a catch-all, so no existing route changes.
2. `app/(marketing)/national-show/not-found.tsx` — rendered inside the national-show layout (`.nos-theme`) and the NOS
   chrome, HTTP 404. Existing dynamic routes that already call `notFound()` (archive/[year]) pick it up for free.

Copy (no source for NOS-specific copy exists, so the SAOC root not-found copy is reused verbatim, with one cut):
- eyebrow `404 — Page not found`, h1 `This orchid has left the bench.`
- body sentence one, verbatim: `The page you’re looking for doesn’t exist or may have moved.` Sentence two of the root
  copy ("Start from the home page or find a society near you.") is NOT used: it points at SAOC links this page does not
  carry. That cut is the one deliberate deviation; the lead should say if sentence two must stay.
- three recovery links, labels exactly the nav-config labels, in this order: `National Show` -> /national-show,
  `Tickets` -> /national-show/tickets, `Plan your visit` -> /national-show/plan-your-visit. Use the existing NOS
  `Button` (components/nos/Button) — Tickets primary, the other two ghost — and the `.nos-theme` tokens; no new colours,
  no new CSS file. One `<h1>`. Do not repeat the SAOC root page's photograph treatment.
Do not edit `app/not-found.tsx`.
Codi's conditions (final): a real HTTP 404 plus noindex (meta robots or X-Robots-Tag); the catch-all must not shadow archive/[year] or any dynamic NOS route (a valid archive year stays 200, an invalid one is the NOS 404); recovery links >= 44px.

## f3 — R82 [P2]: /national-show/vendors/apply form

Findings on BASE: `REQUIRED_SENTENCE` ("All fields are required unless marked optional.") already exists in
VendorApplyForm.tsx; `autoComplete` is already `organization` (businessName), `name`, `email`, `tel`, and the stands
field already has `inputMode="numeric"`. Only tradingName lacks autocomplete. Labels render `"<label> (required)"` or
`"<label> (optional)"` through `showRequirement` in VendorFormField.tsx and VendorCheckboxGroupField.tsx (the apply form
is the only caller that sets `showRequirement`; VendorRegisterForm's labels must stay byte-identical). The label class
is `font-mono text-[11px] tracking-[0.16em] text-muted`.

Do:
1. Keep the intro sentence untouched. With `showRequirement`, a required field's label is just its text; the one optional field's label
   already says so (see 4), so the components append nothing for it. (Edit the two `requirement` constants in VendorFormField.tsx and VendorCheckboxGroupField.tsx.)
2. The form-label role, defined ONCE in nos-theme.css: class **`.nos-form-label`** — Karla (`var(--font-nos-karla)` stack
   as the theme already uses), 14px, weight 500, color `var(--ink)` (full ink, no alpha, no `text-muted`), letter-spacing 0,
   no uppercase, no mono. Scope it as `.nos-theme .nos-form-label`. Place it as ONE new rule block; touch nothing else in
   nos-theme.css (heading margins stay). F18b reuses this class name on the ticket forms.
3. When `showRequirement` is true both components use `nos-form-label` (label / legend). When false they keep the current
   class so the register form does not change.
4. Codi (final): the tradingName label renders exactly `Trading name (if different, optional)` (no doubled parentheses; no label anywhere contains `) (`), and every required input keeps `required` and gets `aria-required="true"` so dropping the visible suffix loses no semantics. tradingName stays `autoComplete="organization"` as the lead specified. NOTE for the lead: businessName already carries
   `organization`, so a browser may offer the business name in the "(if different)" field; flipping that one prop to
   `off` is the alternative.
5. The submitted payload is unchanged: golden `vendor-apply-payload.json` is the exact JSON body the form POSTs to
   /api/vendors/apply for the golden inputs, recorded on BASE.
6. No vendor e2e exists in `e2e/` on BASE (nothing under e2e matches vendor); the rendered check drives the real form
   with a stubbed POST instead, and is the e2e of record.
7. The vendors/apply route page.tsx is cleared for f3 only, but nothing in it needs to change; leave it.

### f3 supersession (lead): launch-weekend F7
contracts/checks/launch-weekend/f7/check-h-vendor-static.mjs line 36 requires the form to produce "(required)" and "(optional)", and check-i-vendor-runtime.mjs
line 26 expects `(required)` / `(optional)` labels. R82 supersedes both. @dev amends them IN THIS BRANCH as part of f3 (both are on f3's footprint allowlist):
line 36 now asserts no "(required)" suffix, aria-required on required inputs and the exact tradingName label; line 26 expects the exact labels above.
Record the supersession in docs/nos-critique-r6.md, citing R82 and launch-weekend F7, so main is never red. F18's supersession.json stays untouched.

## f4 — SEO JSON-LD (FAQPage, BreadcrumbList)

Findings on BASE: `breadcrumbJsonLd()` exists in components/seo/JsonLd.tsx and is used nowhere (F18a changed neither JsonLd.tsx nor the Event node; it replaced the hub's inline facts with `buildShowFacts` and removed the Explore index from the hub only — inner pages keep it). The hub already emits an
Event node through `nationalShowEventJsonLd` with `offers` built by `buildAdmissionOffers` (hub page.tsx): price via
`resolveEffectivePrice`, `priceCurrency: 'ZAR'`, availability from released quantity, and offers `[]` unless
`salesState.salesOpen === true`. So the Event-offers bullet is ALREADY DELIVERED and dropped. One part is not: the lead
asked for `validFrom`; the builder deliberately emits `validThrough` from `earlyBirdCutoff` (an F18 wiring ruling says
`validFrom` would state the opposite), and no Sanity field carries a sale-start date. validFrom is therefore not added
(no source, no invention); see risks. Because nothing needs the hub page, there is NO f4b.

Do:
1. `faqPageJsonLd(entries)` added to components/seo/JsonLd.tsx: `{ '@context', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } }] }`. Plus a small exported
   `portableTextToPlainText(blocks)` in the same file (join each block's span `text`, blocks separated by a single space).
   No new dependency.
2. /national-show/faq renders it from the SAME `faqs` array it already passes to ShowFaqList. Entries included are
   exactly those the page presents as settled: `question` non-empty, `hasFaqAnswer(faq)` (the helper F18a exports from
   components/show/ShowFaqList.tsx — reuse it, do not retype the rule) and `status === 'confirmed'` (the only status for
   which ConfirmationBadge renders nothing). When the page is in its HoldingState (`holds`), no FAQPage is emitted. Everything else is omitted. If none qualify, emit no
   FAQPage node at all (never an empty mainEntity). Plain text only, no HTML. Codi (final): each `Answer.text` must EXACTLY equal the visible answer text of that entry (what the page shows when opened, whitespace collapsed); the check compares the JSON-LD text to the rendered `innerText`.
3. BreadcrumbList on every /national-show/* page through ONE spot: a client component
   `components/nos/NosBreadcrumbJsonLd.tsx` mounted by national-show/layout.tsx (the layout is a server component and
   passes it a `labels` map of href -> label built from nav-config for hrefs starting `/national-show`). It reads
   `usePathname()`, builds the trail from the longest labelled ancestor chain — always starting at `National Show`
   `/national-show` — and emits it with `breadcrumbJsonLd()`. Absolute URLs use the origin the hub Event node uses
   (`https://saoc.co.za`). A segment with no nav-config label (a dynamic child, `vendors/apply`) is dropped rather than
   invented; the trail ends at its nearest labelled ancestor. Codi (final): each crumb name must exactly equal the visible nav label for that href (the check compares it to the text of a visible link to that URL on the page). Exactly one BreadcrumbList script per page; the hub gets a
   one-item list. No page file other than faq/page.tsx and layout.tsx changes.

### R61 and the hero LCP: out of f4 (lead 2026-10-17)
The font-preload split is a post-launch item (it would change SAOC head output and the ChromeFrame boundary; next-font-manifest is per page entry and only a route-group split would fix it). The hero LCP assertion (fetchpriority=high, not lazy, preloaded, is the LCP element) moved to f5, whose footprint has NosHero.tsx. f4's footprint is JsonLd.tsx, NosBreadcrumbJsonLd.tsx, national-show/layout.tsx, faq/page.tsx.
FAQPage filter (lead-approved): answered entries the page presents as settled, hasFaqAnswer && (hideUnanswered || status === 'confirmed'); public shows all answered entries without badges (R77), beta only the confirmed ones. FAQPage order = DOM order; the rendered check reads the visible answer with textContent because closed <details> has no innerText.

## f5 — R80 #1 [P1]: hub hero below 768px (waits for F18a)

Findings on BASE (nos-theme.css hero block, not touched by F18a): at <=1023px the hub hero is `flex-direction: column`, copy first, the
photograph `order: 2` at `aspect-ratio: 4/3` below it with `object-position: 64% 50%`; the hero row, countdown and facts
follow the CTAs in DOM order (facts `order: 1` at <=700px). Inner `nos-hero-photo` heroes do the same (media `order: 2`,
4/3) — they have the identical problem and are INCLUDED. Bloom positions come from the pixels, not from guesses:
goldens/measure-bloom.py (sharpness-weighted, deterministic) writes goldens/bloom-marginals.json; measured centroids on
BASE: dark 0.670/0.538, yellow 0.367/0.535, violet 0.474/0.605, purple 0.608/0.407, pink 0.424/0.573.

Do, at max-width 767px only (>=768 unchanged):
1. Hub and inner photo heroes: the media block comes FIRST (`order: -1`), a fixed height of 220-300px (Codi, final: the height is whatever leaves the Tickets button's bottom edge at y<=828 at 390x844, floor 220, expected about 260, aim 300 and never above; `height`, `aspect-ratio: auto`, replacing the 4/3 aspect at
   this width), then the h1, lede and CTAs. Tickets (the primary button) must sit above the fold at 390x844: its bottom
   edge <= 828. Measured on BASE at 390 (before f9 shrinks the header to one 64px row; with f9 the photo can climb back toward 300): the SAOC utility bar + NOS header are 146px, the h1 is 140px, the lede 118px, the
   button ends about 46px below the lede, and the copy block has 40px top padding, so at a full 300px the button ends near
   y=866 (22px under the fold). Fit it by trimming the media toward 280px and/or the copy block's padding-block below 768 (a
   hero CSS edit only); do not drop the lede or change copy. Then the countdown, then the facts (the existing `.nos-hero-row` order stays; the
   `order: 1` on facts keeps them last).
2. `object-position` per photo is the value that puts the most bloom mass in the 390x300 window: set it where the photo
   is defined — extend `HERO_PHOTOS` in components/nos/hero-photos.ts with the measured `objectPosition` for the four
   inner photos (the hub's 68% 50% stays) and apply it through an inline `style` / CSS variable in NosHero.tsx only below
   768 (the >=768 hero CSS keeps its current positions). The rendered check scores the shipped crop against the best
   possible crop computed from bloom-marginals.json and fails when it is more than 3 percentage points of bloom mass
   worse.
3. The hub page.tsx may be edited ONLY if a structural change is needed (for example moving the countdown above the
   facts in DOM order); prefer CSS. Do not touch its data fetching, JSON-LD, hero copy or facts.
4. NosHero lede below 768 (Codi, final, all NosHero ledes incl. the symposium theme line): `font-size: 18px; line-height: 1.5; max-width: 60ch`, set once on
   `.nos-hero-lede` in the same max-width: 767px block; >= 768 untouched (the check compares computed lede sizes at 768 and 1280 with BASE). Reason:
   on /national-show/vendors/apply at 390 the 20px lede runs 5 lines and pushes the first form field to about y 740; at 390x844 Business name label +
   input must now be fully on screen one. The rendered check also saves 390 shots of the hub, /national-show/about (a long-form page) and vendors/apply.
5. Scrim: the stacked hero has none and stays that way.

## f7 — R33 [P2]: plan-your-visit tel links and the venue map button

Source: lead saoc-2b 2026-10-17 (R80/R63/R82/SEO lane); NOS Design R34/R33 sign-off 2026-10-17 (cite that exact string in the docs).
Findings on 47cf7f1b: plan-your-visit/page.tsx is NOT on F18a's LongFormPage (F18a left it alone), so f7 edits the page as it is today;
if the lead later moves it onto the template, the same two pieces carry over. Emergency contacts render as a `<dl>` of Cards:
`<dt>` label, `<dd className="font-serif text-[26px] ...">{contact.number}</dd>` (data seeded as 10111, 10177, 112). The venue card is
components/show/VenueCard.tsx (also used by the SAOC /contact page); its map link "Open in a map ↗" is a 12px underlined text link
(min-h 44px but a thin target) on `venue.mapsUrl`. components/nos/Button.tsx has no variant called secondary: its outlined variant is
`ghost`, which is what "secondary" means here; add no variant.
1. Each emergency number whose text is digits (+ and spaces allowed) becomes `<a href={`tel:${contact.number.replace(/[^\d+]/g, '')}`}>`
   inside the `<dd>`, keeping the large serif numeral, with a >= 44 x 44px target (`inline-flex min-h-[44px] min-w-[44px] items-center`).
   A number that is not phone-shaped stays plain text. No new copy.
2. VenueCard gains an optional `mapAction?: 'link' | 'button'` (default `'link'`, today's markup untouched so /contact is byte-identical).
   `'button'` renders the existing `Button` from components/nos with `as="a"`, `variant="ghost"`, `href={venue.mapsUrl}`,
   `target="_blank"`, `rel="noreferrer noopener"`, label `Open in a map ↗` verbatim, >= 50px (Button's own min-height). plan-your-visit passes
   `mapAction="button"`.
3. Hub/other routes: none touched. Footprint: plan-your-visit/page.tsx and components/show/VenueCard.tsx only (both also on f1's list: class-only R65 edits
   there stay valid, f1 does not touch the new `mapAction` markup).

### f7 rebuilt from the NOS v4 golden (lead 2026-10-17; goldens/f7-v4-plan-your-visit.html, structure only)
The page stays as it stands (not LongFormPage). From the golden: (a) "Getting there" with the venue card as an `<aside>` beside it from 1024 (the page wraps `<VenueCard>` in an `<aside>`; VenueCard stays a section so /contact is untouched), address plus the map action as a >= 44px button; (b) "In an emergency" as a dl whose numerals are Fraunces (font-serif), weight 300-400, >= 38px (clamp from 2.4rem), set ABOVE their label, each a tel: link; (c) "Be the first to know" present. The golden's copy is shipped only where it matches an existing source. NOT in our sources, so NOT shipped (listed for the lead): the ihero stand-first "Everything you need to get to the National Orchid Show and make a day of it. Travel and accommodation guidance ... confirm the final details."; "Travel, parking and accommodation guidance for the Stellenbosch Flying Club has not been worked out yet."; the three pending lines (Parking / Public transport / Where to stay sentences); "It will be published here once it is ready."; the venue card title "The Hangar, Stellenbosch Flying Club" and its paragraph; the emergency labels and numbers (Police (national) 10111, Ambulance and fire (national) 10177, All emergencies from a mobile phone 112 and its note); "On-site first aid and show duty contact" and "The committee will supply the on-site contact before the show." The emergency numbers on the page come from the Sanity `emergencyContacts`; if the CMS holds none, the section is empty and the rendered check fails as vacuous, which is the signal to load Lee-Ann's list. Note the golden's map action is a text link (uppercase, 44px, icon); the lead's brief asks for a >= 44px button, which the ghost nos Button satisfies.

## Docs
docs/nos-critique-r6.md gets one short section per feature: f2 cites R63, f3 R82, f4 SEO (FAQPage, BreadcrumbList) and
says offers/validFrom were not added and why, f5 R80. Each states its source (lead saoc-2b 2026-10-17).

## Red-on-base expectation
Every static and rendered check for f2-f5 must fail on BASE and pass on the implemented tree. f1's T1 was relaxed to a
presence check so the stacked nos-theme.css edits of f3 and f5 do not fail it.

## Superseded checks to record (lead)
contracts/checks/launch-weekend/f7/check-h-vendor-static.mjs line 36 requires the form to produce both "(required)" and "(optional)"; R82 removes "(required)", so that assertion is superseded by f3 (add it to F18's supersession.json). check-i-vendor-runtime.mjs in the same folder should be re-read for the same string.

## Load rule (Athanor, fleet-wide; lead 2026-10-17)
Playwright always runs with --workers=1 and only one suite at a time. Our rendered checks drive the Playwright library from one process (never the test runner), start `next start` through `_server.mjs` on 3010-3019 and kill it in `finally`. @dev: run the rendered checks one after another, never in parallel, and if you start `pnpm dev` or `next start` yourself, stop it by PID the moment you are done. Any e2e you run is `pnpm exec playwright test --workers=1`.

## Hub page.tsx is a shared f1/f5 file
Per the lead, the hub page.tsx body-type lines (the 16px `leading-relaxed` paragraphs near the hub "Three years in the making" section) are f1's (leading-[1.55]),
while f5 may edit its hero structure. They are different lines; apply both in the one stacked tree and let the footprint (hub on both lists) and each
feature's static check police its own lines.

## f9 — NOS chrome: utility bar and Search off, 44px targets, nav-config naming (lead 2026-10-17)
The one-row mobile header (R74 #7) was WITHDRAWN by Codi: it contradicts Brad's approved chrome decision #6. The earlier f9 work, including the v13 reference CSS, was thrown away.
Source: Brad chrome decision #2 and #6 (2026-10-15), via NOS Design 2026-10-17, from the NOS v4 pack (read only, /Users/vetus/ai/SAOC/.agent/memory/project/specs/launch-weekend/goldens/nos-v4/), quoted verbatim:
- DESIGN-PACK.md: "2. Search and the SAOC utility bar are left off NOS pages, at every width." and "6. Phone header: two rows, not sticky, lockup 390px wide (6.27px cap) so the logo stays legible."
- handoff/HANDOFF.md "Approved decisions (Brad, 2026-10-15)": "2. **Left off NOS pages:** Search and SAOC's utility bar." and "6. **Phone header:** two rows and not sticky, so the logo stays at 390px with a 6.27px cap."
- HANDOFF header: >=700px "position: sticky ... The bar is 97px tall."; <=699px "Two rows ... The bar is 146px tall. Not sticky (position: relative)". Targets: "every link, button and input is >=44x44px. The only exceptions are inline text links inside running copy."
Footprint: components/nos-chrome/NosHeader.tsx, nos-chrome.css, NosFooter.tsx (NOS only), components/chrome/UtilityBar.tsx (NOS variant only), components/chrome/nav-config.ts. NOT ChromeFrame.tsx, globals.css, Header, Footer.
Dev order: f2, f3, f4, f9, f5, f1. After f9 the 46px utility bar is gone, so f5 re-measures: Tickets bottom <= 828 at 390x844 with the photo as close to 300 as that allows (floor 220).

1. Utility bar: the NOS variant of UtilityBar returns null (`if (isNos) return null;`), no wrapper, no reserved height. app/(marketing)/layout.tsx keeps passing variant="nos", unchanged. The SAOC path is byte-identical.
   Search: the NOS header has none in the source; assert there is none (no role=search, no search input, no control named Search).
2. Header geometry is NOT changed: >=700 is 97px, sticky, top y=0 now (the bar above it is gone); <=699 is 146px, two rows, position relative, scroll-padding-top 0. Geometry relative to the header and pixels are compared with goldens/f9-baseline.json (captured from BASE: `node checks/check-rendered-f9.mjs --capture`, refuses if the f9 files differ from BASE).
3. Targets (at 390 and 1280; the open drawer at 390; the open mega-menu at 1280): every a/button/input in the NOS header and footer is >= 44px high, icon-only controls 44x44; inline links inside running copy are exempt. Satisfy with padding or min-height, never by changing the type size. If a measured shortfall is found (the lead measured "Open menu" 38px and footer links 24px on an older build; on the current source .nh-burger, .nf-list a, .nf-legal a, .nf-wild a already carry min-height 44px), fix only what the rendered check reports.
4. nav-config.ts (f9 is the only lane editing it): exactly four lines. leadLabel "19th SAOC National Orchid Show" -> "19th National Orchid Show"; the Symposium descriptor -> "The National Orchid Show Symposium — what it is, its theme, and who it is for."; rail Day Visitor href -> /national-show/tickets#ticket-day, Weekend Pass -> /national-show/tickets#ticket-weekend (F18b supplies the ids later; assert the href only). Both surfaces (1280 mega-menu, 390 drawer) render the new strings and none of the old.
   WARNING for the lead: nav-config.ts is SHARED with the SAOC header (MegaMenu.tsx, MobileMenu.tsx read leadLabel and the rail). The SAOC mega-menu and mobile menu will show the same new strings; only the closed header is pixel-compared, and the SAOC markup comparison maps the four strings back. f4's BreadcrumbList reads nav-config LABELS (not leadLabel, descriptors or rail hrefs), so f4 is unaffected.
5. Superseded by this change (dev amends in-branch and lists each): launch-weekend f12 check-i-utility-bar.mjs, check-h-utility-render.mts and check-a-static.mjs (they require the bar on NOS pages), launch-weekend f11 nos-menu-baseline.json and check-f11.mjs, f16 check-f-cards.mjs and check-e-testmode.mts, f17 check-c-nav-labels.mjs, nos-own-brand-chrome check-l-hub-h1.mjs, f3/check-f3-audit.mjs and check-static.mjs, e2e/mega-menu-layout4-visual-fidelity.spec.ts and mega-menu-f8-logo-and-tickets-rail.spec.ts wherever they pin the old strings, the old rail hrefs or the NOS utility bar.
6. v4 conflicts for the lead (rulings dated after 2026-10-15 override v4): HANDOFF decision 3 and 7 carry "19th SAOC National Orchid Show" (superseded by the naming above); hub h1 "National Orchid Show", CTAs Tickets + Plan your visit and no hub index override index.html (f1/f5 do not touch the hub copy). f5's hero is judged against v4 index.html only for the stacking order; the 220-300px photo, 18px/1.5 lede and the fold rule are later rulings.
Load rule: Playwright one suite at a time, single worker; the check stops its server by PID.

## Lead amendments 2026-10-17 (late)
- f9 naming: in nav-config the substring "SAOC Symposium" becomes "National Orchid Show Symposium" (it occurs once, at the Symposium descriptor on 47cf7f1b line 216, not 215/217); no "SAOC Symposium" may remain in nav-config and both menu surfaces render the new name. Other files are F18's sweep.
- f4 single source: faq/page.tsx computes ONE derived list, hands it to <ShowFaqList faqs={...}> and derives the FAQPage entries from that same list (no second sort or filter). Static asserts it; rendered asserts FAQPage question set and order equal the visible set and order in BOTH modes (beta wall on, and public via startServer({ publicMode: true }) with the wall env emptied).
- f1: vendors/apply is back in the rendered enumeration; its intro (VendorApplyForm REQUIRED_SENTENCE, now text-[15px]) is prose and goes to 16px/1.55. VendorApplyForm.tsx is added to f1's footprint (f3 also lists it).
- f5: below 768 the INNER photo heroes take exactly 220px at the same measured focal points (bloom scoring uses the actual box); the hub keeps 220-300 aiming for 300 with Tickets bottom <= 828; the "photo under 300 while 300 fits" rule is hub only. Screen one (sub-nav plus first content line above y=844 on plan-your-visit, symposium, vendors/apply at 390x844) is check-rendered-f9-screen-one.mjs, contract-f9 A7, green only once f9 and f5 are both in the tree.
