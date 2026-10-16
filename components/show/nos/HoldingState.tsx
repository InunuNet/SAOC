// =============================================================
// NOS — components/show/nos/HoldingState.tsx
// Server Component. R76 (launch-weekend F18): what a PUBLIC page shows when the Council has
// supplied no prose for it yet. Instead of a muted "to be confirmed" block the page holds with
// real navigation, built only from parts that already exist:
//
//   - the show facts (Dates / Host / Venue / Cycle),
//   - the page's own absence sentence where it has one,
//   - one card per OTHER leaf of the route's nav-config group (the nav-config label as the
//     link, the nav-config descriptor beneath it; never the route itself),
//   - the existing "Be the first to know" band.
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
import { NAV, type NavLeaf } from '@/components/chrome/nav-config';
import type { ShowFact } from '@/lib/data/show-facts';

const CARDS_EYEBROW = 'Explore the show';
const BAND_EYEBROW = 'Stay informed';
const BAND_TITLE = 'Be the first to know';
const BAND_ACTION = 'Ask the council';
const BAND_HREF = '/contact';

const MEGA = NAV.find((item) => item.type === 'mega');
const GROUPS: readonly { heading: string; links: readonly NavLeaf[] }[] =
  MEGA && MEGA.type === 'mega' && MEGA.lead ? [MEGA.lead.theShow, ...MEGA.columns] : [];

interface HoldingCard {
  href: string;
  label: string;
  descriptor: string;
}

/** The other leaves of the nav-config group `route` belongs to. Throws rather than render a bare card. */
function siblingCards(route: string): HoldingCard[] {
  const group = GROUPS.find((candidate) => candidate.links.some((leaf) => leaf.href === route));
  if (!group) throw new Error(`HoldingState: nav-config has no group for ${route}`);
  return group.links
    .filter((leaf) => leaf.href !== route)
    .map((leaf) => {
      if (!leaf.descriptor)
        throw new Error(`HoldingState: nav-config leaf ${leaf.href} has no descriptor`);
      return { href: leaf.href, label: leaf.label, descriptor: leaf.descriptor };
    });
}

export interface HoldingStateProps {
  /** The route being held; it selects the nav-config group the cards come from. */
  route: string;
  facts: readonly ShowFact[];
  /** The page's own absence sentence, rendered first. */
  statement?: string;
  /** Content kept after the cards (e.g. the WOSA link-out). */
  afterCards?: ReactNode;
  /** Passed straight onto the section: the F24 data-nos-content-state marker. */
  contentState?: string;
}

export function HoldingState({
  route,
  facts,
  statement,
  afterCards,
  contentState,
}: HoldingStateProps) {
  const cards = siblingCards(route);

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
          <h2 className="nos-holding-eyebrow">{CARDS_EYEBROW}</h2>
          <ul data-nos-holding-cards="" className="nos-holding-cards">
            {cards.map((card) => (
              <li key={card.href} data-nos-holding-card="">
                <h3>
                  <Link href={card.href}>
                    {card.label}
                    <span aria-hidden="true" className="nos-holding-arrow">
                      <svg
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </Link>
                </h3>
                <p>{card.descriptor}</p>
              </li>
            ))}
          </ul>
          {afterCards}
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
