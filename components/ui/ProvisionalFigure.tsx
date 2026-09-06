import type { ReactNode } from 'react';

/**
 * F1 (refunds-cancellation-terms, M1) — visible marker for an invented, not-yet-
 * council-confirmed figure. Wrap each individual figure (a day threshold, a
 * percentage, a transfer-window count) in its own instance — do not wrap an entire
 * paragraph containing several pooled figures. Mirrors the convention already proven
 * for ticket pricing (`TicketTypeCard`'s `provisional` badge): the literal word
 * "provisional" must be visible text content, not a `title` attribute or CSS
 * pseudo-element, so it survives `renderToStaticMarkup()` with no browser. See
 * .agent/memory/project/specs/refunds-cancellation-terms/goldens/f1-refunds-policy.golden.md §4.
 */
export function ProvisionalFigure({ children }: { children: ReactNode }) {
  return (
    <mark
      data-provisional-figure="true"
      className="bg-primary/10 font-medium text-ink no-underline"
    >
      {children}
      {' '}
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted align-super">
        provisional
      </span>
    </mark>
  );
}
