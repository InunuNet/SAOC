# nos-award-entries: spec

Branch fix/nos-award-entries off origin/main 3c30e11. Authority: Brad's explicit instruction, relayed by the SAOC lead, 2026-10-28 (goldens/source-council-thread.md, no-invention source 3).

📋 DECISION
"SAOC members who submit plants for judging are not exhibitors." On the NOS host, plant entrants are **Award Entries**; only stand bookers are Retail Vendors / Display Exhibitors. The page at `/national-show/exhibitors` (NOS host `/exhibitors`) becomes **Award Entries**, split into **National Show Awards** and **SAOC Awards**. Terminology and label swaps only. No route, component, file or identifier is renamed; no new design.

🔍 ANALYSIS
- Stale-screenshot finding: Brad's screenshot (title "Exhibitor information", intro "Everything we currently know about entering plants...") is the old Sanity-driven page. origin/main already renders the council-corrected page titled **Plant Entry/Registration** (#143): hard-coded standfirst plus four Lee-Ann FAQ questions in `app/(nos)/national-show/exhibitors/page.tsx`. The retitle therefore replaces "Plant Entry/Registration", not "Exhibitor information". The "Everything we currently know..." intro survives only in `scripts/seed-show-exhibitor-info.ts:320` and the (unrendered) showExhibitorInfo schema (class c).
- Two strings, two places. **Headings** (19:13): `National Show Awards`, `SAOC Awards`. **Definition lines** (19:11): `National Show Award Entries — ...`, `SAOC Award Entries — ...`. Each section = its heading + its definition line, verbatim, nothing else but the marker. Exact strings: goldens/award-copy.json.
- The existing copy (member-eligibility standfirst; Q&A on judging, displays, setup, prize-winners) never says which award type it concerns, so it stays shared and unassigned. Splitting it would be a guess.
- Audit: 35 rows (a=13, b=18, c=4 families): goldens/exhibitor-audit.md (+ .json used by the checks). 10 NOS-lane edits, 11 class-b strings pinned as kept, 10 rows go to SAOC (goldens/sanity-for-saoc.md).
- Cheapest durable proof: static string checks (red on origin/main, shown below) plus one built-site gate on the NOS host reading the captured Sanity fixture.

⚡ SPECIFICATION (dev implements; touches only the files of audit rows R01-R10 and the new doc)
1. `app/(nos)/national-show/exhibitors/page.tsx`
   - `PAGE_TITLE = 'Award Entries'` (drives metadata title, og title, NosHero title and crumb).
   - Layout inside the existing DocumentLayout: (i) the unchanged `STANDFIRST` paragraph (shared intro, unassigned); (ii) two `<section data-award-type="national-show">` and `<section data-award-type="saoc">`, in that order, each = `<h2 className="doc-h2 nos-ex-q">` heading (same className string as the neighbouring question h2s, so whichever of this branch and feat/nos-type-tokens lands first, the other rebases cleanly), one `<p>` with the definition line verbatim, then `<ExhibitorStatusBadge status="pending" pendingLabel="Awaiting official SAOC committee copy" />` (existing component; it already renders the visible marker); (iii) the unchanged four-question `data-qa-list` block after the sections.
   - Source the strings from a const array typed from award-copy.json's shape (heading, definition, awardType). No other text in either section; do not describe either award, its classes, fees, rules or how to enter.
   - Audit swaps R03-R06 (aria-label, FAQ 25 sentence, FAQ 28 question and answer).
2. `components/nos-chrome/nos-nav.ts`: leaf `exhibitors` label `Award Entries` (id and href untouched). NosShowIndex, the gateway and the show index read this label.
3. `components/home/ShowBand.tsx` CTA text, `components/show/ShowSectionNav.tsx` label, `content/national-show-routes.json` label and `scripts/generate-nos-route-manifest.ts` label (R07-R10): `Award Entries`.
4. Nothing else. No CSS file, no rename, no redirect, no Sanity or Drive write, nothing under the SAOC-lane files (A3 enforces).
5. Doc: `docs/nos-award-entries.md` (terminology table a/b/c, the heading-versus-label rule, the Sanity list handed to SAOC, the open decisions).
6. e2e is optional; the gates above are the proof.

