// The tickets masthead (goldens/f18b HANDOFF, mock `.masthead`): crumb, the one h1, the live
// countdown and the three show facts on the left, the hero fan on the right, and the "Before you
// visit" row along the foot. Facts, dates and links come from the CMS and nav-config; this file
// holds only the layout. Geometry lives in nos-structure.css under `nk-`.

import Link from 'next/link';
import { Suspense } from 'react';

import { formatRand } from '@/components/nos/cheapest-admission';
import { ShowCountdown } from '@/components/show';
import { TICKET_COPY } from '@/lib/data/ticket-presentation';
import type { ShowFact } from '@/lib/data/show-facts';

import { ArrowIcon } from './parts';
import { TicketFan, type TicketFanProps } from './TicketFan';

const VISIT_LABEL_ID = 'nk-visit-label';
const HEADING_ID = 'page-title';
/** The facts the masthead shows, in the mock's order (the cycle fact belongs to the hub hero). */
const FACT_LABELS: readonly string[] = ['Dates', 'Venue', 'Host'];

export interface VisitLink {
  label: string;
  href: string;
}

export interface TicketsMastheadProps {
  facts: readonly ShowFact[];
  countdownDate: string | null;
  edition: number | null;
  visitLinks: readonly VisitLink[];
  cards: TicketFanProps['cards'];
  // The Day Pass card's effective price; null renders no line (R7).
  dayPassFrom?: number | null;
}

export function TicketsMasthead({
  facts,
  countdownDate,
  edition,
  visitLinks,
  cards,
  dayPassFrom = null,
}: TicketsMastheadProps) {
  const shown = FACT_LABELS.map((label) => facts.find((f) => f.label === label)).filter(
    (f): f is ShowFact => f !== undefined
  );
  return (
    <section
      data-nos-hero="inner"
      data-nos-hero-variant="fan"
      className="nk-masthead nos-on-dark"
      aria-labelledby={HEADING_ID}
    >
      <div data-nos-wrap="" className="nk-masthead-grid">
        <div className="nk-masthead-copy">
          <nav className="nk-crumbs" aria-label="Breadcrumb">
            <Link href="/national-show">National Show</Link>
            <span className="nk-sep" aria-hidden="true" />
            <span aria-current="page">Tickets</span>
          </nav>
          <h1 id={HEADING_ID}>Tickets</h1>
          <Suspense fallback={null}>
            <ShowCountdown countdownDate={countdownDate} edition={edition} />
          </Suspense>
          <dl className="nk-facts">
            {shown.map(({ label, value }) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <TicketFan cards={cards} />
      </div>
      {dayPassFrom !== null ? (
        <div data-nos-wrap="" className="nk-from-row">
          <p data-day-pass-from="" className="nk-from">
            {`${TICKET_COPY.dayPassFrom} ${formatRand(dayPassFrom)}`}
          </p>
        </div>
      ) : null}
      <nav data-nos-wrap="" className="nk-visit" aria-labelledby={VISIT_LABEL_ID}>
        <p className="nk-visit-label" id={VISIT_LABEL_ID}>
          {TICKET_COPY.beforeYouVisit}
        </p>
        <ul>
          {visitLinks.map(({ label, href }) => (
            <li key={href}>
              <Link href={href}>
                {label}
                <ArrowIcon />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
