// =============================================================
// NOS — components/show/ShowHoldingNote.tsx
// Server Component — the public-build line for visitor logistics. When rows are withheld
// because they are not yet confirmed, ONE R11 line names exactly those rows, followed by the
// existing "Be the first to know" link. It reuses the shared status line, so it is the same
// marker the page draws everywhere else.
//
// It also holds the visitor-info phrases that have no Lee-Ann source (docs/leeann-source/;
// traced in the f8 spec), so a public build can withhold them even on a block Sanity marks
// confirmed.
// =============================================================


import { ShowStatusLine } from './ShowStatusLine';
import { saocUrl } from '@/lib/site-hosts';

const LIST_SEPARATOR = ' · ';

const UNSOURCED_VISITOR_TEXT = [
  'concession rates for pensioners and children',
  'a reduced rate for members of affiliated SAOC societies',
  'Personal photography is normally welcome',
  'tripods, flash near the benches',
];

/** True when a visitor-info body repeats text that no Drive document supports. */
export function carriesUnsourcedVisitorText(body?: string | null): boolean {
  return !!body && UNSOURCED_VISITOR_TEXT.some((phrase) => body.includes(phrase));
}

export interface ShowHoldingNoteProps {
  /** Headings of the withheld rows, in page order. */
  hidden: string[];
  pendingLabel?: string | null;
}

export function ShowHoldingNote({ hidden, pendingLabel }: ShowHoldingNoteProps) {
  if (hidden.length === 0) return null;

  // The first heading as written, the rest lower case, so the list reads as one sentence.
  const items = hidden.map((heading, index) => (index === 0 ? heading : heading.toLowerCase()));

  return (
    <ShowStatusLine
      kind="confirmation"
      status="pending"
      pendingLabel={pendingLabel}
      items={items}
      separator={LIST_SEPARATOR}
    >
      <p>
        <a
          href={saocUrl('/contact')}
          className="inline-flex min-h-[44px] items-center font-sans text-[15px] font-medium text-primary underline decoration-[var(--green-1)] decoration-2 underline-offset-4"
        >
          Be the first to know
        </a>
      </p>
    </ShowStatusLine>
  );
}