✅ RATIONALE
Brad's wording is used character for character, so the only judgement left is placement; the placement rules are in D1-D11 with defaults the checks already encode. Keeping the `exhibitors` path, ids and class-c identifiers avoids route churn (CLAUDE.md: do not restructure routes) and keeps existing nav-links-200, sitemap and hero-photo wiring valid.

➡️ RISKS
- FAQ page (Sanity) will keep "exhibitors" in q25/q28 until SAOC applies S1/S2, so the FAQ and this page disagree for a while. The gate prints these as NOTEs, not failures.
- Existing contracts that quote the old strings: none found by `git grep` for "Plant Entry", "Exhibitor Entry Guide", "More for exhibitors" outside source and the design handoff. `contracts/checks/nos-own-brand-chrome/f3/check-f3-hub-conversion.mjs` mentions an "Exhibitor information" CTA that no page on main renders (already stale).
- File overlap with feat/nos-type-tokens (unmerged): `app/(nos)/national-show/exhibitors/page.tsx` (it adds `nos-card-title` to the question h2) and `components/show/ShowSectionNav.tsx` (different line). Textual conflicts are trivial; no other overlap (vendors/page.tsx, page.tsx, tickets/page.tsx, archive/page.tsx are touched there but not here).
- Class-b "keep" pins would false-fail if Lee-Ann later reworks the vendors page; they pin today's text on purpose.

## Decisions (DECISION NEEDED for NOS Design unless stated; the default is what the checks encode)
| id | question | recommendation (default) |
|---|---|---|
| D1 | Order and heading levels: standfirst, then the two award sections, then the existing Q&A (all h2) | Adopt as specified; the two types come first because Brad's message makes them the page's structure. |
| D2 | "When can exhibitors set up their displays?" is class b (Brad's Display Exhibitors "present orchid displays") | Swap to "Display Exhibitors" in the question and "Display Exhibitor setup" in the answer. Alternative: leave the question as Lee-Ann wrote it. |
| D3 | Grammar of the two class-a sentence swaps: "recognising outstanding orchids and exhibitors." and aria-label "More for exhibitors" | "recognising outstanding Award Entries." and "More for Award Entries". Alternative: ask Lee-Ann for her own sentence; until then the swap uses Brad's term only. |
| D4 | Keep "Exhibitors and vendors" as the /vendors title and nav label, or rename to "Display Exhibitors and Retail Vendors" | Keep: both are stand bookers, which Brad allows. Rename only if Brad asks. |
| D5 | Nav group and home band heading "Exhibit & trade" (a verb) | Keep. |
| D6 | Lee-Ann's /vendors paragraph "Exhibitors will present stunning displays ... compete for prestigious national awards" and the tickets card "I'm exhibiting orchids / Apply to exhibit" (links to /vendors/apply) | Keep: stand copy. Flag to Brad that "compete for national awards" overlaps with Award Entries. |
| D7 | Archive statistic label "Exhibitors" and "{n} exhibitors took part." | Keep until Lee-Ann says what the historical count measured. |
| D8 | `lib/ticket-taxonomy.ts` label "Exhibitor Entry" (unrendered) and Studio option title | Leave the lib label (class c); SAOC may retitle the Studio option (S3), value unchanged. |
| D9 | ticketsPage.ticketIncludesNote "entry to all exhibitor stages" | SAOC to rule; no wording proposed. |
| D10 | Where the "Retail Vendors" and "Display Exhibitors" definition lines (19:11) are shown | Not placed by this feature (the thread does not say). Recommendation: two definition paragraphs at the top of /vendors, verbatim from award-copy.json vendorTerms. |
| D11 | Typographic emphasis of the definition label ("National Show Award Entries") | Plain text, one paragraph (no new style); NOS Design may bold the label later via the type-tokens classes. |

## Gates (contract.yaml) and proof the static checks bite
`node .agent/memory/project/specs/nos-award-entries/checks/check-static.mjs` is red on origin/main (32 failures: every R01-R10 row, the missing sections, the stray "exhibitor" wording) and goes green only with the edits above. `check-diff-scope.mjs` is green on a clean tree and red on any SAOC-lane, protected or CSS file. `gate-render.mjs` (url, content) needs the dev's node_modules and a build; it was syntax-checked here but not run, since the architect worktree has no dependencies and none may be installed. The first dev run is its proof; a dev who finds a defect in a checker reports it, never edits it (checks.sha256 pins them).
