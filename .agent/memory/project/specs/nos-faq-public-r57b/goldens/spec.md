# nos-faq-public-r57b - public FAQ shows sourced rows only (Codi, owner question O4 of r57; 2026-10-22)

Ruling (Codi, NOS design lead, final authority, verbatim): "Q1 (O4): hide non-confirmed rows in public. Thirteen 'has not been confirmed' answers make the FAQ read as empty. That's my original r57 P2 and the same rule as r56/r64. Public shows only rows with a sourced answer (When, cost, venue), and any FAQ section left empty is hidden. Use the existing R11 gap-notice component and its existing copy once at page level, with no new copy. Preview keeps every row (critique H8; 17 Oct public-mode rule)."
Base: origin/main b1c29304 (r56 #41 and r57 #42 squash-merged). Branch fix/nos-faq-public-r57b. (Facts below were measured on the r57 head 6c170c4e; the FAQ page and components are identical at b1c29304, so render-baseline.json stands.) No invention; Sanity is read only.

## The sourced-row rule, from data
There IS a per-row confirmation field: `showFaq.status` (`pending` | `research` | `confirmed`, schema sanity/schemas/documents/showFaq.ts; selected by `showFaqsQuery`).
Live read (published perspective, 2026-10-22), 14 active rows:
- `confirmed`: showFaq-general-3 "When is the show?" (answer: "Thursday 23 to Sunday 26 September 2027, confirmed by the show committee").
- `pending`, but wired by r57 (answer read from a published fact): showFaq-tickets-1 (cost, hub loader) and showFaq-getting-there-3 (venue name, while `confirmations.venue` is confirmed).
- `pending`, no source: the other 11 (their prose says "has not been confirmed", or carries unsourced text such as the concession rates).
Rule: a row is SOURCED when `wired[faq._id]` is set (r57) OR `faq.status === 'confirmed'` with a non-empty Sanity answer. This is exactly Codi's "When, cost, venue". It names no row. Public (`withholdPlaceholderProse()`) keeps sourced rows; preview keeps all.
Result in public: 3 of 14 rows; sections Getting there (venue), Tickets (cost), General (when). Accessibility and Plant sales have no sourced row and vanish (ShowFaqList already omits a category with no entries; the jump chips follow).
Side effect worth knowing: the unsourced concession rates answer (showFaq-tickets-3), which the public page showed until now, leaves the public page.

## Page-level notice
Existing component and copy: `ShowStatusLine kind="confirmation" status="pending"` with the Sanity `pendingLabel`/`researchLabel`, exactly the line preview already draws (r57 P3). In public it is drawn once before the list, only when at least one row is withheld. Considered and rejected: `ShowHoldingNote` (what-to-expect's public line) because it lower-cases its items, which would mangle the 11 withheld questions ("Cape Town International Airport"), and it would list 11 questions.
If the committee ever wants the line to say WHICH topics are pending, that needs new copy: not written here (gap, owner).

## Dev brief
Files: `app/(marketing)/national-show/faq/page.tsx` and (P3, below) `app/(marketing)/national-show/nos-structure.css`.
1. Move the r57 `wired` block above the derived list (the rule reads it).
2. Replace `visibleFaqs` by: `sortedFaqs` = rows with a question, sorted by `categoryRank`; `isSourced(faq)` = `Boolean(wired[faq._id]) || (faq.status === 'confirmed' && hasFaqAnswer(faq))`; `visibleFaqs` = `sortedFaqs.filter((faq) => !hideUnanswered || (hasFaqAnswer(faq) && isSourced(faq)))`; `withheldCount = sortedFaqs.length - visibleFaqs.length`. `holds` unchanged.
3. The page-level line: draw `<ShowStatusLine ...>` (same props as today) when `!hideUnanswered || withheldCount > 0`.
4. JSON-LD: `faqEntries` keeps deriving from `visibleFaqs`, so it lists only the shown rows (its filter already passes every shown row in public). Nothing else in the file changes. what-to-expect is untouched; `ShowFaqList.tsx` only gains `WiredFaq.text` (J1 plan).
5. `docs/nos-faq-public-r57b.md`: r57b, the rule and its evidence (status field), the wired map, O4, the JSON-LD effect, ShowStatusLine, owner flags.
`goldens/reference-trial.patch` is the architect's trial (page.tsx and the doc), proven green on A3, A7, A8, then reverted. Non-binding.

## P3 - status pill in sentence case (Codi's reversal, H4)
Codi (verbatim): "the public gap notice on what-to-expect still renders its pill as 'TO BE CONFIRMED BY THE SHOW COMMITTEE' in uppercase. I told you to leave [data-confirmation-badge]; I'm reversing that. Make it sentence case with normal tracking too, so public, email and PDF match (H4)."
r56's rule exists at base (nos-structure.css, after the R19 block): `.nos-theme [data-exhibitor-marker] { letter-spacing: normal; text-transform: none; }`. EXTEND it in place, do not add a second one.
In `nos-structure.css` (the R19 block stays untouched; its uppercase and .14em declarations keep their counts):
- r56's selector becomes `.nos-theme [data-confirmation-badge], .nos-theme [data-exhibitor-marker] { letter-spacing: normal; text-transform: none; }` (unlayered, wins over R19 by order).
- Add `@layer base { .nos-theme [data-confirmation-badge], .nos-theme [data-exhibitor-marker] { letter-spacing: normal !important; } }` right after it.
- Remove r57's `.nos-theme .nos-faq-answer [data-confirmation-badge]` rule (redundant); update r56's comment to say it now covers both.
Why the second block is layered and !important: at 375-700px ShowStatusLine's chip-fit ladder sets 0.02-0.06em with !important Tailwind utilities (in @layer utilities). Important declarations from an earlier layer beat later layers, and any unlayered important loses to them; so a plain or unlayered-!important rule left 0.24px at 390 (measured). `@layer base` is earlier than utilities. Verified green with it. Not touched: ShowStatusLine.tsx (the ladder is still wanted by SAOC pages outside .nos-theme).
Prettier: nos-structure.css was 10 dirty lines at base; keep it at 10 (the trial measures 10).
"Sunset Cocktails (Single)" is an owner item: not touched.
Check B1 (rendered, both modes, both widths): every [data-confirmation-badge] in main on /national-show/faq and /national-show/what-to-expect computes text-transform none and letter-spacing normal (0); the public what-to-expect gap notice must draw >= 1 marker (else INFRA). A8 compares marker text via textContent, so the case change is allowed there and B1 pins it.

## P2 - JSON-LD parity (Codi's ruling)
Codi (verbatim): "JSON-LD ruling (P2, fold into r57b): FAQPage acceptedAnswer must match the visible answer word for word. The structured data must reflect what's on the page, and a stale 'not confirmed' venue answer in search results contradicts the page (Google's structured-data policy; critique H4). Render the JSON-LD from the same resolved answer as the visible row: the venue name, and the cost list from the hub loader. Add a gate assertion that each acceptedAnswer.text equals the row's rendered text."
Plan the check matches (lead implements; production code not touched by this spec): WiredFaq gains `text: string`; venue text = venue.name (replaces); cost text = the price labels joined by "; ", appended after the Sanity answer (not replaces); JSON-LD answer = replaces ? text : `${sanityPlain} ${text}`; faqEntries filters on isSourced in both modes (preview JSON-LD lists sourced rows only, not just Sanity-confirmed ones).
J1 (rendered, both modes, both widths): the JSON-LD question set equals the visible sourced rows (wired, or Sanity status confirmed, read live); for each, the row's answer panel text (without the per-row status marker and without the Tickets link/button) and acceptedAnswer.text are tokenised into [A-Za-z0-9]+ words, case-sensitive, and compared as sequences. S8 (static) pins the isSourced filter. D4 and the V1 JSON-LD comparison are removed (they pinned the old Sanity-text answers).
Shots: r57b-faq-public-390/1280.png and r57b-faq-preview-390/1280.png (cost and venue rows open) and r57b-wte-<mode>-<width>.png for the badge pass, in <checkout>/.tmp/ex-shots/.

## Checks
A1 hashes. A2 footprint vs b1c29304 (faq/page.tsx, nos-structure.css, docs, spec dir). A3 static (S1-S7). A4 prettier no dirtier. A5 eslint. A6 tsc. A7 rendered public (D1-D6, B1, X1). A8 rendered preview equals base apart from marker case (V1, B1). `render-baseline.json` is the render of 6c170c4e in both modes. The expected row set is computed live: base wired rows plus rows whose Sanity status is confirmed (read from the public CDN), so a row the committee confirms later is expected to appear.

## Owner notes
- Public JSON-LD for the venue row still carries the Sanity answer text while the page shows the venue name only (a r57 carry-over; JSON-LD answers are unchanged by r57b). Flag for Codi: should the venue JSON-LD answer be the venue name?
- Public hero lede stays hidden (r57 behaviour). The FAQ intro says unconfirmed answers are marked; not shown in public.
- A row returns to the public page when the committee sets its Sanity status to confirmed (or when it gains a wired source). No code change needed.
- BASE in checks/_lib.mjs is origin/main b1c29304; re-point it if the branch is rebased again.
