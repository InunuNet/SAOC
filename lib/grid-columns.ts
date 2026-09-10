// lib/grid-columns.ts
//
// R13 — the grid orphan rule, DERIVED at runtime, never a hardcoded column class.
// See .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/grid-orphan-rule.golden.md.
//
// For `n` items in `c` columns: `n mod c != 1` when `n > c`; choose the largest `c` up
// to 4 that satisfies it; `n == c` takes `c`. When no `c` in 4..3 avoids the orphan
// (n ≡ 1 mod 12, n > 4 — i.e. 13, 25, 37, …), the content ceiling is kept and the FINAL
// CARD SPANS the remainder, so the grid never leaves a partial row of dead cells beside
// a lone card.
//
// This is the ONLY file permitted to contain a `grid-cols-` literal — Tailwind v4 scans
// source for complete class names, so a template literal like `grid-cols-${c}` produces
// no CSS. Consumers import COLUMN_CLASS / SPAN_CLASS, never build the string themselves.

export type GridColumns = 1 | 2 | 3 | 4;

export interface GridLayout {
  columns: GridColumns;
  finalCardSpans: GridColumns;
}

// Search floor is 3, never 2 — R13 binds at c >= 3; c = 2 is exempt by ruling (a
// two-column grid reads as a list more than a grid, and a lone empty cell there is
// mild). This constant is what G6 pins: a future edit that widens the search range
// downward would silently extend the rule to two columns.
const ORPHAN_SEARCH_FLOOR = 3;
const MAX_COLUMNS = 4;

export const COLUMN_CLASS: Record<GridColumns, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
};

export const SPAN_CLASS: Record<GridColumns, string> = {
  1: 'lg:col-span-1',
  2: 'lg:col-span-2',
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
};

/**
 * Pure. No DOM, no config, no side effects. Never throws — n = 0 (an empty listing)
 * returns { columns: 1, finalCardSpans: 1 }; the caller renders its empty state instead
 * of a grid, but the function stays total.
 */
export function resolveGridLayout(n: number): GridLayout {
  if (n < ORPHAN_SEARCH_FLOOR) {
    const columns = (n > 0 ? n : 1) as GridColumns;
    return { columns, finalCardSpans: 1 };
  }

  // `n == c` takes `c` — you never have more columns than items. Without this cap,
  // n = 2 would fall through the loop below with c starting at min(4, n) = 2 anyway,
  // but n = 3 must not be pushed to a wider ceiling than its own count.
  const ceiling = Math.min(MAX_COLUMNS, n) as GridColumns;

  for (let c = ceiling; c >= ORPHAN_SEARCH_FLOOR; c--) {
    if (n <= c || n % c !== 1) {
      return { columns: c as GridColumns, finalCardSpans: 1 };
    }
  }

  // No c in [ORPHAN_SEARCH_FLOOR, ceiling] avoids the orphan (n ≡ 1 mod every
  // candidate — the n ≡ 1 (mod 12), n > 4 cases: 13, 25, 37, …). Keep the content
  // ceiling and let the final card span the remainder: three full rows of four plus
  // one full-width card, never a partial row.
  return { columns: ceiling, finalCardSpans: ceiling };
}
