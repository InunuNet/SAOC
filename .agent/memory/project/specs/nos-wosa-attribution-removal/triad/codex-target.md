# Codex QA target — nos-wosa-attribution-removal F1

Placeholder. @dev replaces the content of this file with the actual diff (or
a diff plus short summary) of the two-file change before the gate's codex_qa
assertion runs — `git diff 047d610e -- "app/(marketing)/national-show/about/page.tsx" "app/(marketing)/national-show/what-to-expect/page.tsx"`.

Review brief for whoever/whatever fills this in: confirm the diff removes
only the SAOC/WOSA attribution paragraph (the one bordered `<p>` linking to
`wildorchids.co.za`) and its preceding JSX comment ("WOSA is credited as a
hosted guest...") from both pages, that Lee-Ann's own WOSA sentence on each
page is untouched, and that no other content, styling, or file is affected.
See `.agent/memory/project/specs/nos-wosa-attribution-removal/goldens/f1-wosa-attribution-removal.md`
for the exact before/after text.

This placeholder text itself is not a diff and must not be reviewed as a
pass — the codex_qa assertion only means anything once this file holds the
real change.
