import type { Metadata } from 'next';

import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosShowIndex } from '@/components/nos/NosShowIndex';
import { PresenterList } from '@/components/nos/PresenterSection';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { loadInternationalGuests } from '@/lib/view-models/load-presenters';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// IG-G1 (NOS Design, comms.md 2026-10-25; spec 4.5): one editorial profile per guest, in record order,
// never a card grid. A guest is any profile with a country set and not South Africa, whatever its type,
// so presenters and international nurseries alike; no country, no listing. With no guests the page is
// the hero and the sub-nav: the build's own absence statement and field-label skeleton were builder
// copy (R7) and a placeholder box, and are gone.
export const revalidate = 60;

const PAGE_TITLE = 'International guests';
// Spec 4.5, Purpose.
const LEDE =
  'Profiles of international speakers, judges, exhibitors and researchers attending the Show.';
const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;

export const metadata: Metadata = buildPageMetadata({
  title: 'International Guests and Exhibitors',
  image: nosOgImage('International Guests and Exhibitors — National Orchid Show'),
  description: 'International guests and exhibitors attending the National Orchid Show.',
  path: '/national-show/international-guests',
});

export default async function InternationalGuestsPage() {
  const [guests, showFacts] = await Promise.all([loadInternationalGuests(), loadShowFacts()]);

  return (
    <>
      <NosHero
        route="/national-show/international-guests"
        title={PAGE_TITLE}
        crumbLabel={PAGE_TITLE}
        lede={LEDE}
        facts={heroFactsFromShow(showFacts, FACTS_LABELS)}
        priority
      />

      {guests.length > 0 ? (
        <div className="nos-pr-body">
          <div data-nos-wrap="">
            <PresenterList profiles={guests} level={2} showAppearing />
          </div>
        </div>
      ) : null}
      <NosShowIndex current="/national-show/international-guests" />
    </>
  );
}
