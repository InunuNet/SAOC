// components/show/nos/show-content-state-internal.ts
//
// INTERNAL. Do not import this module from anywhere except
// components/show/nos/ShowContentState.tsx (unwrap side — the only renderer of a
// ShowPageResult) and lib/data/show-pages.ts (wrap side only, called from
// loadShowPageOrFallback, never re-exported). Sibling to the showPage GatedProse
// wrap/unwrap boundary in components/nos/ (see that module's own header), enforced the
// same two ways, neither trusting the other:
//   1. eslint.config.mjs's `no-restricted-imports` block.
//   2. scripts/checks/assert-content-state-single-consumer.sh — a grep-based CI guard.
//
// F24 (national-show-ia-alignment, M4) — see
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/never-404-fallback.golden.md
// ("The marker must be STRUCTURAL, not author-remembered"). ShowPageResult is opaque so
// that rendering a fallback (or the published branch) and emitting the
// data-nos-content-state marker are the SAME act: there is no way through the type
// system for a route module to reach `.sections`/`.title`/`.isFallback` on the branded
// value and render page content without going through ShowContentState.tsx, which
// emits the marker on both branches from the one discriminant it switches on.
import type { ShowPage, ShowPageResult } from '@/lib/data/show-pages';

/** Called only by lib/data/show-pages.ts, to build the value it hands out publicly. */
export function wrapShowPageResult(page: ShowPage): ShowPageResult {
  return page as unknown as ShowPageResult;
}

/** Called only by components/show/nos/ShowContentState.tsx, to actually render it. */
export function unwrapShowPageResult(value: ShowPageResult): ShowPage {
  return value as unknown as ShowPage;
}
