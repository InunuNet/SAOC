// =============================================================
// NOS — components/show/ShowStatusLine.tsx
// Server Component — ONE existing R11 marker standing for a whole page. In a public build
// the per-row "not yet confirmed" chips are withheld and this line says it once instead.
// It renders the shared StatusMarker, so it is the same marker, not a new chip.
//
// With `items` it is the v4 R11 disclosure: the marker as a one-line chip on a gold surface,
// then a sentence-case list of what the marker covers, then an optional body sentence, a quieter foot line, and any `children` (a closing link
// or button).
// =============================================================

import type { ReactNode } from 'react';

import { StatusMarker, resolveStatusMarker } from './_shared/StatusMarker';

const DEFAULT_SEPARATOR = ' · ';

// Chip-fit ladder so the verbatim label stays on one line inside the 16px-padded surface:
// 10px inline padding at <=700px; tracking 0.06em at 420-700px, 0.02em at 375-419px, 0 below
// 375px. Range syntax, so each boundary is one strict comparison and no fractional width falls
// between two steps. Important: the NOS marker rule in nos-structure.css (.nos-theme [data-...])
// otherwise outranks a plain utility.
const CHIP_FIT_CLASSES = [
  '[@media(max-width:700px)]:[&>p]:!px-[10px]',
  '[@media(width>=420px)_and_(width<=700px)]:[&>p]:!tracking-[0.06em]',
  '[@media(width>=375px)_and_(width<420px)]:[&>p]:!tracking-[0.02em]',
  '[@media(width<375px)]:[&>p]:!tracking-[0]',
].join(' ');

export interface ShowStatusLineProps {
  /** Which marker family to draw: the exhibitor guide's (default) or the visitor pages'. */
  kind?: 'exhibitor' | 'confirmation';
  status: 'pending' | 'research';
  pendingLabel?: string | null;
  researchLabel?: string | null;
  /** What the marker covers, already cased; shown as one sentence under the chip. */
  items?: string[];
  /** A plain sentence under the list: 16px, no pill, border or fill. */
  body?: string;
  /** A quieter closing line under the body: 15px, no text-transform. */
  foot?: string;
  /** What goes between the items; a middle dot by default. */
  separator?: string;
  children?: ReactNode;
}

/** The quieter closing line of the R11 disclosure; also used where no disclosure renders. */
export function ShowStatusFoot({ children }: { children: ReactNode }) {
  return (
    <p data-status-foot="" className="text-[15px] leading-[1.55] text-[var(--ink-500)]">
      {children}
    </p>
  );
}

export function ShowStatusLine({
  kind = 'exhibitor',
  status,
  pendingLabel,
  researchLabel,
  items,
  body,
  foot,
  separator = DEFAULT_SEPARATOR,
  children,
}: ShowStatusLineProps) {
  const inDisclosure = Boolean(items && items.length > 0);
  const marker = (
    <StatusMarker
      kind={kind}
      status={status}
      pendingLabel={pendingLabel}
      researchLabel={researchLabel}
      shortOnNarrow
      shortResearch={inDisclosure}
    />
  );
  if (!items || items.length === 0) return marker;
  const researchWording = status === 'research' ? researchLabel?.trim() : undefined;

  return (
    <div
      data-status-disclosure=""
      role="note"
      aria-label={resolveStatusMarker({ kind, status, pendingLabel, researchLabel })?.label}
      className="grid gap-5 rounded-[16px] bg-[var(--gold)] px-[clamp(20px,3vw,32px)] pb-6 pt-5 shadow-sm [@media(max-width:700px)]:px-4"
    >
      <div className={CHIP_FIT_CLASSES}>{marker}</div>
      <p data-status-list="" className="text-[16px] leading-[1.55] text-[var(--ink-700)]">
        {items.join(separator)}.
      </p>
      {body ? (
        <p data-status-body="" className="text-[16px] leading-[1.55] text-[var(--ink-700)]">
          {body}
        </p>
      ) : null}
      {foot ? <ShowStatusFoot>{foot}</ShowStatusFoot> : null}
      {researchWording ? <ShowStatusFoot>{researchWording}</ShowStatusFoot> : null}
      {children}
    </div>
  );
}
