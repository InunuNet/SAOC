# nos-critique-r10

## F1 - type-scale tokens for nos-structure.css

Main's F18b read three type-scale tokens in `nos-structure.css` with an inline fallback and no
definition anywhere: `var(--fs-sm, 0.875rem)` on `.nk-btn`, `var(--fs-lg, 1.5625rem)` on
`.nk-pool strong`, and `var(--fs-base, 1rem)` on `.nk-pool p`, `.nk-facts dd` and `.nk-visit a`.

- `nos-theme.css`: the `.nos-theme` rule that holds `--fs-body` now declares `--fs-sm: 0.875rem`,
  `--fs-base: 1rem` and `--fs-lg: 1.5625rem`, the values of the nos-v4 golden
  (`plan-your-visit.html` `:root`, lines 38-42). `--fs-xs` (0.8rem, the Codi F2 floor) and
  `--fs-body` (1rem, R14) are unchanged; both deliberately differ from nos-v4.
- `nos-structure.css`: those five uses drop their fallback. Nothing else changes.
- Each defined value equals its old fallback, so nothing moves: the computed font sizes and the
  ticket stub backgrounds at 375 and 1280 match the main baseline.
- The `.nk-stub` `var(--nk-field, var(--primary))` fallback stays. `--nk-field` is not a theme
  token: `components/tickets/keepsake/parts.tsx` sets it inline per product, and the fallback
  guards that setter.
