# copy-baseline

Visible-text goldens per template, rendered from contracts/checks/email-shell/fixtures.mts.
`copy-baseline-origin/` is untouched origin/main text; this directory is origin plus Brad's and Codi's rulings only.

Placeholder text: the fixtures carry NO `pendingLabel`, so every "To be confirmed" in these baselines is the FALLBACK string.
In production the pill text is the Sanity `pendingLabel` (live: "To be confirmed by the show committee"), per Codi's pendingLabel ruling in
../design-ruling.md. A fixture that sets `pendingLabel` must be given its own baseline; do not change these to the long label.
Wildcards: ⟦FIRSTAID⟧ (first-aid item), ⟦SEP⟧ (":" or a space).
