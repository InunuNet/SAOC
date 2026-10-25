# nos-content-standard: research, decisions, blockers

## 1. Brad's words (verbatim)
- /faq: "This frequently asked questions page is fuck ugly. There's no hero image. Look at those scrappy little buttons in the menu system. It's horrible. Fucking use your design skills and do this properly."
- /plan-your-visit: "Same thing for this plan your visit. What's going on with the copy? It's all squashed to the left. You need to make a standard that every document is built against. We can't have every document and every article and every page looking different. That's just piss poor."
- /what-to-expect: "It's a huge waste of space on the page. Like if you look between the hero image and the dates and stuff like that, those dates and things and the leading info should appear on the hero image. I shouldn't have to scroll down to find information. We should fit the most important information in the first screen that loads."
- /international-guests: "Again, no hero image. Most important information could be shown straight up top for this page, but we have a big blank empty band of nothing. Load your design skills... get your design shit together and fix these."

## 2. What the live page does today (critique `.tmp/sandbox/nos-content-critique/assessment-b.json`, nos.saoc.co.za, 2026-10-25)
/about at 1440: no hero image; first content 120px below the sub-nav; h2 and h3 are Karla 12px 600 (an eyebrow style) beside a Fraunces 300 h1; prose column 712px at left 581px (so the page is not squashed, but is unframed); two `div.nos-hero-copy` flagged as duplicate h1 containers. The route table is still provisional: `assessment-a.md` (design review) has not landed.

## 3. Findings carried forward from the first pass
- #76 (`feat/nos-pagehero`, read with `git show`) already maps `/national-show/faq` to crop H4b and sets FQ7 (64px >= 768, 40px < 768). DS-1 r2 replaces the split panel with the full-bleed `.ihero` and sets the gap to **64 at >= 1024 and 48 below**. **Conflict for the lead: 40 vs 48 (and 64 vs 48 at 768-1023).** The contract follows DS-1 (it wins) and retires the #76 clause.
- `ShowJumpChips` stays (exhibitor and media-kit nav). Frozen `nos-critique-r4/r5` keep: nav name `FAQ categories`, link text equals h2, `#faq-<id>`, 44px, scroll-margin, focus ring, no smooth scroll; their chip LAYOUT clauses are retired.
- Gate pattern: `execution/heartbeat_wrap.sh`, own `next start` port, kill by exact child PID, refuse a busy port.

## 4. BLOCKERS (not resolved by me; assertions are written to fail loudly until they are)
**B1. Drive store.** `content/drive-source/` is untracked on every branch and this checkout holds no 24 Oct version. Versions the architect actually read: About 2.1 v1.1 (7 Oct), What to Expect 3.1 v1.1 (7 Oct), SA Exhibitors v1.0, Contact v1.0 (a placeholder: "www......", "Email......"), FAQ 17.1 v1.0 whose `source.docx` is corrupt (`content.md` is the string "[ERROR] Invalid or corrupted zip file"). No Plan Your Visit document exists in the store. Gaps: plan-your-visit, international-guests, exhibitors, vendors, programme, workshops, symposium, wosa-conference, conferences, sponsors, archive, privacy, terms, refunds. The lead says the 24 Oct versions of FAQ (edited 18:59 UTC), PYV, WTE and About exist: they must be synced into the project tree (`execution/drive_docx_sync.py`, gws) before the dev starts. The route table records the version per route; the verbatim gate reads `drive.path` and fails on a missing file, an `[ERROR]` body, or a zero-length body. Update `goldens/route-table.json` `drive.version` and path when the sync lands (this is an architect-frozen file: re-run the sha step).
**B2. Photo supply at 2056@2.** See D2.
**B3. Key facts.** The synced docs hold prose; dates and hours are Sanity show data. D3 holds the per-route list as slots.

