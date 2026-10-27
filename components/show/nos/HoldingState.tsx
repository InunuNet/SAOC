// =============================================================
// NOS — components/show/nos/HoldingState.tsx
// Server Component. R76 (launch-weekend F18): what a PUBLIC page shows when the Council has
// supplied no prose for it yet. Instead of a muted "to be confirmed" block the page holds with
// real content, built only from parts that already exist:
//
//   - the show facts (Dates / Host / Venue),
//   - the page's own absence sentence where it has one,
//   - the existing "Be the first to know" band.
//
// There is no related-page list: the full Explore index below every inner route is the one
// list (design-cb rotation ruling 4).
//
// It never renders in beta (withholdPlaceholderProse() is the one switch, owned by the caller).
// The wrapping NosSection carries the F24 data-nos-content-state marker, passed in by the
// caller so the marker's single emitter stays ShowContentState.
// Geometry lives in nos-structure.css (`.nos-holding`).
// =============================================================

import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosSection } from '@/components/nos/NosSection';
import { ShowFacts } from '@/components/nos/ShowFacts';
import type { ShowFact } from '@/lib/data/show-facts';

const BAND_EYEBROW = 'Stay informed';
const BAND_TITLE = 'Be the first to know';
const BAND_ACTION = 'Ask the council';
const BAND_HREF = '/contact';

export interface HoldingStateProps {
  facts: readonly ShowFact[];
  /** The page's own absence sentence, rendered first. */
  statement?: string;
  /** Content kept after the statement (e.g. the WOSA link-out). */
  afterStatement?: ReactNode;
  /** Passed straight onto the section: the F24 data-nos-content-state marker. */
  contentState?: string;
}

export function HoldingState({
  facts,
  statement,
  afterStatement,
  contentState,
}: HoldingStateProps) {
  return (
    <>
      <NosSection
        data-nos-holding=""
        data-nos-content-state={contentState}
        wrapClassName="nos-holding"
      >
        <div className="nos-holding-facts">
          <ShowFacts facts={facts} />
        </div>
        <div className="nos-holding-main">
          {statement ? <p className="nos-holding-statement">{statement}</p> : null}
          {afterStatement}
        </div>
      </NosSection>
      <div data-nos-holding-cta="" className="contents">
        <CtaBand
          eyebrow={BAND_EYEBROW}
          title={BAND_TITLE}
          action={
            <Button as={Link} href={BAND_HREF} variant="on-dark">
              {BAND_ACTION}
            </Button>
          }
        />
      </div>
    </>
  );
}
