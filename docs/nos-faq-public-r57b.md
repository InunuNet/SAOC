# nos-faq-public-r57b - public FAQ shows sourced rows only

Round r57b (stacked on r57). Codi's ruling on owner question O4: a public build hides every FAQ row without a sourced answer, and any section left empty.

## The sourced-row rule
A row is sourced when it is **wired** (r57: answered from a published fact, keyed by showFaq `_id`) or its Sanity `status` is `confirmed`. Both are read from data; no row is named in the rule. Preview keeps every row.
Evidence (Sanity read only, published perspective, 2026-10-22): of 14 rows, `showFaq-general-3` "When is the show?" is `confirmed`; the cost and venue rows are `pending` in Sanity but wired. The other 11 are `pending`.

## Page-level notice
One ShowStatusLine (the R11 marker, the Sanity `pendingLabel`), drawn once before the list when at least one row is withheld. No new copy.

## JSON-LD
The FAQPage node is built from the shown rows, so it lists only the sourced rows.

## Owner flags
Rows return to the public page as the committee confirms them in Sanity (status `confirmed`); nothing here writes Sanity.

## Badge case (H4)
The status pill reads in sentence case with normal tracking: one rule in nos-structure.css after the R19 block covers `[data-confirmation-badge]` and `[data-exhibitor-marker]`. r57's `.nos-faq-answer` rule is removed as redundant.