## 5. DECISION slots (NOS Design unless stated)
**D1. Crops (contact sheet signed off by eye before build).** `goldens/crops/contact-sheet.html`, proposals in `goldens/crops/crop-proposals.json`. Cleared originals only (`public/images/orchid-*.jpg`; the Ormerod set is not cleared). K1 violet left spray (FAQ), K2 purple buds and pale lower bloom (About), K3 dark speckled stem (proposed SA Exhibitors), K4 violet right buds (proposed spare). Each is >= 4300px wide, so it passes need 4112 (2056@2) and 1170 (390@3). K1 and K4 share the centre bloom's petals, which "no shared bloom" forbids, so bloom-distinct supply is **three crops (violet, purple, dark)**. Existing #76 crops are not reusable at 2056@2 (all narrower than 4112 except S2a, 4400px, which is the centre bloom).
**D2. Sharpness basis (NOS Design) and photography (Brad).** The ruling's basis, a full-bleed hero at 2056@2, caps supply at three bloom-distinct crops against 19 routes. Recommendation: both of (a) Brad supplies more cleared photography for the rest (the list is the `photo: null` rows), and (b) the basis becomes the hero's capped width, the 1384 axis, so need at 2056@2 is ceil(max(1384, boxH x aspect) x 2) about 2768; pink (3456w) then also qualifies and supply becomes four sources. Until answered the gate is written for the ruling as given (`standard.json` `hero.sharpness.basis = "full-bleed"`) and each `photo: null` route prints as NEEDS PHOTO.
**D3. Hero key facts per route (NOS Design sign-off; the lead and SAOC fill `keyFacts` in the route table).** Each entry is `{label, value source}`; values are read from the source at render, never typed. Proposed sources: What to Expect: show dates, opening hours, price headline (`lib/data/show-facts` and the cheapest-admission loader the hub already uses); Plan Your Visit: venue name and town (show-facts); About: show dates and the venue; FAQ: none (the lede carries the marker explanation); Contact: the enquiry address when the Drive doc has one (it is a placeholder today); other routes: none until a Drive doc or Sanity field supplies one. A page with none gets no row.
**D4. Scrim for facts.** DS-1 states the v4 scrim does the legibility. The gate measures >= 4.5:1 on the photo pixels behind each fact; if a crop fails, the options are an existing-token gradient stop or a different focal point, not a new colour.
**D5. FAQ source of truth (lead).** The FAQ rows render from Sanity (`showFaq`) and `lib/data/faq-sections.ts` (12 sections, Lee-Ann's earlier doc). The 24 Oct Drive doc has 13 categories. Verbatim then needs a content update the dev cannot make without a Sanity write. Recommendation: the dev regenerates `content/show-pages/17-faq.json` and `scripts/seed-show-faq.ts` from the doc and `faq-sections.ts` from its headings, and the lead runs the seed; the verbatim gate runs against the preview of that seeded dataset.
**D6. Gap value.** 64/48 (DS-1) against #76's 64/40: the lead confirms DS-1.
**D7. Mobile aside.** DS-1: an index aside becomes the sub-nav scroller pattern, sticky under the header once the Visit sub-nav scrolls away. The header is not sticky below 700px, so "sticky under the header" means sticky at `top: 0` there; NOS Design confirms.

## 6. Follow-up (out of scope, noted)
The SAOC (non-NOS) site should adopt the same document standard later (its legal and about pages and `PageHero` routes), mirrored against SAOC tokens.

## 7. Reading done
`craft-floor.md`, `layout.md` and `mode-read.md` read in full. Encoded: the craft-floor bans (eyebrow, coloured side border above 1px, nested and equal-size cards, hard shadows, gradient text, mono as costume, glyph icons) in `standard.json` `bans`, checked statically and in the browser; the layout rules (reading order equals DOM and focus order, one grouping by proximity, targets >= 24/44, a real measure) as gate checks; mode-read's "calm column inside a world-owned frame" as the F1 shape. The measure range is 55-75ch (craft-floor 65-75; DS-1 sets 60ch). `mode-persuade.md`, `new-work.md` (62 KB) and `frontend-design/SKILL.md` were not read in this pass; DS-1's ruling already fixes the world, so none of them can override it, but the read is owed before the dev starts. `.claude/skills/impeccable/scripts/impeccable` (the `detect --scope layout` binary) is not installed in this tree, so no assertion depends on it.

## 8. Update 2026-10-25 (Drive store synced, ruling c applied)

**B1 (Drive store) and B2 (photo-width basis) are resolved.** Frozen copies live in `goldens/sources/` and are sha-verified by the gate (`checks.sha256`).

| route | Drive doc | version | sha256 |
|---|---|---|---|
| /about | About | v1.2 | bb431853bdafec3bddd130cc031c0f3a8ea53da5265a2357826d7bdee5a67837 |
| /what-to-expect | What to Expect | v1.0 | aeadd29ec3ef6f332d0e89e7cb2f4d26b69acbbef47bfc969ad9233e488c6bfe |
| /plan-your-visit | PLAN YOUR VISIT | v1.0 | 49dfa05546909299eafacb7cd6deb1f1e6896664c6b552c7cf7925db5215076b |
| /faq | Frequently Asked Questions | v1.0 | a35ca3ad1779cb22bc8eb14355abfeb61c41ad485dde786fbe0e98c916f1f4b5 |
| /contact | Contact | v1.1 | c7144cfedad11bcbc0943bf750f94a3e3414b98f1c81c7a86ff8b5e174998406 |
| /sa-exhibitors | SA Exhibitors | v1.1 | bd5020ac5e40ff767879d13d9c3fb87d6fc0c727a302886e23e31b7463a4707d |

Struck text (`~~x~~`) is deleted and never rendered; the gate asserts its absence (What to Expect 12 spans, Plan Your Visit 6). The old 17.1 FAQ stub is corrupt and ignored.

**Sync tool gap (lead files against the harness).** `execution/drive_docx_sync.py` skipped the folders "Privacy/Terms" and "13. Registration/Booking/Tickets" because the names contain "/". Privacy and Terms are verified by SAOC, so this spec asserts nothing new on them. Registration/Booking/Tickets has no frozen source, so no verbatim assertion exists for it.

**Photo width (ruling c).** Photo box 38%-100% at >= 1024, left 38% `--black`, scrim remapped across the box, stacked full width below. Need is about 2550 at 2056@2 and 1170 at 390@3; both width-driven and height-driven need are asserted. Eight 2600-wide crops (V1 V3 P1 D1 PK1 PK2 PK3 Y1) serve 19 routes with 11 cross-group reuses logged by the generator (never a repeat inside a group). V3 is flagged for the centre bloom's top tip. A10 still needs `goldens/crops/NOS-DESIGN-SIGNOFF.txt`, created by the lead after NOS Design clears the in-situ sheet (`.tmp/sandbox/nos-content-standard/crops-c/contact-sheet.html`).

**Key facts per route (DECISION slots, recommendation).** What to Expect: dates, hours and price headline from `lib/data/show-facts`. Plan Your Visit: venue and town. Others: facts only where the page's own Drive doc states them; no typed values; opening hours stay as Sanity has them.

**Sanity edits for Brad/SAOC (no assertion requires them).** What to Expect: struck cloakroom block and `expectIntro`. Plan Your Visit: invented `planIntro` lede, appended directionsNote sentence, emergency chip label. FAQ: `faqIntro` (struck in her doc), the appended price list under Q10, and the invented contact note if Sanity-held. If a Sanity-held string trips a strike-absence assertion before Brad edits it, the lead adds a `strikeAbsenceExempt` entry to the route table and re-freezes `checks.sha256`.

**Other notes.**
- Corrected: the frozen FAQ doc has 12 categories (counted in goldens/sources/faq.md), the same count as `lib/data/faq-sections.ts`; names and order may still differ; D5 seed update is the lead's.
- The nav label becomes "Plant Entry/Registration" (`nos-nav.ts:147` and every reuse); asserted by `mustPresentNav`/`mustAbsentNav`.
- Gap under the sub-nav: DS-1 says 64px at >= 1024 and 48px below; #76 has 64/40. DS-1 wins; the dev edits that one rule.
- The lead's full copy audit `.tmp/sandbox/leeann-1025/audit-report.md` does not exist on disk; the F3 fix list encodes the lead's message only.
- Skills not read: mode-persuade, new-work, frontend-design/SKILL.md. The `impeccable` detect binary is not installed.
- Follow-up: propose the same standard for the SAOC site.

## 9. Revision 2 (2026-10-25): rulings folded in, shared API pinned

**Base and precondition.** Dev branches from the #76 tip (`feat/nos-pagehero`, paths `app/(nos)/`) and merges SAOC's shared API at `b2cff780` (`origin/feat/saoc-content-standard-2026-10-25`: `components/ui/{DocumentLayout,DocumentIndex,PageHero}.tsx`, `lib/hero-facts.ts`, `.doc-*`/`.hero-facts` in `app/globals.css`; golden `specs/saoc-content-standard/goldens/shared-api.md`). NOS consumes and never edits `components/ui/**` (A2/A3). SAOC's gate files (`standard.json`, `gate-standard.mjs` on that branch) are not on this tree yet; A7 should reuse their checks with the NOS route table once they land. Status: pinned, not yet reused.

**NOS component API (matches SAOC names; confirmed by shared-api.md section 6).** `HeroFact {term, value}`; `normaliseHeroFacts()`; `NosHero` takes `facts?: readonly HeroFact[]` and renders `dl[data-hero-facts][data-fact-count] > [data-hero-fact] > dt + dd`; `DocumentLayout` props `children`, `aside` (content kind) XOR `index` (`{id,label}[]`), `id`. NOS token mapping: container 1384, h2 `.nos-theme` clamp / 300, card radius 10 + `--shadow-md`, dd `--gold-100`, dt lilac, active link royal + green-1 underline. Change requests to SAOC (none yet): NOS needs `aside` sticky `top: 100` (SAOC 112) and scroller top `env(safe-area-inset-top,0)` under 700 via CSS custom properties only; if the shared CSS hard-codes them, that is a request, not a local edit.

**Conflict flagged.** `buildShowFacts()` (`lib/data/show-facts.ts:27`) returns filler ("Dates to be confirmed", "Venue to be confirmed", "Host region to be confirmed"). `HeroFact` has no TBC field, so a TBC fact must be omitted, not passed. If NOS Design wants "Dates to be confirmed" shown, that needs a ruling and an API request to SAOC.

**PYV facts proposal (to NOS Design before the build).** Dates (published show data), Venue (`venue.name`, published show data), Town "Stellenbosch" (her line 7, "will take place in Stellenbosch"). Three items; the doc states no hours or price. `keyFacts` stays null until signed off.

**Doc vs message.** PYV-1 said six numbered h2; frozen v1.0 has seven ("7. Make the Most of Your Visit"). The gate asserts the seven in her doc. Her lines after "Start planning your visit today" (admin sections, the struck "Stay informed") are out of scope.

**Brad's rulings recorded verbatim (design inputs).** FAQ chips: "...funny round bubble buttons that are all touching each other and overlapping... There's no design effort in that at all..." (target: R44-A3 chips, `ShowFaqList.tsx`; design README:136 allows 999px radius only on the eyebrow pill). /programme: "Massive waste of space under the word program... Are we trying to make all the users infinitely scroll?" /workshops: screenshot at about 2000px, same complaints (about 115px gap, `Programme` h2, legend chip). /plan-your-visit: the narrow left column with the right half empty.

**Before-baseline (assessment-a.md, beta = origin/main without #76, admin preview session).** Measured gaps under the sub-nav 120-163px; five distinct h2 sizes; /about h1 reads "The National Orchid ShowWestern Cape 2027" (sr-only " - " plus glued subtitle); /international-guests first h2 repeats the h1; exhibitors has a 26-chip wall; h1 ring from `nos-theme.css:257` `.nos-theme :focus-visible:not(.group)` (0,3,0) beating `[data-route-focus]:focus` (0,2,0), fix by `:where()` (in #76; A2 only checks the wrap). 17/32 critique pass.

**Sanity edits for Brad/SAOC (this section is the list; no assertion requires any of it).**
1. What to Expect: struck cloakroom block, `expectIntro`.
2. Plan Your Visit: invented `planIntro` lede, appended directionsNote sentence, emergency chip label.
3. FAQ: `faqIntro` (struck in her doc), the appended price list under Q10, the invented contact note and its buttons; and the FAQ SEED itself: 12 categories in her doc vs 12 in `lib/data/faq-sections.ts`. The dev may regenerate `content/show-pages/17-faq.json`, `scripts/seed-show-faq.ts` and `faq-sections.ts`; RUNNING the seed is SAOC's Sanity write. A9 fails loudly with `SEED PENDING` until it has run.
4. Exhibitors: invented lede; CtaBand (code, but copy lives in Sanity if held there).
5. /workshops: the "Programme" h2 if Sanity-held and not a Drive heading.
If a Sanity-held string trips a strike-absence assertion before these edits, the lead adds `strikeAbsenceExempt` to the route table and re-freezes `checks.sha256`.

**Skills.** Not read: mode-persuade.md and frontend-design/SKILL.md (the lead asked for both before finalising; not done, flagged), new-work.md (optional). The standard follows the v4 golden and the NOS Design rulings, which already embody the hero treatment.

## 10. Revision 3 (2026-10-25): PG-1 4 owned here, WS-1, crops verdict, test bar, skills

- **PG-1 4 (hero height) is this spec's**, in full: `spec.md` item 1, `standard.json` `hero.pg1`, asserted in A7. It supersedes nos-pagehero's `check-static.mjs:77` and `gate-hero-geometry.mjs:104-105, 107, 119`; the lead retires those.
- **Crops verdict.** V1, V3 and P1 FAIL; PK1 = PK2; pool D1, PK1, PK3, Y1 plus #76 crops >= 2550 wide (S1b 2600, S2c 2600, S3a 2800, S3b 3000, S2a 4400, H4a 2700; H4b 2200 fails need). 19 routes re-mapped with no repeat inside a group (Programme is covered: S3b, S2c, D1, PK3, S2a); 9 cross-group reuses logged. The #76 crops' sharpness is NOT judged by me: the sheet puts them in front of NOS Design. Re-sheet: `.tmp/sandbox/nos-content-standard/crops-d/contact-sheet.html`, rendered in the in-project Fraunces Light and Karla Bold (`app/(marketing)/national-show/og/fonts/`; Karla Regular is not vendored, Bold is the nearest and is a stated approximation), hero 330px at 1440 and 380px at 2056, stacked band 2:1.
- **WS-1.** `.nk-ticket`/`.nk-perf`/`.nk-stamp` stay but only on purchasable ticket cards (`data-ticket-card`, a new hook the dev adds); the TBC pill inside the status card goes, sentences verbatim. **/workshops "Programme" h2:** no Drive document covers /workshops (searched `content/drive-source` and `goldens/sources`; the About and FAQ docs only mention workshops in prose), so it is builder copy: flagged for Lee-Ann's doc, kept as is, listed here.
- **Test bar.** "Testing only, not live" shows only on /tickets/* and the payment step; absent on every route in the table including /conferences (Brad: "a page that's not a tickets page"). The payment-step paths come from SAOC's `fix/testbar-ticket-pages-only` once it merges; until then the gate asserts absence on all table routes and does not probe presence.
- **Skills read now:** `.claude/skills/frontend-design/SKILL.md` (its SAOC override: craft only, no invented tokens or copy) and `.claude/skills/impeccable/reference/craft-floor.md` (bans the eyebrow, side borders > 1px, hard shadows, nested cards, card-of-icons structure; verify contrast, spacing, measure, states). mode-persuade.md still unread. The impeccable detect binary is not installed, so the dev brief must say its mechanical findings will not run.

## 11. Revision 4 (2026-10-25)
PYV facts signed off by NOS Design: Dates, Venue, Host (all `buildShowFacts()`), no Stellenbosch or Cycle fact, TBC omitted, row only at >= 2 real facts; encoded in `route-table.json` `keyFacts` and gated (A7). /exhibitors joins FAQ-NAV (index aside + scroller, same gates). /sponsors EXCLUDED pending NOS Design's golden. frontend-design/SKILL.md read in full: no contradiction with the spec (see spec.md Additions). #76 owns the hero height and 64/48 gap in the lead's plan; this contract keeps the assertions, which pass once the dev has #76 merged (note: PG-1 4 is stated in this spec too; if #76 lands different numbers, the lead re-freezes).

## 12. Revision 6 (2026-10-25): gate fixes from the dev's PYV step 1 (19021879)
1. A8 h1 compare is case-insensitive for the h1 text only (route table `headings.h1CaseInsensitive`). 2. A8 `unmd` strips her single-asterisk italics. 3. A3 allows `components/nos-chrome/nos-nav.(ts|tsx)` (the label lives there). 4. A2 treats `git grep` exit 1 as no match. 5. A2 allows exactly `--doc-aside-top`, `--doc-index-top`, `--doc-scroll-margin` as new custom properties. 6. A3 counts a file as the dev's only when it differs from origin/main AND the #76 tip (`NOS_STD_REF76`, default feat/nos-pagehero) AND the pinned SAOC commit (`NOS_STD_REFSAOC`, default b2cff780); fetch both first.
- **FAQ is 12 categories**, not 13 (counted from the frozen v1.0: General Show information through Policies and visitor information). The lead's 13 and FAQ-NAV's "13 category names" were wrong; spec.md, standard.json and the contract now say 12; the gate counts from the doc, so it never depended on the number.
- **Real header:** 97px, sticky from 780 up, not sticky below 780. So `--doc-index-top` is 97 and the D7 breakpoint is 780, not 700 (spec.md, standard.json, gate comment re-aligned; the gate itself derives from the measured header, so it needed no number change). NOS Design to be told.

## 13. Revision 7 (2026-10-25)
FACTS-1 encoded (standard.json facts, spec.md item 2, A7 `factsGrammar`); hero caps with facts 420 at 1440 and 440 at 2056; D7 scroller top 97 from 780 up and env(safe-area-inset-top,0) below, aside top 100; crops-d sign-off recorded (NOS-DESIGN-SIGNOFF.txt is now in checks.sha256, so A1 also freezes it).

## 14. Revision 8 (2026-10-25): FQ-G1 (the /faq golden, root comms.md lines 2815-2934)
- **h1 ruling (NOS Design (b), minus the lede).** The /faq h1 is "Frequently asked questions" (faqTitle's default), max-width 14ch, `clamp(3rem,1.8rem+3.2vw,4.75rem)`, copy column `min(1080px,62%)` from 1024. Her doc title line "Frequently Asked Questions — National Orchid Show – Western Cape 2027" is the document's own heading and is not rendered; its second half repeats the header lockup, so it is no lede either. The hero holds crumb + h1 + FACTS-1 and has no lede. A8 (`dropBlocks`, `headings.h1`, `noLede`) and A9 assert this; A9's old expectation of her title line is gone.
- **Numbers as figures.** Section h2 = `<span class="num">1.</span>` then the title; question summary = number span, question, 20px +/-. The A8 gate re-inserts the space after a leading "N." (`numberSpans`) because the spans concatenate in textContent.
- **Gated (A9):** Q1 open on load; category 10 has no questions and its intro links "Plan your visit" to /plan-your-visit; at 390 the scroller links have 12px block padding; active index row weight 700; index card max-height calc(100vh - 124px).
- **Owner flag for Lee-Ann's list (SAOC):** FAQ Q2 says the venue is "Hangar 25, Orca Aero Solutions, Stellenbosch Airfield"; the published show data (facts row, header, /tickets) says "The Hangar, Stellenbosch Flying Club". One is wrong. It stays verbatim in the page; neither source is edited here.

## 15. Revision 9 (2026-10-25)
- **Sponsors route un-excluded**; SP-1 encoded (route-table `sp1`/`sp1Sources`, A7 `sp1Checks`). Not asserted because the golden says it waits on data: the filled wall (no `showSponsor` records yet) and the prospectus (D-SP2). **Owner items:** D-SP1 sponsorship email (Lee-Ann's FAQ says 2027national@gmail.com, the old button says info@saoc.co.za; the build uses hers); the prospectus PDF or its text. The "theme h2" source text is not pinned beyond About v1.2; only the theme prose (L7) is asserted.
- **Gate fixes:** gate-standard no longer crashes on a route with no `[data-doc-layout]` (it fails that route and carries on); check-static's `font-family` regex no longer backtracks (tested: `font-family: var(--serif)` passes, `Georgia, serif` trips); the "focus management kept" check is required only once #76 (`NOS_STD_REF76`, default feat/nos-pagehero) is an ancestor of HEAD, and prints a note until then. It will pass once the dev has #76 merged, provided #76's NosRouteScroll or hero still calls `.focus(`.

## 16. Revision 10 (2026-10-25): sponsors review and PV-G1
- Encoded NOS Design's review of dffa1b89 (root comms.md line 2936) and the PV-G1 golden (line 2964 to the end); details in spec.md "/plan-your-visit (PYV-1 + PV-G1)" and "Hero review items". A7 gained: hero serves the route's signed-off crop; P1 radius-0 + 22% mask on the photo box; breadcrumb in every hero; dates nowrap and venue at most 2 lines at 1440 and 2056; `sp1Checks` (no bullets, stacked wall head, 2px Button); `pyvChecks`. A8 gained: PYV nine h2, the venue and emergency strings, `mustAbsentText`.
- **Reversal:** the earlier fix-list item "Show On-site first aid and show duty contact" is withdrawn by PV-G1 (pending copy, not shown). Owner item for SAOC/Lee-Ann: supply that contact and the venue map ("To be Provided").
- **Owner item:** the venue card's pending map pin and site map.
- The strip-tile `naturalWidth` numbers are the dev's to send to NOS Design; A7's sharpness formula covers the hero only.

## 17. Revision 11 (2026-10-25)
- A9: the question summary is 22px at 768 and up and 19px below 768 (FQ-G1 wins over the earlier 22px-everywhere).
- A9 on-load current row: requires SAOC's `DocumentIndex.tsx` first-entry fallback. The gate keys on the source: once `components/ui/DocumentIndex.tsx` contains an `entries[0]` / `index[0]` / `items[0]` fallback, a current row on load (weight 700) is required; before that it prints "PENDING SAOC" and still runs the scroll-spy checks. **A2 pin note:** that SAOC change edits `components/ui/**`, which A2 diffs against `b2cff780`; the lead sets `NOS_STD_REFSAOC` to SAOC's new commit when it lands (check-static.mjs now reads it, no re-freeze needed).

## 18. Revision 12 (2026-10-25): PG-G1 (/programme) and card sharpness
- PG-G1 encoded (route-table `pg`, `pgSources`, `heroCap` 375/396, `layout: board`, `aside: none`; A7 `programmeChecks`). It supersedes PG-1 item 2's "/programme aside is the h2 index" for this route.
- **"Schedule to follow" is sourced** (lead correction): Brad's ticket news of 2026-10-07 (`lib/provisional-figures.ts:477-487`, `lib/data/ticket-presentation.ts:164`). No marker, no owner item (the earlier `data-awaiting-committee-copy` requirement and the workshops-schedule owner item are withdrawn). A7 asserts the row text equals `TICKET_PRODUCTS.workshops.when` and `.meta`, read at gate time. The D-PG1 time-format question stays an owner line for Lee-Ann/SAOC.
- **Card images (P1):** A7 gained `cardImageChecks` for the `.nk-grid` images on /programme and /tickets at 2056@2 (naturalWidth >= box x DPR, cover-aware) and not-lazy above the fold. NOS Design's finding: the Workshops card serves `orchid-violet.jpg-640.webp` into a 421px box (0.76). `/tickets` is probed outside the route table because it is not a content route.
- The hero caps for /programme are the golden's measured 375 (1440) and 396 (2056), not the generic 420/440.

## 19. Revision 13
Workshops row asserted from source (see section 18), the awaiting-committee-copy marker dropped.

## 20. Revision 14 (2026-10-25): SX-G1, LT-1, /exhibitors withheld
- SX-G1 encoded (route-table `sx`, `subnav`, drive range from her standfirst to her fourth paragraph; A7 `sxChecks`), LT-1 (standard.json `hero.longTitleChars` / `longTitleCap`; A7 on every route), /exhibitors `layout: hero-only` (A7 `heroOnlyChecks`).
- **Owner list additions (Lee-Ann, via SAOC):**
  1. **D-SX1:** may we publish the invited-vendor shortlist (her 21 names), labelled as invited? Until she answers the directory stays gated closed (empty state). The lead flips `sx.directory` to `open` in the route table and re-freezes.
  2. **D-SX2:** confirm the spellings in her list ("Carniverous plants", "Rays Retail Nursary"; "Gods Green Gifts" without an apostrophe). Business names have to be right; nothing is corrected by the build.
  3. **Exhibitor entry guide copy:** schedule, classes, entry form, key dates. No source doc exists; the public build shows the hero and contact panel only until she supplies it.
- **Assumptions:** the empty state's statement is read from the `ABSENCE_STATEMENT` constant in the sa-exhibitors page.tsx at gate time (path found by search under `app/`); the /exhibitors contact panel is detected by `[data-contact-panel]`, a `mailto:` link or a form (a hook the dev should add if none matches); the 3000px page-height bound is a heuristic for "hero + contact + index only".
