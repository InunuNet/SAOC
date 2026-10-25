import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import type { PlanGuideBlock } from '@/components/show/PlanYourVisitGuide';
import { DocumentLayout, type DocumentIndexEntry } from '@/components/ui/DocumentLayout';
import { PLAN_YOUR_VISIT_GUIDE } from '@/content/plan-your-visit/guide';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// The description is a single 161-char sentence, one over the limit, so the page's own intro
// stands in as the lede it is cut back to.
export function generateMetadata(): Metadata {
  return buildPageMetadata({
    title: 'Plan your visit',
    image: nosOgImage('Plan your visit — National Orchid Show'),
    description:
      'Getting to the National Orchid Show: travel from the airports, parking, ' +
      'public transport, where to stay and what else to see while you are in town.',
    path: '/national-show/plan-your-visit',
  });
}

// Lee-Ann's document (Drive: National Show / Plan your Visit, v1.0). Her first line is the page
// title; her third is the hero lede; her fifth is the standfirst. Sentence case for the h1 is
// NOS Design's ruling PYV-1.
const PAGE_TITLE = 'Plan your visit';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;

// Her "Things to see and do" and "Highlights of Cape Town" items are h4 (PYV-1): each group runs
// from its h3 parent to the h3 that follows the group.
const H4_GROUP_END: Readonly<Record<string, string>> = {
  'Things to see and do': 'Plan your Stellenbosch visit',
  'Highlights of Cape Town': 'Plan your Cape Town visit',
};

// Her website notes under "Section 1 – Plan your visit" and "Section 2 – In an emergency",
// word for word (typos included). They sit under the guide's "1. Getting Here" and at its close.
const DESIGNATED_PARKING =
  'Designated Parking for the National Orchid Show will be provided at the Stellenbosch flying club. Please follow the signage from the R44 on arrival instructions will be provided by the Parking Attendants on where to park. Parking is free.';
const E_HAILING =
  'If you plan to use e-hailing services to get to the National Orchid Show please note that they will have a designated drop off and pick up point. This will be provided by the Parking attendants at the venue.';
const VENUE_SENTENCE =
  'The show is held at the hangar at Stellenbosch Flying Club, on the R44 at Stellenbosch Airfield in the Cape Winelands.';
const VENUE_ADDRESS = [
  'The Hangar, Stellenbosch Flying Club',
  'Stellenbosch Airfield',
  'R44',
  'Stellenbosch, 7600',
  'Western Cape',
] as const;
const EMERGENCY_NUMBERS = [
  { label: 'Police (national)', number: '10111' },
  { label: 'Ambulance and fire (national)', number: '10177' },
  { label: 'All emergencies, from a mobile phone', number: '112' },
] as const;
const EMERGENCY_NOTE = 'Works from any mobile, including one with no airtime.';
const FIRST_AID = 'On-site first aid and show duty contact – To be provided';

const INLINE = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\((https?:[^)]+)\)/g;

interface GuideSection {
  id: string;
  title: string;
  blocks: PlanGuideBlock[];
}

function slugOf(heading: string): string {
  return heading
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const [, bold, italic, label, url] = match;
    if (bold !== undefined) {
      nodes.push(<strong key={match.index}>{bold}</strong>);
    } else if (italic !== undefined) {
      nodes.push(<em key={match.index}>{italic}</em>);
    } else {
      nodes.push(
        <a key={match.index} href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

/** Her document in three parts: the lines before "1.", the numbered sections, and nothing else. */
function splitGuide(blocks: readonly PlanGuideBlock[]) {
  const [lede, standfirst, ...rest] = blocks;
  if (lede?.kind !== 'lead' || standfirst?.kind !== 'lead') {
    throw new Error('Plan your visit guide: the first two blocks must be her lede and standfirst');
  }
  const intro: PlanGuideBlock[] = [];
  const sections: GuideSection[] = [];
  for (const block of rest) {
    if (block.kind === 'h2') {
      sections.push({ id: slugOf(block.text), title: block.text, blocks: [] });
    } else if (sections.length === 0) {
      intro.push(block);
    } else {
      sections[sections.length - 1].blocks.push(block);
    }
  }
  return { lede: lede.text, standfirst: standfirst.text, intro, sections };
}

function renderBlocks(blocks: readonly PlanGuideBlock[]): ReactNode[] {
  let h4Until: string | null = null;
  return blocks.map((block, index): ReactNode => {
    switch (block.kind) {
      case 'h3': {
        if (h4Until !== null && block.text !== h4Until) {
          return (
            <h4 key={index} className="doc-h4">
              {block.text}
            </h4>
          );
        }
        h4Until = H4_GROUP_END[block.text] ?? null;
        return (
          <h3 key={index} className="doc-h3">
            {block.text}
          </h3>
        );
      }
      case 'lead':
        return (
          <p key={index} className="doc-lead">
            {block.text}
          </p>
        );
      case 'p':
        return <p key={index}>{renderInline(block.text)}</p>;
      case 'list':
        return (
          <ul key={index}>
            {block.items.map((item, position) => (
              <li key={item}>
                {position > 0 ? ' ' : null}
                {renderInline(item)}
              </li>
            ))}
          </ul>
        );
      case 'h2':
        throw new Error('Plan your visit guide: an h2 reached the block renderer');
    }
  });
}

function VenueNotes() {
  return (
    <>
      <p>{DESIGNATED_PARKING}</p>
      <p>{E_HAILING}</p>
      <p>{VENUE_SENTENCE}</p>
      <address className="doc-address">
        {VENUE_ADDRESS.map((line, index) => (
          <span key={line}>
            {index > 0 ? <br /> : null}
            {line}
          </span>
        ))}
      </address>
    </>
  );
}

function EmergencyNotes() {
  return (
    <>
      <dl className="doc-numbers" aria-label="In an emergency">
        {EMERGENCY_NUMBERS.map(({ label, number }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <a href={`tel:${number}`}>{number}</a>
            </dd>
          </div>
        ))}
      </dl>
      <p>{EMERGENCY_NOTE}</p>
      <p>{FIRST_AID}</p>
    </>
  );
}

export default async function PlanYourVisitPage() {
  const showFacts = await loadShowFacts();
  const guide = splitGuide(PLAN_YOUR_VISIT_GUIDE);
  const index: DocumentIndexEntry[] = guide.sections.map(({ id, title }) => ({ id, label: title }));
  const lastSection = guide.sections.length - 1;

  return (
    <>
      <NosHero
        route="/national-show/plan-your-visit"
        title={PAGE_TITLE}
        lede={guide.lede}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        priority
      />

      <DocumentLayout index={index}>
        <div className="doc-prose">
          <p className="doc-standfirst">{guide.standfirst}</p>
          {renderBlocks(guide.intro)}
        </div>
        {guide.sections.map((section, position) => (
          <section key={section.id} className="doc-section" aria-labelledby={section.id}>
            <div className="doc-prose">
              <h2 id={section.id} className="doc-h2">
                {section.title}
              </h2>
              {position === 0 ? <VenueNotes /> : null}
              {renderBlocks(section.blocks)}
              {position === lastSection ? <EmergencyNotes /> : null}
            </div>
          </section>
        ))}
      </DocumentLayout>
    </>
  );
}
