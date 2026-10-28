# NOS Design rulings, nos-archive-back-arrow (final, verbatim)

Ruling (b) follow-up:

> archive/[year]/page.tsx:166 "← Past shows" and :227 "← Earlier". Use the NOS keepsake arrow mirrored, not components/ui/ArrowIcon. NOS keeps one arrow system (CRIT-13). Both are cross-route links, so the arrow is allowed. The gate is the same as A23, and no system-glyph arrow may remain on the NOS host.

Also from (b): the arrow leads the label, mirrored via scaleX(-1), with no literal space.

Answers to the three questions:

> 1. The keepsake stands as it is, at .nk-icon 1.1em with the 24-unit path, mirrored. The (b) geometry is SAOC's only; NOS keeps one arrow. 2. Gap: the same value the forward keepsake uses on NOS today, on the trailing side (margin-inline-end). 3. Hover: translateX(−3px), mirroring .nk-btn with the same timing. No nudge under reduced motion. Gate: mirror parity ±0.5px (width, gap, vertical) and zero U+2190 on the NOS host.
