# NOS — exhibitors page, Codi route r56 (2026-10-22)

`/national-show/exhibitors`, three changes from the NOS Design lead's r56 ruling.

**P1 — open questions are preview-only.** `ExhibitorQuestions` used to render in the public
build too: `publicMode` gated the rows, the steps and the entry form, but not this section.
`page.tsx` now computes `questionsShown = !publicMode && openQuestions.length > 0` and gates both
the section and its "On this page" chip on it, so the public HTML carries neither. In preview
the section is a closed native `<details>`. The existing H2 "Questions for the show committee"
sits inside the `<summary>` (it keeps its id and stays an H2), next to the same chevron, focus
ring and 44px minimum height as the `ExhibitorJumpNav` summary.

**P2 — the exhibitor status pill is sentence case.** A separate rule after the R19 marker block
in `nos-structure.css` sets `letter-spacing: normal; text-transform: none` on
`.nos-theme [data-exhibitor-marker]`, so the pill no longer wraps to two lines at 390px. The R19
block is unchanged, and the visitor-page `[data-confirmation-badge]` stays uppercase until the
design lead extends the ruling.

**P3 — key dates and link targets.** The key-dates note above the table is the one status line,
so the per-row pending pills are dropped. Rows still show a pill when the status is `research`
or `question`. Each "When" cell now shows `row.dateNote` in both builds. The ruling offered
"Date to be confirmed" as a date slot, but that string exists nowhere in the committee copy, so
it was not used (docs/rules/no-invention.md). The three standalone links (Show classes, SAOC
judging standards, Wild Orchids of Southern Africa) are at least 24px tall.

Known limit: if an editor clears `keyDatesNote`, the table has no status line.

Spec: `.agent/memory/project/specs/nos-exhibitors-r56/`.
