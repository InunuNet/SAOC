import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { RouteHero } from '@/components/ui/RouteHero';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { CTASection } from '@/components/ui/CTASection';
import { client } from '@/sanity/lib/client';
import { sanityFetch } from '@/sanity/lib/fetch';
import {
  societyBySlugQuery,
  societySlugsQuery,
  societyUpcomingEventsQuery,
} from '@/sanity/queries';
import {
  SocietyFacts,
  SocietyAbout,
  SocietyCommittee,
  SocietyEvents,
  SocietyDetailsCallout,
} from '@/components/societies';
import type { SanitySociety } from '@/components/societies';
import { upcomingEventsParams } from '@/lib/sast-date';
import { societies as staticSocieties } from '@/lib/data/societies';
import { withholdPlaceholderProse } from '@/lib/data/show-pages';
import { withholdSocietyEstimates } from '@/lib/data/society-withhold';
import { buildSocietyMetadata } from '@/lib/society-metadata';
import type { SanityEvent } from '@/types';

// F1 cms-loop: bound CDN staleness to 60s (no programmatic purge API exists for
// Firebase App Hosting — see docs/f1-cdn-purge-api-findings.md) so a Sanity publish
// propagates within F6's 120s round-trip window. See contracts/cms-loop-f1-cdn-purge.yaml.
export const revalidate = 60;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await sanityFetch<{ slug: string }[]>({
    query: societySlugsQuery,
    tags: ['society', 'sanity'],
  });
  if (slugs && slugs.length > 0) {
    return slugs.filter((s) => s.slug).map((s) => ({ slug: s.slug }));
  }
  // Build-time fallback so SSG works with no Sanity connection. With Sanity configured the
  // hardcoded array is never used: it would resurrect societies hidden with `listed: false`.
  if (client !== null) return [];
  return staticSocieties.map((s) => ({ slug: s.slug ?? slugify(s.name) }));
}

async function getSociety(slug: string): Promise<SanitySociety | null> {
  const doc = await sanityFetch<SanitySociety>({
    query: societyBySlugQuery,
    params: { slug },
    tags: ['society', slug, 'sanity'],
  });
  if (doc) return doc;

  // Static fallback by synthesised slug, only when Sanity is not configured at all.
  if (client !== null) return null;
  const match = staticSocieties.find((s) => (s.slug ?? slugify(s.name)) === slug);
  if (!match) return null;
  return {
    _id: `static-${slug}`,
    name: match.name,
    slug,
    province: match.province ?? null,
    region: match.region ?? null,
    founded: match.founded ?? null,
    meets: match.meet ?? null,
    venue: match.venue ?? null,
    memberCount: match.members ?? null,
    description: null,
    logo: null,
    website: match.websiteUrl ?? null,
    markBadge: null,
    // Static fallback founding years and member counts are our own
    // estimates, not Lee-Ann-sourced or Sanity-sourced data.
    foundedPlaceholder: true,
    memberCountPlaceholder: true,
    // Meeting day/time and venue have not been supplied at all (match.meet/
    // match.venue are unset) — flag so the UI shows "to be confirmed" instead of nothing.
    meetPlaceholder: true,
    venuePlaceholder: true,
  };
}

async function getSocietyEvents(society: SanitySociety): Promise<SanityEvent[]> {
  const events = await sanityFetch<SanityEvent[]>({
    query: societyUpcomingEventsQuery,
    params: { slug: society.slug, ...upcomingEventsParams() },
    tags: ['events', 'sanity'],
  });
  return events ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const society = await getSociety(slug);
  if (!society) notFound();
  return buildSocietyMetadata(society);
}

export default async function SocietyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const society = await getSociety(slug);
  if (!society) notFound();

  const events = await getSocietyEvents(society);
  const detailsUnconfirmed = !society.meets && !society.venue;
  const withhold = withholdPlaceholderProse();
  const shown = withholdSocietyEstimates(society, withhold);

  return (
    <>
      <RouteHero
        route="/societies/[slug]"
        eyebrow={society.province ?? 'SAOC society'}
        heading={society.name}
        lede={society.region ?? undefined}
      />
      <div className="saoc-container space-y-16 py-16">
        <SocietyFacts society={shown} />

        <SocietyAbout society={shown} />

        <SocietyCommittee society={shown} />

        <SocietyEvents societyName={society.name} events={events} />

        {detailsUnconfirmed ? <SocietyDetailsCallout societyName={society.name} /> : null}

        <Link
          href="/societies"
          className="flex min-h-6 items-center font-mono text-[12px] uppercase tracking-[0.18em] text-muted outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
        >
          <span>
            <ArrowIcon direction="back" />
            All societies
          </span>
        </Link>
      </div>

      <CTASection
        eyebrow="Keep exploring"
        heading="Find another society, or reach the council"
        primaryCta={{ href: '/societies', label: 'Find a society' }}
        secondaryCta={{ href: '/contact', label: 'Contact SAOC' }}
      />
    </>
  );
}
