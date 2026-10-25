import type { Metadata } from 'next';

import { Button } from '@/components/nos/Button';
import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { saocUrl } from '@/lib/site-hosts';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// NOS Design ruling (comms.md, SX-G1 block, 2026-10-25) and R7: there is no source document for an
// exhibitor entry guide (neither Lee-Ann's Drive docs nor the dev spec has one), and the page used to
// carry about 10,000px of researched international show practice written by the build. Until she
// supplies the copy (schedule, classes, entry form, key dates) the page is the hero and the contact
// panel only. The Sanity showExhibitorInfo document is untouched and comes back with her copy; the build's own
// intro line ("everything that is not settled yet") is withheld with the rest.
const PAGE_TITLE = 'Exhibitor entry guide';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;
const CONTACT_HEADING = 'Contact';
const CONTACT_LABEL = 'Contact the council';
const ENTRIES_NOT_OPEN = 'Exhibitor entries are not yet open. Contact the council to be notified.';

export const generateMetadata = async (): Promise<Metadata> =>
  buildPageMetadata({
    title: PAGE_TITLE,
    image: nosOgImage(`${PAGE_TITLE} — National Orchid Show`),
    description: ENTRIES_NOT_OPEN,
    path: '/national-show/exhibitors',
  });

export default async function ExhibitorEntryGuidePage() {
  const showFacts = await loadShowFacts();

  return (
    <>
      <NosHero
        route="/national-show/exhibitors"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        priority
      />

      <NosSection aria-labelledby="exhibitor-contact-h">
        <div data-contact-panel="" className="nos-contact-panel">
          <h2 id="exhibitor-contact-h" className="doc-h2">{CONTACT_HEADING}</h2>
          <p>{ENTRIES_NOT_OPEN}</p>
          <Button as="a" href={saocUrl('/contact')} variant="primary">
            {CONTACT_LABEL}
          </Button>
        </div>
      </NosSection>
      <NosShowIndex current="/national-show/exhibitors" />
    </>
  );
}
