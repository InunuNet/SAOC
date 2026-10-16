// =============================================================
// NOS — components/nos/EditionCard.tsx
// Server Component. A past edition of the National Show as a typographic card (NOS Design
// R29): the year in the Fraunces numerals role, the title as an h3, then the venue — no
// photograph, no stock flowers. Shared by the hub's Past editions and /national-show/archive.
// Geometry lives in nos-structure.css (`.nos-edition-card`).
// =============================================================

import Link from 'next/link';

import { Badge } from './Badge';

export interface NosEditionCardProps {
  /** Detail page for this edition; omit for a non-linking card. */
  href?: string;
  year: number | string;
  title: string;
  venue?: string;
  /** Short facts rendered as chips, e.g. "1,240 entries". */
  chips?: readonly string[];
  note?: string | null;
}

export function EditionCard({ href, year, title, venue, chips = [], note }: NosEditionCardProps) {
  const body = (
    <>
      <div data-nos-edition-year="" className="nos-edition-year">
        {year}
      </div>
      <h3 data-nos-edition-title="" className="nos-edition-title">
        {title}
      </h3>
      {venue ? (
        <p data-nos-edition-venue="" className="nos-edition-venue">
          {venue}
        </p>
      ) : null}
      {chips.length > 0 ? (
        <div className="nos-edition-chips">
          {chips.map((chip) => (
            <Badge key={chip} tone="purple">
              {chip}
            </Badge>
          ))}
        </div>
      ) : null}
      {note ? <p className="nos-edition-note">{note}</p> : null}
    </>
  );

  if (href) {
    // The card surface is the div; the link fills it edge to edge so its focus ring is the card's.
    return (
      <div data-nos-edition-card="" className="nos-edition-card nos-edition-card--link">
        <Link href={href} className="nos-edition-card-link">
          {body}
        </Link>
      </div>
    );
  }
  return (
    <div data-nos-edition-card="" className="nos-edition-card">
      {body}
    </div>
  );
}
