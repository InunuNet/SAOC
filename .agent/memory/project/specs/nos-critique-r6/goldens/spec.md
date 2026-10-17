# nos-critique-r6 F1 — R65 body text standard 16px / 1.55 (golden spec for @dev)

## Source (NO INVENTION)
- Ruling R65, Brad: "Body text should be standard across both sites", relayed by NOS Design and confirmed by lead saoc-2b.
- The value, verbatim from `design/design_handoff_saoc/design_system_README.md` line 100: "**Sans body — Manrope** — running copy, buttons, nav. 16px base, 1.55 line-height." Karla stays the NOS face (R14); only the size and leading are taken from the handoff.
- Worktree `.tmp/sandbox/critique-r6/` (rebased by the lead onto main 47cf7f1b, F18a landed on 76ad8b98). BASE in `checks/_lib.mjs` is pinned to 47cf7f1b. Re-grepped 2026-10-17 on 47cf7f1b, including `nos-structure.css` and the long-form prose styles: `.nos-longform-body > p` is already 16px / 1.55, `.nos-longform-lede` is a 20px lede, `.nos-holding-cards p` is 16px and inherits the 1.55 root leading, `.nos-edition-venue` / `.nos-edition-note` (15px) are meta lines; none needs a change, and T3-T6 do not scan them. The reference applied to a fresh 47cf7f1b fixture turns the check green (70 files touched), and the routed-count table matches it exactly; ShowPageProse's new 15px sans span and ShowFaqList / ExhibitorKeyDates / RealEmptyListing 17px lines are in the sweep. Earlier re-grep (76ad8b98): `VisitorLinkCard` deleted by F3; `vendors/page.tsx` empty state added. Stacked contracts f2-f5 (R63, R82, SEO, R80; spec-f2-f5.md) share this BASE and one `checks.sha256`; new code they add must itself meet R65 (T4-T6 are rule-based and apply to it). Footprint: f1 may also edit components/nos/LongFormPage.tsx, ShowFacts.tsx and components/show/nos/HoldingState.tsx should the sweep reach them (none does today).

## Footprint (check-footprint.mjs)
Allowed: `components/show/**`, `components/nos/**`, `app/(marketing)/national-show/**` (the .tsx/.css files), `components/vendors/{VendorIntro,VendorGrid,VendorEmptyState}.tsx`, `docs/nos-critique-r6.md`.
Never (enforced): globals.css, the NOS hub `national-show/page.tsx` (incl. its 17px line), `national-show/tickets/**`, `national-show/vendors/{apply,register,payment,photos}/**` and the vendor form components, `components/show/nos/ShowContentState.tsx`, every file outside the allowed trees (home, contact, judging, ui/PageHero, Header, Footer, NosSkipLink, nos-chrome). The nos-theme heading margins and any new nos-theme token are blocked by T1 below.

## 1. nos-theme.css — exactly two lines (check T1, byte-exact)
- `line-height: 1.65;` (the `.nos-theme` root rule) -> `line-height: 1.55;`
- `--fs-body: 1.0625rem;` -> `--fs-body: 1rem;`
Nothing else in the file changes: no new token, no comment edit (stale "17px" comments in the file stay; only these two lines are cleared).

## 2. presenters.css (check T2)
Line-height `1.65` -> `1.55` on `.nos-presenters`. ALSO `--pc-bio-lh: 1.68` -> `1.55` (the presenter bios `.pc-body p, li` read this token and render at 26.88px otherwise; found by the rendered check on a reference build; flagged to the lead because it is a line the ruling did not list). The `var(--fs-body, 1.0625rem)` fallbacks (`.pc-clip`, `.pc-jump-link`) are stale once the token is 1rem: change the fallback to `1rem` (same one-source value, no behaviour change under `.nos-theme`), and the "17px body role" comment to "16px". T2 allows exactly those substitutions (1.65->1.55, `--pc-bio-lh` 1.68->1.55, 1.0625rem->1rem, 17px->16px) and nothing else.

## 3. Components pick up the body role (checks T3, T4, T6, T7)
Decision: size from the existing token, leading explicit.
- Every sans 17px body line becomes `text-[length:var(--fs-body,1rem)] leading-[1.55]` (the `1rem` fallback is required: `VenueCard` is also rendered on /contact, outside `.nos-theme`, where `--fs-body` is undefined).
- The leading is explicit `leading-[1.55]` on each body element, not inherited, because components set their own (`leading-relaxed` = 1.625, `leading-snug` = 1.375) and `VenueCard` renders outside the NOS root. `.nos-theme`'s own 1.55 covers unclassed text.
- Existing 16px body lines keep `text-[16px]` (it is the handoff value) but their `leading-relaxed` becomes `leading-[1.55]` (T6: every non-serif body-role line, i.e. `text-[16px]` or the token, carries exactly one leading, `leading-[1.55]`). ASSUMPTION flagged to the lead: the ruling is "standard", so the 16px lines at 1.625 (about, what-to-expect, faq, exhibitors, VendorIntro, ExhibitorSection and the rest) are normalised too, not only the 17px ones.
- No `1.65` and no `1.0625rem` remain in NOS scope (T3).
- The 17px serifs stay: `JudgingGroupCard` h3 and the `ExhibitorKeyDates` row `th` (T4 allowlist).

