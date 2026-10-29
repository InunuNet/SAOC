# nos-landing-v1 - spec (architect, 2026-10-29)

Authority: Lee-Ann's "National Orchid Show Website-Landing Page.docx" v1.0 (Drive 1VIHf90ozX20PleXvzpxl6ztbWPZ4r7A3, md5 fc0c7351...), frozen in goldens/sources/. Brad's rule: her copy renders verbatim, typos included, never corrected. Design authority: existing NOS components and CSS, NOS Design rulings. Designed against main @ 98aa1da1. No product code in this feature's spec.

Machine-readable form of everything below: goldens/classification.json (every non-blank line) and goldens/copy.json (every rendered string, with its source line, raw substring, italics, section, tag, and the decision it depends on).

## 1. Line classification (104 non-blank lines)

| class | lines | meaning |
|---|---|---|
| copy | 73 | rendered verbatim (a mixed line renders only the part that is copy; her " - Copy needs to be provided..." tail is instruction) |
| instruction | 24 | acted on, never rendered (labels, rules, status notes, "Change the wording..." |
| ambiguous | 7 | I made the call and flag it; DECISION NEEDED in section 9 |

Ambiguous lines and how each is classified:
- L44 "The blow needs to be added to this page." Instruction, not rendered. Reading: an editorial note ("blow" for "blurb"); the judging paragraph on L46 is the blurb she means. If it were copy it would be a sentence addressed to a web builder, which no visitor can use. The string is on the forbidden list, so rendering it fails the gate.
- L52 "Planning a visit". Copy (the Section 3 heading). Nothing else in the doc is a bare bold line that is not either a card title or a section label, and her section labels are "Section N".
- L64 blurb with ~~cloakroom~~ struck through. Copy, rendered without the struck word: "Opening hours, admission, food, photography, facilities and accessibility." The strikethrough is her own edit mark, not a typo; this is not a correction of her wording.
- L70 "Past shows" and L72 "Previous editions". Copy (card titles), but gated: no blurb exists and /archive answers 404 while no past show is public. Optional in the verifier; see D6.
- L129 "Register Here - Takes you to a show entry registration form that needs to be provided...". Label is copy, destination does not exist. Not rendered as a control (D4).
- L139 "Logo to be confirmed for SAOC". Instruction; nothing rendered; visual gap.

Oddities she (or SAOC's Drive comment) already flagged, rendered exactly as written: "can be judges" (L46), heading "Ten judging groups" over 13 groups (L74), stat "13 Judging Groups" (L48), and in the deferred footer lines "love to communication" (L143). check-source asserts the golden still carries them; verify-landing fails any page that "corrects" them.

Also kept as written, noted for the record: "Frequently asked Questions" (lower-case "asked"), "Preparation and Drop Off", "Judging begins on Wednesday at 12pm" (no full stop), card blurb "The questions we are asked most, answered" (no full stop).

## 2. Mapping onto app/(nos)/national-show/page.tsx (main @ 98aa1da1)

Adapt content to the existing structure; no route or component restructure. Sections in render order after the change: hero, about, visit, judging (new), entry (new), programme, exhibit, closing. Doc sections 1-4 are consecutive; the two existing sections the doc does not mention (programme, exhibit) are kept, unedited, after them (D8).

| doc | page.tsx today | change |
|---|---|---|
| Section 1 hero H1 (L29) | NosHero title={HUB_HEADING} (:228), HUB_HEADING = SHOW_TITLE (:41) | H1 text becomes "National Orchid Show" (D1) |
| hero lede (L33) | LEDE (:87) inside NosHero lede span (:230) | LEDE value replaced by L33 copy; keep the data-hm-lede span |
| hero theme (L35) | none | one new <p data-lp="hero-theme"> as the first child of the NosHero actions slot, with className nos-hero-lede and data-nos-lede="theme" (existing R70 theme-line pattern) |
| rest of hero | CTAs, price, countdown, facts | untouched ("can remain as is") |
| Section 2 tag line (L41) | h2#hm-about-h = ABOUT_HEADING (:106) | h2 text = tag line |
| Section 2 paragraph (L42) | p.nos-hm-lead = ABOUT_LEAD (:88) | = L42 |
| Section 2 judging paragraph (L46) | p.nos-hm-body = ABOUT_BODY (:89) | = L46 |
| Section 2 stats (L47-49) | none | three stats (visual gap, section 7) |
| Section 2 neighbours | "About the show" link, dates/hours card | untouched |
| Section 3 heading + cards (L52-72) | section visit: h2 "Visit", ul.nos-hm-visit of 5 nav leaves | h2 = "Planning a visit"; four cards About the show / Plan your visit / What to expect / Frequently asked Questions, each h3 + blurb + arrow in the existing ul.nos-hm-rows pattern (as Programme uses); hrefs are the existing nav leaves about-the-show, plan-your-visit, what-to-expect, faq. The Tickets card is dropped (Tickets stays in the hero and closing). Past shows / Previous editions: D6 |
| judging groups (L74-98) | none; JudgingGroupCard exists but is unused | new NosSection data-hm-section="judging": h2 + 13 JudgingGroupCard |
| Section 4 Plant Entry (L101-127) | none; ExhibitorStageCard exists but is unused | new NosSection tone="royal" data-hm-section="entry": h2, 4 ExhibitorStageCard, "Start planning your entry now." line; no Register Here control (D4) |
| closing (L131-135) | CLOSING (:98) in section closing, two Buttons | text = L131 (D5); the Tickets and Plan your visit buttons already carry her labels |
| L141-160 | shared footer | deferred (D7) |

Metadata and JSON-LD: LEDE feeds metadata description (:123) and the Event description (:210), so the old "promises an immersive experience..." wording leaves them too (D10). Title, SHOW_TITLE_EXPANDED and the Event name are not touched.

## 3. Markup contract the gate reads

- Each rendered unit carries data-lp="<unit id>" (ids in copy.json) on the element whose visible text is exactly the unit. Tag expectations (h1/h2/h3/p) are in copy.json.
- Section elements keep data-hm-section: about, visit, programme, exhibit, closing exist; judging and entry are new. The hero sits before the first data-hm-section.
- Italics: a group description wraps exactly her *...* spans in <em> and nothing else. A description she did not italicise has no <em>.
- Groups 11-13 have no description element at all (no empty <p>).
- A stat reads "3 Years" as normalised text; if split into number and label spans, a literal space must separate them.
- Judging group label is "Group N", name is the text after her "Group N: " (D9).
- No data-lp id outside copy.json, no <form>/<button>/<input> in the entry section, every link in the page body root-relative (or SAOC), none pointing at a registration route.

## 4. page.tsx hunks the dev will touch (lines on main @ 98aa1da1; confirm after the WTE v1.2 merge)

| lines | what | conflict note |
|---|---|---|
| :39-41 | HUB_HEADING literal for D1 (SHOW_TITLE import stays: used at :121 and :41's replacement does not need it) | clean |
| :87 | LEDE value | clean |
| :88, :89 | delete ABOUT_LEAD, ABOUT_BODY | clean |
| :92 HOURS | NOT touched | WTE v1.2 edits it |
| :98 CLOSING | delete the constant and replace its use | WTE v1.2 edits this line: a modify-vs-delete conflict, resolve by deleting; the gate also retires main's current CLOSING value (baseline.mjs), so the stale value cannot slip through |
| :105-115 | new copy constants (tag line, theme, card blurbs, stage and group data, stat strings), VISIT_IDS drops 'tickets' and is renamed or reordered to the four cards, ABOUT_HEADING (:106) deleted | clean |
| :230-232 | lede span unchanged shape; add theme <p> in actions (:233 region) | clean |
| :283-309 | about section: h2/lead/body text, stats block | clean |
| :311-328 | visit section: h2, list markup to nos-hm-rows pattern, four cards | clean |
| new, after :328 | judging section, entry section | clean |
| :350-375 | exhibit section untouched; programme (:330-348) untouched; order per D8 | clean |
| :377-387 | closing text only | clean |

Other files: components/nos/JudgingGroupCard.tsx (description optional; data-lp pass-through), components/nos/ExhibitorStageCard.tsx (data-lp pass-through), app/(nos)/national-show/nos-structure.css (only if NOS Design has ruled; tokens only, no new colour/font), optional lib/data/national-show-landing.ts for the copy constants, docs/nos-landing-v1.md. Nothing else (check-static S1 enforces this list).

## 5. Reused components and why

- Group list: JudgingGroupCard, built for "the ten-group judging index on the landing page" and never used. Props today: code, group, name, description. Pass code = the numeral, group = "Group N", name, description. Make description optional (groups 11-13 have none); do not change its look.
- Plant Entry: ExhibitorStageCard (royal ground). `stage="01"` renders "Stage 01", matching her "Stage 01". Leave the confirmation slot empty.
- Cards in Section 3: the Programme rows pattern (ul.nos-hm-rows: h3, p, arrow).
- Theme line: NosHero's existing theme-lede styling (data-nos-lede="theme").

## 6. Copy gaps (do not fill; docs/rules/no-invention.md)

1. Register Here: the show-entry registration form (her L129: request sent to Nitsi and Fiona). No control, no href, no placeholder form. Announce nothing in its place.
2. Past shows / Previous editions: "Copy and photos need to be provided". No blurb, no image.
3. Stay in touch / Explore: see D7.
4. Logo for SAOC (L139): not supplied.
5. Her pages marked "Copy to be provided - Added to google drive" (About, Plan your visit, What to expect, FAQ and the Explore targets): the destination pages already render Drive copy via nos-content-standard; nothing to do on the landing page.

## 7. Visual gaps for NOS Design (named with the closest component; not designed here)

1. Stats trio (3 Years / 13 Judging Groups / 18 National Show Editions): closest is the hero facts dl / ShowFacts. Interim: a plain semantic list, no new tokens.
2. Theme line under the hero lede: NosHero styles the theme lede only inside .nos-hero-about; the hub has no rule. Interim: unstyled beyond the existing class.
3. Judging group grid (13 cards): JudgingGroupCard exists, its grid does not. Interim: single column or the archive edition grid if NOS Design names it.
4. Groups 11-13 cards without a description: card height/rhythm with no body.
5. Plant Entry stage grid on the royal ground and its CTA line without a button.
6. Section 3 card blurbs in the gold section (today's nos-hm-visit has no blurb).
7. Logo "to be confirmed" (L139) and her "Use only 3 fonts" rule (L15) are with NOS Design; not acted on.

## 8. Explore link statuses (L150-160). Instructions, never rendered. Footer is shared chrome (D7).

| her label | her note | NOS route today | in NOS footer today |
|---|---|---|---|
| Tickets | link is good | /national-show/tickets (live) | Explore |
| Programme | copy to be provided | /programme exists; no Drive doc in route-table | Explore |
| Plan your visit | provided in Drive | /plan-your-visit, Drive copy rendered | Explore |
| Exhibitors and vendors | in Drive | /vendors, sa-exhibitors.md | Explore |
| Show sponsors | awaiting final list | /sponsors, no Drive doc | Explore |
| FAQ | in Drive | /faq, Drive copy rendered | Explore |
| Contact | in Drive | /contact, Drive copy rendered | Explore |
| Privacy, Terms, Refunds | in Drive | routes exist; no Drive doc (Privacy and Terms verified by SAOC) | legal row |
| Constitution | in Drive; her URL is beta.saoc.co.za/constitution | SAOC site | footer shows "Memorandum of Incorporation" instead (SAOC) |

Order and labels in the footer already match hers for the first seven; the Constitution entry and the "Stay in touch" wording differ (D7).

## 9. DECISION NEEDED (recommendation first)

D1. Hero H1: her L29 is "National Orchid Show"; SHOW_TITLE (R68, title sweep) is "The National Orchid Show". Recommend: render her L29 on the hub H1 (a new literal, SHOW_TITLE and every constant untouched) because it is explicit hero copy and her naming rule says the name reads "National Orchid Show". Alternative: keep SHOW_TITLE and leave the H1 at "The ..." until the sweep rules on dropping "The". Check impact: nos-content-standard/title-sweep gates that assert H1 = SHOW_TITLE would need to be superseded.
D2. L52 "Planning a visit" as the Section 3 h2, replacing "Visit". Recommend yes (it is her heading). Alternative: keep "Visit" (the nav group name, HM-G1 ruling).
D3. L64: omit the struck word "cloakroom". Recommend omit (her own deletion). Alternative: render it, which shows text she crossed out.
D4. Register Here: render no control and no stand-in until the form exists. Recommend as written; "Start planning your entry now." renders alone. Alternative: a beta-only COPY GAP marker using the existing marker pattern (no new wording).
D5. Section 2 and closing: the two paragraphs (L42, L46) replace the About v1.2 lead and body on the home, and L131 replaces CLOSING. Recommend yes: her sections list exactly those lines, and two closing paragraphs would contradict L131. The About copy stays on /about. Alternative: keep the old paragraphs below hers (longer home, duplicated About copy).
D6. Past shows / Previous editions: recommend render neither on production (no blurb, /archive answers 404 while withheld) and, on the beta preview, only the existing placeholder marker. Alternative: titles as plain links to /archive.
D7. L141-160 (Stay in touch, topic checkboxes "SAOC Monthly Newsletter" / "National Show Updates", Explore, Constitution): shared chrome (components/chrome/footer-data.ts, NewsletterSignup) used by the SAOC site too, and the newsletter-topics-unsub branch is editing it. Recommend defer to SAOC (owner of shared chrome): hand SAOC goldens/copy.json "deferred" plus section 8; diff scope forbids the dev from touching it. Her "Monthly" conflicts with today's "Quarterly bulletin" blurb, which needs her ruling.
D8. Placement of programme and exhibit (doc is silent). Recommend after entry, before closing, unedited. Alternative: between visit and judging.
D9. Group heading rendering: label "Group N" and name as separate elements, her ": " delimiter not rendered. Recommend as written (it is JudgingGroupCard's structure). Alternative: one heading "Group N: Name" (needs a card change).
D10. Meta description and JSON-LD description follow the new lede. Recommend yes (they share LEDE; the old wording is what she asked to remove).

## 10. Naming rule follow-up

The rule (L11-13) is scoped out of this feature beyond the landing page. Every other deviation, file:line on main @ 98aa1da1, is in goldens/naming-sweep-followup.md for the sweep. Lee-Ann's own verbatim lines are listed there as do-not-touch.

## 11. Sequencing and checks that go stale

Dev starts after SAOC's What to Expect v1.2 PR merges; merge main into feat/nos-landing-v1, never rebase. Superseded by this feature, to be retired by the lead (not edited by the dev): nos-content-standard gate-standard.mjs:857 "HM-G1 the hero lede is What to Expect v1.0 section 3 sentence 1" and any hub H1 = SHOW_TITLE assertion (title sweep); contracts/checks/nos-audit-fixes/f2-check-hero-cta.mjs and show-visitor-info rendered checks should be run once to confirm they do not pin the old copy.

## 12. Risks

- The live gate (A7) needs a production build with the Sanity fixture replay; it is written but could not be run before the dev exists (no node_modules in the architect worktree). The pure verifier and both mutation suites ran and pass here.
- data-lp hooks are an implementation contract: a dev who renders the right text without the attribute fails (by design: the check cannot otherwise tell copy from decoration).
- D1 and D5 change what other gates assert; the lead should rule before dispatch.
