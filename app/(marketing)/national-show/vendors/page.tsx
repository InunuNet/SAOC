import type { Metadata } from 'next';
import Link from 'next/link';

import { Button } from '@/components/nos/Button';
import { CtaBand } from '@/components/nos/CtaBand';
import { NosHero } from '@/components/nos/NosHero';
import { VendorEmptyState, VendorGrid, VendorIntro } from '@/components/vendors';
import type { SanityVendorNursery } from '@/components/vendors';
import { sanityFetch } from '@/sanity/lib/fetch';
import { vendorNurseriesQuery } from '@/sanity/queries';
import { buildPageMetadata } from '@/lib/seo';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

// Description restates the page's own rendered lede below. No Event or Offer markup on any
// vendor route: the flow is invitation-gated, which Google excludes from the event
// experience (M6/B8c).
export const metadata: Metadata = buildPageMetadata({
  title: 'Exhibiting Nurseries — National Show',
  description:
    'Meet the specialist nurseries showcasing their finest orchids at the South African ' +
    'National Orchid Show.',
  path: '/national-show/vendors',
});

// F10 (nos-design-system, M3): borrows the World Orchid Conference's prestige framing
// (research item D) — a curated trade floor of named nurseries, not a bureaucratic listing.
// VendorIntro/VendorGrid/VendorEmptyState are SAOC-owned, untouched, and already re-skin
// through the inherited nos-theme tokens; this page only composes NOS chrome around them.
export default async function VendorsPage() {
  const nurseries = await sanityFetch<SanityVendorNursery[]>({
    query: vendorNurseriesQuery,
    tags: ['vendorNursery', 'sanity'],
  });

  const list = nurseries ?? [];

  return (
    <>
      <NosHero
        image="/images/orchid-violet.jpg"
        eyebrow="National Show"
        title="Exhibiting Nurseries"
        lede="Meet the specialist nurseries showcasing their finest orchids at the South African National Orchid Show."
        priority
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        <VendorIntro />

        {list.length > 0 ? <VendorGrid nurseries={list} /> : <VendorEmptyState />}
      </div>

      <CtaBand
        eyebrow="Trade floor"
        title="Interested in exhibiting at the 2027 SAOC National Show?"
        action={
          <Button as={Link} href="/national-show/vendors/apply" variant="on-dark">
            Register as a vendor
          </Button>
        }
      />
    </>
  );
}