Body files that must use `text-[length:var(--fs-body,1rem)]` (T7 minimum counts, in `goldens/small-text-allowlist.json` `routed`): ShowFaqList 1, VenueCard 2, ExhibitorKeyDates 2 (td cells), ExhibitorQuestions 1, RealEmptyListing 1, ExhibitorStageCard 1, plan-your-visit 2, what-to-expect 1, sponsors 1 (its `leading-[1.65]` goes), plus the raised prose in section 4.

## 4. Sub-body sweep: prose raised to 16, labels stay (check T5)
Rule: a sans line at 12-15px is allowed only if it is a label, meta, link or control (`goldens/small-text-allowlist.json`, matched by file + same-line substring) or is a tracked-caps label (`uppercase` / `font-mono`). Anything else is prose and takes the body role (section 3).

Raised to 16 (prose; each is a sentence or phrase of running copy):
| file | was | why prose |
|---|---|---|
| components/show/AccommodationList.tsx | 14 | accommodation note paragraph |
| components/show/TravelRoutes.tsx | 15 and 14 | route description paragraph and option list items |
| components/show/nos/NurseryCard.tsx | 14 and 13 | specialisation and plants-brought sentences |
| components/show/nos/ShowSponsorCard.tsx | 14 | sponsor description |
| components/nos/NosEventCard.tsx | 15 (leading 1.5) | event description |
| components/nos/ShowPageProse.tsx | 15 | page notice sentence beside its label chip |
| app/(marketing)/national-show/workshops/page.tsx | 13 | sessions note card text |
| app/(marketing)/national-show/wosa-conference/page.tsx | 15 | closing paragraph |
| components/vendors/VendorGrid.tsx | 14 x4 | nursery details paragraphs |
| components/vendors/VendorEmptyState.tsx | 15 | empty-state paragraph |
| app/(marketing)/national-show/vendors/page.tsx | 15 | F3 inlined the empty-state paragraph into the route; same text, same rule |

Kept (label / meta / link / control): archive venue value (meta); exhibitors inline links (15); plan-your-visit, AccommodationList, NurseryCard, ShowSponsorCard, VendorGrid website links (13); programme links row (15); EntryFormLink button style (14); ExhibitorKeyDates caption and column headers (12); ExhibitorSteps number chip and when-line meta (12); the R52 FAQ chips (14) and the +/- glyphs (13); ShowSectionNav 13px hints (nav surface; 13 is meta); VenueCard directions link (12); NosHubGroup link tiles (15); RealEmptyListing `dt` labels (13); VendorEmptyState link-button (14); JudgingGroupCard serif italic code (15); every `uppercase` status marker and eyebrow.
Vendor forms (`components/vendors/Vendor*Fieldset`, FormField, tables, Apply/Register forms) are forms, not NOS prose, and are outside this sweep.

## 5. Docs
`docs/nos-critique-r6.md`: cite R65 and quote the README line, state "16px / 1.55", list the two nos-theme lines, the body-role routing decision (size from `--fs-body`, explicit `leading-[1.55]`), and the prose/label classification above. Note /contact's venue card shifts 17 -> 16 because `VenueCard` is shared.

## Checks
Live in `.agent/memory/project/specs/nos-critique-r6/checks/` (run against `.tmp/sandbox/critique-r6`, override with NOS_CR6_ROOT): `check-footprint.mjs`, `check-static.mjs` (T1-T8), `check-rendered.mjs` (computed: `--fs-body` 1rem, root 16px / 24.8px, no prose < 16px, no Karla at 17px, 16px prose at 24.8px line-height, chips 14px, presenters 16px, no overflow; 13 NOS routes at 375 and 1280). `goldens/apply-reference.py` is the mechanical reference implementation: static checks are red on 6af92875 and green on its output.


## File boundary (lead 2026-10-17, after Athanor's overlap check)
Allowed: exactly the files in goldens/f1-footprint.json (33: the 32 the reference touches, plus nos-structure.css, which needs no change today). That includes nos-theme.css (the two lines only), presenters.css, components/show/VenueCard.tsx (incl. the /contact card, previously approved) and the hub page.tsx, whose 16px body paragraphs (`leading-relaxed` -> `leading-[1.55]`) are f1's: one shared edit with f5, different lines. The hub's 12px stats caption is allowlisted as a label. Forbidden: app/globals.css and every SAOC component (F19 sets SAOC to 16/1.55 at globals.css:230), national-show/tickets, tickets/page.tsx and the ticket catalogue (F18b). Anything that would need globals.css goes to the lead, not into this contract. check-footprint.mjs enforces the list exactly.
