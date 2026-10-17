// =============================================================
// NOS — components/show/ShowStatusLine.tsx
// Server Component — ONE existing R11 marker standing for a whole page. In a public build
// the per-row "not yet confirmed" chips are withheld and this line says it once instead.
// It renders the shared StatusMarker, so it is the same marker, not a new chip.
//
// With `items` it is the v4 R11 disclosure: the marker as a one-line chip on a gold surface,
// then a sentence-case list of what the marker covers, then any `children` (a closing link).
// =============================================================

import type { ReactNode } from 'react';

import { StatusMarker } from './_shared/StatusMarker';

const DEFAULT_SEPARATOR = ' · ';

export interface ShowStatusLineProps {
  /** Which marker family to draw: the exhibitor guide's (default) or the visitor pages'. */
  kind?: 'exhibitor' | 'confirmation';
  status: 'pending' | 'research';
  pendingLabel?: string | null;
  researchLabel?: string | null;
  /** What the marker covers, already cased; shown as one sentence under the chip. */
  items?: string[];
  /** What goes between the items; a middle dot by default. */
  separator?: string;
  children?: ReactNode;
}

export function ShowStatusLine({
  kind = 'exhibitor',
  status,
  pendingLabel,
  researchLabel,
  items,
  separator = DEFAULT_SEPARATOR,
  children,
}: ShowStatusLineProps) {
  const marker = (
    <StatusMarker
      kind={kind}
      status={status}
      pendingLabel={pendingLabel}
      researchLabel={researchLabel}
    />
  );
  if (!items || items.length === 0) return marker;

  return (
    <div
      data-status-disclosure=""
      role="note"
      className="grid gap-5 rounded-[16px] bg-[var(--gold)] px-[clamp(20px,3vw,32px)] pb-6 pt-5 shadow-sm max-[700px]:px-4"
    >
      <div className="max-[700px]:[&>p]:px-[10px] max-[700px]:[&>p]:tracking-[0.06em]">{marker}</div>
      <p data-status-list="" className="text-[16px] leading-[1.55] text-[var(--ink-700)]">
        {items.join(separator)}.
      </p>
      {children}
    </div>
  );
}
