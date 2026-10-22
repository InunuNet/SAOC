// =============================================================
// NOS — components/nos/LongFormPage.tsx
// Server Component. R75 (launch-weekend F18): the ONE long-form prose template, shared by
// /about, /what-to-expect, /vendors and /sa-exhibitors. The route supplies the copy verbatim
// (no word added or removed); this component supplies only the shape:
//
//   head   [data-nos-longform-head]   the section h2 (when the page has one) and the lede,
//                                     the first paragraph at the handoff lede role
//   aside  [data-nos-longform-aside]  the show facts, a pull quote where the page names one;
//                                     sticky from 900px, stacked above the body below it
//   body   [data-nos-longform-body]   the remaining paragraphs
//   cta    [data-nos-longform-cta]    Tickets (primary) + Plan your visit (ghost)
//
// DOM order is head, aside, body, cta at every width; from 900px the grid places the aside in
// the left 4fr column beside head and body (7fr). The route renders this inside its own
// NosSection, so the content-state marker (ShowContentState) stays on the section.
// Geometry lives in nos-structure.css (`.nos-longform`).
// =============================================================

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/nos/Button';
import { ShowFacts } from '@/components/nos/ShowFacts';
import type { ShowFact } from '@/lib/data/show-facts';

function sameText(a: string, b: string): boolean {
  const flat = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
  return flat(a) === flat(b);
}

export interface LongFormPageProps {
  facts: readonly ShowFact[];
  /** The section heading, where the source copy has one. */
  heading?: string | null;
  /** The page h1; a heading that only repeats it (case and spacing aside) is not rendered. */
  pageTitle?: string | null;
  /** Inline content of each paragraph, in order; the first is the lede. */
  paragraphs: readonly ReactNode[];
  /** A pull quote for the aside, verbatim from one paragraph of the copy. */
  pullQuote?: string;
  /** A status marker rendered at the head of the section (beta-only notes). */
  marker?: ReactNode;
  /** Tickets + Plan your visit; false where the page keeps its own closing band. */
  cta?: boolean;
}

export function LongFormPage({
  facts,
  heading,
  pageTitle,
  paragraphs,
  pullQuote,
  marker,
  cta = true,
}: LongFormPageProps) {
  const [lede, ...rest] = paragraphs;
  const showHeading = heading && !(pageTitle && sameText(heading, pageTitle));

  return (
    <div data-nos-longform="" className="nos-longform">
      <div data-nos-longform-head="" className="nos-longform-head">
        {marker}
        {showHeading ? <h2>{heading}</h2> : null}
        <p data-nos-longform-lede="" className="nos-longform-lede">
          {lede}
        </p>
      </div>

      <aside data-nos-longform-aside="" className="nos-longform-aside">
        <ShowFacts facts={facts} />
        {pullQuote ? (
          <blockquote data-nos-pullquote="" aria-hidden="true" className="nos-pullquote">
            {pullQuote}
          </blockquote>
        ) : null}
      </aside>

      <div data-nos-longform-body="" className="nos-longform-body">
        {rest.map((content, index) => (
          <p key={`para-${index}`}>{content}</p>
        ))}
      </div>

      {cta ? (
        <div data-nos-longform-cta="" className="nos-longform-cta">
          <Button as={Link} href="/tickets" variant="primary">
            Tickets
          </Button>
          <Button as={Link} href="/plan-your-visit" variant="ghost">
            Plan your visit
          </Button>
        </div>
      ) : null}
    </div>
  );
}
