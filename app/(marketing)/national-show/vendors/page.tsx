import type { Metadata } from 'next';
import Link from 'next/link';

import { PageHero } from '@/components/ui/PageHero';
import { VendorEmptyState, VendorGrid, VendorIntro } from '@/components/vendors';
import type { SanityVendorNursery } from '@/components/vendors';
import { sanityFetch } from '@/sanity/lib/fetch';
import { vendorNurseriesQuery } from '@/sanity/queries';

// Bound CDN staleness to 60s, matching every other CMS-backed route on the site.
export const revalidate = 60;

export const metadata: Metadata = { title: 'Exhibiting Nurseries — National Show' };

export default async function VendorsPage() {
  const nurseries = await sanityFetch<SanityVendorNursery[]>({
    query: vendorNurseriesQuery,
    tags: ['vendorNursery', 'sanity'],
  });

  const list = nurseries ?? [];

  return (
    <>
      <PageHero
        image="/images/orchid-yellow.jpg"
        eyebrow="National Show"
        heading="Exhibiting Nurseries"
        lede="Meet the specialist nurseries showcasing their finest orchids at the South African National Orchid Show."
      />

      <div className="mx-auto max-w-[1280px] px-8 py-16 space-y-16">
        <VendorIntro />

        {list.length > 0 ? <VendorGrid nurseries={list} /> : <VendorEmptyState />}

        <p className="font-sans text-[15px] text-ink/80">
          Interested in exhibiting at the 2027 SAOC National Show?{' '}
          <Link href="/national-show/vendors/apply" className="underline hover:text-accent">
            Register as a vendor
          </Link>
          .
        </p>
      </div>
    </>
  );
}
