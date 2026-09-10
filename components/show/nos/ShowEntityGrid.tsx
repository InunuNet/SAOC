// =============================================================
// components/show/nos/ShowEntityGrid.tsx
// Server Component — R13's grid orphan rule, applied generically to any listing of
// real-world entities (nurseries, sponsors). Column count is DERIVED from the rendered
// item count via lib/grid-columns.ts's resolveGridLayout — never a hardcoded
// column-count class. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m4/grid-orphan-rule.golden.md.
// =============================================================

import type { ReactNode } from 'react';

import { COLUMN_CLASS, SPAN_CLASS, resolveGridLayout } from '@/lib/grid-columns';

export interface ShowEntityGridProps<T> {
  items: readonly T[];
  itemKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
}

export function ShowEntityGrid<T>({ items, itemKey, renderCard }: ShowEntityGridProps<T>) {
  const { columns, finalCardSpans } = resolveGridLayout(items.length);
  const lastIndex = items.length - 1;
  const isSpanningTieBreak = finalCardSpans > 1;

  return (
    // No hardcoded column-count utility below lg: mobile and tablet stack via flex-col —
    // the only column-count class here comes from lib/grid-columns.ts (D68).
    <ul className={`flex flex-col gap-6 lg:grid ${COLUMN_CLASS[columns]}`}>
      {items.map((item, index) => {
        const isFinal = index === lastIndex;
        // Only the final card in the spanning tie-break case (n = 13, 25, 37, ...) gets
        // a span class, and it is never centred — it fills the row from the grid's own
        // content-box left edge by ordinary block flow, with no auto margins and no
        // justify-self.
        const spanClass = isFinal && isSpanningTieBreak ? SPAN_CLASS[finalCardSpans] : '';
        return (
          <li key={itemKey(item)} className={spanClass}>
            {renderCard(item)}
          </li>
        );
      })}
    </ul>
  );
}
