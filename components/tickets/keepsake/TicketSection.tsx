// One titled group of keepsake tickets on the hub (Thursday evening, Show passes, Programme).
// The heading is the section's accessible name and the anchor target of the hub's own links.

import type { ReactNode } from 'react';

export interface TicketSectionProps {
  id: string;
  title: string;
  columns: 2 | 3;
  // Rendered above the grid: the pool banner on the passes section, the admin test strip.
  lead?: ReactNode;
  children: ReactNode;
}

export function TicketSection({ id, title, columns, lead, children }: TicketSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section className="nk-section" id={id} aria-labelledby={headingId}>
      <div data-nos-wrap="">
        <div className="nk-head">
          <h2 id={headingId}>{title}</h2>
        </div>
        {lead}
        <div className={`nk-grid cols-${columns}`}>{children}</div>
      </div>
    </section>
  );
}
