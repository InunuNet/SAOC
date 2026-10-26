import type { ReactNode } from 'react';

/**
 * F1 (refunds-cancellation-terms, M1) — marker for an invented, not-yet-council-confirmed
 * figure. Wrap each individual figure (a day threshold, a percentage, a transfer-window count)
 * in its own instance — do not wrap an entire paragraph containing several pooled figures.
 * The literal word "provisional" is visible text content, not a `title` attribute or CSS
 * pseudo-element, so it survives `renderToStaticMarkup()` with no browser. It is set in the quiet
 * register (muted, 0.85em, sans, not superscript) beside the dotted underline, because the
 * refunds page body says figures are "marked provisional wherever they appear" (critique
 * decision 2026-10-25, amended). See
 * .agent/memory/project/specs/refunds-cancellation-terms/goldens/f1-refunds-policy.golden.md §4.
 */
export function ProvisionalFigure({ children }: { children: ReactNode }) {
  return (
    <mark
      data-provisional-figure="true"
      className="bg-transparent font-medium text-ink underline decoration-dotted decoration-muted decoration-1 underline-offset-4"
    >
      {children}
      <span className="font-sans text-[0.85em] font-normal text-muted"> (provisional)</span>
    </mark>
  );
}
