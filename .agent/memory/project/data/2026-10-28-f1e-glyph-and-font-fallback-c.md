# 2026-10-28-f1e-glyph-and-font-fallback-c

(2026-10-28) **F1e glyph and font-fallback checks miss open-dialog states** — check-font-fallback-walk.mjs:23–25 and check-glyph-svg.mjs:51–53 (sdc f1e-critical-path) inspect routes with the search dialog closed, so the SearchOverlay literal → (Manrope has no U+2192) slipped through. The arrows are being fixed in F1a. Follow-up: extend both checks to open the search overlay (and other dialogs or drawers) before walking.
