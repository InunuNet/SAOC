import type { Metadata } from 'next';

import { heroFactsFromShow, NosHero } from '@/components/nos/NosHero';
import { NosSection } from '@/components/nos/NosSection';
import { VendorApplyForm } from '@/components/vendors';
import { loadShowFacts } from '@/lib/data/show-facts';
import { buildPageMetadata } from '@/lib/seo';
import { nosOgImage } from '@/app/(nos)/national-show/og-image';

// Indexable (this is the public front door of the vendor flow) but carries no Event or Offer
// markup — the flow it leads into is invitation-gated, which Google excludes (M6/B8c).
export const metadata: Metadata = buildPageMetadata({
  title: 'Vendor application',
  image: nosOgImage('Vendor application — National Orchid Show'),
  description:
    'Apply to exhibit as a vendor at the 2027 National Orchid Show. Once the committee ' +
    'reviews and approves your application, we will email you a link to complete your full ' +
    'registration and agreement.',
  path: '/national-show/vendors/apply',
});

const FACTS_LABELS = ['Dates', 'Venue', 'Host'] as const;

// F10 (nos-design-system, M3): applying should feel like an invitation to a curated trade
// floor, not a bureaucratic form (research item D, WOC framing).
export default async function VendorApplyPage() {
  const facts = await loadShowFacts();
  return (
    <>
      <NosHero
        route="/national-show/vendors/apply"
        title="Vendor application"
        crumbLabel="Vendor application"
        facts={heroFactsFromShow(facts, FACTS_LABELS)}
        lede="Apply to exhibit as a vendor at the 2027 National Orchid Show. Once the committee reviews and approves your application, we'll email you a link to complete your full registration and agreement."
        priority
      />

      <NosSection>
        <div className="max-w-4xl">
          <VendorApplyForm />
        </div>
      </NosSection>
    </>
  );
}
