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
//   body   [data-nos-longform-body]   the remaining paragraphs, with one 21:9 image break
//   cta    [data-nos-longform-cta]    Tickets (primary) + Plan your visit (ghost)
//
// DOM order is head, aside, body, cta at every width; from 900px the grid places the aside in
// the left 4fr column beside head and body (7fr). The route renders this inside its own
// NosSection, so the content-state marker (ShowContentState) stays on the section.
// Geometry lives in nos-structure.css (`.nos-longform`).
// =============================================================

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/nos/Button';
import { ShowFacts } from '@/components/nos/ShowFacts';
import { longFormBreakFor } from '@/components/nos/long-form-breaks';
import type { ShowFact } from '@/lib/data/show-facts';

// The break is decorative and below the fold; 21:9 is its box (the aspect-ratio lives in CSS),
// the intrinsic size only reserves the ratio before the image loads.
const BREAK_WIDTH = 2100;
const BREAK_HEIGHT = 900;
const BREAK_SIZES = '(min-width: 900px) 58vw, 100vw';

export interface LongFormPageProps {
  /** The pathname this template renders, e.g. `/national-show/about`; it selects the image break. */
  route: string;
  facts: readonly ShowFact[];
  /** The section heading, where the source copy has one. */
  heading?: string | null;
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
  route,
  facts,
  heading,
  paragraphs,
  pullQuote,
  marker,
  cta = true,
}: LongFormPageProps) {
  const [lede, ...rest] = paragraphs;
  const photo = longFormBreakFor(route);
  const beforeBreak = Math.max(photo.after - 1, 0);

  return (
    <div data-nos-longform="" className="nos-longform">
      <div data-nos-longform-head="" className="nos-longform-head">
        {marker}
        {heading ? <h2>{heading}</h2> : null}
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
        {rest.slice(0, beforeBreak).map((content, index) => (
          <p key={`before-${index}`}>{content}</p>
        ))}
        <div data-nos-image-break="" className="nos-image-break">
          <Image
            src={photo.src}
            alt=""
            width={BREAK_WIDTH}
            height={BREAK_HEIGHT}
            sizes={BREAK_SIZES}
            loading="lazy"
          />
        </div>
        {rest.slice(beforeBreak).map((content, index) => (
          <p key={`after-${index}`}>{content}</p>
        ))}
      </div>

      {cta ? (
        <div data-nos-longform-cta="" className="nos-longform-cta">
          <Button as={Link} href="/national-show/tickets" variant="primary">
            Tickets
          </Button>
          <Button as={Link} href="/national-show/plan-your-visit" variant="ghost">
            Plan your visit
          </Button>
        </div>
      ) : null}
    </div>
  );
}
