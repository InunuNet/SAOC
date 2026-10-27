// One titled group of keepsake tickets on the hub (Thursday evening, Show passes, Programme).
// The heading is the section's accessible name and the anchor target of the hub's own links.

import type { ReactNode } from 'react';

export interface TicketSectionProps {
  id: string;
  title: string;
  // The one-line scope under the title; null renders no node and no gap.
  lede?: string | null;
  columns: 2 | 3;
  // Rendered above the grid: the pool banner on the passes section, the admin test strip.
  lead?: ReactNode;
  // The page's H1 already names this section: render no visible H2 and label the section instead.
  hideHeading?: boolean;
  children: ReactNode;
}

export function TicketSection({
  id,
  title,
  lede = null,
  columns,
  lead,
  hideHeading = false,
  children,
}: TicketSectionProps) {
  const headingId = `${id}-title`;
  return (
    <section
      className="nk-section"
      id={id}
      aria-label={hideHeading ? title : undefined}
      aria-labelledby={hideHeading ? undefined : headingId}
    >
      <div data-nos-wrap="">
        <div className="nk-head">
          {hideHeading ? null : <h2 id={headingId}>{title}</h2>}
          {lede ? <p data-section-lede="">{lede}</p> : null}
        </div>
        {lead}
        <div className={`nk-grid cols-${columns}`}>{children}</div>
      </div>
    </section>
  );
}
