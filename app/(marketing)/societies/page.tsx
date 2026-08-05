import { Suspense } from 'react';
import type { Metadata } from 'next';

import { PageHero } from '@/components/ui/PageHero';
import { SocietiesClient } from './SocietiesClient';
import type { SanitySociety } from '@/components/societies';
import { sanityFetch } from '@/sanity/lib/fetch';
import { societyListQuery } from '@/sanity/queries';
import { societies as staticSocieties } from '@/lib/data/societies';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

export const metadata: Metadata = { title: 'Affiliated Societies' };

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default async function SocietiesPage() {
  const sanityList = await sanityFetch<SanitySociety[]>({
    query: societyListQuery,
    tags: ['society', 'sanity'],
  });

  const societies: SanitySociety[] =
    sanityList && sanityList.length > 0
      ? sanityList
      : staticSocieties.map((s, i) => ({
          _id: `static-${i}`,
          name: s.name,
          slug: s.slug ?? slugify(s.name),
          province: s.province ?? null,
          region: s.region ?? null,
          founded: s.founded ?? null,
          meets: s.meet ?? null,
          venue: s.venue ?? null,
          memberCount: s.members ?? null,
          description: null,
          logo: null,
          website: s.websiteUrl ?? null,
          markBadge: null,
        }));

  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="Affiliated societies"
        heading="Find an orchid society near you"
        lede="21 societies across South Africa — growing, showing, and judging together since 1968."
      />
      <div className="mx-auto max-w-[1280px] px-8 py-16">
        <Suspense fallback={null}>
          <SocietiesClient societies={societies} />
        </Suspense>
      </div>
    </>
  );
}
