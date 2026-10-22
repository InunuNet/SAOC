# nos-faq-public-r57b - public FAQ shows sourced rows only (Codi, owner question O4 of r57; 2026-10-22)

Ruling (Codi, NOS design lead, final authority, verbatim): "Q1 (O4): hide non-confirmed rows in public. Thirteen 'has not been confirmed' answers make the FAQ read as empty. That's my original r57 P2 and the same rule as r56/r64. Public shows only rows with a sourced answer (When, cost, venue), and any FAQ section left empty is hidden. Use the existing R11 gap-notice component and its existing copy once at page level, with no new copy. Preview keeps every row (critique H8; 17 Oct public-mode rule)."
Base: fix/nos-faq-r57 head 6c170c4e (PR #42, not yet merged). Stacked branch fix/nos-faq-public-r57b. No invention; Sanity is read only.

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
One file: `app/(marketing)/national-show/faq/page.tsx`.
1. Move the r57 `wired` block above the derived list (the rule reads it).
2. Replace `visibleFaqs` by: `sortedFaqs` = rows with a question, sorted by `categoryRank`; `isSourced(faq)` = `Boolean(wired[faq._id]) || (faq.status === 'confirmed' && hasFaqAnswer(faq))`; `visibleFaqs` = `sortedFaqs.filter((faq) => !hideUnanswered || (hasFaqAnswer(faq) && isSourced(faq)))`; `withheldCount = sortedFaqs.length - visibleFaqs.length`. `holds` unchanged.
3. The page-level line: draw `<ShowStatusLine ...>` (same props as today) when `!hideUnanswered || withheldCount > 0`.
4. JSON-LD: `faqEntries` keeps deriving from `visibleFaqs`, so it lists only the shown rows (its filter already passes every shown row in public). Nothing else in the file changes. `ShowFaqList`, the CSS and what-to-expect are untouched.
5. `docs/nos-faq-public-r57b.md`: r57b, the rule and its evidence (status field), the wired map, O4, the JSON-LD effect, ShowStatusLine, owner flags.
`goldens/reference-trial.patch` is the architect's trial (page.tsx and the doc), proven green on A3, A7, A8, then reverted. Non-binding.

## Checks
A1 hashes. A2 footprint vs 6c170c4e. A3 static (S1-S6). A4 prettier no dirtier. A5 eslint. A6 tsc. A7 rendered public (D1-D6, X1). A8 rendered preview equals base (V1). `render-baseline.json` is the render of 6c170c4e in both modes. The expected row set is computed live: base wired rows plus rows whose Sanity status is confirmed (read from the public CDN), so a row the committee confirms later is expected to appear.

## Owner notes
- Public JSON-LD for the venue row still carries the Sanity answer text while the page shows the venue name only (a r57 carry-over; JSON-LD answers are unchanged by r57b). Flag for Codi: should the venue JSON-LD answer be the venue name?
- Public hero lede stays hidden (r57 behaviour). The FAQ intro says unconfirmed answers are marked; not shown in public.
- A row returns to the public page when the committee sets its Sanity status to confirmed (or when it gains a wired source). No code change needed.
- Stacked on PR #42: merge it first. If #42 is squash-merged, BASE (6c170c4e) in checks/_lib.mjs must be re-pointed to the squash commit.
