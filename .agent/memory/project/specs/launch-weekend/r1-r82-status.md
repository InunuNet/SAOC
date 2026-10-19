# R1-R82 design-review ruling status (saoc-nos-design-cb)

Built 2026-10-17, read-only, from backlog.md (l.1900-2258), comms.md, specs/launch-weekend, nos-design-rulings.md, NOS-DESIGN-FINAL-2026-09-10.md, `git log main`, `git log --all --grep`, and `git grep` on `main` (HEAD 76ad8b98 = F17).

Status vocabulary: DONE / IN FLIGHT / NOT STARTED / SUPERSEDED / WITHDRAWN, plus two the lead did not list: PARTIAL (some sub-items done, named remainder open) and UNTRACED (the ruling's text is not recorded anywhere in the repo; cannot be classified). Row status is the headline; sub-item detail is in the Evidence column.

IMPORTANT main-vs-branch fact: F18a (538faab8, merge 47cf7f1b) lives on `feat/lw-f18-longform` and is NOT on `main`. Everything marked IN FLIGHT (F18a) is built-but-unmerged or unbuilt. F19 and F18b have no committed contract in the repo yet (F19 spec lives in `.tmp/sandbox/wt-lw-f19-spec`, `spec/lw-f19` has only F17 rulings).

Source caveat: R1-R19 are the Codi NOS rulings (mirror is stale, per NOS-DESIGN-FINAL). R20-R23 are logo rulings (menu-system-layout4 goldens). R24, R28, R30, R50 and R82 have no recorded text in this repo.

| id | page / surface | one-line ask | status | evidence |
|---|---|---|---|---|
| R1 | NOS chrome | NOS keeps SAOC structure, only identity changes | DONE | Standing rule; partly overridden by R17. NOS own-brand chrome fd8a4fc0 (F1) on main |
| R2 | NOS controls | Pill radius only for eyebrow chips | DONE | Standing; R17 keeps it. fd8a4fc0, F3 b72fb435 |
| R3 | NOS hero | Name in type, emblem not headline | SUPERSEDED | Reversed: lockup IS the h1 (NOS-DESIGN-FINAL l.31); 3d1722b7, d424e71f |
| R4 | NOS heroes | Fix collisions by crop, never scrim | DONE | Standing; mobile flat scrim 8e14c39d |
| R5 | NOS photos | No duotone/opacity on photographs | DONE | 0e63f151 removed opacity photo cards; F3 imagery check |
| R6 | Transactional pages | Functionally fixed, not visually frozen | DONE | Standing; invalid-link state plain per R6/5 |
| R7 | All NOS copy | No invented copy | DONE | Standing; fb23f1b4, efb59feb, 0e63f151 removals |
| R8 | Status colour | Declared functional colours | DONE | Standing; ticket status tokens F16 41a7a08f |
| R9 | NOS focus | Solid outline ring | DONE | Standing; 25f4831d, 5f1a2725 |
| R10 | NOS hero scrim | Gradient with transparent end | SUPERSEDED | By R15 near-black ramp (NOS-DESIGN-FINAL l.40) |
| R11 | Unconfirmed copy | One disclosure anatomy, exact wording | DONE | e2bb0095, f3bf39dd (gap block) on main |
| R12 | NOS menu/header | Retire canvas SiteHeader, click-only disclosure | DONE | fd8a4fc0; R40 317de6b9 |
| R13 | Card grids | Column count follows item count, no orphans | DONE | 0d391fb7 (VISITOR_CARDS) |
| R14 | NOS type | Fraunces + Karla; Cormorant/Jost wordmark-only | DONE | 575668ed, fd8a4fc0 |
| R15 | NOS hero scrim | Near-black #0B0A14 single ramp | DONE | 22f6ed76, 8e14c39d; F2 A13 |
| R16 | NOS imagery | Never reuse one photo for different things | DONE | F3 hero-photo-map (b72fb435), archive 0e63f151, F16 drops card photos 41a7a08f |
| R17 | NOS radii/shadow | 10px controls, 16px cards, shadow not borders | DONE | fd8a4fc0 chrome v4; F16 |
| R18 | Empty listings | Sponsors/exhibitors/guests designed empty state | DONE | c7ba982b (sponsors G2) |
| R19 | Disclosure | Disclosed extent is one surface | DONE | e2bb0095 |
| R20 | Logo files | Branding folder is only logo source | DONE | b1e31112 (doc); lockups from branding/ used in fd8a4fc0 |
| R21 | Mega-menu lead | Lockup lead block, no plate | DONE | db2d268f (F8) |
| R22 | Logo serving res | Min rendered width on raster lockup | WITHDRAWN | Withdrawn in full 2026-09-21 by NOS Design (menu-system-layout4 contract-f8) |
| R23 | Lockup | Emblem never beside typeset name | DONE | 3d1722b7, menu F8 |
| R24 | unknown | text not recorded | UNTRACED | No occurrence in repo, comms or git log |
| R25 | NOS og card + no mono | NOS og:image 1200x630, no monospace on NOS | DONE | `app/(marketing)/national-show/og/route.tsx` exists on main (F3 b72fb435). No-mono not grep-verified |
| R26 | SAOC header | Tickets as header CTA, Contact into nav | SUPERSEDED | Shipped ff1a7e18, then removed on Brad's direction by F13 5fed5450 |
| R27 | NOS hub + sub-nav | One hub destinations list, group sub-nav under hero | DONE | `components/nos/NosSubNav.tsx` on main; F3 b72fb435 |
| R28 | unknown (F3 cites R26-R29 + C1/C2 container/rhythm) | text not recorded | UNTRACED | F3 spec lists R26-R29 together; C1/C2 landed in F3, not separable |
| R29 | NOS heroes | Typographic heroes, one stock photo per route | DONE | F3 b72fb435, hero-photo-map.json |
| R30 | unknown | text not recorded | UNTRACED | No occurrence in repo |
| R31 | /national-show/tickets | Ticket choice on first screen, rows, per-row prices | DONE | F16 41a7a08f (audit PASS). Open: duplicate SKU naming = Brad/Lee-Ann data flag |
| R32 | /vendors/apply | Field border, labels, autocomplete, inline errors | DONE | F7b b4e75248, 68be02ac; `autoComplete` present in VendorApplyForm/VendorFormField on main |
| R33 | /plan-your-visit | One R11 panel, venue first, map button, tel: links | PARTIAL | Design-cb "Plan-your-visit PASS" (R76). `tel:`/10111 links NOT found on main (git grep). Untagged priority |
| R34 | /exhibitors | R11 status, jump nav, stepper, 9.5k px page | PARTIAL | G2 caption F17 091b8ce5; F18a for duplicate TBC rows. No jump nav / `<ol>` stepper / sticky rail on main. Untagged priority |
| R35 | Presenter cards | Title/name at card-title role | DONE | ea9056ad (critique-r2) |
| R36 | NOS headings/skip link | Heading margins, skip link NOS look, .pc-title | DONE | 539124ad, 0ec591f1, b9792f16, 07e09ef3 |
| R37 | /archive | Typographic hero, hairline figure row, 65ch about | NOT STARTED | Deferred: "apply once real records exist" (backlog l.2023). Content-blocked, no P tag |
| R38 | /archive | Dedupe XVIII/back links | NOT STARTED | Same as R37, content-blocked |
| R39 | /symposium presenters | Clamp bios 4 lines + disclosure | DONE | 07e09ef3 |
| R40 | NOS mobile menu | Opens National Show section, labelled nav | DONE | 317de6b9 |
| R41 | /national-show/faq | Badge placement, "When is the show?" first, chevron, FAQPage JSON-LD | IN FLIGHT | F18a (branch, unmerged) for badges/chevron/hide unanswered; FAQPage JSON-LD absent on main (git grep) = SEO item in nos-critique-r6 |
| R42 | SAOC home hero | Pause control, reduced motion, labels, scrim | DONE | F7a 943fd2e3 (pause, reduced-motion in Hero.tsx). Scrim half moved to R64/R79 (F19) |
| R43 | NOS body floor; SAOC 13px prose | 16px floor | DONE | NOS 07e09ef3. SAOC 13px prose folded into R65/R72 (F19). 17px asks WITHDRAWN |
| R44 | FAQ chips, presenters jump | Category jump chips, symposium jump link | DONE | ee366553 (A3), 07e09ef3 (A5) |
| R45 | /societies | Result count, search label/border, counts removed | DONE | F7c 649b2433 |
| R46 | /judging | Real h2s, ranked order, ladder table | DONE | F7c 649b2433. (Separate R72 judging layout open = F19) |
| R47 | /events | NS row link (P1), Event JSON-LD + time (P1), compact hero, label | NOT STARTED | P1. No `national-show` link / JsonLd / `<time>` in events/page.tsx on main; `eventJsonLd` only used in events/[slug]. NB id collision: F7c contract uses R47 for footer newsletter (done 649b2433) |
| R48 | /members | Move off primary nav; dup Contact; hero | DONE | Members link hidden by F17 091b8ce5 (Brad confirmed). P2 dup "Contact SAOC" (members/page.tsx:44,69) still there |
| R49 | SAOC /about | Six TBC committee h3s -> one status line (P1) | NOT STARTED | P1. BoardGrid.tsx:26 still renders h3 per member; lib/data/board.ts placeholders on main. 68ch + "EST." items WITHDRAWN |
| R50 | unknown ("state-before-promo" pattern) | text not recorded | UNTRACED | Only reference is backlog l.2066 |
| R51 | Show pages (P0) | Withhold AI placeholder prose in public | DONE | F8 f3bf39dd, 2f163899, 2e8cf4d2, 6de27b21 |
| R52 | /faq chips | Outlined FAQ chips | DONE | 6af92875 |
| R53 | /workshops | Ozow test-mode (P0), stock photo, rows, total, h3 | PARTIAL | Photos gone + admin-only test strip F16 41a7a08f. Rows/total/h3 = F18b IN FLIGHT. P0 go-live toggle: Brad flips himself; proposed hardening + gate assertion NOT STARTED (needs contract) |
| R54 | /conferences | Delete stale "Joint" clause (P1), row links (P1), scope chip, label | NOT STARTED | P1. "SAOC/WOSA Joint" still at conferences/page.tsx:21,35 on main AND on feat/lw-f18-longform; F18 spec l.58 deliberately left it verbatim (Lee-Ann list). Row links to /symposium,/wosa-conference not found |
| R55 | SAOC /contact | Field border (P1), describedby (P1), autocomplete (P1), button height | NOT STARTED | P1. No autoComplete name/email in ContactForm.tsx on main (only an "off" at :157). Button contrast already fixed |
| R56 | /national-show/vendors | Hero vs empty-state contradiction (P1), label unify (P1), CTA placement | IN FLIGHT | F18a long-form on /vendors (branch). "Meet the specialist nurseries" lede still at vendors/page.tsx:27,49 on main. Label = Brad wording call. 68ch WITHDRAWN |
| R57 | /national-show/about | Lift theme pull-quote (P1), closing CTA, 17px | IN FLIGHT | F18a = R75 template (branch). 17px superseded by R65 |
| R58 | SAOC /sponsors | h1 with zero partners (P1 content), figure provenance, subject param | NOT STARTED | Content-gated (Lee-Ann/Brad decision "leave placeholders"). h1 "The partners behind SAOC" still at sponsors/page.tsx:45 |
| R59 | /wosa-conference, gap sentence | Registration link (P1), delete gap sentence (P1) | PARTIAL | F8 PASS on main. Registration link NOT STARTED (none on main; F18a holding state keeps only WOSA link-out). Gap-sentence wording = Brad/Lee-Ann (F8b) |
| R60 | SEO sweep | Unique descriptions on 6 SAOC pages (P1), lengths, NOS titles, JSON-LD | IN FLIGHT | nos-critique-r6 SEO. On main judging has only `title`; noindex traced to launch flag (go-live checklist) |
| R61 | Perf /national-show | minInstances (Brad), preloads (P1), fonts | PARTIAL | minInstances: 1 DONE (96129578, apphosting.yaml:5). Preload/font cleanup not evidenced (P1); hero `priority` present |
| R62 | /tickets/* chrome | NOS chrome on product routes (P1), dates, total, photo | IN FLIGHT | F18b with R81. ChromeFrame switches only on segment `national-show`, so /tickets/* still SAOC chrome. Not yet built |
| R63 | NOS 404 | NOS-scoped not-found | IN FLIGHT | nos-critique-r6. Only app/not-found.tsx on main. P2 |
| R64 | SAOC hero scrim, casing | Brief scrim, sentence-case buttons | IN FLIGHT | F19. Hero.tsx:129 "Find Your Society" still on main |
| R65 | Body type both sites | 16px/1.55 | IN FLIGHT | F19 (SAOC side) + nos-critique-r6 (NOS). globals.css:230 still 1.65 on main |
| R66 | SAOC-header Show mega-menu | Fits viewport, matches NOS menu | DONE | F11 422d8ca1, e9f7d4f9 |
| R67 | NOS hub hero CTAs | Exactly Tickets then Plan your visit | DONE | 3cd3d603 (F3 A27) |
| R68 | NOS hub hero | Re-layout, h1 "National Orchid Show" | DONE | F12 b6ab65b0 |
| R69 | NOS hub index | Grouped "Explore the show" | DONE | F12 b6ab65b0 (hub index later removed by R74 #2, in F18a) |
| R70 | /symposium + template | h1, theme line, shared template, 1280 grid | DONE | F12 b6ab65b0 |
| R71 | NOS axis | One header/section left axis | DONE | F12 (audit PASS on 17 routes), 36d1661e |
| R72 | SAOC wide sweep | Shared axis, /judging grid, 16px prose | IN FLIGHT | F19 |
| R73 | Naming sweep | "SAOC National Show" -> "National Orchid Show" | DONE | F17 091b8ce5 (audit PASS 76ad8b98) |
| R74 | NOS hub/footer/menu polish | Members hidden, sentence case, gaps, nbsp, descriptor | DONE | F17 091b8ce5 #1,#3-#6. #2 hub NosShowIndex removal = F18a (IN FLIGHT). #7 one-row mobile header PARKED |
| R75 | /national-show/about | Long-form template, lede, sticky pull-quote | IN FLIGHT | F18a 538faab8 on feat/lw-f18-longform, not merged |
| R76 | Empty show pages | Designed holding state, R76b ledes | IN FLIGHT | F18a, same branch |
| R77 | NOS sweep | #1,#2 explore index, key-dates; #3,#5,#6; #4 catalogue rows | IN FLIGHT | #1,#2 DONE F17; #3,#5,#6 F18a; #4 F18b |
| R78 | Long-form, FAQ, archive | Shared template, FAQ icon, archive card | IN FLIGHT | F18a |
| R79 | SAOC home | Scrim, CTA casing, events label, yearbook band | IN FLIGHT | F19 (EventsStrip.tsx:48 "Upcoming society shows" still on main) |
| R80 | Mobile heroes | #1 NOS hub image-first (P1); #2 SAOC home hero gap/CTAs | IN FLIGHT | #1 nos-critique-r6 (P1); #2 F19 |
| R81 | /tickets/day-visitor | ISO dates, disabled-Buy reason, scrim, total | IN FLIGHT | F18b with R62 |
| R82 | Vendor apply | text not recorded in repo | IN FLIGHT | nos-critique-r6 per lead; no repo record to verify scope |

## NOT STARTED, P1 or above (the gaps)

| id | priority | item | note |
|---|---|---|---|
| R47 | P1 x2 | /events: National Show row as link; Event JSON-LD + `<time>` | Not in any in-flight feature per the lead's list |
| R49 | P1 x2 (1 withdrawn) | /about six TBC committee h3s -> one R11 status line | Not in F18/F19 |
| R54 | P1 x2 | /conferences Joint clause; row links | Joint clause deliberately left by F18 spec l.58; row links F18b-adjacent but unassigned |
| R55 | P1 x3 | /contact field border, describedby/status region, name+email autocomplete | "Needs contract", never queued |
| R59 | P1 | /wosa-conference link to registration | F18a holding state does not add it |
| R53 | P0 launch-gate | Ozow toggle hardening + gate assertion | Brad flips at launch; hardening unbuilt |
| R58 | P1 content | /sponsors h1 with zero partners; placeholder figures | Content-gated, Lee-Ann/Brad |
| R33, R34 | untagged | tel: links + map button; exhibitors jump nav + stepper | Queued "after F3", never picked up |
| R37, R38 | untagged | archive layout | Content-blocked (no real records) |

PARTIAL items whose open remainder is P1: R59 (reg link), R61 (preloads), R53 (above).
