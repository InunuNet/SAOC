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

import Link from 'next/link';

import { ShowStatusLine } from './ShowStatusLine';

const NAME_SEPARATOR = ' · ';

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

  const names = hidden.map((heading) => heading.toLowerCase()).join(NAME_SEPARATOR);
  const label = pendingLabel?.trim() ? `${pendingLabel.trim()}: ${names}` : names;

  return (
    <div>
      <ShowStatusLine kind="confirmation" status="pending" pendingLabel={label} />
      <p className="mt-3">
        <Link
          href="/contact"
          className="font-sans text-[15px] font-medium text-primary underline underline-offset-4"
        >
          Be the first to know
        </Link>
      </p>
    </div>
  );
}
